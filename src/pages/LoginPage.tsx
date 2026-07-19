import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { markOnboardingPending } from "@/components/onboarding/OnboardingModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Eye, EyeOff } from "lucide-react";

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

const ease = [0.22, 1, 0.36, 1] as const;
const slideDown = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: { opacity: 1, y: 0, height: "auto" },
  exit: { opacity: 0, y: -8, height: 0 },
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

const getPanelCopy = (step: "initial" | "login" | "signup", resetMode: boolean) => {
  if (resetMode) {
    return {
      badge: "Recuperação",
      title: "Recupere seu acesso.",
      description: "Enviaremos um link para redefinir sua senha e voltar para a operação da Velo.",
    };
  }

  if (step === "signup") {
    return {
      badge: "Nova conta",
      title: "Comece sua operação.",
      description: "Crie sua conta e entre na Velo para descobrir produtos, pedidos e publicações em um só lugar.",
    };
  }

  if (step === "login") {
    return {
      badge: "Entrar",
      title: "Volte para a Velo.",
      description: "Continue de onde parou com a mesma conta usada para acessar o seu dashboard.",
    };
  }

  return {
    badge: "Acesso",
    title: "Entre ou crie sua conta.",
    description: "Use seu e-mail para continuar. A Velo identifica se você já possui acesso ou se precisa criar uma conta.",
  };
};

