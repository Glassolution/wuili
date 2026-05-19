import { useState } from "react";
import { useNavigate, Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { VeloLogo } from "@/components/VeloLogo";

const duplicateEmailMessage = "Esse email já está cadastrado. Faça login.";

function isDuplicateEmailAuthError(error: { message?: string; code?: string } | null): boolean {
  const m = error?.message?.toLowerCase() ?? "";
  const c = error?.code?.toLowerCase() ?? "";
  return c === "user_already_exists" || m.includes("already registered") || m.includes("already been registered") || m.includes("email already");
}

const CadastroPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next");
  const planParam = searchParams.get("plan");
  const redirectTarget = nextPath ? `${nextPath}${planParam ? `?plan=${planParam}` : ""}` : "/setup";
  const { user, loading: authLoading } = useAuth();

  const initialEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!authLoading && user) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (nome.trim().length < 2) return setErrorText("Informe seu nome completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErrorText("Email inválido.");
    if (senha.length < 8) return setErrorText("A senha precisa ter pelo menos 8 caracteres.");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: senha,
      options: { data: { full_name: nome.trim() }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      setErrorText(isDuplicateEmailAuthError(error) ? duplicateEmailMessage : error.message);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").update({ display_name: nome.trim() }).eq("user_id", data.user.id);
    }

    toast.success("Conta criada!");
    navigate("/setup", { replace: true });
  };

  const handleGoogle = async () => {
    setErrorText(null);
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/setup`,
    });
    if (result.error) {
      setGoogleLoading(false);
      setErrorText("Não foi possível entrar com o Google. Tente novamente.");
      return;
    }
    if (result.redirected) return;
    navigate("/setup", { replace: true });
  };

  return (
    <div className="min-h-screen bg-black font-['Manrope'] text-white antialiased">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <Link to="/" className="opacity-95">
          <VeloLogo size="md" variant="light" />
        </Link>
        <Link
          to="/login"
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
        >
          Pular
        </Link>
      </header>

      {/* Main centered card */}
      <main className="flex min-h-[calc(100vh-72px)] items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="grid w-full max-w-[920px] grid-cols-1 overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.5)] md:grid-cols-[1fr_1fr]">
          {/* LEFT — Offer */}
          <section className="flex flex-col gap-8 bg-[#1a1a1a] p-8 sm:p-10">
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.01em] text-white">
              Comece hoje,<br />continue por R$ 1
            </h1>

            <div className="flex flex-col divide-y divide-white/[0.08] text-[14px]">
              <Row label="Hoje" value="7 dias grátis" />
              <Row
                label="26 de mai."
                value={
                  <>
                    <span className="text-white/40 line-through">R$ 19</span>{" "}
                    <span className="text-white">R$ 1/mês durante 3 meses</span>
                  </>
                }
              />
              <Row label="Sempre" value="Cancele a qualquer momento" />
            </div>
          </section>

          {/* RIGHT — Form */}
          <section className="flex flex-col gap-4 bg-white p-8 text-[#1a1a1a] sm:p-10">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-[#1a1a1a]/15 bg-white text-[14px] font-medium text-[#1a1a1a] transition hover:bg-[#fafafa] disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z"/></svg>
              )}
              Continuar com Google
            </button>

            <div className="flex items-center gap-3 text-[12px] text-[#1a1a1a]/45">
              <span className="h-px flex-1 bg-[#1a1a1a]/10" />
              ou
              <span className="h-px flex-1 bg-[#1a1a1a]/10" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input value={nome} onChange={setNome} placeholder="Nome completo" autoComplete="name" />
              <Input value={email} onChange={setEmail} placeholder="Email" type="email" autoComplete="email" />
              <Input value={senha} onChange={setSenha} placeholder="Senha (mín. 8 caracteres)" type="password" autoComplete="new-password" />

              {errorText && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-600">{errorText}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1a1a1a] text-[14px] font-medium text-white transition hover:bg-black disabled:opacity-60"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Criar conta"}
              </button>

              <p className="mt-2 text-center text-[12px] leading-relaxed text-[#1a1a1a]/55">
                Ao continuar, você concorda com os Termos e a<br />Política de Privacidade.
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
    <span className="text-white/55">{label}</span>
    <span className="text-right text-white/90">{value}</span>
  </div>
);

const Input = ({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    autoComplete={autoComplete}
    className="h-11 w-full rounded-md border border-[#1a1a1a]/20 bg-white px-3 text-[14px] text-[#1a1a1a] outline-none transition placeholder:text-[#1a1a1a]/45 focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#1a1a1a]/10"
  />
);

export default CadastroPage;
