import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { veloToast } from "@/components/ui/velo-toast";
import PlatformLogo from "@/components/dashboard/PlatformLogo";
import { useTikTokShop } from "@/hooks/useTikTokShop";

const TikTokShopIntegrationCard = () => {
  const { account, loading, connect, disconnect, refresh } = useTikTokShop();
  const [busy, setBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tiktok_connected")) {
      veloToast.success("TikTok Shop conectado com sucesso!");
      void refresh();
    } else if (searchParams.get("tiktok_error")) {
      veloToast.error("Não foi possível conectar o TikTok Shop. Tente novamente.");
    } else {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("tiktok_connected");
    next.delete("tiktok_error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, refresh]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connect();
    } catch {
      veloToast.error("Não foi possível iniciar a conexão com o TikTok Shop.");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect();
      veloToast.success("TikTok Shop desconectado.");
    } catch {
      veloToast.error("Não foi possível desconectar.");
    } finally {
      setBusy(false);
    }
  };

  const connected = account?.status === "connected";
  const expired = account?.status === "expired";


  return (
    <div className="rounded-xl border border-border bg-background p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E5] bg-white p-1 dark:border-white/10 dark:bg-white">
          <PlatformLogo platform="TikTok Shop" size={35} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">TikTok Shop</h3>
          <p className="text-xs text-muted-foreground truncate">
            {connected
              ? account?.shop_name || `Loja ${account?.shop_id ?? "conectada"}`
              : expired
                ? "Conexão expirada — conecte novamente"
                : "Publique produtos do catálogo na sua loja TikTok"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            connected
              ? "bg-green-100 text-green-700"
              : expired
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {loading ? "Verificando..." : connected ? "Conectado" : expired ? "Expirado" : "Não conectado"}
        </span>
      </div>

      <button
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={busy || loading}
        className="w-full rounded-lg bg-black text-white py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {connected ? "Desconectar" : expired ? "Reconectar TikTok Shop" : "Conectar TikTok Shop"}
      </button>

    </div>
  );
};

export default TikTokShopIntegrationCard;
