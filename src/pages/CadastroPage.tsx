import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

/* ── Types ─────────────────────────────────────────── */
type Step = "nome" | "email" | "senha" | "whatsapp" | "nicho" | "criando";
const STEPS: Step[] = ["nome", "email", "senha", "whatsapp", "nicho", "criando"];

const questions: Record<Step, string> = {
  nome: "Qual é o seu nome completo?",
  email: "", // dynamic
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
  nome: "Vamos começar pelo básico",
  email: "Usaremos para acessar sua conta",
  senha: "Mínimo de 8 caracteres",
  whatsapp: "Para avisos sobre suas vendas",
  nicho: "Escolha o mercado que mais te interessa",
  criando: "",
};

const NICHOS = ["moda", "eletrônicos", "beleza", "casa", "pets", "esportes"];

/* ── Password strength ─────────────────────────────── */
function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length < 4) return { label: "Fraca", color: "#EF4444", pct: 20 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Fraca", color: "#EF4444", pct: 25 };
  if (score <= 2) return { label: "Razoável", color: "#F59E0B", pct: 50 };
  if (score <= 3) return { label: "Boa", color: "#3B82F6", pct: 75 };
  return { label: "Forte", color: "#22C55E", pct: 100 };
}

/* ── WhatsApp mask ─────────────────────────────────── */
function maskWhatsApp(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function isValidWhatsApp(v: string): boolean {
  return /^\(\d{2}\) \d{5}-\d{4}$/.test(v);
}

/* ── Component ─────────────────────────────────────── */
const CadastroPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("nome");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collected data
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const stepIndex = STEPS.indexOf(step);
  const progressPct = Math.round((stepIndex / 5) * 100);

  useEffect(() => {
    if (!animating) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step, animating]);

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

  /* ── Submit handler ──────────────────────────────── */
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
        setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
      }, 600);
    }
  };

  const str = step === "senha" ? passwordStrength(input) : null;

  return (
    <div className="relative flex min-h-screen flex-col bg-white overflow-hidden">

      {/* ── Progress bar ───────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 h-1 bg-gray-100">
        <div
          className="h-full bg-[#7C3AED] transition-all duration-700 ease-out"
          style={{ width: `${step === "criando" ? 100 : progressPct}%` }}
        />
      </div>
      <div className="absolute top-0 left-0 right-0 z-10 h-1 bg-gray-100">
        <div
          className="h-full bg-[#7C3AED] transition-all duration-700 ease-out"
          style={{ width: `${step === "criando" ? 100 : progressPct}%` }}
        />
      </div>

      {/* ── Step indicator top-right ───────────────────── */}
      <div className="absolute top-6 right-6 z-10">
        <span className="text-xs font-medium text-gray-400 tracking-wide">
          {Math.min(stepIndex + 1, 5)} / 5
        </span>
      </div>

      {/* ── Center content ─────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[560px] flex flex-col items-center">

          {/* Question text */}
          <div className="relative w-full mb-10 min-h-[80px] flex flex-col items-center justify-center">
            <h1
              key={step}
              className="text-center text-[1.75rem] sm:text-[2.25rem] font-semibold text-[#0A0A0A] leading-tight tracking-[-0.03em] animate-fade-in"
            >
              {getQuestion()}
            </h1>

            {/* Subtext */}
            {subtexts[step] && !loading && (
              <p
                key={`sub-${step}`}
                className="mt-3 text-center text-sm text-gray-400 animate-fade-in"
                style={{ animationDelay: "100ms" }}
              >
                {subtexts[step]}
              </p>
            )}

            {/* Loading spinner */}
            {step === "criando" && (
              <div className="mt-6 flex items-center gap-3 animate-fade-in">
                <div className="h-5 w-5 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
                <span className="text-sm text-gray-500">Preparando tudo para você...</span>
              </div>
            )}

            {/* Confirmation flash */}
            {confirmText && (
              <p className="mt-4 text-sm font-medium text-[#7C3AED] animate-fade-in">
                ✓ {confirmText}
              </p>
            )}

            {/* Error message */}
            {errorText && (
              <p className="mt-4 text-sm font-medium text-red-500 animate-fade-in">
                {errorText}
              </p>
            )}
          </div>

          {/* Input area */}
          {step !== "criando" && (
            <div className="w-full animate-fade-in" key={`input-${step}`}>

              {/* Nicho quick picks */}
              {step === "nicho" && (
                <div className="flex flex-wrap justify-center gap-2 mb-5">
                  {NICHOS.map(n => (
                    <button
                      key={n}
                      onClick={() => { setInput(n); setTimeout(() => inputRef.current?.focus(), 0); }}
                      className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED] transition-all capitalize"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {/* Input + send button */}
              <div className="relative flex items-center">
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
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder={placeholders[step]}
                  disabled={loading || animating}
                  autoFocus
                  className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 pr-14 text-base text-gray-900 outline-none placeholder:text-gray-300 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition-all disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || animating || !input.trim()}
                  className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowRight size={18} />
                </button>
              </div>

              {/* Password strength */}
              {step === "senha" && input.length > 0 && str && (
                <div className="flex items-center gap-3 mt-3 px-1">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${str.pct}%`, backgroundColor: str.color }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: str.color }}>
                    {str.label}
                  </span>
                </div>
              )}

              {/* Login link */}
              <p className="mt-8 text-center text-sm text-gray-400">
                Já tem conta?{" "}
                <Link to="/login" className="text-[#7C3AED] font-semibold hover:underline">
                  Fazer login
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CadastroPage;
