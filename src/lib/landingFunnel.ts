/*
  Medição do funil da landing: visita → clique no botão principal → cadastro.

  Não escolhe ferramenta por você. Cada evento é entregue em três lugares, e
  cada um funciona sozinho:

  1. `window.dataLayer` — é o que o Google Tag Manager lê. Se um dia você colar
     o GTM no index.html, os eventos já estão lá esperando, sem tocar no código.
  2. `gtag` / `fbq` — se o GA4 ou o Pixel da Meta estiverem na página, o evento
     é disparado neles também.
  3. `window.__veloFunil` — uma lista em memória, só para conferir no console do
     próprio navegador que o evento saiu. Não sai da máquina de quem visita.

  Para ligar o GA4 sem instalar nada: defina VITE_GA_MEASUREMENT_ID no ambiente
  (ex.: G-XXXXXXX). O script é carregado depois do `load` da página, então não
  concorre com o primeiro desenho da tela — que é justamente o gargalo no 4G.
*/

import { getVisitorId } from "@/lib/affiliateFunnel";

/*
  Nomes fixos dos eventos. Ficam aqui, num lugar só, porque o relatório do GA4 é
  montado em cima deles: renomear um evento depois significa perder a série
  histórica dele.
*/
export const EVENTOS_LANDING = {
  /** A landing apareceu para alguém. É o denominador de todas as taxas. */
  visita: "landing_visita",
  /** Clique em qualquer botão principal de cadastro. O parâmetro `local` diz qual. */
  cliqueCadastro: "landing_clique_criar_conta",
  /** Clique em "Ver como funciona" (botão ou item de menu). */
  cliqueComoFunciona: "landing_clique_como_funciona",
  /** Clique em "Já tenho conta" — quem já é cliente, separado de quem é novo. */
  cliqueEntrar: "landing_clique_entrar",
  /** A pessoa chegou à tela de cadastro vinda da landing. */
  chegouNoCadastro: "landing_chegou_no_cadastro",
  /** Conta criada com sucesso. É o fim do funil — o número que importa. */
  contaCriada: "landing_conta_criada",
} as const;

export type EventoLanding = (typeof EVENTOS_LANDING)[keyof typeof EVENTOS_LANDING];

type Parametros = Record<string, string | number | boolean | undefined>;

type Janela = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  __veloFunil?: Array<{ evento: string; params: Parametros; em: string }>;
};

const janela = (): Janela | null => (typeof window === "undefined" ? null : (window as Janela));

const GA_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? "").trim();

/**
 * De onde a pessoa veio. Sem isso, saber que 100 pessoas clicaram no botão não
 * diz se o anúncio do Instagram converte melhor que o vídeo do TikTok.
 */
function origem(): Parametros {
  const w = janela();
  if (!w) return {};

  const params = new URLSearchParams(w.location.search);
  const referrer = (() => {
    try {
      return w.document.referrer ? new URL(w.document.referrer).hostname.replace(/^www\./, "") : "";
    } catch {
      return "";
    }
  })();

  return {
    utm_source: params.get("utm_source") ?? undefined,
    utm_medium: params.get("utm_medium") ?? undefined,
    utm_campaign: params.get("utm_campaign") ?? undefined,
    referrer: referrer || undefined,
  };
}

/** Remove chaves vazias: parâmetro `undefined` polui o relatório sem informar nada. */
const limpar = (params: Parametros): Parametros =>
  Object.fromEntries(Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== ""));

/**
 * Registra um evento do funil da landing. Nunca lança: uma falha de medição não
 * pode impedir a pessoa de clicar no botão.
 */
export function medirLanding(evento: EventoLanding, params: Parametros = {}): void {
  const w = janela();
  if (!w) return;

  const completo = limpar({
    ...origem(),
    ...params,
    // Identificador anônimo, o mesmo já usado pelo funil de afiliados: é ele que
    // costura o clique de hoje ao cadastro de amanhã.
    visitante: getVisitorId() ?? undefined,
  });

  try {
    w.__veloFunil = w.__veloFunil ?? [];
    w.__veloFunil.push({ evento, params: completo, em: new Date().toISOString() });

    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: evento, ...completo });

    w.gtag?.("event", evento, completo);
    w.fbq?.("trackCustom", evento, completo);

    if (import.meta.env.DEV) {
      console.debug("[funil-landing]", evento, completo);
    }
  } catch {
    // Bloqueador de anúncio, modo anônimo, storage cheio: seguir em frente.
  }
}

/**
 * Carrega o GA4 depois que a página terminou de carregar, e só se houver um ID
 * configurado. Sem ID, nada é baixado — o custo para quem está no 4G é zero.
 */
export function iniciarMedicaoLanding(): void {
  const w = janela();
  if (!w || !GA_ID) return;
  if (w.document.getElementById("velo-ga4")) return;

  const carregar = () => {
    const script = w.document.createElement("script");
    script.id = "velo-ga4";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    w.document.head.appendChild(script);

    w.dataLayer = w.dataLayer ?? [];
    const gtag = (...args: unknown[]) => {
      w.dataLayer?.push(args);
    };
    w.gtag = w.gtag ?? gtag;
    gtag("js", new Date());
    gtag("config", GA_ID);
  };

  if (w.document.readyState === "complete") carregar();
  else w.addEventListener("load", carregar, { once: true });
}
