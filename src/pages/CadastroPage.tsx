import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import { Progress } from "@/components/ui/progress";

/* ── Types ─────────────────────────────────────────── */
type Msg = { role: "ai" | "user"; text: string };

type Step = "nome" | "email" | "senha" | "whatsapp" | "nicho" | "criando";

const STEPS: Step[] = ["nome", "email", "senha", "whatsapp", "nicho", "criando"];

const placeholders: Record<Step, string> = {
  nome: "Digite seu nome completo...",
  email: "Digite seu melhor email...",
  senha: "Crie uma senha segura...",
  whatsapp: "(XX) XXXXX-XXXX",
  nicho: "Ex: moda, eletrônicos, beleza...",
  criando: "",
};

const NICHOS = ["moda", "eletrônicos", "beleza", "casa", "pets", "esportes"];

/* ── Logo ──────────────────────────────────────────── */
const WuilliHex = () => (
  <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);

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
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("nome");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collected data
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Auto-greet
  useEffect(() => {
    setTimeout(() => {
      addAI("Olá! 👋 Vou te ajudar a criar sua conta na Wuilli. Pode começar me dizendo seu nome completo?");
    }, 400);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, step]);

  const addAI = (text: string) => setMessages(p => [...p, { role: "ai", text }]);
  const addUser = (text: string) => setMessages(p => [...p, { role: "user", text }]);

  const stepIndex = STEPS.indexOf(step);
  const progressPct = Math.round(((stepIndex) / 5) * 100);

  /* ── Submit handler ──────────────────────────────── */
  const handleSend = async () => {
    const val = input.trim();
    if (!val || loading || step === "criando") return;

    if (step === "nome") {
      if (val.length < 2) { addAI("Hmm, nome muito curto. Pode digitar seu nome completo?"); return; }
      setNome(val);
      addUser(val);
      setInput("");
      setTimeout(() => addAI(`Prazer, ${val.split(" ")[0]}! 😊 Qual é o seu email?`), 300);
      setStep("email");
    } else if (step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { addAI("Esse email não parece válido. Tente novamente."); return; }
      setEmail(val);
      addUser(val);
      setInput("");
      setTimeout(() => addAI("Perfeito! Agora crie uma senha com pelo menos 8 caracteres. 🔒"), 300);
      setStep("senha");
    } else if (step === "senha") {
      if (val.length < 8) { addAI("A senha precisa ter pelo menos 8 caracteres. Tente novamente."); return; }
      setSenha(val);
      addUser("••••••••");
      setInput("");
      setTimeout(() => addAI("Boa! 📱 Qual é o seu WhatsApp? Vou usar para te avisar sobre suas vendas."), 300);
      setStep("whatsapp");
    } else if (step === "whatsapp") {
      if (!isValidWhatsApp(val)) { addAI("O formato precisa ser (XX) XXXXX-XXXX. Tente novamente."); return; }
      setWhatsapp(val);
      addUser(val);
      setInput("");
      setTimeout(() => addAI("Última pergunta: qual nicho você quer explorar primeiro? 🎯\n\nEscolha: moda, eletrônicos, beleza, casa, pets ou esportes"), 300);
      setStep("nicho");
    } else if (step === "nicho") {
      const lower = val.toLowerCase();
      const matched = NICHOS.find(n => lower.includes(n));
      const nicho = matched || val;
      addUser(val);
      setInput("");
      setStep("criando");
      setTimeout(() => addAI(`Tudo certo, ${nome.split(" ")[0]}! 🚀 Criando sua conta...`), 300);

      // Create account
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
          setTimeout(() => addAI("Hmm, esse email já está cadastrado. 🤔 Quer tentar outro ou fazer login?"), 300);
        } else {
          setStep("nicho");
          setTimeout(() => addAI(`Ops, algo deu errado: ${error.message}. Tente novamente.`), 300);
        }
        return;
      }

      // Save profile data
      if (data.user) {
        await supabase.from("profiles").update({
          display_name: nome,
          whatsapp,
          nicho,
        }).eq("user_id", data.user.id);
      }

      setLoading(false);
      setTimeout(() => {
        addAI("Conta criada com sucesso! ✅ Redirecionando para o dashboard...");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
      }, 500);
    }
  };

  const str = step === "senha" ? passwordStrength(input) : null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-white px-6 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400 font-medium">Cadastro</span>
          <span className="text-xs text-gray-400 font-medium">{Math.min(stepIndex + 1, 5)}/5</span>
        </div>
        <Progress value={progressPct} className="h-1.5 bg-gray-100" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "ai" && (
                <div className="shrink-0 mt-0.5">
                  <WuilliHex />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#7C3AED] text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start animate-in fade-in duration-300">
              <div className="shrink-0 mt-0.5"><WuilliHex /></div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      {step !== "criando" && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-8 py-4">
          <div className="max-w-2xl mx-auto">
            {/* Password strength indicator */}
            {step === "senha" && input.length > 0 && str && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${str.pct}%`, backgroundColor: str.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: str.color }}>{str.label}</span>
              </div>
            )}

            {/* Nicho quick picks */}
            {step === "nicho" && (
              <div className="flex flex-wrap gap-2 mb-3">
                {NICHOS.map(n => (
                  <button
                    key={n}
                    onClick={() => { setInput(n); }}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED] transition-all capitalize"
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type={step === "senha" ? "password" : "text"}
                value={input}
                onChange={e => {
                  if (step === "whatsapp") {
                    setInput(maskWhatsApp(e.target.value));
                  } else {
                    setInput(e.target.value);
                  }
                }}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder={placeholders[step]}
                disabled={loading}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>

            <p className="mt-3 text-center text-xs text-gray-400">
              Já tem conta?{" "}
              <Link to="/login" className="text-[#7C3AED] font-semibold hover:underline">
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
