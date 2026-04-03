import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Paperclip,
  Mic,
  Sparkles,
  ShoppingCart,
  BarChart3,
  Megaphone,
  ChevronDown,
  ListChecks,
  ArrowUpRight,
} from "lucide-react";

const tasks = [
  "Analisar produtos em alta no Mercado Livre",
  "Criar anúncio otimizado para fone TWS",
  "Responder perguntas de compradores",
];

const suggestedPrompt = "Quais são os produtos com melhor margem no meu catálogo que eu deveria priorizar?";

const quickActions = [
  { icon: ShoppingCart, label: "Ver Catálogo", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", to: "/dashboard/catalogo" },
  { icon: ListChecks, label: "Meus Pedidos", color: "text-[#7C3AED]", bg: "bg-[#EDE9FE]", to: "/dashboard/pedidos" },
  { icon: Megaphone, label: "Publicações", color: "text-[#EA580C]", bg: "bg-[#FFF7ED]", to: "/dashboard/publicacoes" },
  { icon: BarChart3, label: "Relatórios", color: "text-[#0284C7]", bg: "bg-[#E0F2FE]", to: "/dashboard/relatorios" },
];

const useTypewriter = (text: string, speed = 40, delay = 0) => {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) { setDone(true); return; }
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed);
    return () => clearTimeout(t);
  }, [displayed, started, text, speed]);

  return { displayed, done };
};

const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <div className={`opacity-0 ${className}`} style={{ animation: `dashReveal 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}ms both` }}>
    {children}
  </div>
);

const GitChatPage = () => {
  const [message, setMessage] = useState("");
  const { displayed: title, done: titleDone } = useTypewriter("Olá, bem-vindo 👋", 65, 800);
  const { displayed: subtitle, done: subtitleDone } = useTypewriter("Diga o que você precisa, e a IA cuida do resto.", 35, 2200);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
      <style>{`
        @keyframes dashReveal {
          from { opacity: 0; transform: translateY(36px) scale(0.96); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center px-4 pb-6">
        <div className="flex-1 flex flex-col items-center justify-center w-full py-8">
          <Reveal delay={300}>
            <div className="relative mb-5 w-16 h-16">
              <div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#a78bfa] opacity-95" />
            </div>
          </Reveal>

          <Reveal delay={600} className="text-center">
            <h1 className="font-['Sora'] text-2xl font-bold text-foreground tracking-[-0.02em] mb-1 min-h-[2rem]">
              {title}
              {!titleDone && <span className="inline-block w-[2px] h-5 bg-[#7C3AED] ml-0.5 align-middle animate-pulse" />}
            </h1>
          </Reveal>

          <Reveal delay={1000} className="text-center">
            <p className="text-sm text-muted-foreground mb-10 min-h-[1.25rem]">
              {subtitle}
              {!subtitleDone && subtitle.length > 0 && <span className="inline-block w-[2px] h-4 bg-muted-foreground/40 ml-0.5 align-middle animate-pulse" />}
            </p>
          </Reveal>

          <Reveal delay={3800} className="w-full flex justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 max-w-[680px]">
              <div className="bg-[#1A1A2E] text-white rounded-2xl p-4 flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center text-[9px] font-bold">S</div>
                  <span className="text-xs font-medium">Sam AI</span>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#7C3AED] text-white ml-auto">Sales Assistant</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Projetado para ajudar a gerenciar vendas e maximizar o engajamento dos clientes.
                </p>
              </div>

              <div className="bg-background border border-border rounded-2xl p-4 flex flex-col min-h-[140px]">
                <ul className="space-y-2 flex-1">
                  {tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground leading-snug">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                  <span className="text-[10px] text-muted-foreground/60">Tarefas</span>
                  <span className="text-[10px] text-[#7C3AED] font-medium cursor-pointer hover:underline">Ver Tudo</span>
                </div>
              </div>

              <div className="bg-background border border-border rounded-2xl p-4 flex flex-col justify-between min-h-[140px]">
                <p className="text-[12px] text-foreground leading-snug font-medium">{suggestedPrompt}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                  <span className="text-[10px] text-muted-foreground/60">Sugestão</span>
                  <button className="text-muted-foreground/40 hover:text-foreground transition-colors">
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={4400} className="w-full flex justify-center">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              {quickActions.map(({ icon: Icon, label, color, bg, to }) => (
                <Link key={label} to={to} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-all">
                  <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon size={13} className={color} />
                  </div>
                  {label}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={5000} className="w-full flex justify-center">
          <div className="w-full max-w-[680px]">
            <div className="border border-border rounded-2xl bg-background p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} className="text-muted-foreground/50" />
                <input
                  type="text"
                  placeholder="Pergunte qualquer coisa..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                  Selecionar fonte <ChevronDown size={12} />
                </button>
                <div className="flex items-center gap-1.5">
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
                    <Paperclip size={14} /> Anexar
                  </button>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
                    <Mic size={14} /> Voz
                  </button>
                  <button className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg px-4 py-1.5 hover:bg-[#6D28D9] transition-colors">
                    <Send size={13} /> Enviar
                  </button>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/50 mt-3">
              Wuilli pode exibir informações imprecisas, por favor verifique as respostas.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

export default GitChatPage;
