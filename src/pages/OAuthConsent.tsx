import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthResult["data"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Pedido de autorização inválido.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError("O servidor de autorização não retornou o endereço de volta."); }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-card-foreground space-y-5">
        {error ? (
          <p className="text-destructive">Não foi possível carregar este pedido: {error}</p>
        ) : !details ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Conectar {details.client?.name ?? "um aplicativo"} à sua conta Velo</h1>
            <p className="text-muted-foreground text-sm">
              Isso permite que {details.client?.name ?? "o aplicativo"} consulte os dados da Velo em seu nome, com as mesmas permissões da sua conta.
            </p>
            <div className="flex gap-3">
              <Button disabled={busy} onClick={() => decide(true)}>Permitir</Button>
              <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Recusar</Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
