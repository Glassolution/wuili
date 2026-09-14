import { useEffect, useState } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { startMercadoLivreOAuth, ML_CONNECT_FALLBACK_MESSAGE } from "@/lib/mercadoLivreOAuth";

const DISMISS_KEY = "velo:ml-reconnect-banner-dismissed";

/**
 * Aviso exibido para sellers cuja conexão com o Mercado Livre foi feita na
 * aplicação antiga (token expirado que não renova mais). Eles precisam
 * reconectar a conta para voltar a publicar.
 */
const MLReconnectBanner = () => {
  const { user } = useAuth();
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("access_token, refresh_token")
        .eq("user_id", user.id)
        .eq("platform", "mercadolivre")
        .maybeSingle();

      if (!active) return;
      // O access_token do Mercado Livre vale apenas 6h e é renovado
      // automaticamente pelo servidor usando o refresh_token. Portanto
      // "expirado" NÃO significa desconectado — só pedimos reconexão quando
      // não existe refresh_token (conexão realmente quebrada).
      setNeedsReconnect(!!data?.access_token && !data?.refresh_token);
    })();


    return () => {
      active = false;
    };
  }, [user]);

  if (!needsReconnect || dismissed) return null;

  const handleReconnect = async () => {
    setConnecting(true);
    try {
      await startMercadoLivreOAuth();
    } catch {
      veloToast.error(ML_CONNECT_FALLBACK_MESSAGE);
      setConnecting(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            <AlertTriangle size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Sua conexão com o Mercado Livre expirou
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
              Atualizamos a integração do Mercado Livre. Reconecte sua conta para voltar a publicar e sincronizar seus anúncios.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleReconnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={14} className={connecting ? "animate-spin" : undefined} />
            {connecting ? "Conectando..." : "Reconectar conta"}
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Fechar aviso"
            className="rounded-full p-1.5 text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/20"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MLReconnectBanner;
