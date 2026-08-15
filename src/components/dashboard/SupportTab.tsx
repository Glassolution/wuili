import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Download,
  Inbox,
  Loader2,
  Paperclip,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { notifyNewSupportTicketEmail } from "@/lib/supportEmail";
import {
  ACTIVE_SUPPORT_TICKET_EVENT,
  CATEGORY_LABEL,
  FAQ_ITEMS,
  formatTicketDate as formatDate,
  playSoftSupportNotification,
  protocolo,
  readActiveSupportTicketId,
  setActiveSupportTicketId,
  shouldAnnounceSupportReply,
  SUPPORT_CATEGORIES,
  buildSupportImageMessage,
  removeSupportImage,
  supportDb as db,
  uploadSupportImage,
  validateSupportImage,
  type SupportMessage,
  type SupportTicket,
  type TicketCategory,
} from "@/lib/support";
import SupportImagePreview from "@/components/support/SupportImagePreview";
import SupportMessageMedia from "@/components/support/SupportMessageMedia";

const TRIAL_REASON_MESSAGES: Record<string, string> = {
  bug: "Olá! Estou no período de trial e encontrei um bug na plataforma. Poderiam me ajudar?",
  refund: "Olá! Estou no período de trial e gostaria de solicitar um reembolso. Poderiam me orientar?",
  billing: "Olá! Tenho uma dúvida sobre cobrança relacionada ao meu trial. Podem me ajudar?",
  other: "Olá! Preciso de ajuda com um assunto relacionado ao meu trial.",
};

const TRIAL_REASON_CATEGORY: Record<string, TicketCategory> = {
  bug: "bug",
  refund: "reembolso",
  billing: "financeiro",
  other: "outros",
};

const announceSupportReply = (message: SupportMessage) => {
  if (!shouldAnnounceSupportReply(message)) return;
  playSoftSupportNotification();
  toast.info("Nova resposta do suporte recebida.");
};

/* ──── estilos compartilhados ──── */
const card =
  "rounded-[16px] border border-[#EAEAEA] bg-white p-5 shadow-[0_1px_2px_rgba(15,15,15,0.04)] dark:border-white/10 dark:bg-[#0f0f0f]";
const fieldLabel = "mb-1.5 block text-[11.5px] text-[#8A8A8A] dark:text-zinc-500";
const underline =
  "h-9 w-full border-0 border-b border-[#E4E4E4] bg-transparent px-0 text-[13.5px] text-[#111113] outline-none transition-colors placeholder:text-[#BDBDBD] focus:border-[#111113] disabled:text-[#9A9A9A] dark:border-white/15 dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-white";

