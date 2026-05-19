import { useState } from "react";
import { useNavigate, Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Check, Loader2 } from "lucide-react";
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
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0c] font-['Manrope'] text-white">
      {/* Cinematic background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 800px at 20% 20%, rgba(56,189,248,0.10), transparent 60%), radial-gradient(900px 700px at 85% 80%, rgba(16,185,129,0.08), transparent 60%), radial-gradient(600px 500px at 50% 50%, rgba(255,255,255,0.04), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link to="/" className="opacity-90 transition hover:opacity-100">
          <VeloLogo size="md" variant="light" />
        </Link>
        <Link to="/login" className="text-[13px] font-medium text-white/60 transition hover:text-white">
          Já tenho conta
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-[1180px] items-center px-6 pb-16 pt-4 sm:px-10">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.02] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl lg:grid-cols-[1.05fr_1fr]">
          {/* LEFT — Offer */}
          <section className="relative flex flex-col justify-between gap-10 p-10 lg:p-14">
            <div className="flex flex-col gap-7">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
                Oferta de lançamento
              </span>
              <h1 className="font-['Sora'] text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-white sm:text-[48px]">
                Comece sua operação hoje
              </h1>
              <p className="max-w-[460px] text-[15px] leading-relaxed text-white/60">
                Configure sua loja, encontre produtos e comece a vender rapidamente com a Velo —
                tudo em uma plataforma só.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
              <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.06] pb-4">
                <span className="text-[13px] text-white/50">Hoje</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-white/40 line-through">R$ 297,00</span>
                  <span className="font-['Sora'] text-[26px] font-semibold tracking-tight text-white">R$ 149,90</span>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-3 text-[13.5px] text-white/70">
                {[
                  "Primeiros 2 meses inclusos",
                  "Integração Mercado Livre, Shopee e TikTok Shop",
                  "Catálogo CJ Dropshipping ilimitado",
                  "Sem fidelidade — cancele quando quiser",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-[3px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Check size={10} strokeWidth={3} className="text-white" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[11.5px] leading-relaxed text-white/35">
              Pagamento seguro processado por Mercado Pago. Você pode cancelar a qualquer momento
              nas configurações.
            </p>
          </section>

          {/* RIGHT — Form */}
          <section className="relative flex flex-col gap-6 border-t border-white/[0.05] bg-white p-10 text-[#0a0a0c] lg:border-l lg:border-t-0 lg:p-14">
            <div className="flex flex-col gap-2">
              <h2 className="font-['Sora'] text-[26px] font-semibold tracking-[-0.01em]">
                Criar sua conta
              </h2>
              <p className="text-[13.5px] text-[#0a0a0c]/55">
                Leva menos de um minuto.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#0a0a0c]/12 bg-white text-[14px] font-medium text-[#0a0a0c] transition hover:bg-[#fafafa] disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z"/></svg>
              )}
              Continuar com Google
            </button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[#0a0a0c]/35">
              <span className="h-px flex-1 bg-[#0a0a0c]/10" />
              ou
              <span className="h-px flex-1 bg-[#0a0a0c]/10" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label="Nome completo">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  className="h-12 w-full rounded-xl border border-[#0a0a0c]/12 bg-white px-4 text-[14px] outline-none transition focus:border-[#0a0a0c]/40"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-[#0a0a0c]/12 bg-white px-4 text-[14px] outline-none transition focus:border-[#0a0a0c]/40"
                />
              </Field>
              <Field label="Senha">
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-[#0a0a0c]/12 bg-white px-4 text-[14px] outline-none transition focus:border-[#0a0a0c]/40"
                />
              </Field>

              {errorText && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{errorText}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0a0a0c] text-[14px] font-medium text-white transition hover:bg-[#1a1a1c] disabled:opacity-60"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Criar conta"}
              </button>

              <p className="text-center text-[11.5px] text-[#0a0a0c]/45">
                Ao continuar, você concorda com os Termos e a Política de Privacidade.
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[12px] font-medium text-[#0a0a0c]/60">{label}</span>
    {children}
  </label>
);

export default CadastroPage;
