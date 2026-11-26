import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { markOnboardingPending } from "@/components/onboarding/OnboardingModal";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import {
  captureOrigin,
  concluirCadastroNoTikTok,
  detectInAppBrowser,
  getVisitorId,
  mensagemDeErro,
  readOrigin,
  sugerirEmail,
  tipoDeErro,
  trackSignup,
} from "@/lib/signupFunnel";
import { emailEhDescartavel, MENSAGEM_EMAIL_DESCARTAVEL } from "@/lib/emailDescartavel";
import { EVENTOS_LANDING, medirLanding } from "@/lib/landingFunnel";
import { metaVeloCadastroConcluido } from "@/lib/veloMetaPixel";
import { temIdeiaDaLanding } from "@/lib/ideiaDaLanding";
import agenteEstrela from "@/assets/agentes/grandes/estrela.webp";
import agenteConcha from "@/assets/agentes/grandes/concha.webp";
import agenteSino from "@/assets/agentes/grandes/sino.webp";
import agenteLua from "@/assets/agentes/grandes/lua.webp";
import agenteCubo from "@/assets/agentes/grandes/cubo.webp";
import agenteFolha from "@/assets/agentes/grandes/folha.webp";

/* ─── Email check ─────────────────────────────────────────────────────────── */
async function checkEmailExists(email: string): Promise<boolean | null> {
  try {
    // Nunca deixar a tela presa em "Verificando...": limite de 6s.
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    const request = supabase.functions
      .invoke("auth-email-exists", { body: { email: email.toLowerCase().trim() } })
      .then((res) => res);

    const result = await Promise.race([request, timeout]);
    if (!result || result.error) return null;
    return result.data?.exists ?? false;
  } catch {
    return null;
  }
}

const ease = [0.22, 1, 0.36, 1] as const;
const slideDown = {
  initial: { opacity: 0, y: -10, height: 0, filter: "blur(3px)" },
  animate: { opacity: 1, y: 0, height: "auto", filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, height: 0, filter: "blur(3px)" },
  transition: { duration: 0.38, ease },
};

/*
  Entrada da coluna do formulário: os blocos sobem em cascata em vez de a tela inteira
  aparecer de uma vez. `staggerChildren` cuida do encadeamento; cada bloco só precisa
  declarar `variants={fadeUp}`.
*/
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};
const semMovimento = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } };
/*
  O card do mobile entra com um scale mínimo além do deslocamento: é o que faz ele
  parecer que "assenta" sobre o fundo escuro em vez de só deslizar. 0.985 é de
  propósito discreto — acima disso a borda arredondada visivelmente deforma.
*/
const cardEntrada = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease } },
};

/*
  Mesmas pilhas de fonte da landing (src/pages/Index.tsx). Elas precisam ser declaradas
  aqui de novo porque index.css força "Hanken Grotesk" no body e em h1–h6 — sem o
  font-family explícito, o título desta página cai no Hanken e destoa da landing inteira.
*/
const FONTE_TEXTO =
  "[font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif]";
// Título: mesmo tratamento das headlines da landing — Inter em peso leve, tracking
// fechado e sem o character variant "cv11" herdado do body.
const FONTE_TITULO =
  "font-light tracking-[-0.03em] antialiased [font-family:Inter,ui-sans-serif,system-ui,sans-serif] [font-feature-settings:normal]";
/*
  O card é a exceção pedida: campo, botão e rótulo continuam na fonte de interface, que é
  o que se lê melhor em texto pequeno e em caixa de entrada.
*/
const FONTE_FORMULARIO =
  "[font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]";

const AVISO_ESTILO = {
  erro: "border-[#FBD5D5] bg-[#FEF3F2] text-[#B42318]",
  info: "border-[#C7DBFE] bg-[#EFF5FF] text-[#1D4ED8]",
  ok: "border-[#BBF0D0] bg-[#F0FDF4] text-[#15803D]",
} as const;

// No celular, quem entra cai direto no catálogo; no computador, no dashboard.
const destinoPosLogin = () => {
  if (typeof window === "undefined") return "/dashboard";
  const next = new URLSearchParams(window.location.search).get("next");
  if (next) {
    const seguro = oauthReturnPath(next);
    if (seguro !== "/") return seguro;
  }
  // Com ideia escrita na landing: /dashboard leva ao chat do Atlas (App.tsx).
  // Fica /dashboard (e não /dashboard/atlas) porque é o retorno já liberado no OAuth do Google.
  if (temIdeiaDaLanding()) return "/dashboard";
  return window.matchMedia("(max-width: 767px)").matches ? "/dashboard/catalogo" : "/dashboard";
};