const Field = ({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={`min-w-0 ${className}`}>
    <label className={fieldLabel}>{label}</label>
    <div className="relative">{children}</div>
  </div>
);

const SupportTab = () => {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Formulário de novo ticket
  const [formCategory, setFormCategory] = useState<TicketCategory>("outros");
  const [formSubject, setFormSubject] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Busca no histórico
  const [query, setQuery] = useState("");

  // Conversa do ticket selecionado
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messageImage, setMessageImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [faqOpen, setFaqOpen] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const trialAutoOpenRef = useRef(false);

  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

  /* ── carrega os tickets do usuário ── */
  useEffect(() => {
    if (!user?.id) {
      setTickets([]);
      return;
    }

    let active = true;

    const loadTickets = async () => {
      setTicketsLoading(true);
      try {
        const { data, error } = await db
          .from("support_tickets")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (error) throw error;

        const nextTickets = (data ?? []) as SupportTicket[];
        setTickets(nextTickets);

        const activeTicketId = readActiveSupportTicketId();
        const activeTicket = nextTickets.find((ticket) => ticket.id === activeTicketId && ticket.status === "open");
        if (activeTicket) {
          setSelectedId(activeTicket.id);
        } else if (activeTicketId) {
          setActiveSupportTicketId(null);
        }
      } catch (error) {
        console.error(error);
        if (active) toast.error("Não foi possível carregar seus tickets.");
      } finally {
        if (active) setTicketsLoading(false);
      }
    };

    void loadTickets();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const syncActiveTicket = (event: Event) => {
      const ticketId =
        event instanceof CustomEvent && typeof event.detail?.ticketId === "string"
          ? event.detail.ticketId
          : readActiveSupportTicketId();

      if (ticketId) setSelectedId(ticketId);
    };

    window.addEventListener(ACTIVE_SUPPORT_TICKET_EVENT, syncActiveTicket);
    return () => window.removeEventListener(ACTIVE_SUPPORT_TICKET_EVENT, syncActiveTicket);
  }, []);

  /* ── mensagens + realtime do ticket aberto na conversa ── */
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      setMessagesLoading(true);
      const { data, error } = await db
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setMessagesLoading(false);

      if (error) {
        toast.error("Não foi possível carregar o histórico do suporte.");
        return;
      }

      setMessages((data ?? []) as SupportMessage[]);
    };

    void loadMessages();

    const channel = supabase
      .channel(`support-ticket:${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedId}`,
        },
        (payload) => {
          const message = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
          announceSupportReply(message);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${selectedId}`,
        },
        (payload) => {
          const updated = payload.new as SupportTicket;
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          if (updated.status === "closed" && readActiveSupportTicketId() === updated.id) {
            setActiveSupportTicketId(null);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, messagesLoading]);

  /* ── criação de ticket ── */
  const createTicket = async (opts: {
    category: TicketCategory;
    subject: string;
    firstMessage: string;
  }): Promise<SupportTicket | null> => {
    if (!user?.id) {
      toast.error("Faça login para falar com o suporte.");
      return null;
    }

    try {
      const { data, error } = await db
        .from("support_tickets")
        .insert({
          user_id: user.id,
          status: "open",
          ai_active: false,
          category: opts.category,
          subject: opts.subject,
        })
        .select("*")
        .single();

      if (error) throw error;

      const created = data as SupportTicket;

      const { data: message, error: messageError } = await db
        .from("support_messages")
        .insert({
          ticket_id: created.id,
          user_id: user.id,
          message: opts.firstMessage,
          sender: "user",
        })
        .select("*")
        .single();

      if (messageError) throw messageError;

      setTickets((prev) => [created, ...prev]);
      setActiveSupportTicketId(created.id);

      notifyNewSupportTicketEmail(created.id, message.id).catch((err) => {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Ticket aberto, mas não foi possível avisar os admins por email.",
        );
      });

      return created;
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível abrir o ticket.");
      return null;
    }
  };

  const handleSubmitTicket = async () => {
    const subject = formSubject.trim();
    const description = formDescription.trim();

    if (!subject) {
      toast.error("Informe o assunto do ticket.");
      return;
    }
    if (!description) {
      toast.error("Descreva o que aconteceu para o suporte entender seu caso.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createTicket({
        category: formCategory,
        subject,
        firstMessage: description,
      });
      if (created) {
        toast.success("Ticket aberto. Nosso time responde por aqui.");
        setFormSubject("");
        setFormDescription("");
        setFormCategory("outros");
        setSelectedId(created.id);
        setActiveSupportTicketId(created.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── envio de mensagem dentro da conversa ── */
  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !messageImage) || sending || !user?.id || !selectedTicket || selectedTicket.status !== "open") return;

    setInput("");
    setSending(true);

    let uploadedPath: string | null = null;
    try {
      const attachment = messageImage
        ? await uploadSupportImage({ file: messageImage, ticketId: selectedTicket.id, userId: user.id })
        : null;
      uploadedPath = attachment?.path ?? null;
      const { data, error } = await db
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: attachment ? buildSupportImageMessage(attachment, trimmed) : trimmed,
          sender: "user",
        })
        .select("*")
        .single();

      if (error) throw error;

      setMessages((prev) =>
        prev.some((item) => item.id === data.id) ? prev : [...prev, data as SupportMessage],
      );
      setMessageImage(null);
      setActiveSupportTicketId(selectedTicket.id);
    } catch (error) {
      if (uploadedPath) await removeSupportImage(uploadedPath);
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar sua mensagem ao suporte.");
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  /* ── abertura automática vinda do banner de trial ── */
  useEffect(() => {
    const reason = searchParams.get("trial_reason");
    if (!reason || !user?.id || ticketsLoading || trialAutoOpenRef.current) return;
    trialAutoOpenRef.current = true;

    const message = TRIAL_REASON_MESSAGES[reason] ?? TRIAL_REASON_MESSAGES.other;
    const category = TRIAL_REASON_CATEGORY[reason] ?? "outros";

    (async () => {
      const created = await createTicket({ category, subject: message.slice(0, 80), firstMessage: message });
      if (created) {
        setSelectedId(created.id);
        setActiveSupportTicketId(created.id);
      }
      const next = new URLSearchParams(searchParams);
      next.delete("trial_reason");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, ticketsLoading]);

  /* ── histórico filtrado ── */
  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        protocolo(t.id).toLowerCase().includes(q) ||
        (t.subject ?? "").toLowerCase().includes(q) ||
        CATEGORY_LABEL[t.category]?.toLowerCase().includes(q),
    );
  }, [tickets, query]);

  const handleExport = () => {
    if (!filteredTickets.length) {
      toast.error("Não há tickets para exportar.");
      return;
    }
    const linhas = [
      ["Protocolo", "Assunto", "Tipo", "Data", "Status"],
      ...filteredTickets.map((t) => [
        protocolo(t.id),
        (t.subject ?? "").replace(/"/g, '""'),
        CATEGORY_LABEL[t.category] ?? t.category,
        formatDate(t.created_at),
        t.status === "open" ? "Em aberto" : "Resolvido",
      ]),
    ];
    const csv = linhas.map((l) => l.map((c) => `"${c}"`).join(";")).join("\n");
    // BOM na frente para o Excel abrir os acentos corretamente.
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tickets-suporte-velo.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-8">
      {/* ── Cabeçalho ── */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="md:max-w-[320px]">
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white">
            Tickets de suporte
          </h2>
          <p className="mt-1 text-[13px] leading-[1.45] text-[#737373] dark:text-zinc-400">
            Quando algo não sai como esperado, você abre um ticket e nosso time resolve.
          </p>
        </div>

        <div className="flex h-9 items-center gap-2 rounded-full border border-[#E6E6E6] bg-white px-3.5 md:w-[210px] dark:border-white/10 dark:bg-[#0f0f0f]">
          <Search size={14} className="shrink-0 text-[#9A9A9A]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ticket"
            className="w-full bg-transparent text-[12.5px] text-[#111113] outline-none placeholder:text-[#9A9A9A] dark:text-white"
          />
        </div>
      </div>

      {/* ── Card: abrir novo ticket ── */}
      <section className={card}>
        <h3 className="text-[17px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white">
          Abrir novo ticket
        </h3>
        <p className="mt-1 text-[12.5px] text-[#8A8A8A] dark:text-zinc-400">
          Preencha as informações abaixo e clique em enviar ticket.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tipo de solicitação *">
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as TicketCategory)}
              className={`${underline} cursor-pointer appearance-none pr-6`}
            >
              {SUPPORT_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#8A8A8A]"
            />
          </Field>

          <Field label="Assunto *">
            <input
              value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
              placeholder="Cobrança duplicada"
              className={underline}
            />
          </Field>

          <Field label="E-mail de contato">
            <input readOnly value={user?.email ?? ""} className={`${underline} cursor-not-allowed pr-6`} />
            <Search size={13} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
          </Field>

          <Field label="Data de abertura">
            <input
              readOnly
              value={formatDate(new Date().toISOString())}
              className={`${underline} cursor-not-allowed pr-6`}
            />
            <CalendarDays
              size={13}
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#8A8A8A]"
            />
          </Field>

          <Field label="Descrição" className="sm:col-span-2 lg:col-span-4">
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmitTicket();
                }
              }}
              placeholder="Conte o que aconteceu, com o máximo de detalhes que puder"
              className={underline}
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={handleSubmitTicket}
          disabled={submitting}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#2563EB] px-7 text-[13.5px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Enviar ticket
        </button>
      </section>

      {/* ── Histórico + FAQ ── */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#111113] dark:text-white">
              Histórico de atendimentos
            </h3>
            {filteredTickets.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[#9A9A9A] transition hover:text-[#111113] dark:hover:text-white"
              >
                <Download size={13} />
                Exportar
              </button>
            )}
          </div>

          <div className="mt-3">
            {ticketsLoading ? (
              <div className="flex items-center gap-2 py-12 text-[12.5px] text-[#9A9A9A]">
                <Loader2 size={14} className="animate-spin" />
                Carregando seus tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F4F4F5] text-[#A0A0A0] dark:bg-white/5 dark:text-zinc-500">
                  <Inbox size={17} />
                </span>
                <p className="mt-3 text-[13px] font-medium text-[#111113] dark:text-white">
                  {tickets.length === 0 ? "Nenhum atendimento por aqui" : "Nada encontrado"}
                </p>
                <p className="mt-1 max-w-[240px] text-[12px] leading-[1.5] text-[#9A9A9A] dark:text-zinc-500">
                  {tickets.length === 0
                    ? "Assim que você abrir um ticket, ele aparece nesta lista."
                    : "Tente outro termo na busca."}
                </p>
              </div>
            ) : (
              <div className="-mx-2">
                {filteredTickets.map((t, index) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(t.id);
                      if (t.status === "open") setActiveSupportTicketId(t.id);
                    }}
                    className={`group block w-full rounded-[12px] px-2.5 py-3 text-left transition hover:bg-[#F7F7F8] dark:hover:bg-white/5 ${
                      index > 0 ? "border-t border-[#F2F2F2] dark:border-white/[0.07]" : ""
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#111113] dark:text-white">
                        {t.subject || CATEGORY_LABEL[t.category]}
                      </span>
                      <StatusPill status={t.status} />
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#9A9A9A] dark:text-zinc-500">
                      <Ticket size={12} className="shrink-0" />
                      <span className="truncate">
                        {protocolo(t.id)} · {CATEGORY_LABEL[t.category]} · {formatDate(t.created_at)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={card}>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#111113] dark:text-white">
            Perguntas frequentes
          </h3>

          <div className="mt-1 divide-y divide-[#F2F2F2] dark:divide-white/[0.07]">
            {FAQ_ITEMS.map((item, index) => {
              const open = faqOpen === index;
              return (
                <div key={item.question}>
                  <button
                    type="button"
                    onClick={() => setFaqOpen(open ? -1 : index)}
                    className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
                  >
                    <span
                      className={`text-[12.5px] leading-[1.4] transition-colors ${
                        open
                          ? "font-semibold text-[#111113] dark:text-white"
                          : "text-[#525257] dark:text-zinc-300"
                      }`}
                    >
                      {item.question}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-[#A8A8AD] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <p className="-mt-1 pb-4 pr-6 text-[12px] leading-[1.6] text-[#8A8A8F] dark:text-zinc-400">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[11.5px] leading-[1.5] text-[#A0A0A5] dark:text-zinc-500">
            Não achou sua resposta? Abra um ticket no formulário acima que nosso time responde por aqui.
          </p>
        </section>
      </div>

      {selectedTicket && (
        <TicketChatModal
          ticket={selectedTicket}
          messages={messages.filter((m) => m.sender !== "ai")}
          loading={messagesLoading}
          sending={sending}
          input={input}
          image={messageImage}
          onInputChange={setInput}
          onImageChange={(file) => {
            const validationError = validateSupportImage(file);
            if (validationError) {
              toast.error(validationError);
              return;
            }
            setMessageImage(file);
          }}
          onImageRemove={() => setMessageImage(null)}
          onSend={sendMessage}
          onClose={() => {
            setSelectedId(null);
            setMessageImage(null);
            setActiveSupportTicketId(null);
          }}
          endRef={endRef}
        />
      )}
    </div>
  );
};

const StatusPill = ({ status }: { status: SupportTicket["status"] }) => (
  <span
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      status === "open"
        ? "bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-500/15 dark:text-indigo-300"
        : "bg-[#ECFDF3] text-[#15803D] dark:bg-emerald-500/15 dark:text-emerald-300"
    }`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {status === "open" ? "Em aberto" : "Resolvido"}
  </span>
);

const TicketChatModal = ({
  ticket,
  messages,
  loading,
  sending,
  input,
  image,
  onInputChange,
  onImageChange,
  onImageRemove,
  onSend,
  onClose,
  endRef,
}: {
  ticket: SupportTicket;
  messages: SupportMessage[];
  loading: boolean;
  sending: boolean;
  input: string;
  image: File | null;
  onInputChange: (v: string) => void;
  onImageChange: (file: File) => void;
  onImageRemove: () => void;
  onSend: () => void;
  onClose: () => void;
  endRef: React.RefObject<HTMLDivElement>;
}) => {
  const closed = ticket.status === "closed";
  const hasAdminReply = messages.some((m) => m.sender === "admin");
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[min(720px,calc(100svh-32px))] w-full max-w-[680px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.34)] dark:bg-[#0B1220]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-[#2563EB] px-5 py-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(147,197,253,0.50),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0)_42%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] ring-1 ring-white/60">
                <AtlasAvatarIcon size={30} animated={false} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-semibold uppercase text-white/72">{protocolo(ticket.id)}</p>
                <h3 className="mt-0.5 truncate text-[19px] font-bold leading-tight text-white">
                  {ticket.subject || CATEGORY_LABEL[ticket.category]}
                </h3>
                <p className="mt-1 text-[12.5px] font-medium text-white/78">
                  {CATEGORY_LABEL[ticket.category]} · aberto em {formatDate(ticket.created_at)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/12 hover:text-white"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="min-h-[360px] flex-1 space-y-4 overflow-y-auto bg-[#F4F7FF] px-5 py-5 dark:bg-[#0F172A]">
          {loading && (
            <div className="flex items-center gap-2 text-[12.5px] text-[#64748B] dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Carregando conversa...
            </div>
          )}

          {!loading && !closed && !hasAdminReply && (
            <div className="rounded-full bg-white px-4 py-2 text-center text-[12.5px] font-semibold text-[#2563EB] shadow-sm ring-1 ring-[#DBEAFE] dark:bg-white/8 dark:text-blue-200 dark:ring-white/10">
              Aguardando resposta do suporte
            </div>
          )}

          {closed && (
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-center text-[12.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              Este ticket foi marcado como resolvido.
            </div>
          )}

          {messages.map((m) => (
            <HumanMessageBubble key={m.id} msg={m} />
          ))}

          {sending && <TypingBubble />}
          <div ref={endRef} />
        </div>

        <div className="border-t border-[#E5EFFF] bg-white px-4 py-4 dark:border-white/10 dark:bg-[#0B1220]">
          {image ? <SupportImagePreview file={image} onRemove={onImageRemove} /> : null}
          <div className="flex items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImageChange(file);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || closed}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition ${image ? "border-[#93b0ff] bg-[#eef3ff] text-[#2563EB]" : "border-[#D7E3FF] bg-[#F8FBFF] text-[#65758f] hover:border-[#2563EB] hover:text-[#2563EB]"}`}
            aria-label="Anexar imagem"
            title="Anexar imagem (até 8 MB)"
          >
            <Paperclip size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={closed ? "Ticket resolvido" : "Digite sua mensagem para o suporte..."}
            disabled={sending || closed}
            className="h-12 flex-1 rounded-full border border-[#D7E3FF] bg-[#F8FBFF] px-5 text-[14px] text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-[#60A5FA]"
          />
          <button
            onClick={onSend}
            disabled={sending || closed || (!input.trim() && !image)}
            aria-label="Enviar"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_12px_26px_rgba(37,99,235,0.32)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-[#CBD5E1] disabled:shadow-none dark:disabled:bg-white/15"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={19} />}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const HumanMessageBubble = ({ msg }: { msg: SupportMessage }) => {
  const isUser = msg.sender === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-[18px_6px_18px_18px] bg-[#2563EB] px-4 py-3 text-[14px] leading-[1.55] text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] whitespace-pre-wrap">
          <SupportMessageMedia value={msg.message} textClassName="whitespace-pre-wrap" imageClassName="max-h-[300px] max-w-[420px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#DBEAFE] dark:bg-white">
        <AtlasAvatarIcon size={24} animated={false} />
      </div>
      <div className="max-w-[78%] rounded-[6px_18px_18px_18px] bg-white px-4 py-3 text-[14px] leading-[1.55] text-[#0F172A] shadow-sm ring-1 ring-[#E8F0FF] whitespace-pre-wrap dark:bg-white/8 dark:text-white dark:ring-white/10">
        <p className="mb-1 text-[11px] font-semibold uppercase text-[#2563EB] dark:text-blue-200">
          Suporte Velo
        </p>
        <SupportMessageMedia value={msg.message} textClassName="whitespace-pre-wrap" imageClassName="max-h-[300px] max-w-[420px] w-full" />
      </div>
    </div>
  );
};

const TypingBubble = () => (
  <div className="flex items-start gap-2">
    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#DBEAFE]">
      <AtlasAvatarIcon size={24} animated={false} />
    </div>
    <div className="flex items-center gap-1.5 rounded-[6px_18px_18px_18px] bg-white px-4 py-3 shadow-sm ring-1 ring-[#E8F0FF] dark:bg-white/8 dark:ring-white/10">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2563EB] dark:bg-blue-200"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  </div>
);

export default SupportTab;
