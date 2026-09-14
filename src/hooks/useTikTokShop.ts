import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TikTokShopAccount = {
  shop_id: string | null;
  shop_name: string | null;
  status: string;
  connected_at: string;
};

export type TikTokPublication = {
  catalog_product_id: string;
  status: string;
  tiktok_product_id: string | null;
  error_message: string | null;
};

export const useTikTokShop = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState<TikTokShopAccount | null>(null);
  const [publications, setPublications] = useState<Record<string, TikTokPublication>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      setPublications({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: acc }, { data: pubs }] = await Promise.all([
      supabase
        .from("tiktok_shop_accounts")
        .select("shop_id,shop_name,status,connected_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("tiktok_shop_publications")
        .select("catalog_product_id,status,tiktok_product_id,error_message")
        .eq("user_id", user.id),
    ]);

    setAccount((acc as TikTokShopAccount | null) ?? null);
    const map: Record<string, TikTokPublication> = {};
    (pubs ?? []).forEach((p) => {
      map[p.catalog_product_id] = p as TikTokPublication;
    });
    setPublications(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("tiktok-shop-connect", {
      body: { redirect_to: window.location.origin },
    });
    if (error) throw new Error(error.message);
    const authUrl = (data as { authUrl?: string } | null)?.authUrl;
    if (!authUrl) throw new Error("Nao foi possivel obter a URL de autorizacao do TikTok Shop");
    window.location.assign(authUrl);
  }, []);


  const disconnect = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from("tiktok_shop_accounts").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);
    setAccount(null);
  }, [user]);

  const publishProducts = useCallback(
    async (productIds: string[]) => {
      setPublishing(true);
      try {
        const { data, error } = await supabase.functions.invoke("tiktok-shop-publish-product", {
          body: { product_ids: productIds },
        });
        if (error) throw new Error(error.message);
        await refresh();
        return (data as { results?: Array<{ product_id: string; status: string; error?: string | null }> } | null)?.results ?? [];
      } finally {
        setPublishing(false);
      }
    },
    [refresh],
  );

  return { account, publications, loading, publishing, refresh, connect, disconnect, publishProducts };
};
