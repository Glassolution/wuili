import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const FAVORITES_STORAGE_PREFIX = "velo-favorites";
const FAVORITES_CHANGED_EVENT = "velo:catalog-favorites-changed";

const parseFavoriteIds = (raw: string | null) => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const areSameFavoriteIds = (current: string[], next: string[]) =>
  current.length === next.length && current.every((id, index) => id === next[index]);

export const useCatalogFavorites = () => {
  const { user } = useAuth();
  const [favoritedIds, setFavoritedIds] = useState<string[]>([]);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);

  const favoritesStorageKey = useMemo(
    () => `${FAVORITES_STORAGE_PREFIX}${user?.id ? `-${user.id}` : ""}`,
    [user?.id],
  );

  const readFavorites = useCallback(() => {
    if (typeof window === "undefined") return [];
    return parseFavoriteIds(window.localStorage.getItem(favoritesStorageKey));
  }, [favoritesStorageKey]);

  useEffect(() => {
    const storedFavorites = readFavorites();
    setFavoritedIds((current) =>
      areSameFavoriteIds(current, storedFavorites) ? current : storedFavorites,
    );
    setHydratedStorageKey(favoritesStorageKey);
  }, [favoritesStorageKey, readFavorites]);

  useEffect(() => {
    if (hydratedStorageKey !== favoritesStorageKey || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(favoritesStorageKey, JSON.stringify(favoritedIds));
      window.dispatchEvent(
        new CustomEvent(FAVORITES_CHANGED_EVENT, {
          detail: { storageKey: favoritesStorageKey },
        }),
      );
    } catch {
      // Armazenamento indisponível: os favoritos continuam valendo em memória.
    }
  }, [favoritedIds, favoritesStorageKey, hydratedStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncFavorites = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== favoritesStorageKey) return;
      if (event instanceof CustomEvent && event.detail?.storageKey !== favoritesStorageKey) return;

      const storedFavorites = readFavorites();
      setFavoritedIds((current) =>
        areSameFavoriteIds(current, storedFavorites) ? current : storedFavorites,
      );
    };

    window.addEventListener("storage", syncFavorites);
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);

    return () => {
      window.removeEventListener("storage", syncFavorites);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    };
  }, [favoritesStorageKey, readFavorites]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavoritedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  return {
    favoritedIds,
    toggleFavorite,
  };
};
