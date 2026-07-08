import { useEffect, useRef, useState } from "react";
import { ArrowUp, Headphones, Loader2, UserRound } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RefundSection from "@/components/dashboard/RefundSection";

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

const SupportTab = () => {
  const { user } = useAuth();
  const { nome } = useProfile();
  const firstName = (nome || "").split(" ")[0] || "tudo bem";
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [supportMessages, loading, ticketLoading]);

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
      return newTicket;
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível iniciar o atendimento com o suporte.");
      return null;
    } finally {
      setTicketLoading(false);
    }
  };

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

  const send = async (text: string) => {
    await sendHumanMessage(text);
  };

  const visibleSupportMessages = supportMessages.filter((m) => m.sender !== "ai");
  const hasAdminReply = visibleSupportMessages.some((m) => m.sender === "admin");
  const supportClosed = ticket?.status === "closed";
  const supportReady = ticketLoading || (!!ticket && !supportClosed);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-[#0A0A0A] dark:text-white">Suporte Velo</h2>
          <p className="mt-0.5 text-[13px] text-[#737373] dark:text-zinc-400">
            Fale com nosso suporte para tirar dúvidas sobre sua conta, plano, integrações e operação na plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!ticket && (
            <button
              type="button"
              onClick={() => void startHumanSupport()}
              disabled={ticketLoading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-black px-5 text-[13px] font-semibold leading-none text-white shadow-sm transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {ticketLoading ? <Loader2 size={14} className="animate-spin" /> : <Headphones size={14} />}
              Chamar Ticket
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] dark:border-white/10 dark:bg-[#0f0f0f]">
        <div
          ref={scrollRef}
          className="h-[480px] space-y-3 overflow-y-auto p-4 scroll-smooth"
        >
          <>
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 text-[13px] leading-6 text-[#525252] dark:border-white/10 dark:bg-[#151515] dark:text-zinc-300">
              <p className="font-semibold text-[#0A0A0A] dark:text-white">
                {supportReady ? "Atendimento em andamento" : `Olá, ${firstName}!`}
              </p>
              <p className="mt-1">
                {supportReady
                  ? "Sua conversa com o suporte foi iniciada. Envie sua mensagem e nossa equipe responderá por aqui."
                  : "Estamos preparando seu atendimento com a equipe da Velo."}
              </p>
            </div>

            {ticket && !hasAdminReply && !supportClosed && (
              <div className="rounded-full bg-amber-50 px-4 py-2 text-center text-[12px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                Aguardando resposta do suporte
              </div>
            )}

            {supportClosed && (
              <div className="rounded-full bg-emerald-50 px-4 py-2 text-center text-[12px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Este ticket foi marcado como resolvido.
              </div>
            )}

            {visibleSupportMessages.map((m) => (
              <HumanMessageBubble key={m.id} msg={m} />
            ))}
          </>

          {(loading || ticketLoading) && <TypingBubble />}
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
            placeholder="Digite sua mensagem para o suporte..."
            disabled={loading || ticketLoading || supportClosed || !ticket}
            className="h-10 flex-1 rounded-full border border-[#E5E5E5] bg-white px-4 text-[14px] text-[#0A0A0A] outline-none transition-colors placeholder:text-[#A3A3A3] focus:border-black disabled:opacity-60 dark:border-white/10 dark:bg-[#0f0f0f] dark:text-white dark:focus:border-white"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || ticketLoading || supportClosed || !ticket || !input.trim()}
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

const HumanMessageBubble = ({ msg }: { msg: SupportMessage }) => {
  const isUser = msg.sender === "user";

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
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-white dark:bg-white dark:text-black">
        <UserRound size={14} strokeWidth={2.2} />
      </div>
      <div className="max-w-[75%] rounded-[4px_16px_16px_16px] bg-white px-4 py-2.5 text-[14px] leading-[1.6] text-[#0A0A0A] shadow-sm whitespace-pre-wrap dark:bg-zinc-800 dark:text-white">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#737373] dark:text-zinc-400">
          Suporte Velo
        </p>
        {msg.message}
      </div>
    </div>
  );
};

const TypingBubble = () => (
  <div className="flex items-start gap-2">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
      <Headphones size={14} strokeWidth={2.2} />
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
