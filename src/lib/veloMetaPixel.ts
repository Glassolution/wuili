/*
  Pixel da Meta dos anúncios da própria Velo.

  Não confundir com o pixel de cada seller (initMetaPixel/trackPixel em
  metaPixel.ts). Os dois dividem o mesmo `fbq`, por isso tudo aqui vai com
  `trackSingle` só para o ID da Velo, e os sellers só recebem nos IDs deles.

  Eventos:
  - PageView: landing, login/cadastro, /checkout e /assinatura/confirmada
    (MedicaoAnunciosTikTok no App.tsx chama a cada troca de rota).
  - Lead: clique num botão de cadastro da landing.
  - CompleteRegistration: conta criada (e-mail no LoginPage, Google em
    atribuirCadastroOAuth).
  - InitiateCheckout: dentro de startValidaPayCheckout, então vale para o
    /checkout e para o modal de planos do painel.
  - Purchase + Subscribe: chegada em /assinatura/confirmada, com plano e valor
    guardados no InitiateCheckout (uma vez por checkout).
  - Eventos personalizados do funil da landing (landingFunnel.ts).

  O ID do pixel é público (aparece no HTML de qualquer site que usa a Meta).
*/

import { initMetaPixel, trackSinglePixel } from "./metaPixel";

export const VELO_META_PIXEL_ID = "2170225700534826";

const ROTAS_COM_PIXEL = ["/", "/login", "/cadastro", "/checkout", "/assinatura/confirmada"];
const CHAVE_COMPRA_PENDENTE = "velo-meta-compra-pendente";
/** Depois disso a chegada na página de confirmação não é mais desta compra. */
const VALIDADE_COMPRA_MS = 2 * 24 * 60 * 60 * 1000;

type Opcoes = {
  /** Mede fora das rotas do pixel (cadastro pelo Google e checkout aberto no painel). */
  forcar?: boolean;
  /** Mesmo eventID = mesmo evento para a Meta; evita contar duas vezes. */
  eventId?: string;
};

export function rotaTemPixelMeta(pathname: string): boolean {
  return ROTAS_COM_PIXEL.includes(pathname.replace(/\/+$/, "") || "/");
}

export function iniciarMetaVelo(forcar = false): boolean {
  if (typeof window === "undefined") return false;
  if (!forcar && !rotaTemPixelMeta(window.location.pathname)) return false;
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  try {
    initMetaPixel(VELO_META_PIXEL_ID, { seller: false });
    /*
      Desliga o PageView automático que o script da Meta conta a cada troca de
      rota. Sem isso, quem saísse da landing para o painel continuaria contando
      visita da Velo; quem decide as rotas é MedicaoAnunciosTikTok, no App.tsx.
    */
    const fbq = (window as unknown as { fbq?: { disablePushState?: boolean } }).fbq;
    if (fbq) fbq.disablePushState = true;
    return true;
  } catch {
    return false;
  }
}

export function medirMetaVelo(
  event: string,
  params: Record<string, unknown> = {},
  custom = false,
  opcoes: Opcoes = {},
): void {
  if (!iniciarMetaVelo(opcoes.forcar)) return;
  try {
    trackSinglePixel(VELO_META_PIXEL_ID, event, params, custom, opcoes.eventId);
  } catch {
    // Medição não pode interromper a navegação, o cadastro nem o pagamento.
  }
}

/** Clique num botão principal de cadastro da landing. `local` diz qual botão foi. */
export function metaVeloCliqueCadastro(local: string): void {
  medirMetaVelo("Lead", { content_name: local });
}

/** Conta criada. O eventID fixo por conta evita contar o mesmo cadastro duas vezes. */
export function metaVeloCadastroConcluido(userId: string, opcoes: { forcar?: boolean } = {}): void {
  if (!userId) return;
  medirMetaVelo("CompleteRegistration", { content_name: "cadastro_velo", status: true }, false, {
    forcar: opcoes.forcar,
    eventId: `cadastro_${userId}`,
  });
}

type CompraPendente = { plano: string; ciclo: string; valor: number; eventId: string; em: number };

function parametrosDoPlano(plano: string, ciclo: string, valor: number) {
  return {
    content_ids: [`velo_${plano}_${ciclo}`],
    content_name: `Velo ${plano}`,
    content_type: "product",
    num_items: 1,
    value: valor,
    currency: "BRL",
  };
}

/**
 * A pessoa escolheu o plano e está indo para a ValidaPay. Guarda plano e valor
 * para o Purchase, que acontece quando ela volta em /assinatura/confirmada.
 */
export function metaVeloInicioCheckout(dados: { plano: string; ciclo: string; valor: number }): void {
  const valor = Number.isFinite(dados.valor) ? Math.round(dados.valor * 100) / 100 : 0;
  const em = Date.now();
  medirMetaVelo("InitiateCheckout", parametrosDoPlano(dados.plano, dados.ciclo, valor), false, {
    forcar: true,
    eventId: `checkout_${dados.plano}_${em}`,
  });
  try {
    const pendente: CompraPendente = { plano: dados.plano, ciclo: dados.ciclo, valor, eventId: `compra_${dados.plano}_${em}`, em };
    window.localStorage.setItem(CHAVE_COMPRA_PENDENTE, JSON.stringify(pendente));
  } catch {
    // Sem storage não há Purchase com valor; o resto segue.
  }
}

function lerCompraPendente(): CompraPendente | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_COMPRA_PENDENTE);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as Partial<CompraPendente>;
    if (typeof dado.plano !== "string" || typeof dado.ciclo !== "string") return null;
    if (typeof dado.valor !== "number" || typeof dado.eventId !== "string") return null;
    if (typeof dado.em !== "number" || Date.now() - dado.em > VALIDADE_COMPRA_MS) return null;
    return dado as CompraPendente;
  } catch {
    return null;
  }
}

/**
 * Pagamento aprovado (chegada em /assinatura/confirmada). Só dispara se houver
 * um checkout iniciado neste navegador nos últimos 2 dias, e uma vez só:
 * recarregar a página não conta outra compra.
 */
export function metaVeloCompraConcluida(): void {
  if (typeof window === "undefined") return;
  const pendente = lerCompraPendente();
  if (!pendente) return;
  try {
    window.localStorage.removeItem(CHAVE_COMPRA_PENDENTE);
  } catch {
    return; // Sem conseguir apagar, um F5 contaria a compra de novo.
  }
  const params = parametrosDoPlano(pendente.plano, pendente.ciclo, pendente.valor);
  medirMetaVelo("Purchase", params, false, { forcar: true, eventId: pendente.eventId });
  // Vitalício é pagamento único: é compra, não assinatura.
  if (pendente.ciclo === "lifetime") return;
  medirMetaVelo(
    "Subscribe",
    { ...params, predicted_ltv: pendente.ciclo === "annual" ? pendente.valor : pendente.valor * 12 },
    false,
    { forcar: true, eventId: `assinatura_${pendente.eventId}` },
  );
}
