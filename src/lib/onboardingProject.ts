// Fase 1 da unificação: o wizard /comecar passa a criar um user_projects logo
// no passo do produto e propaga o projectId até o editor. sessionStorage é
// cache de UI (sobrevive a reloads dentro do wizard) — a fonte de verdade
// permanece no banco.
const ONBOARDING_PROJECT_KEY = "velo-onboarding-project-id";

export function saveOnboardingProjectId(id: string): void {
  try {
    sessionStorage.setItem(ONBOARDING_PROJECT_KEY, id);
  } catch {
    // Ambientes sem storage (Safari privado) ainda funcionam via router state.
  }
}

export function readOnboardingProjectId(): string | null {
  try {
    return sessionStorage.getItem(ONBOARDING_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function clearOnboardingProjectId(): void {
  try {
    sessionStorage.removeItem(ONBOARDING_PROJECT_KEY);
  } catch {
    /* noop */
  }
}
