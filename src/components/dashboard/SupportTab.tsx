import { useEffect, useRef, useState } from "react";
import { ArrowUp, Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/lib/profileContext";
import RefundSection from "@/components/dashboard/RefundSection";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Como importar um produto?",
  "Meu plano não foi ativado",
  "Como conectar o Mercado Livre?",
  "Ver meu histórico de vendas",
];

const SupportTab = () => {
  const { nome } = useProfile();
  const firstName = (nome || "").split(" ")[0] || "tudo bem";

  const greeting = `Olá, ${firstName}! 👋 Sou a IA de suporte da Velo. Posso te ajudar com:
• Dúvidas sobre importar produtos do catálogo
• Como publicar no Mercado Livre e Shopee
• Problemas com integrações
• Dúvidas sobre seu plano e faturamento
• Qualquer outra questão sobre a plataforma

Como posso te ajudar hoje?`;

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset on unmount handled implicitly by component lifecycle
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) toast.error("Muitas requisições. Aguarde um momento.");
        else if (res.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error(err.error || "Erro ao falar com a IA.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const userHasTyped = messages.some((m) => m.role === "user");

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[20px] font-bold text-[#0A0A0A]">Suporte Velo</h2>
          <p className="text-[13px] text-[#737373] mt-0.5">
            Tire suas dúvidas sobre a plataforma com nossa IA
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-black rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          IA Online
        </span>
      </div>

      {/* Chat container */}
      <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] overflow-hidden flex flex-col">
        <div
          ref={scrollRef}
          className="h-[480px] overflow-y-auto p-4 scroll-smooth space-y-3"
        >
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}

          {!userHasTyped && (
            <div className="pt-1 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-black text-black bg-white hover:bg-black hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {loading && <TypingBubble />}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#E5E5E5] bg-white px-4 py-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Digite sua dúvida..."
            disabled={loading}
            className="flex-1 h-10 px-4 rounded-full border border-[#E5E5E5] bg-white text-[14px] text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none focus:border-black transition-colors disabled:opacity-60"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            aria-label="Enviar"
            className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>

      <RefundSection />
    </div>
  );
};

const MessageBubble = ({ msg }: { msg: Msg }) => {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-black text-white text-[14px] leading-[1.6] px-4 py-2.5 rounded-[16px_4px_16px_16px] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 shrink-0 rounded-full bg-black text-white flex items-center justify-center mt-0.5">
        <Cloud size={14} strokeWidth={2.2} />
      </div>
      <div className="max-w-[75%] bg-[#F0F0F0] text-[#0A0A0A] text-[14px] leading-[1.6] px-4 py-2.5 rounded-[4px_16px_16px_16px] whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  );
};

const TypingBubble = () => (
  <div className="flex items-start gap-2">
    <div className="w-7 h-7 shrink-0 rounded-full bg-black text-white flex items-center justify-center mt-0.5">
      <Cloud size={14} strokeWidth={2.2} />
    </div>
    <div className="bg-[#F0F0F0] px-4 py-3 rounded-[4px_16px_16px_16px] flex items-center gap-1.5">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  </div>
);

export default SupportTab;
