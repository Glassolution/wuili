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
