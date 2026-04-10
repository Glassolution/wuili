import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import BrandMark from "@/components/brand/BrandMark";

type Step = "nome" | "email" | "senha" | "whatsapp" | "nicho" | "criando";
const STEPS: Step[] = ["nome", "email", "senha", "whatsapp", "nicho", "criando"];

const questions: Record<Step, string> = {
  nome: "Qual e o seu nome completo?",
  email: "",
  senha: "Crie uma senha segura.",
  whatsapp: "Qual e o seu WhatsApp?",
  nicho: "Qual nicho voce quer explorar?",
  criando: "",
};

const placeholders: Record<Step, string> = {
  nome: "Seu nome completo",
  email: "seu@email.com",
  senha: "Minimo 8 caracteres",
  whatsapp: "(XX) XXXXX-XXXX",
  nicho: "Ex: moda, eletronicos, beleza...",
  criando: "",
};

const subtexts: Record<Step, string> = {
  nome: "Vamos comecar pelo basico",
  email: "Usaremos para acessar sua conta",
  senha: "Minimo de 8 caracteres",
  whatsapp: "Para avisos sobre suas vendas",
  nicho: "Escolha o mercado que mais te interessa",
  criando: "",
};

const NICHOS = ["moda", "eletronicos", "beleza", "casa", "pets", "esportes"];

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length < 4) return { label: "Fraca", color: "#EF4444", pct: 20 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Fraca", color: "#EF4444", pct: 25 };
  if (score <= 2) return { label: "Razoavel", color: "#F59E0B", pct: 50 };
  if (score <= 3) return { label: "Boa", color: "#3B82F6", pct: 75 };
  return { label: "Forte", color: "#22C55E", pct: 100 };
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
  const [step, setStep] = useState<Step>("nome");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (step === "email") return `Prazer, ${nome.split(" ")[0]}! Qual e o seu email?`;
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

  const handleSend = async () => {
    const val = input.trim();
    if (!val || loading || step === "criando" || animating) return;
    setErrorText(null);

    if (step === "nome") {
      if (val.length < 2) { setErrorText("Nome muito curto. Digite seu nome completo."); return; }
      setNome(val);
      transitionTo("email", val);
    } else if (step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setErrorText("Email invalido. Verifique e tente novamente."); return; }
      setEmail(val);
      transitionTo("senha", val);
    } else if (step === "senha") {
      if (val.length < 8) { setErrorText("A senha precisa ter pelo menos 8 caracteres."); return; }
      setSenha(val);
      transitionTo("whatsapp", "••••••••");
    } else if (step === "whatsapp") {
      if (!isValidWhatsApp(val)) { setErrorText("Formato invalido. Use (XX) XXXXX-XXXX."); return; }
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
            setErrorText("Esse email ja esta cadastrado. Tente outro ou faca login.");
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
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(117,90,255,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(100,247,255,0.14),transparent_24%)]" />
      <div className="absolute inset-0 panel-grid opacity-25" />

      <div className="absolute left-0 right-0 top-0 z-10 h-1 bg-white/6">
        <div
          className="h-full bg-cyan-300 transition-all duration-700 ease-out"
          style={{ width: `${step === "criando" ? 100 : progressPct}%` }}
        />
      </div>

      <div className="absolute right-6 top-6 z-10">
        <span className="text-xs font-medium tracking-wide text-slate-400">
          {Math.min(stepIndex + 1, 5)} / 5
        </span>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
        <div className="card-wuili-elevated w-full max-w-[760px] px-6 py-10 sm:px-10">
          <div className="mb-3 flex justify-center">
            <BrandMark size="lg" showWordmark />
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-6 animate-fade-in">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-3">
                <BrandMark size="md" />
              </div>
            </div>

            <div className="relative mb-10 flex min-h-[80px] w-full flex-col items-center justify-center">
              <h1
                key={step}
                className="animate-fade-in text-center text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[2.25rem]"
              >
                {getQuestion()}
              </h1>

              {subtexts[step] && !loading && (
                <p
                  key={`sub-${step}`}
                  className="mt-3 animate-fade-in text-center text-sm text-slate-400"
                  style={{ animationDelay: "100ms" }}
                >
                  {subtexts[step]}
                </p>
              )}

              {step === "criando" && (
                <div className="mt-6 flex items-center gap-3 animate-fade-in">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  <span className="text-sm text-slate-300">Preparando tudo para voce...</span>
                </div>
              )}

              {confirmText && (
                <p className="mt-4 animate-fade-in text-sm font-medium text-cyan-200">
                  ? {confirmText}
                </p>
              )}

              {errorText && (
                <p className="mt-4 animate-fade-in text-sm font-medium text-red-400">
                  {errorText}
                </p>
              )}
            </div>

            {step !== "criando" && (
              <div className="w-full animate-fade-in" key={`input-${step}`}>
                {step === "nicho" && (
                  <div className="mb-5 flex flex-wrap justify-center gap-2">
                    {NICHOS.map(n => (
                      <button
                        key={n}
                        onClick={() => { setInput(n); setTimeout(() => inputRef.current?.focus(), 0); }}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium capitalize text-slate-300 transition-all hover:border-cyan-300/50 hover:bg-cyan-300 hover:text-slate-950"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}

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
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 pr-14 text-base text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || animating || !input.trim()}
                    className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-slate-950 transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>

                {step === "senha" && input.length > 0 && str && (
                  <div className="mt-3 flex items-center gap-3 px-1">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
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

                <p className="mt-8 text-center text-sm text-slate-400">
                  Ja tem conta?{' '}
                  <Link to="/login" className="font-semibold text-cyan-200 hover:text-white">
                    Fazer login
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadastroPage;
