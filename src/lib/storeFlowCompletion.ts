// Persistência simples (localStorage) para saber se o usuário já concluiu
// o fluxo de criação da loja. Se sim, pulamos direto para o editor.

const FLAG_KEY = (userId: string) => `velo-store-flow-completed:${userId}`;
const DATA_KEY = (userId: string) => `velo-store-flow-data:${userId}`;

type FlowData = Record<string, unknown>;

export const markStoreFlowCompleted = (userId: string | null | undefined, flow: FlowData) => {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLAG_KEY(userId), "1");
    window.localStorage.setItem(DATA_KEY(userId), JSON.stringify(flow));
  } catch {
    // ignore quota errors
  }
};

export const hasCompletedStoreFlow = (userId: string | null | undefined): boolean => {
  if (!userId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FLAG_KEY(userId)) === "1";
  } catch {
    return false;
  }
};

export const getSavedStoreFlow = <T = FlowData>(userId: string | null | undefined): T | null => {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DATA_KEY(userId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const clearStoreFlowCompletion = (userId: string | null | undefined) => {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FLAG_KEY(userId));
    window.localStorage.removeItem(DATA_KEY(userId));
  } catch {
    // ignore
  }
};
