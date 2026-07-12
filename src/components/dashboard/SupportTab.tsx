import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUp, Check, CheckCheck, Headphones, Loader2, UserRound, X } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RefundSection from "@/components/dashboard/RefundSection";
import { notifyNewSupportTicketEmail } from "@/lib/supportEmail";

const TRIAL_REASON_MESSAGES: Record<string, string> = {
  bug: "Olá! Estou no período de trial e encontrei um bug na plataforma. Poderiam me ajudar?",
  refund: "Olá! Estou no período de trial e gostaria de solicitar um reembolso. Poderiam me orientar?",
  billing: "Olá! Tenho uma dúvida sobre cobrança relacionada ao meu trial. Podem me ajudar?",
  other: "Olá! Preciso de ajuda com um assunto relacionado ao meu trial.",
};

export const SUPPORT_CATEGORIES: Array<{ key: TicketCategory; label: string; description: string }> = [
  { key: "financeiro", label: "Financeiro", description: "Cobranças, planos e pagamentos" },
  { key: "bug", label: "Bug / Erro", description: "Problemas técnicos na plataforma" },
  { key: "integracao", label: "Integrações", description: "Mercado Livre, Shopee e outras" },
  { key: "conta", label: "Conta", description: "Login, dados pessoais, acessos" },
  { key: "reembolso", label: "Reembolso", description: "Solicitações de devolução" },
  { key: "outros", label: "Outros", description: "Dúvidas gerais e outros assuntos" },
];

type TicketCategory = "financeiro" | "bug" | "integracao" | "conta" | "reembolso" | "outros";

type SupportTicket = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  ai_active: boolean;
  admin_last_seen_at: string | null;
  category: TicketCategory;
  subject: string | null;
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

