import { type FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, Mail } from "lucide-react";
import BrandMark from "@/components/brand/BrandMark";

const LoginPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  // If already logged in, redirect to dashboard
  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message === "Invalid login credentials"
        ? "Email ou senha incorretos. Tente novamente."
        : error.message);
    }
    // On success: onAuthStateChange will update `user` in context,
    // which triggers the guard above to redirect to /dashboard.
    // Do NOT call navigate() here — it fires before user state is set,
    // causing DashboardLayout to see user=null and bounce back to /login.
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Digite seu email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
    setResetMode(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10">

      {/* ── Background layer ── */}
      <div className="absolute inset-0">
        {/* Subtle radial vignette */}
        <div
          className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06] blur-[100px]"
          style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
        />
      </div>

      {/* ── Center card ── */}
      <div className="relative z-10 flex w-full max-w-[860px] overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#111] shadow-[0_32px_80px_rgba(0,0,0,0.5)]">

        {/* ── Left: Form ── */}
        <div className="w-full px-8 py-10 sm:w-[420px] sm:min-w-[420px] sm:px-12 sm:py-12">
          {/* Logo */}
          <div className="mb-8">
            <BrandMark size="sm" showWordmark tone="dark" />
          </div>

          {/* Header */}
          <h1 className="mb-1 font-['Manrope'] text-[1.5rem] font-bold tracking-[-0.02em] text-white">
            {resetMode ? "Recuperar senha" : "Bem-vindo de volta!"}
          </h1>
          <p className="mb-7 font-['Manrope'] text-[13px] text-white/45">
            {resetMode
              ? "Digite seu email para receber o link de recuperação"
              : "Estamos felizes em te ver novamente"}
          </p>

          {/* Tab toggle */}
          {!resetMode && (
            <div className="mb-6 flex rounded-full border border-white/[0.08] bg-white/[0.03] p-[3px]">
              <div className="flex-1 rounded-full bg-white py-[7px] text-center font-['Manrope'] text-[12px] font-semibold text-black">
                Login
              </div>
              <Link
                to="/cadastro"
                className="flex-1 rounded-full py-[7px] text-center font-['Manrope'] text-[12px] font-medium text-white/40 transition hover:text-white/70"
              >
                Sign Up
              </Link>
            </div>
          )}

          <form onSubmit={resetMode ? handleReset : handleLogin} className="flex flex-col gap-3">
            {/* Email */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Seu email"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-[13px] pr-11 font-['Manrope'] text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.07]"
              />
              <Mail size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
            </div>

            {/* Password */}
            {!resetMode && (
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Sua senha"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-[13px] pr-11 font-['Manrope'] text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.07]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 transition hover:text-white/40"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            )}

            {/* Remember + Forgot */}
            {!resetMode && (
              <div className="flex items-center justify-between py-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRemember(!remember)}
                    className={`flex h-[16px] w-[16px] items-center justify-center rounded-full border transition ${
                      remember ? "border-white bg-white" : "border-white/20 bg-transparent"
                    }`}
                  >
                    {remember && (
                      <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
                        <path d="M4 8l3 3 5-6" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="font-['Manrope'] text-[11px] text-white/40">Lembrar de mim</span>
                </label>
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="font-['Manrope'] text-[11px] font-semibold text-white/70 transition hover:text-white"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-white py-[13px] font-['Manrope'] text-[13px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {loading ? "Aguarde..." : resetMode ? "Enviar link" : "Login"}
            </button>
          </form>

          {/* Divider */}
          {!resetMode && (
            <>
              <div className="my-5 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-wider text-white/25">ou</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              <button
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] py-[12px] font-['Manrope'] text-[12px] font-medium text-white/60 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
              >
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Entrar com Google
              </button>
            </>
          )}

          {resetMode && (
            <button
              onClick={() => setResetMode(false)}
              className="mt-5 w-full text-center font-['Manrope'] text-[12px] text-white/40 transition hover:text-white"
            >
              ← Voltar para login
            </button>
          )}
        </div>

        {/* ── Right: Info panel ── */}
        <div className="hidden flex-1 border-l border-white/[0.06] sm:flex sm:flex-col sm:justify-between sm:p-10">
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
              <BrandMark size="xs" tone="dark" />
            </div>
            <h2 className="mb-3 font-['Manrope'] text-[1.25rem] font-bold leading-[1.2] tracking-[-0.02em] text-white">
              Sua operação de e-commerce no piloto automático.
            </h2>
            <p className="font-['Manrope'] text-[13px] leading-[1.7] text-white/40">
              Produtos de dropshipping com alta margem, anúncios criados por IA e publicados no Mercado Livre e Shopee em segundos.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { value: "4s", label: "Tempo médio de resposta" },
              { value: "98%", label: "Taxa de satisfação" },
              { value: "24/7", label: "IA operando" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="font-['Manrope'] text-[1.25rem] font-bold text-white">{s.value}</div>
                <div className="mt-1 font-['Manrope'] text-[10px] leading-[1.4] text-white/30">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Bottom quote */}
          <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
            <p className="font-['Manrope'] text-[12px] italic leading-[1.6] text-white/50">
              "Faturei R$ 3.200 no primeiro mês sem saber nada de e-commerce. A IA fez tudo — eu só aprovei."
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-white/[0.08]" />
              <span className="font-['Manrope'] text-[10px] text-white/35">Camila S. — São Paulo, SP</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom copyright ── */}
      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 font-['Manrope'] text-[10px] text-white/20">
        © 2025 Velo. Todos os direitos reservados.
      </p>
    </div>
  );
};

export default LoginPage;
