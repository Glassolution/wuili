import { VELO_PLAN_PRICES, type VeloPaidPlanId } from "@/lib/planPricing";

/*
  Oferta de boas-vindas: 30% no plano ANUAL (Base, Pro e Business), só na
  primeira cobrança, para conta criada há menos de 48 horas que nunca pagou.

  Quem aplica o desconto de verdade é o checkout (edge function
  `validapay-checkout`, cupom BOASVINDAS, regra no servidor). Enquanto o
  checkout não estiver pronto, `ativa` fica false e nada aparece na interface:
  não se anuncia desconto que o checkout não cobra.
*/
export const OFERTA_BOAS_VINDAS = {
  ativa: false,
  cupom: "BOASVINDAS",
  percentOff: 30,
  janelaHoras: 48,
  planos: ["base", "pro", "business"] as VeloPaidPlanId[],
} as const;

/*
  Prévia na conta Sandbox: o dono vê o banner e o anual com desconto mesmo com a
  oferta desligada. A compra no Sandbox é ativada sem cobrança, então não há risco
  de anunciar um preço que o checkout não cobra. A contagem de 48h começa quando
  a página carrega (a conta Sandbox é antiga e já teria passado da janela).
*/
const INICIO_DA_PREVIA = Date.now();

/** Fim da janela da oferta (ms), contado da criação da conta (ou do carregamento, na prévia). */
export const fimDaOferta = (contaCriadaEm?: string | null, previa = false) => {
  if (previa) return INICIO_DA_PREVIA + OFERTA_BOAS_VINDAS.janelaHoras * 60 * 60 * 1000;
  if (!contaCriadaEm) return null;
  const inicio = new Date(contaCriadaEm).getTime();
  if (Number.isNaN(inicio)) return null;
  return inicio + OFERTA_BOAS_VINDAS.janelaHoras * 60 * 60 * 1000;
};

/**
 * A oferta aparece para esta pessoa agora? É só a vitrine: a regra que vale é a
 * do servidor, que também confere se a conta nunca pagou nenhum plano.
 */
export const ofertaValendo = ({
  contaCriadaEm,
  jaPagou,
  agora = Date.now(),
  previa = false,
}: {
  contaCriadaEm?: string | null;
  jaPagou: boolean;
  agora?: number;
  /** Conta Sandbox: mostra a oferta para teste, mesmo desligada. */
  previa?: boolean;
}) => {
  if (previa) return agora < (fimDaOferta(null, true) ?? 0);
  if (!OFERTA_BOAS_VINDAS.ativa || jaPagou) return false;
  const fim = fimDaOferta(contaCriadaEm);
  return fim !== null && agora < fim;
};

/** Preço anual com o desconto, na mesma conta do cupom no servidor. */
export const precoAnualComOferta = (plano: VeloPaidPlanId) => {
  const cheio = VELO_PLAN_PRICES[plano].annual;
  const desconto = Math.round(cheio * OFERTA_BOAS_VINDAS.percentOff) / 100;
  return Math.round((cheio - desconto) * 100) / 100;
};
