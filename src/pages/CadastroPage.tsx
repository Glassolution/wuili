import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUp, Check } from "lucide-react";
import { toast } from "sonner";
import { VeloLogo } from "@/components/VeloLogo";
import { playSendSound, playSoftTypeSound } from "@/lib/uiFeedback";

type Step = "nome" | "email" | "senha" | "whatsapp" | "nicho" | "criando";
const STEPS: Step[] = ["nome", "email", "senha", "whatsapp", "nicho", "criando"];

const questions: Record<Step, string> = {
  nome: "Qual é o seu nome completo?",
  email: "",
  senha: "Crie uma senha segura.",
  whatsapp: "Qual é o seu WhatsApp?",
  nicho: "Qual nicho você quer explorar?",
  criando: "",
};

const placeholders: Record<Step, string> = {
  nome: "Seu nome completo",
  email: "seu@email.com",
  senha: "Mínimo 8 caracteres",
  whatsapp: "(XX) XXXXX-XXXX",
  nicho: "Ex: moda, eletrônicos, beleza...",
  criando: "",
};

const subtexts: Record<Step, string> = {
  nome: "Vamos começar pelo básico.",
  email: "Usaremos para acessar sua conta.",
  senha: "Mínimo de 8 caracteres.",
  whatsapp: "Para avisos sobre suas vendas.",
  nicho: "Escolha o mercado que mais te interessa.",
  criando: "",
};

const NICHOS = ["moda", "eletrônicos", "beleza", "casa", "pets", "esportes"];

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length < 4) return { label: "Fraca", color: "#ef4444", pct: 20 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Fraca", color: "#ef4444", pct: 25 };
  if (score <= 2) return { label: "Razoável", color: "#f59e0b", pct: 50 };
  if (score <= 3) return { label: "Boa", color: "#3b82f6", pct: 75 };
  return { label: "Forte", color: "#22c55e", pct: 100 };
}

