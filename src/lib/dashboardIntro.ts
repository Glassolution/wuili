// A introdução do dashboard roda uma vez por sessão do app, não uma vez por usuário:
// o estado vive só em memória, então recarregar/reabrir o site rearma a animação.
// Sair da conta também rearma (ver AuthContext), para que o próximo login volte a exibi-la.
let introPlayedForUserId: string | null = null;

export const hasPlayedDashboardIntro = (userId: string) => introPlayedForUserId === userId;

export const markDashboardIntroAsPlayed = (userId: string) => {
  introPlayedForUserId = userId;
};

/**
 * Entrada do dashboard logo depois do onboarding, em segundos contados do clique
 * em "Concluir". O modal some primeiro; a home começa enquanto ele ainda está
 * desbotando (título, depois chat e cards) e a moldura do app — sidebar e faixa
 * do plano — entra só no fim, quando o conteúdo já assentou.
 */
export const ENTRADA_POS_ONBOARDING = {
  modalExit: 0.6,
  homeStart: 0.35,
  sidebar: 3,
  banner: 3.25,
  duration: 0.9,
  /** Depois disso a coreografia terminou e o layout volta ao estado normal. */
  total: 4.8,
};

export const resetDashboardIntro = () => {
  introPlayedForUserId = null;
};
