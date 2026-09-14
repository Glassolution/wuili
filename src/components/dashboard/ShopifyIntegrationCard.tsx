import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { useSearchParams } from "react-router-dom";
import PlatformLogo from "@/components/dashboard/PlatformLogo";

type Connection = {
  shop_domain: string;
  created_at: string;
};

const ShopifyIntegrationCard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [shop, setShop] = useState("");
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("shopify_connections" as any)
      .select("shop_domain, created_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setConnection((data as Connection | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    const status = searchParams.get("shopify");
    if (status === "conectado") {
      veloToast.success("Loja Shopify conectada!");
      setSearchParams((prev) => {
        prev.delete("shopify");
        return prev;
      }, { replace: true });
      load();
    } else if (status === "erro") {
      veloToast.error("Falha ao conectar a Shopify. Tente novamente.");
      setSearchParams((prev) => {
        prev.delete("shopify");
        return prev;
      }, { replace: true });
    }
  }, [searchParams]);

  const isValidDomain = (d: string) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(d.trim());

  const connect = async () => {
    const normalized = shop.trim().toLowerCase();
    if (!isValidDomain(normalized)) {
      veloToast.error("Informe um domínio válido, ex: nomedaloja.myshopify.com");
      return;
    }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-authorize", {
        body: { shop: normalized },
      });
      if (error) throw error;
      const authUrl = (data as any)?.auth_url;
      if (!authUrl) throw new Error("URL de autorização indisponível");
      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      veloToast.error("Não foi possível iniciar a conexão com a Shopify");
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("shopify_connections" as any)
      .delete()
      .eq("user_id", user.id);
    if (error) {
      veloToast.error("Não foi possível desconectar");
      return;
    }
    setConnection(null);
    setShowInput(false);
    setShop("");
    veloToast.success("Loja Shopify desconectada");
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E5E5E5] p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex min-w-0 items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E5] bg-white p-1 dark:border-white/10 dark:bg-white">
            <PlatformLogo platform="Shopify" size={38} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-normal text-[#0A0A0A] dark:text-white">Shopify</div>
            {connection && (
              <div className="truncate text-[11px] text-[#737373] dark:text-zinc-400">
                {connection.shop_domain}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-1 text-[11px] font-semibold">
            Verificando...
          </span>
        ) : connection ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-black">
              <CheckCircle2 size={12} /> Conectado
            </span>
            <button
              type="button"
              onClick={disconnect}
              className="shrink-0 rounded-full border border-[#E5E5E5] bg-white px-3 py-1 text-[11px] font-semibold text-[#0A0A0A] transition hover:border-[#0A0A0A] dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:hover:border-white"
            >
              Desconectar
            </button>
          </div>
        ) : !showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black"
          >
            Conectar +
          </button>
        ) : null}
      </div>

      {!connection && showInput && !loading && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="nomedaloja.myshopify.com"
            className="flex-1 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-[13px] text-[#0A0A0A] outline-none focus:border-[#0A0A0A] dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            disabled={connecting}
          />
          <button
            onClick={connect}
            disabled={connecting}
            className="rounded-lg bg-black px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {connecting ? "Redirecionando..." : "Conectar"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ShopifyIntegrationCard;
