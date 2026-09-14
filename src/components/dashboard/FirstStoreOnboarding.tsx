// O modal de cadastro/onboarding da primeira loja (o "tutorial") foi removido.
// Este módulo mantém apenas os helpers de dados de loja usados pelo dashboard,
// configurações e páginas de catálogo (leitura/escrita das lojas do usuário).

export type VeloStore = {
  id: string;
  name: string;
  ownerName: string;
  cpf: string;
  phone: string;
  source: string;
  businessType: string;
  goal: string;
  productLimit: number;
  publishedProducts: number;
  createdAt: string;
  isActive?: boolean;
};

export const STORES_STORAGE_KEY = "velo-user-stores";
export const STORE_PUBLICATION_COUNTS_KEY = "velo-store-publication-counts";
export const STORES_CHANGED_EVENT = "velo-stores-changed";
export const MAX_STORES_PER_USER = 2;

export const getStoreProductLimit = (storeIndex: number) => (storeIndex === 0 ? 30 : storeIndex === 1 ? 15 : 15);

export const getStoreOnboardingDoneKey = (userId: string) => `velo-store-onboarding-done:${userId}`;

export const hasCompletedStoreOnboarding = (userId: string) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getStoreOnboardingDoneKey(userId)) === "1";
};

export const markStoreOnboardingCompleted = (userId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStoreOnboardingDoneKey(userId), "1");
};

export const readUserStores = (): VeloStore[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((store, index) => ({
      ...store,
      productLimit: getStoreProductLimit(index),
      publishedProducts: Number(store.publishedProducts ?? getStorePublishedCount(store.id)),
    }));
  } catch {
    return [];
  }
};

export const saveUserStores = (stores: VeloStore[]) => {
  window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(stores));
  window.dispatchEvent(new Event(STORES_CHANGED_EVENT));
};

export const setActiveStore = (storeId: string) => {
  const stores = readUserStores();
  const updatedStores = stores.map(store => ({
    ...store,
    isActive: store.id === storeId
  }));
  saveUserStores(updatedStores);
};

export const updateStoreName = (storeId: string, newName: string) => {
  const stores = readUserStores();
  const updatedStores = stores.map(store =>
    store.id === storeId ? { ...store, name: newName.trim() } : store
  );
  saveUserStores(updatedStores);
};

export const deleteStore = (storeId: string) => {
  const stores = readUserStores();
  const storeToDelete = stores.find(store => store.id === storeId);

  if (!storeToDelete) return;

  const filteredStores = stores.filter(store => store.id !== storeId);

  // Se excluiu a loja ativa e ainda há lojas restantes, ativar a primeira
  if (storeToDelete.isActive && filteredStores.length > 0) {
    filteredStores[0] = {
      ...filteredStores[0],
      isActive: true
    };
  }

  saveUserStores(filteredStores);

  // Limpar contadores de publicação da loja excluída
  try {
    const raw = window.localStorage.getItem(STORE_PUBLICATION_COUNTS_KEY);
    const counts = raw ? JSON.parse(raw) : {};
    delete counts[storeId];
    window.localStorage.setItem(STORE_PUBLICATION_COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // Ignorar erros de limpeza
  }
};

export const getActiveStore = () => {
  const stores = readUserStores();
  // Procura por uma loja marcada como ativa
  const activeStore = stores.find(store => store.isActive);
  // Se não encontrar, retorna a primeira loja (compatibilidade)
  return activeStore || stores[0] || null;
};

export const getStorePublishedCount = (storeId: string) => {
  if (typeof window === "undefined") return 0;

  try {
    const raw = window.localStorage.getItem(STORE_PUBLICATION_COUNTS_KEY);
    const counts = raw ? JSON.parse(raw) : {};
    return Number(counts?.[storeId] ?? 0);
  } catch {
    return 0;
  }
};

export const incrementStorePublishedCount = (storeId: string) => {
  const current = getStorePublishedCount(storeId);
  const raw = window.localStorage.getItem(STORE_PUBLICATION_COUNTS_KEY);
  const counts = raw ? JSON.parse(raw) : {};
  counts[storeId] = current + 1;
  window.localStorage.setItem(STORE_PUBLICATION_COUNTS_KEY, JSON.stringify(counts));
  window.dispatchEvent(new Event(STORES_CHANGED_EVENT));
  return counts[storeId] as number;
};