type MessageReceipt = "sent" | "seen";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const trialAutoOpenRef = useRef(false);
  const [openModal, setOpenModal] = useState(false);
  const [modalCategory, setModalCategory] = useState<TicketCategory>("outros");
  const [modalSubject, setModalSubject] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [supportMessages, loading, ticketLoading]);

  useEffect(() => {
    if (!user?.id) {
      setTicket(null);
      setSupportMessages([]);
      return;
    }

    let active = true;

    const loadOpenTicket = async () => {
      setTicketLoading(true);

      try {
        const { data, error } = await (supabase as any)
          .from("support_tickets")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "open")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!active) return;
        if (error) throw error;

        setTicket((data as SupportTicket | null) ?? null);
      } catch (error) {
        console.error(error);
        if (active) toast.error("Não foi possível carregar seu ticket aberto.");
      } finally {
        if (active) setTicketLoading(false);
      }
    };

    void loadOpenTicket();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const startHumanSupport = async (
    opts?: { category?: TicketCategory; subject?: string | null }
  ): Promise<SupportTicket | null> => {
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

      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        status: "open",
        ai_active: false,
        category: opts?.category ?? "outros",
      };
      if (opts?.subject) insertPayload.subject = opts.subject;

      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .insert(insertPayload)
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
    const hadActiveTicket = activeTicket?.status === "open";
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
      if (!hadActiveTicket) {
        notifyNewSupportTicketEmail(activeTicket.id, data.id).catch((error) => {
          console.error(error);
          toast.error(error instanceof Error ? error.message : "Ticket aberto, mas não foi possível avisar os admins por email.");
        });
      }
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

  // Auto-open a support ticket with a pre-filled message when redirected from the trial banner
  useEffect(() => {
    const reason = searchParams.get("trial_reason");
    if (!reason || !user?.id || ticketLoading || trialAutoOpenRef.current) return;
    trialAutoOpenRef.current = true;

    const message = TRIAL_REASON_MESSAGES[reason] ?? TRIAL_REASON_MESSAGES.other;

    (async () => {
      await sendHumanMessage(message);
      const next = new URLSearchParams(searchParams);
      next.delete("trial_reason");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, ticketLoading]);



  const visibleSupportMessages = supportMessages.filter((m) => m.sender !== "ai");
  const hasAdminReply = visibleSupportMessages.some((m) => m.sender === "admin");
  const getMessageReceipt = (message: SupportMessage): MessageReceipt => {
    if (message.sender === "admin") return "seen";

    const messageTime = new Date(message.created_at).getTime();
    const hasReplyAfter = visibleSupportMessages.some((item) => {
      return item.sender === "admin" && new Date(item.created_at).getTime() > messageTime;
    });

    return hasReplyAfter ? "seen" : "sent";
  };
  const supportClosed = ticket?.status === "closed";
  const supportReady = ticketLoading || (!!ticket && !supportClosed);

  return (
    <div className="flex min-h-[calc(100svh-176px)] flex-col md:min-h-0">
      <div className="mb-4 flex flex-col gap-3 md:mb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[24px] font-black tracking-[-0.04em] text-[#0A0A0A] dark:text-white md:text-[20px] md:font-semibold md:tracking-normal">Suporte Velo</h2>
          <p className="mt-1 max-w-[320px] text-[13px] font-medium leading-5 text-[#737373] dark:text-zinc-400 md:max-w-none md:font-normal">
            Fale com nosso suporte para tirar dúvidas sobre sua conta, plano, integrações e operação na plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!ticket && (
            <button
              type="button"
              onClick={() => setOpenModal(true)}
              disabled={ticketLoading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-[13px] font-semibold leading-none text-white shadow-sm transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black sm:w-auto"
            >
              {ticketLoading ? <Loader2 size={14} className="animate-spin" /> : <Headphones size={14} />}
              Abrir novo ticket
            </button>
          )}
        </div>
      </div>

      {openModal && (
        <NewTicketModal
          category={modalCategory}
          subject={modalSubject}
          onCategoryChange={setModalCategory}
          onSubjectChange={setModalSubject}
          submitting={creatingTicket}
          onClose={() => setOpenModal(false)}
          onSubmit={async () => {
            const subj = modalSubject.trim();
            if (!subj) {
              toast.error("Descreva brevemente o motivo do ticket.");
              return;
            }
            setCreatingTicket(true);
            try {
              const created = await startHumanSupport({ category: modalCategory, subject: subj });
              if (created) {
                const { data: message, error: messageError } = await (supabase as any)
                  .from("support_messages")
                  .insert({
                    ticket_id: created.id,
                    user_id: user!.id,
                    message: subj,
                    sender: "user",
                  })
                  .select("*")
                  .single();
                if (messageError) throw messageError;
                notifyNewSupportTicketEmail(created.id, message.id).catch((error) => {
                  console.error(error);
                  toast.error(error instanceof Error ? error.message : "Ticket aberto, mas não foi possível avisar os admins por email.");
                });
                setOpenModal(false);
                setModalSubject("");
                setModalCategory("outros");
              }
            } finally {
              setCreatingTicket(false);
            }
          }}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[#E5E5E5] bg-[#FAFAFA] dark:border-white/10 dark:bg-[#0f0f0f] md:flex-none md:rounded-xl">
        <div
          ref={scrollRef}
          className="h-[calc(100svh-382px)] min-h-[300px] space-y-3 overflow-y-auto p-4 scroll-smooth md:h-[480px]"
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
              <HumanMessageBubble key={m.id} msg={m} receipt={getMessageReceipt(m)} />
            ))}
          </>

          {(loading || ticketLoading) && <TypingBubble />}
          <div ref={endRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-[#E5E5E5] bg-white px-3 py-3 dark:border-white/10 dark:bg-[#121212] md:px-4">
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

      <div className="mt-4 md:mt-6">
        <RefundSection />
      </div>
    </div>
  );
};

const HumanMessageBubble = ({ msg, receipt }: { msg: SupportMessage; receipt: MessageReceipt }) => {
  const isUser = msg.sender === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-[16px_4px_16px_16px] bg-black px-4 py-2.5 text-[14px] leading-[1.6] text-white whitespace-pre-wrap dark:bg-white dark:text-black">
          {msg.message}
          <MessageReceiptLabel receipt={receipt} inverted />
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
        <MessageReceiptLabel receipt={receipt} />
      </div>
    </div>
  );
};

const MessageReceiptLabel = ({ receipt, inverted = false }: { receipt: MessageReceipt; inverted?: boolean }) => {
  const Icon = receipt === "seen" ? CheckCheck : Check;

  return (
    <span
      className={[
        "mt-1.5 flex items-center justify-end gap-1 text-[10px] font-semibold leading-none",
        inverted ? "text-white/65 dark:text-black/60" : "text-[#A3A3A3] dark:text-zinc-400",
      ].join(" ")}
    >
      <Icon size={12} strokeWidth={2.4} />
      {receipt === "seen" ? "Visto" : "Enviado"}
    </span>
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

const NewTicketModal = ({
  category,
  subject,
  onCategoryChange,
  onSubjectChange,
  submitting,
  onClose,
  onSubmit,
}: {
  category: TicketCategory;
  subject: string;
  onCategoryChange: (c: TicketCategory) => void;
  onSubjectChange: (s: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 md:items-center md:p-4" onClick={onClose}>
    <div
      className="max-h-[calc(100svh-24px)] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-4 shadow-2xl dark:bg-[#141414] md:p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-[18px] font-bold text-[#0A0A0A] dark:text-white">Abrir novo ticket</h3>
          <p className="mt-1 text-[13px] text-[#737373] dark:text-zinc-400">
            Escolha o setor e descreva brevemente o motivo. Nosso time responde por aqui.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-1 text-[#737373] hover:bg-[#F0F0F0] dark:text-zinc-400 dark:hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#737373] dark:text-zinc-400">
        Setor
      </label>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SUPPORT_CATEGORIES.map((cat) => {
          const active = cat.key === category;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onCategoryChange(cat.key)}
              className={[
                "rounded-xl border p-3 text-left transition",
                active
                  ? "border-black bg-[#FAFAFA] dark:border-white dark:bg-white/5"
                  : "border-[#E5E5E5] hover:border-[#0A0A0A] dark:border-white/10 dark:hover:border-white/40",
              ].join(" ")}
            >
              <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">{cat.label}</p>
              <p className="mt-0.5 text-[11px] text-[#737373] dark:text-zinc-400">{cat.description}</p>
            </button>
          );
        })}
      </div>

      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#737373] dark:text-zinc-400">
        Motivo do ticket
      </label>
      <textarea
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        placeholder="Ex.: Não recebi o comprovante da minha última cobrança..."
        rows={4}
        className="w-full resize-none rounded-xl border border-[#E5E5E5] bg-white p-3 text-[14px] text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus:border-black dark:border-white/10 dark:bg-[#0f0f0f] dark:text-white"
      />

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={onClose}
          className="min-h-11 rounded-full border border-[#E5E5E5] px-5 py-2 text-[13px] font-semibold text-[#0A0A0A] hover:bg-[#F5F5F5] dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || !subject.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-black px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Abrir ticket
        </button>
      </div>
    </div>
  </div>
);

export default SupportTab;
