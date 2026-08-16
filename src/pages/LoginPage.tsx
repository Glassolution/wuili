import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { markOnboardingPending } from "@/components/onboarding/OnboardingModal";
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
  transition: { duration: 0.34, ease },
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

/* ─── Painel da direita ───────────────────────────────────────────────────── */
// Print do dashboard salvo em public/. O nome tem espaço, por isso o %20.
// Carrossel do painel da direita. Os nomes dos arquivos têm espaço, daí o %20.
const SHOWCASE = [
  {
    image: "/login%2001.png",
    title: "Um catálogo pronto para vender",
    description: "Produtos validados de fornecedores brasileiros, com custo e avaliação na mesma tela.",
  },
  {
    image: "/login%2002.png",
    title: "Páginas de venda criadas por IA",
    description: "Título, descrição e layout prontos em minutos — você só revisa e publica.",
  },
  {
    image: "/login%2003.png",
    title: "Saiba quanto vai lucrar antes de publicar",
    description: "Custo do fornecedor, preço sugerido e lucro por venda, calculados para você.",
  },
  {
    image: "/login%203.png",
    title: "Veja o que cada produto está vendendo",
    description: "Acompanhe as vendas do mês, o status de cada anúncio e publique de novo em um clique.",
  },
];
const SLIDE_INTERVAL = 6000;

const getCopy = (step: "initial" | "login" | "signup", resetMode: boolean) => {
  if (resetMode) {
    return {
      title: "Recupere seu acesso",
      subtitle: "Enviaremos um link para você redefinir a senha e voltar para a Velo.",
    };
  }
  if (step === "signup") {
    return {
      title: "Crie sua conta Velo",
      subtitle: "Só falta o essencial para começar a vender sem estoque.",
    };
  }
  if (step === "login") {
    return {
      title: "Bem-vindo de volta",
      subtitle: "Entre com a sua senha para continuar de onde parou.",
    };
  }
  return {
    title: "Entre na Velo",
    subtitle: "Use seu e-mail para continuar. A gente identifica se você já tem conta.",
  };
};

