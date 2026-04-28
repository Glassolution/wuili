import { useEffect, useRef, useState } from "react";
import { ArrowUp, Cloud, Headphones, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RefundSection from "@/components/dashboard/RefundSection";

type AiMsg = { role: "user" | "assistant"; content: string };

type SupportTicket = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  ai_active: boolean;
  admin_last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  sender: "user" | "admin" | "ai";
  created_at: string;
};

const SUGGESTIONS = [
  "Como importar um produto?",
  "Meu plano não foi ativado",
  "Como conectar o Mercado Livre?",
  "Falar com suporte humano",
];

const SupportTab = () => {
  const { user } = useAuth();
  const { nome } = useProfile();
  const firstName = (nome || "").split(" ")[0] || "tudo bem";

  const greeting = `Olá, ${firstName}! Sou a IA de suporte da Velo. Posso te ajudar com:
• Dúvidas sobre importar produtos do catálogo
• Como publicar no Mercado Livre e Shopee
• Problemas com integrações
• Dúvidas sobre seu plano e faturamento
• Qualquer outra questão sobre a plataforma

Como posso te ajudar hoje?`;

  const [messages, setMessages] = useState<AiMsg[]>([
    { role: "assistant", content: greeting },
  ]);
  const [humanMode, setHumanMode] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, supportMessages, loading, ticketLoading, humanMode]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadOpenTicket = async () => {
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || error || !data) return;

      setTicket(data as SupportTicket);
      setHumanMode(true);
    };

    void loadOpenTicket();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!ticket?.id) return;

    let cancelled = false;

    const appendMessage = (message: SupportMessage) => {
      setSupportMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev, message]
      );
    };

    const loadMessages = async () => {
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        toast.error("Não foi possível carregar o histórico do suporte.");
        return;
      }

      setSupportMessages((data ?? []) as SupportMessage[]);
    };

    void loadMessages();

    const channel = supabase
      .channel(`support-ticket:${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => appendMessage(payload.new as SupportMessage)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${ticket.id}`,
        },
        (payload) => setTicket(payload.new as SupportTicket)
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [ticket?.id]);

  const startHumanSupport = async (): Promise<SupportTicket | null> => {
    if (!user?.id) {
      toast.error("Faça login para falar com o suporte.");
      return null;
    }

    setTicketLoading(true);

    try {
      if (ticket?.status === "open") {
        if (ticket.ai_active) {
          const { error: pauseError } = await (supabase as any)
            .from("support_tickets")
            .update({ ai_active: false })
            .eq("id", ticket.id)
            .eq("user_id", user.id);

          if (pauseError) throw pauseError;
          setTicket({ ...ticket, ai_active: false });
        }
        setHumanMode(true);
        toast.success("Suporte humano acionado.");
        return ticket;
      }

      const { data: existing, error: existingError } = await (supabase as any)
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const openTicket = existing as SupportTicket;
        if (openTicket.ai_active) {
          const { error: pauseError } = await (supabase as any)
            .from("support_tickets")
            .update({ ai_active: false })
            .eq("id", openTicket.id)
            .eq("user_id", user.id);

          if (pauseError) throw pauseError;
          openTicket.ai_active = false;
        }
        setTicket(openTicket);
        setHumanMode(true);
        toast.success("Suporte humano acionado.");
        return openTicket;
      }

      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .insert({ user_id: user.id, status: "open", ai_active: false })
        .select("*")
        .single();

      if (error) throw error;

      const newTicket = data as SupportTicket;
      setTicket(newTicket);
      setSupportMessages([]);
      setHumanMode(true);
      toast.success("Suporte humano acionado.");
      return newTicket;
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível abrir o suporte humano.");
      return null;
    } finally {
      setTicketLoading(false);
    }
  };

  const sendAiMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (trimmed.toLowerCase() === "falar com suporte humano") {
      setInput("");
      await startHumanSupport();
      return;
    }

    const next: AiMsg[] = [...messages, { role: "user", content: trimmed }];
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

  const sendHumanMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || ticketLoading || !user?.id) return;

    let activeTicket = ticket;
    if (!activeTicket || activeTicket.status !== "open") {
      activeTicket = await startHumanSupport();
    }

    if (!activeTicket || activeTicket.status !== "open") return;

    setInput("");
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .insert({
          ticket_id: activeTicket.id,
          user_id: user.id,
          message: trimmed,
          sender: "user",
        })
        .select("*")
        .single();

      if (error) throw error;

      setSupportMessages((prev) =>
        prev.some((item) => item.id === data.id) ? prev : [...prev, data as SupportMessage]
      );
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível enviar sua mensagem ao suporte.");
      setInput(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const sendAiTicketMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || ticketLoading || !user?.id || !ticket?.id) return;

    setInput("");
    setLoading(true);

    try {
      const { data: userMessage, error: userMessageError } = await (supabase as any)
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: trimmed,
          sender: "user",
        })
        .select("*")
        .single();

      if (userMessageError) throw userMessageError;

      setSupportMessages((prev) =>
        prev.some((item) => item.id === userMessage.id) ? prev : [...prev, userMessage as SupportMessage]
      );

      const aiContext = [
        ...supportMessages,
        userMessage as SupportMessage,
      ].map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.message,
      }));

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: aiContext }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao falar com a IA.");
      }

      const aiData = await res.json();
      const aiText = String(aiData.response || "").trim();
      if (!aiText) return;

      const { data: aiMessage, error: aiMessageError } = await (supabase as any)
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: aiText,
          sender: "ai",
        })
        .select("*")
        .single();

      if (aiMessageError) throw aiMessageError;

      setSupportMessages((prev) =>
        prev.some((item) => item.id === aiMessage.id) ? prev : [...prev, aiMessage as SupportMessage]
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Não foi possível falar com a IA.");
      setInput(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const send = async (text: string) => {
    if (humanMode && ticket?.ai_active) await sendAiTicketMessage(text);
    else if (humanMode) await sendHumanMessage(text);
    else await sendAiMessage(text);
  };

  const userHasTyped = messages.some((m) => m.role === "user");
  const hasAdminReply = supportMessages.some((m) => m.sender === "admin");
  const supportClosed = ticket?.status === "closed";

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-[#0A0A0A] dark:text-white">Suporte Velo</h2>
          <p className="mt-0.5 text-[13px] text-[#737373] dark:text-zinc-400">
            {humanMode
              ? ticket?.ai_active
                ? "A IA está ativa neste ticket. Nossa equipe pode pausar e assumir quando necessário."
                : "Converse com nossa equipe de suporte."
              : "Tire suas dúvidas com a IA ou peça atendimento humano."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-black">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {humanMode ? (ticket?.ai_active ? "IA Ativa" : "Humano") : "IA Online"}
          </span>

          {!humanMode && (
            <button
              onClick={startHumanSupport}
              disabled={ticketLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-black px-3 py-1.5 text-[12px] font-semibold text-black transition hover:bg-black hover:text-white disabled:opacity-50 dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
            >
              {ticketLoading ? <Loader2 size={13} className="animate-spin" /> : <Headphones size={13} />}
              Falar com suporte humano
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] dark:border-white/10 dark:bg-[#0f0f0f]">
        <div
          ref={scrollRef}
          className="h-[480px] space-y-3 overflow-y-auto p-4 scroll-smooth"
        >
          {humanMode ? (
            <>
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 text-[13px] leading-6 text-[#525252] dark:border-white/10 dark:bg-[#151515] dark:text-zinc-300">
                <p className="font-semibold text-[#0A0A0A] dark:text-white">Atendimento humano iniciado</p>
                <p className="mt-1">
                  Suporte acionado. Em breve um atendente entrará em contato.
                </p>
              </div>

              {!ticket?.ai_active && !hasAdminReply && !supportClosed && (
                <div className="rounded-full bg-amber-50 px-4 py-2 text-center text-[12px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  Aguardando resposta do suporte
                </div>
              )}

              {ticket?.ai_active && !supportClosed && (
                <div className="rounded-full bg-blue-50 px-4 py-2 text-center text-[12px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  IA ativa neste atendimento. Você receberá respostas automáticas enquanto o suporte humano acompanha.
                </div>
              )}

              {supportClosed && (
                <div className="rounded-full bg-emerald-50 px-4 py-2 text-center text-[12px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Este ticket foi marcado como resolvido.
                </div>
              )}

              {supportMessages.map((m) => (
                <HumanMessageBubble key={m.id} msg={m} />
              ))}
            </>
          ) : (
            <>
              {messages.map((m, i) => (
                <AiMessageBubble key={i} msg={m} />
              ))}

              {!userHasTyped && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => s === "Falar com suporte humano" ? startHumanSupport() : sendAiMessage(s)}
                      className="rounded-full border border-black bg-white px-3 py-1.5 text-[12px] text-black transition-colors hover:bg-black hover:text-white dark:border-white dark:bg-[#111111] dark:text-white dark:hover:bg-white dark:hover:text-black"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {(loading || ticketLoading) && <TypingBubble humanMode={humanMode} />}
          <div ref={endRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-[#E5E5E5] bg-white px-4 py-3 dark:border-white/10 dark:bg-[#121212]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder={humanMode ? "Digite sua mensagem para o suporte..." : "Digite sua dúvida..."}
            disabled={loading || ticketLoading || supportClosed}
            className="h-10 flex-1 rounded-full border border-[#E5E5E5] bg-white px-4 text-[14px] text-[#0A0A0A] outline-none transition-colors placeholder:text-[#A3A3A3] focus:border-black disabled:opacity-60 dark:border-white/10 dark:bg-[#0f0f0f] dark:text-white dark:focus:border-white"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || ticketLoading || supportClosed || !input.trim()}
            aria-label="Enviar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {loading || ticketLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>

      <RefundSection />
    </div>
  );
};

const AiMessageBubble = ({ msg }: { msg: AiMsg }) => {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-[16px_4px_16px_16px] bg-black px-4 py-2.5 text-[14px] leading-[1.6] text-white whitespace-pre-wrap dark:bg-white dark:text-black">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
        <Cloud size={14} strokeWidth={2.2} />
      </div>
      <div className="max-w-[75%] rounded-[4px_16px_16px_16px] bg-[#F0F0F0] px-4 py-2.5 text-[14px] leading-[1.6] text-[#0A0A0A] whitespace-pre-wrap dark:bg-zinc-800 dark:text-white">
        {msg.content}
      </div>
    </div>
  );
};

const HumanMessageBubble = ({ msg }: { msg: SupportMessage }) => {
  const isUser = msg.sender === "user";
  const isAi = msg.sender === "ai";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-[16px_4px_16px_16px] bg-black px-4 py-2.5 text-[14px] leading-[1.6] text-white whitespace-pre-wrap dark:bg-white dark:text-black">
          {msg.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        isAi
          ? "bg-blue-600 text-white"
          : "bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
      }`}>
        {isAi ? <Cloud size={14} strokeWidth={2.2} /> : <UserRound size={14} strokeWidth={2.2} />}
      </div>
      <div className={`max-w-[75%] rounded-[4px_16px_16px_16px] px-4 py-2.5 text-[14px] leading-[1.6] shadow-sm whitespace-pre-wrap ${
        isAi
          ? "bg-blue-50 text-blue-950 dark:bg-blue-500/10 dark:text-blue-100"
          : "bg-white text-[#0A0A0A] dark:bg-zinc-800 dark:text-white"
      }`}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#737373] dark:text-zinc-400">
          {isAi ? "IA Velo" : "Suporte Velo"}
        </p>
        {msg.message}
      </div>
    </div>
  );
};

const TypingBubble = ({ humanMode }: { humanMode: boolean }) => (
  <div className="flex items-start gap-2">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
      {humanMode ? <Headphones size={14} strokeWidth={2.2} /> : <Cloud size={14} strokeWidth={2.2} />}
    </div>
    <div className="flex items-center gap-1.5 rounded-[4px_16px_16px_16px] bg-[#F0F0F0] px-4 py-3 dark:bg-zinc-800">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#737373] dark:bg-zinc-300"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  </div>
);

export default SupportTab;
