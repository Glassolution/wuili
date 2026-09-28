/*
  Carrega o SDK do Mercado Pago sob demanda.

  Antes ele vinha numa <script> fixa no index.html, ou seja: baixado em TODA
  página do site, inclusive na landing, onde ninguém vai digitar cartão. Num
  celular com 4G isso é uma conexão a mais com um domínio externo antes de a
  página aparecer.

  Agora só as telas que tokenizam cartão (checkout e planos) pedem o SDK, e
  pedem no momento em que a tela monta — então, quando a pessoa termina de
  digitar o cartão, ele já está pronto e nada fica mais lento para ela.
*/

const SCRIPT_ID = "mercadopago-sdk-v2";
const SRC = "https://sdk.mercadopago.com/js/v2";

let carregando: Promise<void> | null = null;

type ComMercadoPago = Window & { MercadoPago?: unknown };

/**
 * Resolve quando `window.MercadoPago` estiver disponível. Chamadas repetidas
 * compartilham o mesmo carregamento — o script entra no documento uma vez só.
 */
export function carregarSdkMercadoPago(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("SDK do Mercado Pago só carrega no navegador."));
  }

  if ((window as ComMercadoPago).MercadoPago) return Promise.resolve();
  if (carregando) return carregando;

  carregando = new Promise<void>((resolve, reject) => {
    const existente = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existente ?? document.createElement("script");

    const aoFalhar = () => {
      // Deixa tentar de novo numa próxima chamada: a falha pode ser de rede.
      carregando = null;
      reject(new Error("Não foi possível carregar o Mercado Pago."));
    };

    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", aoFalhar, { once: true });

    if (!existente) {
      script.id = SCRIPT_ID;
      script.src = SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return carregando;
}
