/*
  TikTok Pixel dos anúncios da própria Velo.

  Roda só na landing e no cadastro (ROTAS_COM_PIXEL) e no instante em que uma
  conta nova é criada. Lojas, páginas de venda e checkout dos sellers ficam de
  fora: lá quem mede é o Pixel da Meta de cada seller (src/lib/metaPixel.ts).

  O ID do pixel é público (aparece no HTML de qualquer site que usa o TikTok),
  por isso fica no código. O token da Events API, esse sim secreto, nunca vem
  para o navegador.

  A fila abaixo é o código base oficial do TikTok reescrito em TypeScript: os
  eventos chamados antes de o script terminar de baixar ficam guardados e são
  enviados quando ele chega.
*/

import { supabase } from "@/integrations/supabase/client";

export const TIKTOK_PIXEL_ID = "DB1U9MRC77U5HCCK5HA0";

const SCRIPT_SRC = "https://analytics.tiktok.com/i18n/pixel/events.js";
const SCRIPT_ID = "tiktok-pixel-base";

/** Rotas da Velo onde o pixel registra visita. "/auth" só redireciona para /login. */
const ROTAS_COM_PIXEL = ["/", "/login", "/cadastro"];

const METODOS = [
  "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias",
  "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent",
];

type TtqFn = (...args: unknown[]) => void;
type Fila = unknown[] & Record<string, unknown>;
type Ttq = Fila & {
  methods: string[];
  setAndDefer: (alvo: Fila, metodo: string) => void;
  instance: (id: string) => Fila;
  load: (id: string, opcoes?: Record<string, unknown>) => void;
  page: TtqFn;
  track: TtqFn;
  identify: TtqFn;
  _i?: Record<string, Fila>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
};

type Janela = Window & {
  ttq?: Ttq;
  TiktokAnalyticsObject?: string;
  __veloTikTokPixel?: boolean;
};

const janela = (): Janela | null => (typeof window === "undefined" ? null : (window as Janela));

export function rotaTemPixelTikTok(pathname: string): boolean {
  const limpo = pathname.replace(/\/+$/, "") || "/";
  return ROTAS_COM_PIXEL.includes(limpo);
}