function maskWhatsApp(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function isValidWhatsApp(v: string): boolean {
  return /^\(\d{2}\) \d{5}-\d{4}$/.test(v);
}

const CadastroPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next");
  const planParam = searchParams.get("plan");
  const redirectTarget = nextPath
    ? `${nextPath}${planParam ? `?plan=${planParam}` : ""}`
    : "/dashboard";
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("nome");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypeSoundAtRef = useRef(0);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const revealFromInk = Boolean((location.state as { fromLandingInk?: boolean } | null)?.fromLandingInk);

  const stepIndex = STEPS.indexOf(step);
  const progressPct = Math.round((stepIndex / 5) * 100);

  useEffect(() => {
    if (!animating) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step, animating]);

  useEffect(() => {
    if (!revealFromInk) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousBodyOverflowX = document.body.style.overflowX;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";

    const timeout = window.setTimeout(() => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
    }, 900);

    return () => {
      window.clearTimeout(timeout);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
    };
  }, [revealFromInk]);

  // Logged-in users skip signup and go to destination
  if (!authLoading && user) {
    return <Navigate to={redirectTarget} replace />;
  }

  const getQuestion = () => {
    if (step === "email") return `Prazer, ${nome.split(" ")[0]}! Qual é o seu email?`;
    if (step === "criando") return `Criando sua conta, ${nome.split(" ")[0]}...`;
    return questions[step];
  };

  const transitionTo = (nextStep: Step, confirmed: string) => {
    setConfirmText(confirmed);
    setErrorText(null);
    setAnimating(true);

    setTimeout(() => {
      setConfirmText(null);
      setStep(nextStep);
      setInput("");
      setTimeout(() => setAnimating(false), 50);
    }, 600);
  };

  const playTypeSoundThrottled = () => {
    const now = performance.now();
    if (now - lastTypeSoundAtRef.current < 38) return;
    lastTypeSoundAtRef.current = now;
    playSoftTypeSound();
  };

  const handleComposerSubmit = () => {
    playSendSound();
    void handleSend();
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleComposerSubmit();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const isPrintable = e.key.length === 1;
    const isEditingKey = e.key === "Backspace" || e.key === "Delete";

    if (isPrintable || isEditingKey) {
      playTypeSoundThrottled();
    }
  };

  const handleSend = async () => {
    const val = input.trim();
    if (!val || loading || step === "criando" || animating) return;
    setErrorText(null);

    if (step === "nome") {
      if (val.length < 2) { setErrorText("Nome muito curto. Digite seu nome completo."); return; }
      setNome(val);
      transitionTo("email", val);
    } else if (step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setErrorText("Email inválido. Verifique e tente novamente."); return; }
      setEmail(val);
      transitionTo("senha", val);
    } else if (step === "senha") {
      if (val.length < 8) { setErrorText("A senha precisa ter pelo menos 8 caracteres."); return; }
      setSenha(val);
      transitionTo("whatsapp", "••••••••");
    } else if (step === "whatsapp") {
      if (!isValidWhatsApp(val)) { setErrorText("Formato inválido. Use (XX) XXXXX-XXXX."); return; }
      setWhatsapp(val);
      transitionTo("nicho", val);
    } else if (step === "nicho") {
      const lower = val.toLowerCase();
      const matched = NICHOS.find(n => lower.includes(n));
      const nicho = matched || val;

      setConfirmText(val);
      setAnimating(true);

      setTimeout(async () => {
        setConfirmText(null);
        setStep("criando");
        setInput("");
        setAnimating(false);
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { full_name: nome }, emailRedirectTo: window.location.origin },
        });

        if (error) {
          setLoading(false);
          if (error.message.includes("already registered") || error.message.includes("already been registered")) {
            setStep("email");
            setErrorText("Esse email já está cadastrado. Tente outro ou faça login.");
          } else {
            setStep("nicho");
            setErrorText(error.message);
          }
          return;
        }

        if (data.user) {
          await supabase.from("profiles").update({
            display_name: nome,
            whatsapp,
            nicho,
          }).eq("user_id", data.user.id);
        }

        setLoading(false);
        toast.success("Conta criada com sucesso!");
        setTimeout(() => navigate(redirectTarget, { replace: true }), 1200);
      }, 600);
    }
  };

  const str = step === "senha" ? passwordStrength(input) : null;

  return (
    <div className={`relative flex min-h-screen overflow-hidden flex-col bg-[#0f0f0f] font-['Manrope'] text-white ${revealFromInk ? "signup-ink-entry" : ""}`}>
      {/* ── Topbar ── */}
      <header className={`flex items-center justify-between px-5 py-4 sm:px-8 ${revealFromInk ? "signup-ink-header" : ""}`}>
        <Link to="/" className="flex items-center opacity-90 transition hover:opacity-100">
          <VeloLogo size="md" variant="light" />
        </Link>
        <span className="text-[12px] font-medium tracking-wide text-white/40">
          {Math.min(stepIndex + 1, 5)} / 5
        </span>
      </header>

      {/* ── Thin progress bar ── */}
      <div className={`h-[2px] w-full bg-white/[0.06] ${revealFromInk ? "signup-ink-progress" : ""}`}>
        <div
          className="h-full bg-white/70 transition-all duration-700 ease-out"
          style={{ width: `${step === "criando" ? 100 : progressPct}%` }}
        />
      </div>

      {/* ── Chat area ── */}
      <main className={`flex flex-1 flex-col items-center px-5 pb-48 pt-16 sm:pt-24 ${revealFromInk ? "signup-ink-main" : ""}`}>
        <div className="flex w-full max-w-[680px] flex-col gap-6">

          {/* Assistant bubble: question */}
          <div key={`q-${step}`} className={`flex animate-fade-in items-start gap-3 ${revealFromInk ? "signup-ink-card" : ""}`}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1f1f1f] ring-1 ring-white/[0.08]">
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><path d="M33 18 A11 11 0 1 0 33 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/><path d="M30 26 L34 30 L38 26" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </div>
            <div className="flex max-w-[calc(100%-3rem)] flex-col gap-1 rounded-2xl rounded-tl-sm bg-[#1f1f1f] px-5 py-4">
              <h1 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-white sm:text-[1.1875rem]">
                {getQuestion()}
              </h1>
              {subtexts[step] && (
                <p className="text-[0.8125rem] leading-snug text-white/50">
                  {subtexts[step]}
                </p>
              )}
            </div>
          </div>

          {/* User confirmation bubble (appears briefly on send) */}
          {confirmText && (
            <div className="flex animate-fade-in justify-end">
              <div className="flex max-w-[70%] items-center gap-2 rounded-2xl rounded-tr-sm bg-[#2a2a2a] px-4 py-[10px] text-[0.9375rem] text-white">
                <Check size={14} className="text-white/60" strokeWidth={2.5} />
                <span>{confirmText}</span>
              </div>
            </div>
          )}

          {/* Error as assistant follow-up */}
          {errorText && (
            <div className="flex animate-fade-in items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1f1f1f] ring-1 ring-white/[0.08]">
                <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><path d="M33 18 A11 11 0 1 0 33 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/><path d="M30 26 L34 30 L38 26" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-[#2a1515] px-5 py-3 text-[0.875rem] text-[#fca5a5]">
                {errorText}
              </div>
            </div>
          )}

          {/* Creating state */}
          {step === "criando" && (
            <div className="flex animate-fade-in items-center gap-3 pl-12 text-[0.875rem] text-white/60">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              <span>Preparando tudo para você...</span>
            </div>
          )}

          {/* Nicho quick picks (shown above composer on step) */}
          {step === "nicho" && !animating && (
            <div className="flex flex-wrap gap-2 pl-12">
              {NICHOS.map(n => (
                <button
                  key={n}
                  onClick={() => { setInput(n); setTimeout(() => inputRef.current?.focus(), 0); }}
                  className="rounded-full border border-white/[0.08] bg-[#1a1a1a] px-3 py-[7px] text-[0.8125rem] font-medium capitalize text-white/70 transition hover:border-white/20 hover:bg-[#262626] hover:text-white"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Composer (sticky bottom, ChatGPT style) ── */}
      {step !== "criando" && (
        <div className={`pointer-events-none fixed inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/95 to-transparent px-5 pb-6 pt-10 sm:pb-8 ${revealFromInk ? "signup-ink-composer" : ""}`}>
          <div className="pointer-events-auto flex w-full max-w-[680px] flex-col gap-2">
            <div className="relative flex items-end rounded-[24px] border border-white/[0.08] bg-[#1f1f1f] shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors focus-within:border-white/20">
              <input
                ref={inputRef}
                type={step === "senha" ? "password" : "text"}
                value={input}
                onChange={e => {
                  setErrorText(null);
                  if (step === "whatsapp") {
                    setInput(maskWhatsApp(e.target.value));
                  } else {
                    setInput(e.target.value);
                  }
                }}
                onKeyDown={handleComposerKeyDown}
                placeholder={placeholders[step]}
                disabled={loading || animating}
                autoFocus
                className="flex-1 bg-transparent px-5 py-[18px] text-[0.9375rem] text-white outline-none placeholder:text-white/30 disabled:opacity-50"
              />
              <button
                onClick={handleComposerSubmit}
                disabled={loading || animating || !input.trim()}
                aria-label="Enviar"
                className="mb-[9px] mr-[9px] flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Password strength meter */}
            {step === "senha" && input.length > 0 && str && (
              <div className="flex items-center gap-3 px-2">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${str.pct}%`, backgroundColor: str.color }}
                  />
                </div>
                <span className="text-[11px] font-medium" style={{ color: str.color }}>
                  {str.label}
                </span>
              </div>
            )}

            <p className="text-center text-[12px] text-white/40">
              Já tem conta?{" "}
              <Link to="/login" className="font-semibold text-white/80 hover:text-white">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroPage;