const AvisoIcone = ({ tipo }: { tipo: "erro" | "info" | "ok" }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-[1px] shrink-0">
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.3" />
    {tipo === "ok" ? (
      <path d="M5 8.2 7 10.2l4-4.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    ) : tipo === "erro" ? (
      <path d="M8 4.6v4.1M8 11.1v.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    ) : (
      <path d="M8 7.4v4.1M8 4.6v.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    )}
  </svg>
);

/* ─── Google SVG ──────────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ─── Agentes da Velo ─────────────────────────────────────────────────────── */
// Recortados da folha de personagens do dono (fundo removido), 300px de altura.
// x = posição na plataforma (%), base = altura dos pés, h = altura na tela.
const AGENTES = [
  { nome: "Estrela", src: agenteEstrela, x: 6, base: 92, h: 118, atraso: 0, z: 2 },
  { nome: "Concha", src: agenteConcha, x: 19, base: 128, h: 128, atraso: 0.35, z: 1 },
  { nome: "Sino", src: agenteSino, x: 33, base: 44, h: 160, atraso: 0.7, z: 3 },
  { nome: "Lua", src: agenteLua, x: 49, base: 140, h: 118, atraso: 0.2, z: 1 },
  { nome: "Cubo", src: agenteCubo, x: 64, base: 122, h: 132, atraso: 0.55, z: 1 },
  { nome: "Folha", src: agenteFolha, x: 77, base: 66, h: 146, atraso: 0.9, z: 3 },
];

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
      subtitle: "Leva menos de um minuto para começar a vender sem estoque.",
    };
  }
  if (step === "login") {
    return {
      title: "Bem-vindo de volta",
      subtitle: "Entre com a sua senha para continuar de onde parou.",
    };
  }
  return {
    title: "Que bom ter você aqui.",
    subtitle: "Crie sua conta ou entre com o seu e-mail.",
  };
};

