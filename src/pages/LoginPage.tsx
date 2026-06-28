import { type FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { ArrowRight, Check, Eye, EyeOff, Loader2, Mail } from "lucide-react";

/* ─── Email check ─────────────────────────────────────────────────────────── */
async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("auth-email-exists", {
      body: { email: email.toLowerCase().trim() },
    });
    if (error) return false;
    return data?.exists ?? false;
  } catch {
    return false;
  }
}

const PRODUCT_PREFERENCES = [
  "Eletrônicos", "Moda", "Casa & Decoração",
  "Beleza", "Esportes", "Brinquedos",
];

const ease = [0.22, 1, 0.36, 1] as const;
const slideDown = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: { opacity: 1, y: 0, height: "auto" },
  exit:    { opacity: 0, y: -8, height: 0 },
  transition: { duration: 0.38, ease },
};

/* ─── Google SVG ──────────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ─── Right panel — vitrine visual ───────────────────────────────────────── */
const RightPanel = () => (
  <div className="relative hidden lg:flex flex-1 overflow-hidden rounded-r-[24px]"
    style={{
      background: "linear-gradient(135deg, #d4c5b0 0%, #c4b8a8 30%, #a8b4c8 60%, #8090b8 100%)",
    }}
  >
    {/* Overlay escuro sutil */}
    <div className="absolute inset-0 bg-black/10" />

    {/* Conteúdo central — mockup do dashboard */}
    <div className="relative z-10 flex w-full flex-col items-center justify-center px-10 py-12">

      {/* Card principal mockup */}
      <div
        className="w-full max-w-[340px] rounded-[20px] bg-white/95 backdrop-blur-sm shadow-[0_32px_80px_rgba(0,0,0,0.22)] overflow-hidden"
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        {/* Header do mockup */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-[#0a0a0a] grid place-items-center">
              <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
                <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFF" strokeWidth="4" strokeLinecap="round" fill="none"/>
                <path d="M30 26 L34 30 L38 26" stroke="#FFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span className="text-[12px] font-bold text-neutral-800 tracking-tight">Velo</span>
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </div>

        {/* Welcome */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] text-neutral-400 font-medium">Bem-vindo de volta</p>
          <h3 className="text-[17px] font-bold text-neutral-900 tracking-tight mt-0.5">Sua loja hoje</h3>
        </div>

        {/* KPI */}
        <div className="px-5 pb-3">
          <div className="flex items-end gap-2">
            <span className="text-[28px] font-bold tracking-tight text-neutral-900 leading-none">R$ 4.206</span>
            <span className="text-[11px] font-semibold text-emerald-600 mb-1">↑ 12%</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-0.5">vs. semana passada</p>
        </div>

        {/* Mini chart bars */}
        <div className="px-5 pb-4 flex items-end gap-1" style={{ height: 52 }}>
          {[30, 45, 28, 60, 38, 72, 50, 85, 62, 90, 70, 100].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${h}%`,
                background: i >= 9 ? "#0a0a0a" : "#e5e7eb",
              }}
            />
          ))}
        </div>

        {/* Product list */}
        <div className="px-5 pb-5 space-y-2">
          {[
            { name: "Fone Bluetooth Pro", val: "R$ 4.908", delta: "+12%", color: "#6366f1" },
            { name: "Suporte MagSafe", val: "R$ 2,97", delta: "+6%", color: "#f59e0b" },
            { name: "Mini Projetor HD", val: "R$ 201", delta: "+3%", color: "#10b981" },
            { name: "Kit Manicure", val: "R$ 1.516", delta: "+2%", color: "#ec4899" },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
              <div className="h-7 w-7 rounded-full flex-shrink-0" style={{ background: item.color + "22" }}>
                <div className="h-full w-full rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-neutral-800 truncate">{item.name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-bold text-neutral-900">{item.val}</p>
                <p className="text-[9px] font-semibold text-emerald-600">{item.delta} hoje</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Caption abaixo do card */}
      <p className="mt-6 text-center text-[13px] font-medium text-white/70 max-w-[260px] leading-relaxed">
        Gerencie produtos, pedidos e publicações em um só lugar.
      </p>
    </div>
  </div>
);

/* ─── Page ────────────────────────────────────────────────────────────────── */
const LoginPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]                   = useState<"initial" | "login" | "signup">("initial");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [nome, setNome]                   = useState("");
  const [showPw, setShowPw]               = useState(false);
  const [preferences, setPreferences]     = useState<string[]>([]);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resetMode, setResetMode]         = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const nomeRef     = useRef<HTMLInputElement>(null);

  /* ── Auth ── */
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const toastId = veloToast.loading("Conectando com o Google...", { fullscreen: true, minDuration: 3000 });
    try {
      const [result] = await Promise.all([
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/dashboard`, skipBrowserRedirect: true },
        }),
        veloToast.waitForMinimum(toastId),
      ]);
      veloToast.dismiss(toastId);
      if (result.error) { veloToast.error(result.error.message); setGoogleLoading(false); return; }
      if (result.data.url) { window.location.assign(result.data.url); return; }
      veloToast.error("Não foi possível iniciar o acesso com o Google.");
      setGoogleLoading(false);
    } catch (error) {
      await veloToast.waitForMinimum(toastId);
      veloToast.dismiss(toastId);
      veloToast.error(error instanceof Error ? error.message : "Erro inesperado.");
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = veloToast.loading("Entrando...", { fullscreen: true, minDuration: 3000 });
    try {
      const [{ data, error }] = await Promise.all([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        veloToast.waitForMinimum(toastId),
      ]);
      veloToast.dismiss(toastId);
      if (error) { veloToast.error(error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message); return; }
      if (data.session || data.user) { navigate("/dashboard", { replace: true }); return; }
      veloToast.error("Não foi possível concluir o login.");
    } catch (error) {
      await veloToast.waitForMinimum(toastId);
      veloToast.dismiss(toastId);
      veloToast.error(error instanceof Error ? error.message : "Erro inesperado.");
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) { veloToast.error("Informe seu nome."); return; }
    if (password.length < 8)    { veloToast.error("Senha precisa ter pelo menos 8 caracteres."); return; }
    setLoading(true);
    const toastId = veloToast.loading("Criando conta...", { fullscreen: true, minDuration: 3000 });
    const [{ data, error }] = await Promise.all([
      supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: nome.trim(), velo_onboarding_pending: true }, emailRedirectTo: `${window.location.origin}/setup` },
      }),
      veloToast.waitForMinimum(toastId),
    ]);
    veloToast.dismiss(toastId);
    if (error) {
      setLoading(false);
      veloToast.error(error.message === "User already registered" ? "Este e-mail já possui conta." : error.message);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").update({ display_name: nome.trim() }).eq("user_id", data.user.id);
      veloToast.success("Conta criada com sucesso.");
      navigate("/dashboard", { replace: true });
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { veloToast.error("Digite seu email"); return; }
    setLoading(true);
    const toastId = veloToast.loading("Enviando link de recuperação...");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { veloToast.error(error.message, { id: toastId }); return; }
    veloToast.success("Email de recuperação enviado.", { id: toastId });
    setResetMode(false);
    setStep("initial");
  };

  const handleEmailContinue = async () => {
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { veloToast.error("Digite um e-mail válido."); return; }
    setCheckingEmail(true);
    const exists = await checkEmailExists(clean);
    setCheckingEmail(false);
    setStep(exists ? "login" : "signup");
  };

  const togglePreference = (pref: string) =>
    setPreferences((prev) => prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]);

  useEffect(() => { if (step === "login")  setTimeout(() => passwordRef.current?.focus(), 350); }, [step]);
  useEffect(() => { if (step === "signup") setTimeout(() => nomeRef.current?.focus(), 350);     }, [step]);

  if (!authLoading && user && !loading && !googleLoading) return <Navigate to="/dashboard" replace />;

  /* ── Shared input style ── */
  const inputCls = "h-[46px] w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 text-[14px] text-[#111111] outline-none transition placeholder:text-[#c4c4c4] focus:border-[#111111] focus:bg-white focus:ring-1 focus:ring-[#111111]";
  const btnPrimaryCls = "h-[46px] w-full rounded-xl bg-[#0f0f0f] text-[14px] font-semibold text-white transition hover:bg-[#2a2a2a] disabled:opacity-50 active:scale-[0.99]";

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#f0f0f0] p-4"
      style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
    >
      {/* Card raiz — split layout */}
      <div className="flex w-full max-w-[960px] overflow-hidden rounded-[24px] bg-white shadow-[0_4px_6px_rgba(0,0,0,0.04),0_20px_60px_rgba(0,0,0,0.10)]"
        style={{ minHeight: 580 }}
      >

        {/* ── Lado esquerdo: formulário ── */}
        <div className="relative flex w-full flex-col justify-between px-10 py-9 lg:w-[420px] lg:flex-shrink-0">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[#0a0a0a]">
              <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFF" strokeWidth="4" strokeLinecap="round" fill="none"/>
                <path d="M30 26 L34 30 L38 26" stroke="#FFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span className="text-[16px] font-bold tracking-tight text-[#0a0a0a]">Velo</span>
          </div>

          {/* Corpo do formulário */}
          <div className="flex flex-1 flex-col justify-center py-8">

            {/* Título */}
            <div className="mb-7">
              <h1 className="text-[26px] font-bold tracking-tight text-[#0a0a0a] leading-tight">
                {resetMode
                  ? "Recuperar senha"
                  : step === "signup"
                  ? "Criar uma conta"
                  : "Bem-vindo à Velo"}
              </h1>
              <p className="mt-1.5 text-[13.5px] text-[#888888]">
                {resetMode
                  ? "Enviaremos um link para seu e-mail."
                  : step === "signup"
                  ? "Comece seu teste grátis de 30 dias."
                  : "Entre ou crie sua conta para continuar."}
              </p>
            </div>

            {/* ── RESET MODE ── */}
            {resetMode ? (
              <form onSubmit={handleReset} className="space-y-3">
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="voce@email.com" className={inputCls}
                />
                <button type="submit" disabled={loading} className={btnPrimaryCls}>
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
                <button type="button" onClick={() => setResetMode(false)}
                  className="w-full text-center text-[13px] text-[#888888] hover:text-[#111111] transition">
                  ← Voltar para login
                </button>
              </form>
            ) : (
              <div className="space-y-3">

                {/* Email field */}
                <form onSubmit={(e) => { e.preventDefault(); if (step === "initial") handleEmailContinue(); }}>
                  <div className="relative">
                    <input
                      type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      readOnly={step !== "initial"}
                      className={`${inputCls} ${step !== "initial" ? "text-[#888] cursor-default" : ""}`}
                    />
                    {step === "initial" && (
                      <button
                        type="submit" disabled={checkingEmail}
                        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg bg-[#0f0f0f] text-white hover:bg-[#2a2a2a] transition disabled:opacity-60"
                        aria-label="Continuar"
                      >
                        {checkingEmail ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                      </button>
                    )}
                  </div>
                </form>

                {/* ── LOGIN ── */}
                <AnimatePresence mode="wait">
                  {step === "login" && (
                    <motion.form key="login" {...slideDown} onSubmit={handleSignIn} className="overflow-hidden">
                      <div className="space-y-3 pt-1">
                        <div className="relative">
                          <input
                            ref={passwordRef}
                            type={showPw ? "text" : "password"}
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            required placeholder="Sua senha"
                            className={`${inputCls} pr-11`}
                          />
                          <button type="button" onClick={() => setShowPw((c) => !c)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c4c4c4] hover:text-[#111111] transition">
                            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        <button type="submit" disabled={loading} className={btnPrimaryCls}>
                          {loading ? "Entrando..." : "Entrar"}
                        </button>
                        <div className="flex items-center justify-between pt-0.5">
                          <button type="button" onClick={() => setResetMode(true)}
                            className="text-[12.5px] text-[#888888] hover:text-[#111111] transition">
                            Esqueceu a senha?
                          </button>
                          <button type="button" onClick={() => { setStep("initial"); setPassword(""); }}
                            className="text-[12px] text-[#c4c4c4] hover:text-[#888] transition">
                            Trocar e-mail
                          </button>
                        </div>
                      </div>
                    </motion.form>
                  )}

                  {/* ── SIGNUP ── */}
                  {step === "signup" && (
                    <motion.form key="signup" {...slideDown} onSubmit={handleSignUp} className="overflow-hidden">
                      <div className="space-y-3 pt-1">
                        <input ref={nomeRef} type="text" value={nome}
                          onChange={(e) => setNome(e.target.value)} required placeholder="Seu nome"
                          className={inputCls} />
                        <div className="relative">
                          <input
                            type={showPw ? "text" : "password"}
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            required placeholder="Mínimo 8 caracteres"
                            className={`${inputCls} pr-11`}
                          />
                          <button type="button" onClick={() => setShowPw((c) => !c)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c4c4c4] hover:text-[#111111] transition">
                            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        {/* Preferências */}
                        <div>
                          <p className="mb-2 text-[12px] font-semibold text-[#888]">O que você quer vender?</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {PRODUCT_PREFERENCES.map((pref) => {
                              const sel = preferences.includes(pref);
                              return (
                                <button key={pref} type="button" onClick={() => togglePreference(pref)}
                                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] font-medium transition ${
                                    sel ? "border-[#0f0f0f] bg-[#0f0f0f] text-white" : "border-[#e5e7eb] text-[#888] hover:border-[#d1d5db] hover:text-[#111]"
                                  }`}>
                                  {sel && <Check size={12} strokeWidth={2.5} />}
                                  {pref}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button type="submit" disabled={loading} className={btnPrimaryCls}>
                          {loading ? "Criando conta..." : "Criar conta"}
                        </button>
                        <button type="button"
                          onClick={() => { setStep("initial"); setNome(""); setPassword(""); setPreferences([]); }}
                          className="w-full text-center text-[12px] text-[#c4c4c4] hover:text-[#888] transition">
                          Trocar e-mail
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Google — só no step initial */}
                {step === "initial" && (
                  <>
                    <div className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-[#f0f0f0]" />
                      <span className="text-[11.5px] text-[#c4c4c4]">ou</span>
                      <div className="h-px flex-1 bg-[#f0f0f0]" />
                    </div>
                    <button type="button" onClick={handleGoogleLogin} disabled={googleLoading}
                      className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-xl border border-[#e5e7eb] bg-white text-[14px] font-semibold text-[#111111] transition hover:bg-[#fafafa] hover:border-[#d1d5db] disabled:opacity-50">
                      <GoogleIcon />
                      {googleLoading ? "Conectando..." : "Continuar com Google"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-[11px] text-[#c4c4c4] leading-relaxed">
            Ao continuar, você concorda com os{" "}
            <span className="text-[#888]">Termos de Uso</span> e a{" "}
            <span className="text-[#888]">Política de Privacidade</span> da Velo.
          </p>
        </div>

        {/* ── Lado direito: vitrine ── */}
        <RightPanel />
      </div>
    </div>
  );
};

export default LoginPage;
