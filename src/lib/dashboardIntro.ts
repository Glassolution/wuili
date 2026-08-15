// A introdução do dashboard roda uma vez por sessão do app, não uma vez por usuário:
// o estado vive só em memória, então recarregar/reabrir o site rearma a animação.
// Sair da conta também rearma (ver AuthContext), para que o próximo login volte a exibi-la.
let introPlayedForUserId: string | null = null;

export const hasPlayedDashboardIntro = (userId: string) => introPlayedForUserId === userId;

export const markDashboardIntroAsPlayed = (userId: string) => {
  introPlayedForUserId = userId;
};

export const resetDashboardIntro = () => {
  introPlayedForUserId = null;
};
