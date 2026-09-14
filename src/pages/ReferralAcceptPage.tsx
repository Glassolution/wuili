import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Gift, AlertTriangle, Check } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";

type LookupOk = {
  ok: true;
  invited_email: string;
  inviter_name: string;
  status: string;
};

const ReferralAcceptPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "invalid"; message: string }
    | { kind: "ready"; info: LookupOk }
    | { kind: "not_eligible"; message: string }
    | { kind: "linked"; inviterName: string }
  >({ kind: "loading" });

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Token ausente." });
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("accept-referral", {
        body: { token, action: "lookup" },
      });
      if (error || !data?.ok) {
        const msg = (data as { error?: string })?.error || "Convite inválido ou expirado.";
        setState({ kind: "invalid", message: msg });
        return;
      }
      setState({ kind: "ready", info: data as LookupOk });
    })();
  }, [token]);

  // Se já estiver logado com o email certo, faz o link automático
  useEffect(() => {
    if (state.kind !== "ready" || authLoading || !user || !token) return;
    const invitedEmail = state.info.invited_email.toLowerCase();
    if ((user.email ?? "").toLowerCase() !== invitedEmail) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("accept-referral", {
        body: { token, action: "link" },
      });
      if (error) {
        toast.error("Não foi possível vincular o convite.");
        return;
      }
      if (data?.code === "not_eligible") {
        setState({ kind: "not_eligible", message: data.error ?? "Convite não elegível." });
        return;
      }
      if (data?.ok) {
        setState({ kind: "linked", inviterName: data.inviter_name });
        setTimeout(() => navigate("/dashboard/planos"), 1500);
      }
    })();
  }, [state, user, authLoading, token, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "ready") return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: state.info.invited_email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/convite/${token}`,
        data: { full_name: name.trim() || undefined },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada. Verifique seu email.");
    // Session hydrates via auth listener → auto-link effect roda.
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "ready") return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: state.info.invited_email,
      password,
    });
    setBusy(false);
    if (error) {
      toast.error("Email ou senha incorretos.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="bg-black p-6 text-white">
          <div className="inline-block rounded-full bg-blue-50/10 px-3 py-1 text-xs font-semibold tracking-wider text-blue-300">
            CONVITE
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Você foi convidado pra Velo</h1>
        </div>

        <div className="p-6">
          {state.kind === "loading" && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          )}

          {state.kind === "invalid" && (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="text-amber-500" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">Convite indisponível</h2>
              <p className="mt-1 text-sm text-zinc-500">{state.message}</p>
              <Link
                to="/login"
                className="mt-5 inline-block rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Ir para o login
              </Link>
            </div>
          )}

          {state.kind === "not_eligible" && (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="text-amber-500" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">Desconto não disponível</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {state.message} Você pode continuar usando a Velo normalmente.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-5 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Ir para o painel
              </button>
            </div>
          )}

          {state.kind === "linked" && (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="text-emerald-500" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">Tudo certo!</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Seu desconto de 15% será aplicado na sua primeira assinatura. Redirecionando...
              </p>
            </div>
          )}

          {state.kind === "ready" && (
            <>
              <div className="rounded-xl bg-emerald-50 p-4 mb-5">
                <div className="flex items-start gap-3">
                  <Gift className="text-emerald-600 mt-0.5" size={20} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      Os dois ganham
                    </p>
                    <p className="mt-1 text-sm text-zinc-800">
                      <strong>{state.info.inviter_name}</strong> te chamou. Se você assinar um plano,
                      vocês dois ganham <strong>15% de desconto</strong> na primeira assinatura.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex rounded-lg bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    mode === "signup" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                  }`}
                >
                  Criar conta
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    mode === "signin" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                  }`}
                >
                  Já tenho conta
                </button>
              </div>

              <form onSubmit={mode === "signup" ? handleSignup : handleSignin} className="space-y-3">
                {mode === "signup" && (
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Nome</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-zinc-600">Email</label>
                  <input
                    type="email"
                    value={state.info.invited_email}
                    readOnly
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600">Senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  {mode === "signup" ? "Criar conta e ganhar 15%" : "Entrar e ganhar 15%"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralAcceptPage;
