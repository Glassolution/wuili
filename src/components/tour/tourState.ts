// Controle de exibição do tour guiado. Mesmo padrão do onboarding: flag em
// localStorage por usuário, independente do estado no Supabase.
//
// Obs.: existe uma coluna `profiles.tutorial_completed` no banco, hoje órfã
// (nada lê nem escreve nela). Se um dia o tour precisar valer entre
// dispositivos, ela é o lugar natural para migrar este flag.
const tourSeenKey = (userId: string) => `velo-tour-seen:${userId}`;

export const hasSeenTour = (userId: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(tourSeenKey(userId)) === "1";
  } catch {
    return false;
  }
};

/** Marca como visto tanto ao concluir quanto ao dispensar — não reaparece. */
export const markTourSeen = (userId: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tourSeenKey(userId), "1");
  } catch {
    /* ignore */
  }
};

// Tour do Atlas pendente: gravado ao concluir o onboarding, para o tour abrir
// assim que o dashboard terminar de entrar — e continuar valendo se a pessoa
// recarregar a página antes de vê-lo.
const tourPendingKey = (userId: string) => `velo-tour-pending:${userId}`;

export const markTourPending = (userId: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tourPendingKey(userId), "1");
  } catch {
    /* ignore */
  }
};

export const hasPendingTour = (userId: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(tourPendingKey(userId)) === "1" && !hasSeenTour(userId);
  } catch {
    return false;
  }
};