/* ─── Page ────────────────────────────────────────────────────────────────── */
const LoginPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

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
  const [slide, setSlide]                 = useState(0);

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

  useEffect(() => { if (step === "login")  setTimeout(() => passwordRef.current?.focus(), 320); }, [step]);
  useEffect(() => { if (step === "signup") setTimeout(() => nomeRef.current?.focus(), 320);     }, [step]);

  // Troca de slide sozinha; clicar num ponto reinicia a contagem.
  useEffect(() => {
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % SHOWCASE.length),
      SLIDE_INTERVAL,
    );
    return () => window.clearInterval(timer);
  }, [slide]);

  if (!authLoading && user && !loading && !googleLoading) return <Navigate to="/dashboard" replace />;

  const copy = getCopy(step, resetMode);
  const inputCls =
    "h-[52px] w-full rounded-[10px] border border-[#E3E7EE] bg-white px-4 text-[14px] font-medium text-[#0F172A] outline-none transition placeholder:font-normal placeholder:text-[#9AA4B2] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10";
  const primaryBtnCls =
    "inline-flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#2563EB] text-[15px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-[#C7D2E4] disabled:text-white";

  return (
    <main
      // Desliga o relevo "Pilot" dos botões sólidos (index.css): aqui o botão é
      // chapado. Sem isto o `hover:bg-[#1D4ED8]` casa com `button[class*="bg-[#1"]`
      // e o brilho volta pelo CSS global.
      data-velo-flat-buttons
      className="flex min-h-screen bg-white text-[#0F172A]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}
    >
      {/* ── Coluna do formulário ─────────────────────────────────────────── */}
      <div className="flex w-full flex-col px-6 py-10 sm:px-12 lg:w-1/2 lg:px-16 lg:py-12">
        <Link to="/" className="inline-flex w-fit items-center gap-2.5" aria-label="Voltar para a home da Velo">
          <img src="/logo.png" alt="Velo" className="h-11 w-11 rounded-[13px]" />
        </Link>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-[420px]">
            <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.025em] text-[#0F172A]">
              {copy.title}
            </h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#64748B]">{copy.subtitle}</p>

            {!resetMode && step === "initial" && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="mt-7 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] border border-[#E3E7EE] bg-white text-[14px] font-semibold text-[#0F172A] transition hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  <GoogleIcon />
                  {googleLoading ? "Conectando..." : "Continuar com Google"}
                </button>

                <div className="my-6 flex items-center gap-4">
                  <span className="h-px flex-1 bg-[#E9EDF3]" />
                  <span className="text-[13px] text-[#94A3B8]">ou entre com e-mail</span>
                  <span className="h-px flex-1 bg-[#E9EDF3]" />
                </div>
              </>
            )}

            {resetMode ? (
              <form onSubmit={handleReset} className="mt-7 space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Endereço de e-mail"
                  className={inputCls}
                />
                <button type="submit" disabled={loading} className={primaryBtnCls}>
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
                <p className="text-center text-[14px] text-[#64748B]">
                  <button
                    type="button"
                    onClick={() => setResetMode(false)}
                    className="font-semibold text-[#2563EB] transition hover:text-[#1D4ED8]"
                  >
                    Voltar para o login
                  </button>
                </p>
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
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Endereço de e-mail"
                    readOnly={step !== "initial"}
                    className={`${inputCls} ${step !== "initial" ? "cursor-default bg-[#F8FAFC] text-[#64748B]" : ""}`}
                  />

                  {step === "initial" && (
                    <button type="submit" disabled={checkingEmail} className={primaryBtnCls}>
                      {checkingEmail ? "Verificando..." : "Continuar"}
                    </button>
                  )}
                </form>

                <AnimatePresence mode="wait">
                  {step === "login" && (
                    <motion.form
                      key="login"
                      {...(reduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : slideDown)}
                      onSubmit={handleSignIn}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4">
                        <div className="relative">
                          <input
                            ref={passwordRef}
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Senha"
                            className={`${inputCls} pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((c) => !c)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] transition hover:text-[#0F172A]"
                            aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setResetMode(true)}
                          className="text-[14px] font-semibold text-[#2563EB] transition hover:text-[#1D4ED8]"
                        >
                          Esqueceu a senha?
                        </button>

                        <button type="submit" disabled={loading} className={primaryBtnCls}>
                          {loading ? "Entrando..." : "Entrar"}
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {step === "signup" && (
                    <motion.form
                      key="signup"
                      {...(reduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : slideDown)}
                      onSubmit={handleSignUp}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4">
                        <input
                          ref={nomeRef}
                          type="text"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          required
                          placeholder="Nome completo"
                          className={inputCls}
                        />

                        <div className="relative">
                          <input
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Senha com 8+ caracteres"
                            className={`${inputCls} pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((c) => !c)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] transition hover:text-[#0F172A]"
                            aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>

                        <div className="space-y-2.5 pt-1">
                          <LegalCheckbox
                            checked={acceptTerms}
                            onChange={setAcceptTerms}
                            label={
                              <>
                                Li e aceito os{" "}
                                <Link to="/termos" target="_blank" className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
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
                                <Link to="/privacidade" target="_blank" className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
                                  Política de Privacidade
                                </Link>
                              </>
                            }
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={loading || !acceptTerms || !acceptPrivacy}
                          className={primaryBtnCls}
                        >
                          {loading ? "Criando conta..." : "Criar conta grátis"}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                <p className="pt-2 text-center text-[14px] text-[#64748B]">
                  {step === "initial" ? (
                    <>Ainda não tem conta? É só continuar com seu e-mail.</>
                  ) : (
                    <>
                      {step === "login" ? "Não é você?" : "Já tem uma conta?"}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setStep("initial");
                          setPassword("");
                          setNome("");
                        }}
                        className="font-semibold text-[#2563EB] transition hover:text-[#1D4ED8]"
                      >
                        Trocar e-mail
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[12.5px] text-[#94A3B8] lg:text-left">
          Ao continuar, você concorda com a{" "}
          <Link to="/privacidade" className="text-[#64748B] underline underline-offset-2 hover:text-[#0F172A]">
            Política de Privacidade
          </Link>{" "}
          e os{" "}
          <Link to="/termos" className="text-[#64748B] underline underline-offset-2 hover:text-[#0F172A]">
            Termos de Uso
          </Link>
          .
        </p>
      </div>

      {/* ── Coluna da vitrine ────────────────────────────────────────────── */}
      <aside className="hidden w-1/2 flex-col items-center overflow-hidden border-l border-black/[0.06] bg-[#F7F8FB] px-4 pb-10 pt-6 lg:flex">
        {/* Sem moldura: os próprios prints já vêm com card e canto arredondado.
            Altura fixa para os dois slides porque as proporções são diferentes
            (um em pé, outro deitado) — assim a legenda não pula de lugar. */}
        {/* -mx-4 cancela o respiro lateral do aside só nesta faixa: o print
            aproveita a largura inteira do painel; a legenda continua recuada.
            `flex-1` em vez de altura fixa: o print fica com todo o espaço que
            sobra depois da legenda, em qualquer altura de tela. `items-end`
            ancora a imagem embaixo, encostando na legenda. */}
        <div className="relative -mx-4 flex min-h-0 w-[calc(100%+32px)] flex-1 items-end justify-center">
          {/* Sem `mode="wait"`: os dois prints coexistem durante a troca, um
              saindo para a esquerda enquanto o outro entra pela direita. Com
              wait, a imagem ficava meio segundo atrás da legenda. */}
          <AnimatePresence initial={false}>
            <motion.img
              key={SHOWCASE[slide].image}
              src={SHOWCASE[slide].image}
              alt={SHOWCASE[slide].title}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 70 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -70 }}
              transition={{ duration: 0.5, ease }}
              // `contain` porque os prints têm proporções diferentes — com
              // `cover` o print deitado perderia metade da tabela no corte.
              className="absolute bottom-0 max-h-full max-w-full object-contain"
            />
          </AnimatePresence>
        </div>

        <div className="mt-8 shrink-0 text-center">
          {/* Sem AnimatePresence na legenda de propósito: com `mode="wait"` ela
              sumia por um instante entre um slide e outro. */}
          <motion.div
            key={SHOWCASE[slide].title}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="min-h-[92px]"
          >
            <h2 className="text-[22px] font-bold tracking-[-0.025em] text-[#0F172A]">
              {SHOWCASE[slide].title}
            </h2>
            <p className="mx-auto mt-3 max-w-[440px] text-[14px] leading-[1.6] text-[#64748B]">
              {SHOWCASE[slide].description}
            </p>
          </motion.div>

          <div className="mt-7 flex items-center justify-center gap-2">
            {SHOWCASE.map((item, index) => (
              <button
                key={item.image}
                type="button"
                onClick={() => setSlide(index)}
                aria-label={`Ver ${item.title}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === slide ? "w-7 bg-[#2563EB]" : "w-4 bg-[#D6DDE8] hover:bg-[#BCC6D6]"
                }`}
              />
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
};

const LegalCheckbox = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) => (
  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.5] text-[#64748B]">
    <span className="relative mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[4px] border border-[#CBD5E1] bg-white transition checked:border-[#2563EB] checked:bg-[#2563EB]"
      />
      {checked && (
        <svg viewBox="0 0 12 12" className="pointer-events-none absolute h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2.5,6.5 5,9 9.5,3.5" />
        </svg>
      )}
    </span>
    <span>{label}</span>
  </label>
);

export default LoginPage;