/*
  Consentimento. A Velo ainda não tem aviso de cookies; o único sinal de recusa
  que existe hoje é o Global Privacy Control, que navegadores como Brave e
  Firefox enviam quando a pessoa pede para não ser rastreada. Se um dia entrar
  um aviso de cookies, a recusa dele deve ser checada aqui também.
*/
function rastreamentoRecusado(w: Janela): boolean {
  return (w.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

function criarFila(w: Janela): Ttq {
  w.TiktokAnalyticsObject = "ttq";
  const ttq = (w.ttq ?? []) as Ttq;
  w.ttq = ttq;
  ttq.methods = METODOS;
  ttq.setAndDefer = (alvo, metodo) => {
    alvo[metodo] = (...args: unknown[]) => {
      alvo.push([metodo, ...args]);
    };
  };
  for (const metodo of METODOS) ttq.setAndDefer(ttq, metodo);
  ttq.instance = (id) => {
    const instancia = ttq._i?.[id] ?? ([] as unknown as Fila);
    for (const metodo of METODOS) ttq.setAndDefer(instancia, metodo);
    return instancia;
  };
  ttq.load = (id, opcoes) => {
    ttq._i = ttq._i ?? {};
    ttq._i[id] = [] as unknown as Fila;
    ttq._i[id]._u = SCRIPT_SRC;
    ttq._t = ttq._t ?? {};
    ttq._t[id] = Date.now();
    ttq._o = ttq._o ?? {};
    ttq._o[id] = opcoes ?? {};
    const script = w.document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "text/javascript";
    script.async = true;
    script.src = `${SCRIPT_SRC}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
    const primeiro = w.document.getElementsByTagName("script")[0];
    if (primeiro?.parentNode) primeiro.parentNode.insertBefore(script, primeiro);
    else w.document.head.appendChild(script);
  };
  return ttq;
}

/** Se o rastreamento de anúncios pode rodar neste navegador. Vale para o pixel e para o envio pelo servidor. */
export function rastreamentoPermitido(): boolean {
  const w = janela();
  return Boolean(w) && !rastreamentoRecusado(w as Janela);
}

/**
 * Código do evento de cadastro. O pixel e a Events API (função tiktok-events)
 * mandam o mesmo valor, e é por ele que o TikTok junta os dois envios num só.
 */
export function eventIdCadastro(userId: string): string {
  return `cadastro_${userId}`;
}

/**
 * Prepara o pixel uma única vez por carregamento de página. O script é
 * assíncrono e não segura o primeiro desenho da tela. Devolve false quando o
 * pixel não deve rodar.
 */
export function iniciarTikTokPixel(): boolean {
  const w = janela();
  if (!w) return false;
  try {
    if (rastreamentoRecusado(w)) return false;
    if (w.__veloTikTokPixel) return true;
    w.__veloTikTokPixel = true;
    /*
      historyObserver: false desliga a visita automática que o script do TikTok
      conta a cada troca de rota. Sem isso, quem saísse da landing para o painel
      ou para a loja de um seller continuaria gerando PageView da Velo; quem
      decide as rotas é MedicaoAnunciosTikTok, no App.tsx.
    */
    criarFila(w).load(TIKTOK_PIXEL_ID, { historyObserver: false });
    return true;
  } catch {
    return false;
  }
}

/*
  Depois que o script do TikTok chega ele troca os métodos de window.ttq; por
  isso todo envio busca o objeto de novo em vez de guardar uma referência.
*/
function enviar(acao: (ttq: Ttq) => void): void {
  const w = janela();
  if (!w || !iniciarTikTokPixel() || !w.ttq) return;
  try {
    acao(w.ttq);
  } catch {
    // Medição nunca pode atrapalhar a navegação nem o cadastro.
  }
}

/** Visualização de página (PageView). */
export function tiktokVisualizacao(): void {
  enviar((ttq) => ttq.page());
}

/** Clique num botão principal de cadastro. `local` diz qual botão foi. */
export function tiktokCliqueCadastro(local: string): void {
  enviar((ttq) => ttq.track("ClickButton", { content_name: local }));
}

async function sha256(valor: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const bytes = await subtle.digest("SHA-256", new TextEncoder().encode(valor));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/**
 * Conta criada (CompleteRegistration). E-mail e ID vão como hash SHA-256: o
 * TikTok só compara com os dados dele, sem receber o e-mail em texto.
 * O event_id fixo por conta é o mesmo do envio pelo servidor
 * (tiktokCadastroServidor), para o TikTok não contar o cadastro duas vezes.
 */
export async function tiktokCadastroConcluido(usuario: { id: string; email?: string | null }): Promise<void> {
  if (!usuario.id || !iniciarTikTokPixel()) return;
  const [email, externalId] = await Promise.all([
    usuario.email ? sha256(usuario.email.trim().toLowerCase()) : Promise.resolve(null),
    sha256(usuario.id),
  ]);
  enviar((ttq) => {
    const identidade = { ...(email ? { email } : {}), ...(externalId ? { external_id: externalId } : {}) };
    if (Object.keys(identidade).length > 0) ttq.identify(identidade);
    ttq.track("CompleteRegistration", { content_name: "cadastro_velo" }, { event_id: eventIdCadastro(usuario.id) });
  });
}

/**
 * O mesmo cadastro, enviado pelo servidor (Events API). Chega ao TikTok mesmo
 * com bloqueador de anúncio e leva IP e navegador, que o servidor lê da
 * própria requisição. ttclid e cookie _ttp vão junto porque, neste instante,
 * a gravação deles no perfil pode ainda não ter terminado.
 * Nunca lança erro: uma falha aqui não pode atrapalhar o cadastro.
 */
export async function tiktokCadastroServidor(dados: {
  userId: string;
  ttclid?: string | null;
  ttp?: string | null;
}): Promise<void> {
  const w = janela();
  if (!w || !dados.userId || !rastreamentoPermitido()) return;
  try {
    const { error } = await supabase.functions.invoke("tiktok-events", {
      body: {
        action: "complete_registration",
        event_id: eventIdCadastro(dados.userId),
        // Sem a query string: o link do anúncio pode passar do limite da função.
        page_url: `${w.location.origin}${w.location.pathname}`,
        ...(dados.ttclid ? { ttclid: dados.ttclid.slice(0, 500) } : {}),
        ...(dados.ttp ? { ttp: dados.ttp.slice(0, 500) } : {}),
      },
    });
    if (error) console.warn("[medição] cadastro não enviado ao TikTok pelo servidor:", error.message);
  } catch {
    /* medição nunca pode atrapalhar o cadastro */
  }
}

/** Cookie _ttp que o pixel grava no domínio da Velo. Vai para o perfil, para a Events API. */
export function lerCookieTtp(): string | null {
  const w = janela();
  if (!w) return null;
  try {
    const par = w.document.cookie.split("; ").find((item) => item.startsWith("_ttp="));
    return par ? decodeURIComponent(par.slice(5)) : null;
  } catch {
    return null;
  }
}
