import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { useSearchParams } from "react-router-dom";

type Account = {
  mp_user_id: string;
  token_expires_at: string | null;
  connected_at: string;
};

const MercadoPagoIntegrationCard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("seller_mp_accounts")
      .select("mp_user_id, token_expires_at, connected_at")
      .eq("seller_id", user.id)
      .maybeSingle();
    setAccount(data ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (searchParams.get("mp_success")) {
      veloToast.success("Conta Mercado Pago conectada!");
      setSearchParams({}, { replace: true });
      load();
    } else if (searchParams.get("mp_error")) {
      veloToast.error("Falha ao conectar Mercado Pago. Tente novamente.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const connect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/mercadopago/callback`;
      const { data, error } = await supabase.functions.invoke("mp-seller-auth-url", {
        method: "GET" as any,
        body: undefined,
      });
      // fallback: chamar via fetch com query string
      let authUrl = (data as any)?.auth_url as string | undefined;
      if (!authUrl) {
        const url = `${(supabase as any).functionsUrl ?? ""}/mp-seller-auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}` },
        });
        const j = await res.json();
        authUrl = j.auth_url;
      } else {
        // reappend redirect_uri (function default returns empty redirect)
        authUrl = authUrl.replace(/redirect_uri=[^&]*/, `redirect_uri=${encodeURIComponent(redirectUri)}`);
      }
      if (error || !authUrl) throw error ?? new Error("URL indisponível");
      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      veloToast.error("Não foi possível iniciar a conexão com o Mercado Pago");
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!user) return;
    const { error } = await supabase.from("seller_mp_accounts").delete().eq("seller_id", user.id);
    if (error) {
      veloToast.error("Não foi possível desconectar");
      return;
    }
    setAccount(null);
    veloToast.success("Conta Mercado Pago desconectada");
  };

  const expiresAt = account?.token_expires_at ? new Date(account.token_expires_at) : null;
  const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 15;

  return (
    <div className="rounded-xl border border-border bg-background p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E5E5E5] bg-[#009EE3] text-white font-bold text-sm">
          MP
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Mercado Pago</h3>
          <p className="text-xs text-muted-foreground">
            Receba pagamentos diretamente na sua conta com split automático.
          </p>
        </div>
        {loading ? (
          <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-semibold">
            Verificando...
          </span>
        ) : account ? (
          <span className="shrink-0 rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-semibold inline-flex items-center gap-1">
            <CheckCircle2 size={12} /> Conectado
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-semibold">
            Não conectado
          </span>
        )}
      </div>

      {account && expiringSoon && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Seu token expira em {daysLeft} dia{daysLeft === 1 ? "" : "s"}. Renovamos automaticamente, mas se falhar
            você precisará reconectar a conta.
          </span>
        </div>
      )}

      {!account ? (
        <button
          onClick={connect}
          disabled={connecting || loading}
          className="w-full rounded-lg bg-[#009EE3] text-white py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {connecting ? "Redirecionando..." : "Conectar Mercado Pago"}
        </button>
      ) : (
        <button
          onClick={disconnect}
          className="w-full rounded-lg border border-black bg-black text-white py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Desconectar
        </button>
      )}
    </div>
  );
};

export default MercadoPagoIntegrationCard;