/* ─── Page ────────────────────────────────────────────────────────────────── */
const LoginPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [step, setStep]                   = useState<"initial" | "login" | "signup">("initial");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [nome, setNome]                   = useState("");
  const [showPw, setShowPw]               = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resetMode, setResetMode]         = useState(false);
  const [acceptTerms, setAcceptTerms]     = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

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
      if (data.session || data.user) {
        // Quem faz login já tem conta: vai direto ao dashboard, pulando o fluxo de cadastro.
        navigate("/dashboard", { replace: true }); return;
      }
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
    if (!acceptTerms)   { veloToast.error("Você precisa aceitar os Termos de Uso."); return; }
    if (!acceptPrivacy) { veloToast.error("Você precisa aceitar a Política de Privacidade."); return; }
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
      // Marca o onboarding como pendente para este usuário: garante que o modal
      // de cadastro apareça no primeiro acesso ao dashboard (frontend-only).
      markOnboardingPending(data.user.id);
      veloToast.success("Conta criada com sucesso.");
      // Se a sessão foi criada (auto-confirm), segue para o onboarding.
      // Caso contrário (confirmação por e-mail pendente), volta o botão ao
      // estado normal e informa o usuário para conferir o e-mail.
      if (data.session) {
        navigate("/dashboard", { replace: true });
        return;
      }
      veloToast.info("Confirme seu e-mail para continuar.");
    }
    setLoading(false);
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

  useEffect(() => { if (step === "login")  setTimeout(() => passwordRef.current?.focus(), 350); }, [step]);
  useEffect(() => { if (step === "signup") setTimeout(() => nomeRef.current?.focus(), 350);     }, [step]);

  if (!authLoading && user && !loading && !googleLoading) return <Navigate to="/dashboard" replace />;

  const copy = getPanelCopy(step, resetMode);
  const inputCls =
    "h-[44px] w-full rounded-[4px] border border-white/[0.06] bg-white/[0.06] px-3 text-[13px] font-[400] text-white/92 outline-none transition placeholder:text-white/22 focus:border-white/[0.14] focus:bg-white/[0.08]";
  const subtleBtnCls =
    "inline-flex h-[36px] min-w-[116px] items-center justify-center rounded-[4px] bg-[#f3efe8] px-5 text-[12px] font-[500] text-black transition hover:bg-white disabled:opacity-50";

  /* ─── Mobile (layout próprio, não afeta o desktop) ──────────────────────── */
  if (isMobile) {
    const mInput =
      "h-[56px] w-full rounded-[14px] border border-white/[0.16] bg-transparent px-4 text-[15px] font-[400] text-white outline-none transition placeholder:text-white/35 focus:border-white/45";

    const primaryLabel = resetMode
      ? loading
        ? "Enviando..."
        : "Enviar link"
      : step === "initial"
        ? checkingEmail
          ? "Verificando..."
          : "Continuar"
        : step === "login"
          ? loading
            ? "Entrando..."
            : "Entrar"
          : loading
            ? "Criando..."
            : "Criar conta";

    const primaryDisabled =
      loading || checkingEmail || (!resetMode && step === "signup" && (!acceptTerms || !acceptPrivacy));

    const onMobileSubmit = (e: FormEvent) => {
      if (resetMode) return void handleReset(e);
      if (step === "initial") {
        e.preventDefault();
        return void handleEmailContinue();
      }
      if (step === "login") return void handleSignIn(e);
      return void handleSignUp(e);
    };

    return (
      <main
        className="relative flex min-h-screen flex-col bg-black px-6 pb-10 pt-5 text-white"
        style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        <div className="flex justify-end">
          <Link to="/" className="text-[15px] font-[400] text-white/55 transition hover:text-white">
            Fechar
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center pb-4">
          {/* Marca centralizada */}
          <div className="flex flex-col items-center">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M30 26 L34 30 L38 26" stroke="#FFFFFF" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="mt-2 text-[21px] font-[700] tracking-[-0.045em]">Velo</span>
          </div>

          <h1 className="mt-7 text-center text-[26px] font-[700] leading-[1.15] tracking-[-0.035em]">
            {copy.title}
          </h1>
          <p className="mx-auto mt-2.5 max-w-[300px] text-center text-[14px] leading-[1.5] text-white/55">
            {copy.description}
          </p>

          <form onSubmit={onMobileSubmit} className="mt-8 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              required
              readOnly={!resetMode && step !== "initial"}
              className={`${mInput} ${!resetMode && step !== "initial" ? "cursor-default text-white/45" : ""}`}
            />

            {!resetMode && step === "signup" && (
              <input
                ref={nomeRef}
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
                className={mInput}
              />
            )}

            {!resetMode && (step === "login" || step === "signup") && (
              <div className="relative">
                <input
                  ref={step === "login" ? passwordRef : undefined}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={step === "signup" ? "Crie uma senha (mín. 8)" : "Sua senha"}
                  required
                  className={`${mInput} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((c) => !c)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white/80"
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {!resetMode && step === "login" && (
              <button
                type="button"
                onClick={() => setResetMode(true)}
                className="block w-full pt-1 text-center text-[14px] font-[400] text-white/55 transition hover:text-white"
              >
                Esqueci a senha
              </button>
            )}

            {!resetMode && step === "signup" && (
              <div className="space-y-2.5 pt-1">
                <LegalCheckbox
                  checked={acceptTerms}
                  onChange={setAcceptTerms}
                  label={
                    <>
                      Li e aceito os{" "}
                      <Link to="/termos" target="_blank" className="text-white/85 underline decoration-white/25 underline-offset-2">
                        Termos de Uso
                      </Link>
                    </>
                  }
                />
                <LegalCheckbox
                  checked={acceptPrivacy}
                  onChange={setAcceptPrivacy}
                  label={
                    <>
                      Li e aceito a{" "}
                      <Link to="/privacidade" target="_blank" className="text-white/85 underline decoration-white/25 underline-offset-2">
                        Política de Privacidade
                      </Link>
                    </>
                  }
                />
              </div>
            )}

            <button
              type="submit"
              disabled={primaryDisabled}
              className="mt-2 flex h-[56px] w-full items-center justify-center rounded-full bg-white text-[16px] font-[600] text-black transition active:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {primaryLabel}
            </button>
          </form>

          {!resetMode && step === "initial" && (
            <>
              <div className="my-5 flex items-center gap-4">
                <span className="h-px flex-1 bg-white/[0.14]" />
                <span className="text-[13px] font-[400] text-white/45">ou</span>
                <span className="h-px flex-1 bg-white/[0.14]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="flex h-[54px] w-full items-center justify-center gap-3 rounded-full bg-white/[0.08] text-[15px] font-[500] text-white transition active:bg-white/[0.14] disabled:opacity-45"
              >
                <GoogleIcon />
                {googleLoading ? "Conectando..." : "Continuar com Google"}
              </button>
            </>
          )}

          {!resetMode && (step === "login" || step === "signup") && (
            <button
              type="button"
              onClick={() => {
                setStep("initial");
                setPassword("");
                setNome("");
              }}
              className="mt-6 text-center text-[14px] font-[400] text-white/55 transition hover:text-white"
            >
              Trocar e-mail
            </button>
          )}

          {resetMode && (
            <button
              type="button"
              onClick={() => setResetMode(false)}
              className="mt-6 text-center text-[14px] font-[400] text-white/55 transition hover:text-white"
            >
              Voltar
            </button>
          )}

          <p className="mt-7 text-center text-[11.5px] font-[400] leading-[1.55] text-white/38">
            Ao continuar, você concorda com a{" "}
            <Link to="/privacidade" className="text-white/60 underline decoration-white/20 underline-offset-2">
              Política de Privacidade
            </Link>{" "}
            e com os{" "}
            <Link to="/termos" className="text-white/60 underline decoration-white/20 underline-offset-2">
              Termos de Uso
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#000000] text-white"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_34%),#000000]" />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-7 py-7 sm:px-10 lg:px-24">
        <Link to="/" className="inline-flex items-center gap-2.5 text-white">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M30 26 L34 30 L38 26" stroke="#FFFFFF" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[17px] font-[700] tracking-[-0.04em] text-white">Velo</span>
        </Link>
        <Link
          to="/"
          className="inline-flex h-[28px] items-center rounded-[4px] bg-white/[0.08] px-3 text-[11px] font-[500] text-white/78 transition hover:bg-white/[0.12] hover:text-white"
        >
          Fechar
        </Link>
      </header>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16 sm:px-10 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="grid w-full max-w-[250px] items-start gap-10 md:w-auto md:max-w-none md:grid-cols-[250px_1px_250px] md:gap-8"
        >
          <div className="flex min-h-[250px] flex-col md:pr-4">
            <div className="inline-flex w-fit items-center gap-2 text-[14px] font-[600] tracking-[-0.04em] text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 48 48"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M30 26 L34 30 L38 26" stroke="#FFFFFF" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Velo</span>
              <span className="rounded-full border border-white/[0.08] bg-[#1b1630] px-2 py-[2px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#a78bfa]">
                {copy.badge}
              </span>
            </div>
            <h1 className="mt-4 max-w-[238px] text-[42px] font-[400] leading-[1.02] tracking-[-0.055em] text-white sm:text-[48px]">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-[258px] text-[15px] font-[400] leading-[1.55] text-white/70">
              {copy.description}
            </p>
            <p className="mt-5 max-w-[258px] text-[14px] font-[400] leading-[1.6] text-white/54">
              Entre para centralizar catálogo, pedidos e publicações com a identidade da Velo.
            </p>
          </div>

          <div className="hidden h-full min-h-[250px] w-px bg-white/[0.08] md:block" />

          <div className="w-full md:pl-2">
            <div className="w-full max-w-[250px]">
              {resetMode ? (
                <form onSubmit={handleReset} className="space-y-4">
                  <Field label="E-mail">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="seuemail@exemplo.com"
                      className={inputCls}
                    />
                  </Field>

                  <AgreementText />

                  <div className="flex justify-center pt-1">
                    <button type="submit" disabled={loading} className={subtleBtnCls}>
                      {loading ? "Enviando..." : "Enviar link"}
                    </button>
                  </div>

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setResetMode(false)}
                      className="text-[11.5px] font-[400] text-white/48 transition hover:text-white/78"
                    >
                      Voltar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (step === "initial") void handleEmailContinue();
                    }}
                    className="space-y-4"
                  >
                    <Field label="Endereço de e-mail">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        readOnly={step !== "initial"}
                        className={`${inputCls} ${step !== "initial" ? "cursor-default text-white/48" : ""}`}
                      />
                    </Field>

                    {step === "initial" && (
                      <>
                        <AgreementText />
                        <div className="flex justify-center pt-1">
                          <button type="submit" disabled={checkingEmail} className={subtleBtnCls}>
                            {checkingEmail ? "Verificando..." : "Continuar"}
                          </button>
                        </div>
                      </>
                    )}
                  </form>

                  <AnimatePresence mode="wait">
                    {step === "login" && (
                      <motion.form key="login" {...slideDown} onSubmit={handleSignIn} className="overflow-hidden">
                        <div className="space-y-4">
                          <Field label="Senha">
                            <div className="relative">
                              <input
                                ref={passwordRef}
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Digite sua senha"
                                className={`${inputCls} pr-10`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPw((c) => !c)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/34 transition hover:text-white/74"
                              >
                                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </Field>

                          <AgreementText />

                          <div className="flex justify-center pt-1">
                            <button type="submit" disabled={loading} className={subtleBtnCls}>
                              {loading ? "Entrando..." : "Entrar"}
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[11.5px] text-white/42">
                            <button
                              type="button"
                              onClick={() => setResetMode(true)}
                              className="transition hover:text-white/72"
                            >
                              Esqueci a senha
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStep("initial");
                                setPassword("");
                              }}
                              className="transition hover:text-white/72"
                            >
                              Trocar e-mail
                            </button>
                          </div>
                        </div>
                      </motion.form>
                    )}

                    {step === "signup" && (
                      <motion.form key="signup" {...slideDown} onSubmit={handleSignUp} className="overflow-hidden">
                        <div className="space-y-4">
                          <Field label="Nome completo">
                            <input
                              ref={nomeRef}
                              type="text"
                              value={nome}
                              onChange={(e) => setNome(e.target.value)}
                              required
                              placeholder="Digite seu nome"
                              className={inputCls}
                            />
                          </Field>

                          <Field label="Senha">
                            <div className="relative">
                              <input
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Mínimo de 8 caracteres"
                                className={`${inputCls} pr-10`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPw((c) => !c)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/34 transition hover:text-white/74"
                              >
                                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </Field>

                          <LegalCheckbox
                            checked={acceptTerms}
                            onChange={setAcceptTerms}
                            label={
                              <>
                                Li e aceito os{" "}
                                <Link to="/termos" target="_blank" className="text-white/85 underline decoration-white/25 underline-offset-2 hover:text-white">
                                  Termos de Uso
                                </Link>
                              </>
                            }
                          />
                          <LegalCheckbox
                            checked={acceptPrivacy}
                            onChange={setAcceptPrivacy}
                            label={
                              <>
                                Li e aceito a{" "}
                                <Link to="/privacidade" target="_blank" className="text-white/85 underline decoration-white/25 underline-offset-2 hover:text-white">
                                  Política de Privacidade
                                </Link>
                              </>
                            }
                          />

                          <div className="flex justify-center pt-1">
                            <button
                              type="submit"
                              disabled={loading || !acceptTerms || !acceptPrivacy}
                              className={`${subtleBtnCls} disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {loading ? "Criando..." : "Criar conta"}
                            </button>
                          </div>

                          <div className="pt-1 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setStep("initial");
                                setNome("");
                                setPassword("");
                              }}
                              className="text-[11.5px] font-[400] text-white/42 transition hover:text-white/72"
                            >
                              Trocar e-mail
                            </button>
                          </div>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {step === "initial" && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="inline-flex items-center justify-center gap-2 text-[11.5px] font-[400] text-white/46 transition hover:text-white/78 disabled:opacity-40"
                      >
                        <GoogleIcon />
                        {googleLoading ? "Conectando..." : "Continuar com Google"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-[400] tracking-[-0.01em] text-white/38">{label}</span>
    {children}
  </label>
);

const AgreementText = () => (
  <p className="max-w-[320px] text-[10px] font-[400] leading-[1.55] text-white/42">
    Ao continuar, você concorda com a{" "}
    <Link to="/privacidade" className="text-white/62 underline decoration-white/18 underline-offset-2 transition hover:text-white">
      Política de Privacidade
    </Link>{" "}
    e com os{" "}
    <Link to="/termos" className="text-white/62 underline decoration-white/18 underline-offset-2 transition hover:text-white">
      Termos de Uso
    </Link>
    .
  </p>
);

const LegalCheckbox = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) => (
  <label className="flex cursor-pointer items-start gap-2.5 text-[11.5px] font-[400] leading-[1.55] text-white/62">
    <span className="relative mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[3px] border border-white/25 bg-white/5 transition checked:border-white checked:bg-white"
      />
      {checked && (
        <svg viewBox="0 0 12 12" className="pointer-events-none absolute h-2.5 w-2.5 text-[#0a0a0a]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2.5,6.5 5,9 9.5,3.5" />
        </svg>
      )}
    </span>
    <span>{label}</span>
  </label>
);

export default LoginPage;
