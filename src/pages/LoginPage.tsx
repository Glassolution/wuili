import { type FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, Mail } from "lucide-react";

/* ──────────────────────────────────────────────────────────
   Verificação de conta via Supabase Edge Function.
   Chama auth-email-exists que usa o admin client para verificar
   se o email já está cadastrado em auth.users.
   ────────────────────────────────────────────────────────── */
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
  "Eletrônicos",
  "Moda",
  "Casa & Decoração",
  "Beleza",
  "Esportes",
  "Brinquedos",
];

const ease = [0.22, 1, 0.36, 1] as const;
const slideDown = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: { opacity: 1, y: 0, height: "auto" },
  exit: { opacity: 0, y: -8, height: 0 },
  transition: { duration: 0.38, ease },
};

const LoginPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"initial" | "login" | "signup">("initial");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  /* ── Auth handlers ── */

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message);
    }
  };

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(
          error.message === "Invalid login credentials"
            ? "Email ou senha incorretos. Tente novamente."
            : error.message,
        );
        return;
      }

      if (data.session || data.user) {
        navigate("/dashboard", { replace: true });
        return;
      }

      toast.error("Não foi possível concluir o login. Tente novamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao entrar.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault();
    if (nome.trim().length < 2) {
      toast.error("Informe seu nome.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const cleanEmail = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: nome.trim() },
        emailRedirectTo: `${window.location.origin}/setup`,
      },
    });
    if (error) {
      setLoading(false);
      toast.error(
        error.message === "User already registered"
          ? "Este e-mail já possui conta. Entre para continuar."
          : error.message,
      );
      return;
    }
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ display_name: nome.trim() })
        .eq("user_id", data.user.id);
      toast.success("Conta criada! Bem-vindo à Velo.");
      navigate("/dashboard", { replace: true });
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error("Digite seu email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
    setResetMode(false);
    setStep("initial");
  };

  /* ── Progressive flow ── */

  const handleEmailContinue = async () => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("Digite um e-mail válido.");
      return;
    }
    setCheckingEmail(true);
    const exists = await checkEmailExists(cleanEmail);
    setCheckingEmail(false);

    if (exists) {
      setStep("login");
    } else {
      setStep("signup");
    }
  };

  const togglePreference = (pref: string) => {
    setPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  };

  useEffect(() => {
    if (step === "login") {
      setTimeout(() => passwordRef.current?.focus(), 350);
    }
  }, [step]);

  useEffect(() => {
    if (step === "signup") {
      setTimeout(() => nomeRef.current?.focus(), 350);
    }
  }, [step]);

  /* ── Render ── */

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#f5f5f5] px-4 py-10 [font-family:'Plus_Jakarta_Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      {/* Botão Voltar */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="absolute left-5 top-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px] font-medium text-[#6b7280] transition hover:border-[#d1d5db] hover:text-[#111111] sm:left-7 sm:top-7"
      >
        <ArrowLeft size={15} />
        Voltar
      </button>

      {googleLoading ? (
        <div className="w-full max-w-[420px] rounded-2xl bg-white p-9 shadow-sm text-center">
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#111111]">
            Entrando com Google
          </h1>
          <div className="mx-auto mt-10 grid h-12 w-12 place-items-center rounded-full border border-[#e5e7eb]">
            <Loader2 className="h-6 w-6 animate-spin text-[#111111]" />
          </div>
          <button
            type="button"
            onClick={() => setGoogleLoading(false)}
            className="mt-10 h-12 w-full rounded-xl bg-[#2a2a2a] text-[15px] font-semibold text-white transition hover:bg-[#333333]"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
          {/* Ícone preto centralizado */}
          <div className="flex justify-center mb-7">
            <div className="flex h-[56px] w-[56px] items-center justify-center rounded-[14px] bg-[#0a0a0a]">
              <svg width="30" height="30" viewBox="0 0 48 48" fill="none">
                <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M30 26 L34 30 L38 26" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
          </div>

          {/* Título em duas linhas */}
          <h1 className="text-center text-[28px] leading-[1.15] tracking-[-0.03em] mb-8">
            <span className="block font-normal text-[#888888]">Gerencie sua loja</span>
            <span className="block font-bold text-[#000000]">em um só lugar.</span>
          </h1>

          {/* ── RESET MODE ── */}
          {resetMode ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#111111]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="voce@email.com"
                  className="h-[48px] w-full rounded-xl border border-[#e5e7eb] bg-white px-4 text-[14px] font-medium text-[#111111] outline-none transition placeholder:text-[#9ca3af] focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-[48px] w-full rounded-xl bg-[#2a2a2a] text-[14px] font-semibold text-white transition hover:bg-[#333333] disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>
              <button
                type="button"
                onClick={() => setResetMode(false)}
                className="w-full text-center text-[13px] font-semibold text-[#111111] transition hover:text-[#6b7280]"
              >
                Voltar para login
              </button>
            </form>
          ) : (
            <>
              {/* Campo de email — sempre visível */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step === "initial") handleEmailContinue();
                }}
              >
                <div className="relative mb-4">
                  <Mail size={16} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    readOnly={step !== "initial"}
                    className={`h-[48px] w-full rounded-xl border bg-white pl-11 text-[14px] font-medium text-[#111111] outline-none transition placeholder:text-[#9ca3af] focus:ring-1 ${
                      step !== "initial"
                        ? "border-[#d1d5db] pr-4 text-[#6b7280] focus:border-[#d1d5db] focus:ring-0"
                        : "border-[#e5e7eb] pr-12 focus:border-[#111111] focus:ring-[#111111]"
                    }`}
                  />
                  {step === "initial" && (
                    <button
                      type="submit"
                      disabled={checkingEmail}
                      className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg bg-[#2a2a2a] text-white transition hover:bg-[#333333] disabled:opacity-60"
                      aria-label="Continuar"
                    >
                      {checkingEmail ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                    </button>
                  )}
                </div>
              </form>

              {/* ── LOGIN FLOW (conta existe) ── */}
              <AnimatePresence mode="wait">
                {step === "login" && (
                  <motion.form
                    key="login-form"
                    {...slideDown}
                    onSubmit={handleSignIn}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-[#111111]">Senha</label>
                        <div className="relative">
                          <input
                            ref={passwordRef}
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Sua senha"
                            className="h-[48px] w-full rounded-xl border border-[#e5e7eb] bg-white px-4 pr-11 text-[14px] font-medium text-[#111111] outline-none transition placeholder:text-[#9ca3af] focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((c) => !c)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] transition hover:text-[#111111]"
                          >
                            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="h-[48px] w-full rounded-xl bg-[#2a2a2a] text-[14px] font-semibold text-white transition hover:bg-[#333333] disabled:opacity-50"
                      >
                        {loading ? "Entrando..." : "Entrar"}
                      </button>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setResetMode(true)}
                          className="text-[13px] font-medium text-[#6b7280] transition hover:text-[#111111]"
                        >
                          Esqueceu a senha?
                        </button>
                        <button
                          type="button"
                          onClick={() => { setStep("initial"); setPassword(""); }}
                          className="text-[12px] text-[#9ca3af] transition hover:text-[#6b7280]"
                        >
                          Trocar e-mail
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}

                {/* ── SIGNUP FLOW (conta não existe) ── */}
                {step === "signup" && (
                  <motion.form
                    key="signup-form"
                    {...slideDown}
                    onSubmit={handleSignUp}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3">
                      {/* Nome */}
                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-[#111111]">Nome</label>
                        <input
                          ref={nomeRef}
                          type="text"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          required
                          placeholder="Seu nome"
                          className="h-[48px] w-full rounded-xl border border-[#e5e7eb] bg-white px-4 text-[14px] font-medium text-[#111111] outline-none transition placeholder:text-[#9ca3af] focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                        />
                      </div>

                      {/* Senha */}
                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-[#111111]">Criar senha</label>
                        <div className="relative">
                          <input
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Mínimo 8 caracteres"
                            className="h-[48px] w-full rounded-xl border border-[#e5e7eb] bg-white px-4 pr-11 text-[14px] font-medium text-[#111111] outline-none transition placeholder:text-[#9ca3af] focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((c) => !c)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] transition hover:text-[#111111]"
                          >
                            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* Preferências de produtos */}
                      <div>
                        <label className="mb-2 block text-[13px] font-semibold text-[#111111]">
                          O que você quer vender?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {PRODUCT_PREFERENCES.map((pref) => {
                            const selected = preferences.includes(pref);
                            return (
                              <button
                                key={pref}
                                type="button"
                                onClick={() => togglePreference(pref)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition ${
                                  selected
                                    ? "border-[#111111] bg-[#111111] text-white"
                                    : "border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d1d5db] hover:text-[#111111]"
                                }`}
                              >
                                {selected && <Check size={14} strokeWidth={2.5} />}
                                {pref}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Botão criar conta */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="h-[48px] w-full rounded-xl bg-[#2a2a2a] text-[14px] font-semibold text-white transition hover:bg-[#333333] disabled:opacity-50"
                      >
                        {loading ? "Criando conta..." : "Criar conta"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStep("initial");
                          setNome("");
                          setPassword("");
                          setPreferences([]);
                        }}
                        className="w-full text-center text-[12px] text-[#9ca3af] transition hover:text-[#6b7280]"
                      >
                        Trocar e-mail
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Botão Google — visível apenas no step initial */}
              {step === "initial" && (
                <>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#e5e7eb]" />
                    <span className="text-[12px] font-medium text-[#9ca3af]">ou</span>
                    <div className="h-px flex-1 bg-[#e5e7eb]" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="flex h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#2a2a2a] text-[14px] font-semibold text-white transition hover:bg-[#333333]"
                  >
                    <GoogleIcon />
                    Continuar com Google
                  </button>

                  <p className="mt-5 text-center text-[11px] leading-[1.5] text-[#9ca3af]">
                    Ao continuar, você concorda com os{" "}
                    <span className="text-[#6b7280]">Termos</span> e a{" "}
                    <span className="text-[#6b7280]">Política de Privacidade</span> da Velo.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default LoginPage;