/* ─── Page ────────────────────────────────────────────────────────────────── */
const LoginPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  /*
    Quem chega por /cadastro (ou por ?modo=cadastro) veio do botão principal da
    landing, que é dirigido a quem ainda NÃO tem conta. Abrir na etapa de e-mail,
    sob o título "Entre na Velo", é pedir login a quem nunca se cadastrou — e era
    aí que essa pessoa desistia. O e-mail fica destravado: ninguém o digitou ainda.
  */
  const location = useLocation();
  const entradaPeloCadastro =
    location.pathname === "/cadastro" ||
    new URLSearchParams(location.search).get("modo") === "cadastro";
  // Vindo de um link com ?email= (ou da landing, que manda por estado, fora da URL), o campo já chega preenchido.
  const emailDaUrl = (
    new URLSearchParams(location.search).get("email") ??
    (location.state as { email?: string } | null)?.email ??
    ""
  ).trim();

  const [step, setStep]                   = useState<"initial" | "login" | "signup">(
    entradaPeloCadastro ? "signup" : "initial",
  );
  const [emailLocked, setEmailLocked]     = useState(false);
  const [email, setEmail]                 = useState(emailDaUrl);
  const [password, setPassword]           = useState("");
  const [nome, setNome]                   = useState("");
  const [showPw, setShowPw]               = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resetMode, setResetMode]         = useState(false);
  const [acceptTerms, setAcceptTerms]     = useState(true);
  const [emailSugerido, setEmailSugerido] = useState<string | null>(null);
  const [navegadorInterno]                = useState<string | null>(() => detectInAppBrowser());
  const [linkCopiado, setLinkCopiado]     = useState(false);
  const [avisoNavegador, setAvisoNavegador] = useState(false);
  // "Dizer oi": os agentes dão um pulinho (a key muda e a animação recomeça).
  const [oi, setOi]                       = useState(0);
  /*
    Todo retorno desta tela (erro, aviso, confirmação) aparece aqui dentro do card, e não
    mais como toast. Num formulário o feedback tem que nascer ao lado do campo que o
    causou — a pílula no canto da tela obriga a pessoa a procurar o que deu errado, e some
    sozinha antes de ela terminar de ler.
  */
  const [aviso, setAviso] = useState<{ tipo: "erro" | "info" | "ok"; texto: string } | null>(null);

  /*
    Digitar já é a resposta ao aviso, então ele sai na primeira tecla. Isso mora no
    onChange, e não num efeito com [email, password, nome] nas dependências: o efeito
    disparava no mesmo ciclo em que o aviso acabava de ser posto e a limpeza corria contra
    ele. Trocar de etapa NÃO limpa — "este e-mail já possui conta" e "link enviado"
    existem justamente para sobreviver à troca.
  */
  const aoDigitar = (definir: (valor: string) => void) => (evento: { target: { value: string } }) => {
    setAviso(null);
    definir(evento.target.value);
  };

  /*
    Segura o último aviso durante o fechamento: se o conteúdo saísse junto com o estado, o
    texto piscaria para fora antes de a caixa terminar de colapsar.
  */
  const ultimoAviso = useRef(aviso);
  if (aviso) ultimoAviso.current = aviso;
  const avisoVisivel = aviso ?? ultimoAviso.current;

  const passwordRef = useRef<HTMLInputElement>(null);
  const nomeRef     = useRef<HTMLInputElement>(null);

  /* ── Auth ── */
  const handleGoogleLogin = async () => {
    trackSignup("signup_google_click");
    /*
      Instagram/TikTok abrem links num navegador embutido, e o Google recusa OAuth ali
      (403 disallowed_useragent). Em vez de mandar a pessoa para um erro, mostramos a
      orientação para abrir no navegador do celular — o caminho por e-mail segue ao lado.
    */
    if (navegadorInterno) {
      trackSignup("signup_inapp_browser", navegadorInterno);
      setAvisoNavegador(true);
      return;
    }
    setGoogleLoading(true);
    const toastId = veloToast.loading("Conectando com o Google...", { fullscreen: true, minDuration: 3000 });
    try {
      const [result] = await Promise.all([
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}${destinoPosLogin()}`, skipBrowserRedirect: true },
        }),
        veloToast.waitForMinimum(toastId),
      ]);
      veloToast.dismiss(toastId);
      if (result.error) { setAviso({ tipo: "erro", texto: result.error.message }); setGoogleLoading(false); return; }
      if (result.data.url) { window.location.assign(result.data.url); return; }
      setAviso({ tipo: "erro", texto: "Não foi possível iniciar o acesso com o Google." });
      setGoogleLoading(false);
    } catch (error) {
      await veloToast.waitForMinimum(toastId);
      veloToast.dismiss(toastId);
      setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Erro inesperado." });
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    trackSignup("login_submit");
    setLoading(true);
    const toastId = veloToast.loading("Entrando...", { fullscreen: true, minDuration: 3000 });
    try {
      const [{ data, error }] = await Promise.all([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        veloToast.waitForMinimum(toastId),
      ]);
      veloToast.dismiss(toastId);
      if (error) {
        trackSignup("login_error", tipoDeErro(error.message));
        setAviso({ tipo: "erro", texto: mensagemDeErro(error.message) });
        return;
      }
      if (data.session || data.user) {
        trackSignup("login_success");
        // Quem faz login já tem conta: vai direto ao dashboard, pulando o fluxo de cadastro.
        navigate(destinoPosLogin(), { replace: true }); return;
      }
      setAviso({ tipo: "erro", texto: "Não foi possível concluir o login." });
    } catch (error) {
      await veloToast.waitForMinimum(toastId);
      veloToast.dismiss(toastId);
      setAviso({ tipo: "erro", texto: mensagemDeErro(error instanceof Error ? error.message : "") });
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    // No cadastro direto o e-mail não passou pela validação da etapa inicial.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setAviso({ tipo: "erro", texto: "Digite um e-mail válido." }); return; }
    if (emailEhDescartavel(email)) { setAviso({ tipo: "erro", texto: MENSAGEM_EMAIL_DESCARTAVEL }); return; }
    if (password.length < 8)    { setAviso({ tipo: "erro", texto: "Crie uma senha com pelo menos 8 caracteres." }); return; }
    if (!acceptTerms)   { setAviso({ tipo: "erro", texto: "Marque o aceite dos Termos e da Política de Privacidade para continuar." }); return; }
    trackSignup("signup_submit");
    setLoading(true);
    const toastId = veloToast.loading("Criando conta...", { fullscreen: true, minDuration: 3000 });
    /*
      O nome completo saiu do cadastro: é atrito puro na entrada e pode ser preenchido
      depois no Perfil. O gatilho do banco já cria o perfil com um nome a partir do
      e-mail, então nada mais adiante fica sem nome.
    */
    const nomeInicial = email.trim().split("@")[0].replace(/[._-]+/g, " ").trim();
    const origem = readOrigin();
    const aceiteEm = new Date().toISOString();
    const [{ data, error }] = await Promise.all([
      supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          data: {
            full_name: nomeInicial,
            velo_onboarding_pending: true,
            terms_accepted_at: aceiteEm,
            signup_source: origem.signup_source,
          },
        },
      }),
      veloToast.waitForMinimum(toastId),
    ]);
    veloToast.dismiss(toastId);
    if (error) {
      setLoading(false);
      trackSignup("signup_error", tipoDeErro(error.message));
      if (/already registered/i.test(error.message)) {
        setStep("login");
        setAviso({ tipo: "info", texto: "Este e-mail já tem conta na Velo. Entre com a sua senha." });
        window.setTimeout(() => passwordRef.current?.focus(), 120);
        return;
      }
      setAviso({ tipo: "erro", texto: mensagemDeErro(error.message) });
      // Senha recusada: mantém o e-mail e deixa a senha selecionada para trocar.
      if (/password/i.test(error.message)) {
        window.setTimeout(() => { nomeRef.current?.focus(); nomeRef.current?.select(); }, 120);
      }
      return;
    }
    if (data.user) {
      trackSignup("signup_success");
      // Supabase pode devolver um usuário ofuscado para e-mail já cadastrado.
      if (data.user.identities?.length) {
        metaVeloCadastroConcluido(data.user.id);
      }
      medirLanding(EVENTOS_LANDING.contaCriada, { confirmacao_pendente: !data.session });
      // Registro do aceite e da origem do visitante (comprovação e atribuição de canal).
      await supabase
        .from("profiles")
        .update({
          terms_accepted_at: aceiteEm,
          signup_source: origem.signup_source,
          utm_source: origem.utm_source,
          utm_medium: origem.utm_medium,
          utm_campaign: origem.utm_campaign,
          // Liga o visitante anônimo da landing à conta criada (funil ponta a ponta).
          visitor_id: getVisitorId(),
        })
        .eq("user_id", data.user.id);
      // TikTok (pixel e servidor) e ttclid no perfil: nada disso segura a navegação.
      concluirCadastroNoTikTok({ id: data.user.id, email: data.user.email });
      // Marca o onboarding como pendente para este usuário: garante que o modal
      // de cadastro apareça no primeiro acesso ao dashboard (frontend-only).
      markOnboardingPending(data.user.id);
      // A Velo não usa confirmação de e-mail: a conta já entra direto.
      if (data.session) {
        navigate(destinoPosLogin(), { replace: true });
        return;
      }
      // Rede de segurança: se por algum motivo a sessão não veio, entramos com a
      // própria senha recém-criada, sem pedir confirmação de e-mail.
      const { error: entrarErro } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!entrarErro) {
        navigate(destinoPosLogin(), { replace: true });
        return;
      }
      setAviso({ tipo: "erro", texto: mensagemDeErro(entrarErro.message) });
    }
    setLoading(false);
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setAviso({ tipo: "erro", texto: "Digite seu e-mail." }); return; }
    setLoading(true);
    // Sem toast de "enviando": o próprio botão já troca o rótulo enquanto a chamada corre.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setAviso({ tipo: "erro", texto: error.message }); return; }
    setResetMode(false);
    setStep("initial");
    setAviso({ tipo: "ok", texto: "Link de recuperação enviado. Confira seu e-mail." });
  };

  const handleEmailContinue = async () => {
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setAviso({ tipo: "erro", texto: "Digite um e-mail válido." }); return; }
    setCheckingEmail(true);
    const exists = await checkEmailExists(clean);
    setCheckingEmail(false);
    // Veio pela detecção de e-mail: o campo já está resolvido, então trava para não confundir.
    setEmailLocked(true);
    if (exists === null) {
      // Não deu para confirmar: seguimos para o cadastro. Se o e-mail já existir,
      // o próprio signUp devolve "User already registered" e leva para o login.
      setEmailLocked(false);
      setStep("signup");
      setAviso({ tipo: "info", texto: "Não consegui confirmar o cadastro agora. Se você já tem conta, use \"Já tenho conta\"." });
      return;
    }
    setStep(exists ? "login" : "signup");

  };

  const voltarParaInicio = () => {
    setAviso(null);
    setEmailLocked(false);
    setPassword("");
    setNome("");
    setStep("initial");
  };

  // A landing (?novo=1) também começa pelo e-mail: a checagem decide entre entrar e criar conta.
  useEffect(() => {
    captureOrigin();
    trackSignup("signup_view");
    if (detectInAppBrowser()) trackSignup("signup_inapp_browser", detectInAppBrowser() ?? undefined);
  }, []);

  /*
    Fecha o funil da landing: sem este evento dá para saber quantas pessoas
    clicaram no botão, mas não quantas realmente chegaram à tela de cadastro.
  */
  useEffect(() => {
    if (entradaPeloCadastro) medirLanding(EVENTOS_LANDING.chegouNoCadastro, { origem_tela: "cadastro" });
  }, [entradaPeloCadastro]);

  useEffect(() => { if (step === "login")  setTimeout(() => passwordRef.current?.focus(), 320); }, [step]);


  if (!authLoading && user && !loading && !googleLoading) return <Navigate to={destinoPosLogin()} replace />;

  const copy = getCopy(step, resetMode);
  // Cadastro alcançado pelo link, e não pela detecção de e-mail.
  const cadastroDireto = step === "signup" && !emailLocked;
  const mostraSocial = !resetMode && (step === "initial" || cadastroDireto);
  const inputCls =
    // 16px no celular: abaixo disso o Safari do iPhone dá zoom na página ao focar o campo.
    "h-12 w-full rounded-[12px] border border-[#D5DCED] bg-white/80 px-4 text-[16px] text-[#20242F] outline-none transition placeholder:text-[#858FA5] focus:border-[#4F6BED] focus:ring-4 focus:ring-[#4F6BED]/10 sm:text-[15px]";
  const primaryBtnCls =
    "inline-flex h-[46px] w-full items-center justify-center gap-4 rounded-[12px] bg-[#3E63EE] text-[14px] font-semibold text-white shadow-[0_4px_12px_rgba(62,99,238,0.16)] transition-colors hover:bg-[#3557E0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#335AF0] disabled:cursor-not-allowed disabled:bg-[#C7D2E4] disabled:shadow-none";

  return (
    <main
      // Desliga o relevo "Pilot" dos botões sólidos (index.css): aqui o botão é chapado.
      data-velo-flat-buttons
      className={`relative min-h-screen overflow-hidden bg-[#F2F3F7] text-[#1B1F2A] [font-kerning:normal] ${FONTE_FORMULARIO}`}
    >
      {/* Fundo da referência: cinza-claro com um brilho azulado à esquerda e um pêssego no canto direito. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 22% 62%, rgba(132,150,255,0.16), transparent 70%), radial-gradient(700px 420px at 88% 6%, rgba(255,196,160,0.22), transparent 70%), radial-gradient(600px 400px at 70% 95%, rgba(170,185,255,0.12), transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1260px] flex-col px-5 sm:px-8 lg:px-12">
        {/* ── Topo ── */}
        <header className="flex items-center justify-between py-6 sm:py-9">
          <Link to="/" className="inline-flex items-center gap-2" aria-label="Voltar para a home da Velo">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
            <span className="text-[25px] font-bold leading-none tracking-[-0.06em] text-[#1B1F2A] sm:text-[28px]">
              Velo<span className="text-[#2563EB]">.</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded-full border border-[#1B1F2A]/[0.14] px-4 text-[11px] font-medium uppercase tracking-[0.2em] text-[#5B6170] transition hover:border-[#1B1F2A]/[0.3] hover:text-[#1B1F2A]"
          >
            Voltar ao site
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-4 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-16 lg:px-10 lg:py-6">
          {/* ── Coluna da esquerda: título e agentes ── */}
          <motion.section
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="min-w-0"
          >
            <h2 className="text-[44px] font-bold leading-[1.04] tracking-[-0.065em] text-[#20242F] sm:text-[62px]">
              Sua loja
              <br />
              começa{" "}
              <span className="font-normal italic tracking-[-0.02em] text-[#56688F] [font-family:'Instrument_Serif',Georgia,serif]">
                aqui.
              </span>
            </h2>
            <p className="mt-6 text-[16px] leading-[1.65] text-[#6B7080] sm:text-[17px]">
              Um lugar para a sua ideia, a sua loja,
              <br className="hidden sm:block" /> e os agentes que ajudam a vender.
            </p>

            {/* Celular: os agentes numa fileira pequena, sem o palco. */}
            <div aria-hidden="true" className="mt-7 flex items-end justify-between px-1 sm:hidden">
              {AGENTES.map((agente) => (
                <img key={agente.nome} src={agente.src} alt="" draggable={false} className="h-[46px] w-auto select-none" />
              ))}
            </div>

            {/* Palco dos agentes, nas medidas da referência: disco oval bem achatado e
                inclinado, maior que a coluna do texto (sai 30px para a esquerda), com a
                fileira de trás menor e mais alta e a da frente maior e mais baixa. */}
            <div className="relative -ml-[30px] mt-10 hidden h-[320px] w-[690px] max-w-[calc(100%+30px)] sm:block">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[22px] h-[126px] rounded-[50%]"
                style={{
                  background: "radial-gradient(120% 140% at 50% 20%, #FFFFFF 0%, #F6F7FB 55%, #ECEFF8 100%)",
                  boxShadow:
                    "0 26px 46px -20px rgba(72,104,255,0.55), 0 5px 0 -1px rgba(160,182,255,0.55), 0 9px 14px -6px rgba(120,150,255,0.35)",
                  transform: "rotate(-4.5deg)",
                }}
              />
              {AGENTES.map((agente) => (
                <motion.img
                  key={`${agente.nome}-${oi}`}
                  src={agente.src}
                  alt=""
                  draggable={false}
                  className="absolute select-none drop-shadow-[0_12px_10px_rgba(40,50,90,0.16)]"
                  style={{ left: `${agente.x}%`, bottom: agente.base, height: agente.h, zIndex: agente.z }}
                  initial={reduceMotion ? false : oi ? { y: 0 } : { opacity: 0, y: 24 }}
                  animate={
                    reduceMotion
                      ? { opacity: 1 }
                      : oi
                        ? { opacity: 1, y: [0, -26, 0, -8, 0] }
                        : { opacity: 1, y: [0, -5, 0] }
                  }
                  transition={
                    oi
                      ? { duration: 0.8, delay: agente.atraso * 0.25, ease: "easeOut" }
                      : { opacity: { duration: 0.5, delay: 0.2 + agente.atraso * 0.3 }, y: { duration: 3.4, delay: agente.atraso, repeat: Infinity, ease: "easeInOut" } }
                  }
                />
              ))}
              <button
                type="button"
                onClick={() => setOi((valor) => valor + 1)}
                className="absolute bottom-0 left-[42%] z-10 inline-flex h-[34px] -translate-x-1/2 items-center gap-4 rounded-[10px] bg-white px-4 text-[12px] font-medium text-[#20242F] shadow-[0_4px_14px_rgba(30,40,80,0.10)] transition hover:shadow-[0_6px_18px_rgba(30,40,80,0.16)]"
              >
                Dizer oi aos agentes
                <span aria-hidden="true" className="text-[#4469F2]">↗</span>
              </button>
            </div>
            <p className="mt-7 hidden w-[690px] max-w-full -translate-x-[30px] text-center text-[12px] tracking-[0.01em] text-[#7A7F8C] sm:block">
              Você dá a direção. A palavra final é sua.
            </p>
          </motion.section>

          {/* ── Card do formulário ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mx-auto w-full max-w-[450px]"
          >
            <section aria-labelledby="login-card-title" className="w-full rounded-[30px] border border-white/90 bg-gradient-to-b from-white/80 to-white/55 p-6 shadow-[0_24px_60px_-32px_rgba(40,50,90,0.24)] sm:p-[38px]">
              <motion.div variants={reduceMotion ? semMovimento : fadeUp}>
                <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-white/90 shadow-[0_4px_14px_rgba(30,40,80,0.06)]">
                  <img src="/logo.png" alt="" className="h-6 w-6 object-contain" />
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={copy.title}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.26, ease }}
                  >
                    <h1 id="login-card-title" className="mt-7 text-[24px] font-bold leading-[1.2] tracking-[-0.045em] text-[#20242F]">{copy.title}</h1>
                    <p className="mt-3 text-[13px] leading-[1.55] text-[#606B80]">{copy.subtitle}</p>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* Avisos do formulário (erro, info, confirmação) — colapso em CSS puro. */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  aviso ? "max-h-[240px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {avisoVisivel && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`mt-5 flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3 text-[13px] font-medium leading-[1.5] ${AVISO_ESTILO[avisoVisivel.tipo]}`}
                  >
                    <AvisoIcone tipo={avisoVisivel.tipo} />
                    <span>{avisoVisivel.texto}</span>
                  </div>
                )}
              </div>

              <motion.div variants={reduceMotion ? semMovimento : fadeUp} className="mt-7">
                {resetMode ? (
                  <form onSubmit={handleReset} className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-[12px] font-semibold text-[#3A4256]">Seu e-mail</span>
                      <input
                        type="email"
                        value={email}
                        onChange={aoDigitar(setEmail)}
                        required
                        placeholder="voce@exemplo.com"
                        className={inputCls}
                      />
                    </label>
                    <button type="submit" disabled={loading} className={primaryBtnCls}>
                      {loading ? "Enviando..." : "Enviar link de recuperação"}
                    </button>
                    <p className="text-center text-[14px] text-[#5B6170]">
                      <button
                        type="button"
                        onClick={() => { setAviso(null); setResetMode(false); }}
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
                        // No cadastro direto o e-mail fica fora do <form> do cadastro:
                        // sem isto, dar Enter no campo não faria nada.
                        else if (cadastroDireto) void handleSignUp(e);
                      }}
                      className="space-y-3"
                    >
                      <label className="block">
                        <span className="mb-2 block text-[12px] font-semibold text-[#3A4256]">Seu e-mail</span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            if (!email) trackSignup("signup_start");
                            setEmailSugerido(null);
                            aoDigitar(setEmail)(e);
                          }}
                          onBlur={() => setEmailSugerido(sugerirEmail(email))}
                          placeholder="voce@exemplo.com"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          enterKeyHint="next"
                          readOnly={emailLocked}
                          className={`${inputCls} ${emailLocked ? "cursor-default !bg-[#F1F3F8] text-[#5B6170]" : ""}`}
                        />
                      </label>

                      {/* Erro comum de digitação: oferecemos a correção. */}
                      {emailSugerido && !emailLocked && (
                        <p className="-mt-1 text-[13px] leading-[1.5] text-[#5B6170]">
                          Você quis dizer{" "}
                          <button
                            type="button"
                            onClick={() => { setEmail(emailSugerido); setEmailSugerido(null); }}
                            className="font-semibold text-[#2563EB] underline underline-offset-2"
                          >
                            {emailSugerido}
                          </button>
                          ?
                        </p>
                      )}

                      {step === "initial" && (
                        <button type="submit" disabled={checkingEmail} className={primaryBtnCls}>
                          {checkingEmail ? "Verificando..." : (
                            <>
                              Continuar com e-mail
                              <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
                            </>
                          )}
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
                                onChange={aoDigitar(setPassword)}
                                required
                                placeholder="Sua senha"
                                autoComplete="current-password"
                                enterKeyHint="go"
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
                              onClick={() => { setAviso(null); setResetMode(true); }}
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
                            <div className="relative">
                              <input
                                ref={nomeRef}
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={aoDigitar(setPassword)}
                                required
                                placeholder="Senha (mín. 8 caracteres)"
                                autoComplete="new-password"
                                enterKeyHint="go"
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

                            {/* Regras conferidas antes do envio: a Velo pede 8+ caracteres. */}
                            <div className="-mt-1 space-y-1 text-[13px]">
                              <p className={`flex items-center gap-1.5 ${password.length >= 8 ? "text-[#16A34A]" : "text-[#5B6170]"}`}>
                                <span aria-hidden>{password.length >= 8 ? "✓" : "○"}</span>
                                8 caracteres ou mais
                              </p>
                              <p className="text-[#5B6170]">Evite senhas comuns, como 12345678 ou seu nome.</p>
                            </div>

                            {/* Aceite único; data e hora ficam gravadas no perfil ao criar a conta. */}
                            <div className="pt-1">
                              <LegalCheckbox
                                checked={acceptTerms}
                                onChange={setAcceptTerms}
                                label={
                                  <>
                                    Aceito os{" "}
                                    <Link to="/termos-de-servico" target="_blank" className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
                                      Termos de Uso
                                    </Link>{" "}
                                    e a{" "}
                                    <Link to="/politica-de-privacidade" target="_blank" className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
                                      Política de Privacidade
                                    </Link>
                                    .
                                  </>
                                }
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={loading || !acceptTerms || password.length < 8}
                              className={primaryBtnCls}
                            >
                              {loading ? "Criando conta..." : "Criar minha conta"}
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {step === "initial" && (
                      <p className="text-[13px] text-[#606B80]">Você não está conectado neste navegador.</p>
                    )}

                    <p className={`text-[14px] text-[#5B6170] ${step === "initial" ? "hidden" : "pt-1"}`}>
                      {step === "login" && (
                        <>
                          Não é você?{" "}
                          <button type="button" onClick={voltarParaInicio} className="font-semibold text-[#2563EB] transition hover:text-[#1D4ED8]">
                            Trocar e-mail
                          </button>
                        </>
                      )}
                      {step === "signup" && (
                        <>
                          Já tem uma conta?{" "}
                          <button
                            type="button"
                            /* Veio de /cadastro: trocar só a etapa deixaria a pessoa numa
                               tela de login com o endereço /cadastro na barra. */
                            onClick={() => (entradaPeloCadastro ? navigate("/login") : voltarParaInicio())}
                            className="font-semibold text-[#2563EB] transition hover:text-[#1D4ED8]"
                          >
                            Entrar
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </motion.div>

              <motion.div variants={reduceMotion ? semMovimento : fadeUp} className="mt-8 flex items-center gap-4 border-t border-[#E2E7F2] pt-6 sm:mt-9">
                <span aria-hidden="true" className="ml-0.5 h-[14px] w-[14px] shrink-0 rotate-45 rounded-[2px] border border-[#7997C6]" />
                <p className="text-[12px] leading-[1.6] text-[#687388]">
                  Você pode entrar assim que se cadastrar.
                  <br />
                  Seus projetos ficam salvos na sua conta.
                </p>
              </motion.div>
            </section>

            {mostraSocial && (
              <motion.div variants={reduceMotion ? semMovimento : fadeUp} className="mt-2 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-[#4C586E] transition hover:bg-white/55 hover:text-[#20242F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#335AF0] disabled:opacity-60"
                >
                  <GoogleIcon />
                  {googleLoading ? "Conectando..." : cadastroDireto ? "Cadastrar com Google" : "Continuar com Google"}
                </button>

                {/* Navegador embutido de rede social: o Google não permite o login ali. */}
                {avisoNavegador && (
                  <div className="rounded-[12px] border border-[#FDE3C0] bg-[#FFF8EE] px-3.5 py-3 text-[13px] leading-[1.55] text-[#92400E]">
                    <p role="status">
                      O {navegadorInterno ?? "aplicativo"} abre a Velo numa janela própria, e o Google não
                      permite login por aqui. Toque nos três pontinhos e escolha
                      <strong> “Abrir no navegador”</strong> — ou continue com seu e-mail no formulário.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(window.location.href);
                          setLinkCopiado(true);
                          window.setTimeout(() => setLinkCopiado(false), 2500);
                        } catch {
                          setLinkCopiado(false);
                        }
                      }}
                      className="mt-2 inline-flex h-9 items-center rounded-full bg-[#92400E] px-4 text-[13px] font-semibold text-white"
                    >
                      {linkCopiado ? "Link copiado!" : "Copiar link da Velo"}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ── Rodapé ── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 py-8 text-[12px] text-[#7A7F8C]">
          <span>Feito para a sua próxima venda.</span>
          <span className="flex items-center gap-5">
            <Link to="/docs" className="transition hover:text-[#1B1F2A]">Precisa de ajuda?</Link>
            <span>Velo · Apenas venda.</span>
          </span>
        </footer>
      </div>
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
