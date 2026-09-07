import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Home,
  Inbox,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";

import { veloToast as toast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { notifyNewSupportTicketEmail } from "@/lib/supportEmail";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import {
  CATEGORY_LABEL,
  ACTIVE_SUPPORT_TICKET_EVENT,
  createSupportTicket,
  FAQ_ITEMS,
  formatTicketDate,
  formatTicketTime,
  playSoftSupportNotification,
  protocolo,
  readActiveSupportTicketId,
  setActiveSupportTicketId,
  shouldAnnounceSupportReply,
  buildSupportImageMessage,
  removeSupportImage,
  supportDb as db,
  uploadSupportImage,
  validateSupportImage,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/support";
import { supabase } from "@/integrations/supabase/client";
import SupportImagePreview from "@/components/support/SupportImagePreview";
import SupportMessageMedia from "@/components/support/SupportMessageMedia";

type WidgetTab = "home" | "messages" | "help";

const panelWidth = "min(400px, calc(100vw - 24px))";

const firstNameFrom = (name: string) => {
  const clean = name.trim();
  if (!clean || clean.toLowerCase() === "usuario") return "tudo bem";
  return clean.split(/\s+/)[0];
};

const announceSupportReply = (message: SupportMessage) => {
  if (!shouldAnnounceSupportReply(message)) return;
  playSoftSupportNotification();
  toast.info("Nova resposta do suporte recebida.");
};

const SupportFloatingWidget = () => {
  const { user } = useAuth();
  const { nome } = useProfile();
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WidgetTab>("home");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(() => readActiveSupportTicketId());
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [newConversationText, setNewConversationText] = useState("");
  const [newConversationImage, setNewConversationImage] = useState<File | null>(null);
  const [composingNewConversation, setComposingNewConversation] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [helpQuery, setHelpQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const openTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "open"), [tickets]);
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );
  const visibleFaqs = useMemo(() => {
    const query = helpQuery.trim().toLowerCase();
    if (!query) return FAQ_ITEMS;
    return FAQ_ITEMS.filter(
      (item) => item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query),
    );
  }, [helpQuery]);

  useEffect(() => {
    if (!user?.id || !open) return;

    let active = true;

    const loadTickets = async () => {
      setTicketsLoading(true);
      try {
        const { data, error } = await db
          .from("support_tickets")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (!active) return;
        if (error) throw error;
        const nextTickets = (data ?? []) as SupportTicket[];
        setTickets(nextTickets);
        setSelectedTicketId((current) => {
          if (current && nextTickets.some((ticket) => ticket.id === current)) return current;
          const activeTicketId = readActiveSupportTicketId();
          const activeTicket = nextTickets.find((ticket) => ticket.id === activeTicketId && ticket.status === "open");
          if (activeTicket) return activeTicket.id;
          if (activeTicketId) setActiveSupportTicketId(null);
          return null;
        });
      } catch (error) {
        console.error(error);
        if (active) toast.error("Não foi possível carregar seus tickets.");
      } finally {
        if (active) setTicketsLoading(false);
      }
    };

    void loadTickets();

    const channel = supabase
      .channel(`support-widget:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadTickets(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [open, user?.id]);

  useEffect(() => {
    const syncActiveTicket = (event: Event) => {
      const ticketId =
        event instanceof CustomEvent && typeof event.detail?.ticketId === "string"
          ? event.detail.ticketId
          : readActiveSupportTicketId();

      if (!ticketId) return;
      setSelectedTicketId(ticketId);
      setComposingNewConversation(false);
      setTab("messages");
    };

    window.addEventListener(ACTIVE_SUPPORT_TICKET_EVENT, syncActiveTicket);
    return () => window.removeEventListener(ACTIVE_SUPPORT_TICKET_EVENT, syncActiveTicket);
  }, []);

  useEffect(() => {
    if (!selectedTicketId || !user?.id) {
      setMessages([]);
      return;
    }

    let active = true;

    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const { data, error } = await db
          .from("support_messages")
          .select("*")
          .eq("ticket_id", selectedTicketId)
          .order("created_at", { ascending: true });

        if (!active) return;
        if (error) throw error;
        setMessages((data ?? []) as SupportMessage[]);
      } catch (error) {
        console.error(error);
        if (active) toast.error("Não foi possível carregar a conversa.");
      } finally {
        if (active) setMessagesLoading(false);
      }
    };

    void loadMessages();

    const channel = supabase
      .channel(`support-widget-ticket:${selectedTicketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedTicketId}`,
        },
        (payload) => {
          const message = payload.new as SupportMessage;
          setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
          announceSupportReply(message);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${selectedTicketId}`,
        },
        (payload) => {
          const updatedTicket = payload.new as SupportTicket;
          setTickets((current) => current.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
          if (updatedTicket.status === "closed" && readActiveSupportTicketId() === updatedTicket.id) {
            setActiveSupportTicketId(null);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedTicketId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "end" });
  }, [messages.length, messagesLoading, prefersReducedMotion, sendingReply, selectedTicketId]);

  const subjectFromMessage = (message: string) => {
    const firstLine = message.split("\n").find((line) => line.trim())?.trim() ?? "Nova conversa com suporte";
    return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
  };

  const handleCreateTicketFromChat = async () => {
    const message = newConversationText.trim();

    if (!user?.id) {
      toast.error("Faça login para falar com o suporte.");
      return;
    }
    if (!message && !newConversationImage) {
      toast.error("Digite uma mensagem ou anexe uma imagem para iniciar a conversa.");
      return;
    }

    setCreatingTicket(true);
    let uploadedPath: string | null = null;
    try {
      const attachment = newConversationImage
        ? await uploadSupportImage({
            file: newConversationImage,
            ticketId: `nova-conversa-${crypto.randomUUID()}`,
            userId: user.id,
          })
        : null;
      uploadedPath = attachment?.path ?? null;
      const { ticket, messageId } = await createSupportTicket({
        userId: user.id,
        category: "outros",
        subject: subjectFromMessage(message || "Imagem enviada"),
        firstMessage: attachment ? buildSupportImageMessage(attachment, message) : message,
      });

      setTickets((current) => [ticket, ...current.filter((item) => item.id !== ticket.id)]);
      setSelectedTicketId(ticket.id);
      setMessages([]);
      setNewConversationText("");
      setNewConversationImage(null);
      setComposingNewConversation(false);
      setTab("messages");
      setActiveSupportTicketId(ticket.id);
      toast.success("Ticket aberto. Nosso time responde por aqui.");

      notifyNewSupportTicketEmail(ticket.id, messageId).catch((error) => {
        console.error(error);
        toast.error("Ticket aberto, mas não foi possível avisar os admins por email.");
      });
    } catch (error) {
      if (uploadedPath) await removeSupportImage(uploadedPath);
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o ticket.");
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleSendReply = async () => {
    const text = reply.trim();
    if ((!text && !replyImage) || !user?.id || !selectedTicket || selectedTicket.status !== "open" || sendingReply) return;

    setReply("");
    setSendingReply(true);
    let uploadedPath: string | null = null;
    try {
      const attachment = replyImage
        ? await uploadSupportImage({ file: replyImage, ticketId: selectedTicket.id, userId: user.id })
        : null;
      uploadedPath = attachment?.path ?? null;
      const { data, error } = await db
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: attachment ? buildSupportImageMessage(attachment, text) : text,
          sender: "user",
        })
        .select("*")
        .single();

      if (error) throw error;
      const message = data as SupportMessage;
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
      setReplyImage(null);
      setActiveSupportTicketId(selectedTicket.id);
    } catch (error) {
      if (uploadedPath) await removeSupportImage(uploadedPath);
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar sua mensagem.");
      setReply(text);
    } finally {
      setSendingReply(false);
    }
  };

  const openMessagesFor = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setReplyImage(null);
    const ticket = tickets.find((item) => item.id === ticketId);
    if (ticket?.status === "open") setActiveSupportTicketId(ticketId);
    setComposingNewConversation(false);
    setTab("messages");
  };

  const startNewConversation = () => {
    setSelectedTicketId(null);
    setNewConversationText("");
    setNewConversationImage(null);
    setComposingNewConversation(true);
    setTab("messages");
  };

  return (
    <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-[70] md:bottom-5 md:right-5">
      <AnimatePresence>
        {open && (
          <motion.section
            key="support-panel"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: panelWidth }}
            className="mb-3 flex h-[min(620px,calc(100svh-170px))] max-h-[680px] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] md:h-[min(660px,calc(100svh-84px))]"
            aria-label="Central de suporte"
          >
            {tab === "messages" ? (
              <SupportMessagesTopBar
                conversationOpen={Boolean(selectedTicket || composingNewConversation)}
                title={selectedTicket || composingNewConversation ? "Suporte Velo" : "Mensagens"}
                onBack={() => {
                  setSelectedTicketId(null);
                  setComposingNewConversation(false);
                }}
                onClose={() => setOpen(false)}
              />
            ) : (
              <div className="relative shrink-0 overflow-hidden bg-[#111827] px-5 pb-10 pt-5 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_6%,rgba(37,99,235,0.50),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_48%)]" />
                <div className="relative flex items-center justify-between gap-4">
                  <SupportHomeBrand />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/82 transition hover:bg-white/10 hover:text-white"
                    aria-label="Fechar suporte"
                  >
                    <X size={21} strokeWidth={2} />
                  </button>
                </div>

                <div className="relative mt-16 pb-1">
                  <p className="text-[31px] font-bold leading-[1.06] tracking-normal">
                    Oi, {firstNameFrom(nome)}.
                    <br />
                    Como podemos ajudar?
                  </p>
                </div>
              </div>
            )}

            <div
              className={`relative min-h-0 flex-1 overflow-y-auto ${
                tab === "messages"
                  ? "bg-white"
                  : tab === "home"
                    ? "bg-[#F6F7FB] px-3 pb-3 pt-4"
                    : "bg-[#F6F7FB] px-3 py-3"
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  className="h-full min-h-full"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 12, filter: "blur(2px)" }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10, filter: "blur(1px)" }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: "easeOut" }}
                >
                  {tab === "home" && (
                    <SupportHome
                      tickets={tickets}
                      openTickets={openTickets}
                      ticketsLoading={ticketsLoading}
                      onNewTicket={startNewConversation}
                      onOpenTicket={openMessagesFor}
                      onHelp={() => setTab("help")}
                    />
                  )}

                  {tab === "messages" && (
                    <SupportMessages
                      tickets={tickets}
                      ticketsLoading={ticketsLoading}
                      selectedTicket={selectedTicket}
                      selectedTicketId={selectedTicketId}
                      messages={messages}
                      messagesLoading={messagesLoading}
                      reply={reply}
                      replyImage={replyImage}
                      sendingReply={sendingReply}
                      newConversationText={newConversationText}
                      newConversationImage={newConversationImage}
                      composingNewConversation={composingNewConversation}
                      creatingTicket={creatingTicket}
                      bottomRef={bottomRef}
                      prefersReducedMotion={Boolean(prefersReducedMotion)}
                      onSelectTicket={(ticketId) => {
                        setSelectedTicketId(ticketId);
                        if (ticketId) {
                          const ticket = tickets.find((item) => item.id === ticketId);
                          if (ticket?.status === "open") setActiveSupportTicketId(ticketId);
                        }
                        setComposingNewConversation(false);
                      }}
                      onReplyChange={setReply}
                      onReplyImageChange={(file) => {
                        const validationError = validateSupportImage(file);
                        if (validationError) {
                          toast.error(validationError);
                          return;
                        }
                        setReplyImage(file);
                      }}
                      onReplyImageRemove={() => setReplyImage(null)}
                      onSendReply={handleSendReply}
                      onNewConversationChange={setNewConversationText}
                      onNewConversationImageChange={(file) => {
                        const validationError = validateSupportImage(file);
                        if (validationError) {
                          toast.error(validationError);
                          return;
                        }
                        setNewConversationImage(file);
                      }}
                      onNewConversationImageRemove={() => setNewConversationImage(null)}
                      onStartNewConversation={startNewConversation}
                      onCancelNewConversation={() => {
                        setNewConversationImage(null);
                        setComposingNewConversation(false);
                      }}
                      onCreateTicket={handleCreateTicketFromChat}
                    />
                  )}

                  {tab === "help" && (
                    <SupportHelp
                      query={helpQuery}
                      faqs={visibleFaqs}
                      onQueryChange={setHelpQuery}
                      onNewTicket={startNewConversation}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <nav className="grid shrink-0 grid-cols-3 border-t border-black/[0.06] bg-white px-3 py-2">
              <WidgetNavButton tab="home" label="Início" icon={Home} active={tab === "home"} onClick={setTab} />
              <WidgetNavButton
                tab="messages"
                label="Mensagens"
                icon={MessageSquareText}
                active={tab === "messages"}
                onClick={setTab}
                badge={openTickets.length}
              />
              <WidgetNavButton tab="help" label="Ajuda" icon={HelpCircle} active={tab === "help"} onClick={setTab} />
            </nav>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ml-auto grid h-14 w-14 place-items-center rounded-full bg-[#2563EB] text-white shadow-[0_16px_36px_rgba(37,99,235,0.34)] transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#93C5FD]"
        aria-label={open ? "Minimizar suporte" : "Abrir suporte"}
      >
        {open ? <ChevronRight size={27} strokeWidth={2.4} className="rotate-90" /> : <MessageSquareText size={25} strokeWidth={2.1} />}
      </button>
    </div>
  );
};

const SupportMessagesTopBar = ({
  conversationOpen,
  title,
  onBack,
  onClose,
}: {
  conversationOpen: boolean;
  title: string;
  onBack: () => void;
  onClose: () => void;
}) => {
  if (!conversationOpen) {
    return (
      <div className="relative flex h-[58px] shrink-0 items-center justify-center border-b border-black/[0.07] bg-white px-4">
        <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#111113]">Mensagens</h2>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#F5F5F5] hover:text-[#111113]"
          aria-label="Fechar suporte"
        >
          <X size={20} strokeWidth={2.1} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[58px] shrink-0 items-center gap-2 border-b border-black/[0.07] bg-white px-3">
      <button
        type="button"
        onClick={onBack}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#F5F5F5] hover:text-[#111113]"
        aria-label="Voltar para mensagens"
      >
        <ChevronLeft size={21} strokeWidth={2.1} />
      </button>
      <SupportAvatarGroup />
      <h2 className="min-w-0 flex-1 truncate text-[14.5px] font-bold tracking-[-0.025em] text-[#111113]">{title}</h2>
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#F5F5F5] hover:text-[#111113]"
        aria-label="Opções da conversa"
      >
        <MoreHorizontal size={20} strokeWidth={2.1} />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#F5F5F5] hover:text-[#111113]"
        aria-label="Fechar suporte"
      >
        <X size={20} strokeWidth={2.1} />
      </button>
    </div>
  );
};

const SupportAvatarGroup = () => (
  <div className="grid h-10 w-10 shrink-0 place-items-center">
    <span className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-[#E0E7FF]">
      <AtlasAvatarIcon size={25} animated={false} />
    </span>
  </div>
);

const SupportHomeBrand = () => (
  <div className="flex min-w-0 items-center gap-2.5">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] ring-1 ring-white/70">
      <AtlasAvatarIcon size={25} animated={false} />
    </span>
    <span className="flex items-baseline gap-1 text-[13px] font-bold tracking-normal text-white">
      <span>VELO</span>
      <span className="font-medium text-white/70">SUPORTE</span>
    </span>
  </div>
);

const WidgetNavButton = ({
  tab,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  tab: WidgetTab;
  label: string;
  icon: typeof Home;
  active: boolean;
  badge?: number;
  onClick: (tab: WidgetTab) => void;
}) => (
  <button
    type="button"
    onClick={() => onClick(tab)}
    className={`relative flex h-[52px] min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition ${
      active ? "text-[#2563EB]" : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
    }`}
  >
    <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
    <span>{label}</span>
    {typeof badge === "number" && badge > 0 && (
      <span className="absolute right-[calc(50%-22px)] top-1 min-w-4 rounded-full bg-[#2563EB] px-1 text-[9px] leading-4 text-white">
        {badge}
      </span>
    )}
  </button>
);

const SupportHome = ({
  tickets,
  openTickets,
  ticketsLoading,
  onNewTicket,
  onOpenTicket,
  onHelp,
}: {
  tickets: SupportTicket[];
  openTickets: SupportTicket[];
  ticketsLoading: boolean;
  onNewTicket: () => void;
  onOpenTicket: (ticketId: string) => void;
  onHelp: () => void;
}) => (
  <div className="space-y-3.5">
    <button
      type="button"
      onClick={onNewTicket}
      className="flex min-h-[72px] w-full items-center justify-between gap-4 rounded-[18px] border border-black/[0.08] bg-white px-5 text-left shadow-[0_12px_26px_rgba(15,23,42,0.13)] transition hover:-translate-y-0.5 hover:border-[#2563EB]/30"
    >
      <span>
        <span className="block text-[16px] font-bold tracking-normal text-[#111827]">Enviar uma mensagem</span>
        <span className="mt-1 block text-[12px] font-medium text-[#6B7280]">Abra uma conversa com o time.</span>
      </span>
      <Send size={24} className="shrink-0 text-[#2563EB]" strokeWidth={2.5} />
    </button>

    <div className="rounded-[18px] border border-black/[0.06] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.08)]">
      <p className="text-center text-[14px] leading-5 text-[#111827]">Tem um feedback ou pedido de melhoria?</p>
      <button
        type="button"
        onClick={onNewTicket}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#2563EB] text-[13px] font-bold text-white transition hover:bg-[#1D4ED8]"
      >
        <Sparkles size={16} />
        Sugerir algo
      </button>
    </div>

    <div className="rounded-[18px] border border-black/[0.06] bg-white p-3 shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
      <button
        type="button"
        onClick={onHelp}
        className="flex h-12 w-full items-center gap-3 rounded-[14px] bg-[#F5F5F5] px-3.5 text-left transition hover:bg-[#EFEFEF]"
      >
        <span className="min-w-0 flex-1 text-[15px] font-bold tracking-normal text-[#111827]">Buscar ajuda</span>
        <Search size={20} className="shrink-0 text-[#2563EB]" strokeWidth={2.3} />
      </button>

      <div className="mt-2 divide-y divide-[#ECEEF6]">
        {ticketsLoading ? (
          <div className="py-2">
            <LoadingLine label="Carregando conversas..." />
          </div>
        ) : openTickets.length > 0 ? (
          openTickets.slice(0, 2).map((ticket) => (
            <TicketQuestionRow key={ticket.id} label={ticket.subject || CATEGORY_LABEL[ticket.category]} onClick={() => onOpenTicket(ticket.id)} />
          ))
        ) : (
          <>
            <TicketQuestionRow label="Como acompanhar meus tickets abertos?" onClick={onHelp} />
            <TicketQuestionRow label="Como resolver problemas de assinatura?" onClick={onHelp} />
            <TicketQuestionRow label="Como conectar uma integração?" onClick={onHelp} />
          </>
        )}
      </div>
    </div>

    {tickets.length > openTickets.length && (
      <p className="px-1 text-center text-[11px] font-medium text-[#8A94A6]">
        Tickets resolvidos ficam em Mensagens.
      </p>
    )}
  </div>
);

const TicketQuestionRow = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left transition hover:bg-[#FAFBFF]"
  >
    <span className="min-w-0 truncate text-[13px] leading-5 text-[#6B7280]">{label}</span>
    <ChevronRight className="shrink-0 text-[#2563EB]" size={18} />
  </button>
);

const SupportMessages = ({
  tickets,
  ticketsLoading,
  selectedTicket,
  selectedTicketId,
  messages,
  messagesLoading,
  reply,
  replyImage,
  sendingReply,
  newConversationText,
  newConversationImage,
  composingNewConversation,
  creatingTicket,
  bottomRef,
  prefersReducedMotion,
  onSelectTicket,
  onReplyChange,
  onReplyImageChange,
  onReplyImageRemove,
  onSendReply,
  onNewConversationChange,
  onNewConversationImageChange,
  onNewConversationImageRemove,
  onStartNewConversation,
  onCancelNewConversation,
  onCreateTicket,
}: {
  tickets: SupportTicket[];
  ticketsLoading: boolean;
  selectedTicket: SupportTicket | null;
  selectedTicketId: string | null;
  messages: SupportMessage[];
  messagesLoading: boolean;
  reply: string;
  replyImage: File | null;
  sendingReply: boolean;
  newConversationText: string;
  newConversationImage: File | null;
  composingNewConversation: boolean;
  creatingTicket: boolean;
  bottomRef: RefObject<HTMLDivElement>;
  prefersReducedMotion: boolean;
  onSelectTicket: (ticketId: string | null) => void;
  onReplyChange: (value: string) => void;
  onReplyImageChange: (file: File) => void;
  onReplyImageRemove: () => void;
  onSendReply: () => void;
  onNewConversationChange: (value: string) => void;
  onNewConversationImageChange: (file: File) => void;
  onNewConversationImageRemove: () => void;
  onStartNewConversation: () => void;
  onCancelNewConversation: () => void;
  onCreateTicket: () => void;
}) => {
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  if (selectedTicket) {
    const closed = selectedTicket.status === "closed";

    return (
      <motion.div
        key={`conversation-${selectedTicket.id}`}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: "easeOut" }}
        className="flex h-full min-h-[390px] flex-col overflow-hidden bg-white"
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-4 py-4">
          {messagesLoading && <LoadingLine label="Carregando conversa..." />}
          {!messagesLoading && messages.length === 0 && <EmptyLine label="A conversa deste ticket ainda está vazia." />}
          {messages.map((message) => (
            <SupportBubble key={message.id} message={message} />
          ))}
          {sendingReply && <TypingBubble />}
          {closed && (
            <div className="rounded-full bg-emerald-50 px-3 py-2 text-center text-[11px] font-bold text-emerald-700">
              Este ticket foi marcado como resolvido.
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-auto shrink-0 bg-white px-4 pb-4 pt-2">
          {replyImage ? <SupportImagePreview file={replyImage} onRemove={onReplyImageRemove} /> : null}
          <div className="flex min-h-[54px] items-end gap-2 rounded-[20px] border-2 border-[#2563EB] bg-white px-3 py-2 transition focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/12">
            <input
              ref={replyFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onReplyImageChange(file);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => replyFileInputRef.current?.click()}
              disabled={closed || sendingReply}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${replyImage ? "bg-[#e9efff] text-[#2563EB]" : "text-[#7b8798] hover:bg-[#f1f4f8] hover:text-[#2563EB]"}`}
              aria-label="Anexar imagem"
              title="Anexar imagem (até 8 MB)"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              value={reply}
              onChange={(event) => onReplyChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSendReply();
                }
              }}
              disabled={closed || sendingReply}
              placeholder={closed ? "Ticket resolvido" : "Responder ao suporte..."}
              className="max-h-24 min-h-8 min-w-0 flex-1 resize-none border-0 bg-transparent text-[13px] leading-5 text-[#111827] outline-none placeholder:text-[#9CA3AF] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={onSendReply}
              disabled={closed || sendingReply || (!reply.trim() && !replyImage)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white transition hover:bg-[#1D4ED8] disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
              aria-label="Enviar resposta"
            >
              {sendingReply ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={composingNewConversation ? "compose" : "conversation-list"}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: "easeOut" }}
      className="flex h-full min-h-[390px] flex-col"
    >
      {composingNewConversation ? (
        <NewConversationComposer
          value={newConversationText}
          image={newConversationImage}
          creating={creatingTicket}
          onChange={onNewConversationChange}
          onImageChange={onNewConversationImageChange}
          onImageRemove={onNewConversationImageRemove}
          onCancel={onCancelNewConversation}
          onSend={onCreateTicket}
        />
      ) : (
        <>
          <div className="shrink-0 bg-white">
            {ticketsLoading ? (
              <div className="px-5 py-4">
                <LoadingLine label="Carregando conversas..." />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex min-h-[285px] flex-col items-center justify-center px-8 text-center">
                <span className="mb-5 grid h-11 w-11 place-items-center rounded-[12px] bg-[#111827] text-white">
                  <MessageSquareText size={24} strokeWidth={2.1} />
                </span>
                <h3 className="text-[19px] font-bold tracking-[-0.03em] text-[#111113]">Sem mensagens</h3>
                <p className="mt-3 max-w-[250px] text-[14px] leading-6 text-[#6B7280]">
                  As respostas do time vão aparecer aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#ECEEF6] px-3">
                {tickets.map((ticket) => (
                  <ConversationRow
                    key={ticket.id}
                    ticket={ticket}
                    active={ticket.id === selectedTicketId}
                    onClick={() => onSelectTicket(ticket.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1" />

          <div className="mt-auto flex justify-center px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={onStartNewConversation}
              className="inline-flex h-12 min-w-[230px] items-center justify-center gap-3 rounded-[14px] bg-[#2563EB] px-6 text-[13.5px] font-bold text-white shadow-none transition hover:bg-[#1D4ED8]"
            >
              Iniciar conversa
              <Send size={18} strokeWidth={2.4} />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
};

const NewConversationComposer = ({
  value,
  image,
  creating,
  onChange,
  onImageChange,
  onImageRemove,
  onCancel,
  onSend,
}: {
  value: string;
  image: File | null;
  creating: boolean;
  onChange: (value: string) => void;
  onImageChange: (file: File) => void;
  onImageRemove: () => void;
  onCancel: () => void;
  onSend: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
  <div className="flex h-full min-h-[390px] flex-col bg-white">
    <div className="flex min-h-0 flex-1 items-start justify-center px-6 pt-10 text-center">
      <p className="text-[14.5px] leading-6 text-[#6B7280]">
        Conte sua dúvida ou deixe seu feedback.
      </p>
    </div>

    <div className="mt-auto shrink-0 bg-white px-4 pb-4">
      {image ? <SupportImagePreview file={image} onRemove={onImageRemove} /> : null}
      <div className="rounded-[22px] border-2 border-[#2563EB] bg-white px-3.5 pb-3 pt-3 shadow-none">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Digite sua mensagem..."
          disabled={creating}
          className="max-h-32 min-h-[82px] w-full resize-none border-0 bg-transparent text-[14px] leading-5 text-[#111827] outline-none placeholder:text-[#6B7280]"
        />
        <div className="flex items-center justify-end gap-2">
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
            onClick={onCancel}
            className="mr-auto rounded-full px-2 py-1 text-[11px] font-semibold text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={creating}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${image ? "bg-[#e9efff] text-[#2563EB]" : "text-[#8B949E] hover:bg-[#F3F4F6] hover:text-[#111827]"}`}
            aria-label="Anexar imagem"
            title="Anexar imagem (até 8 MB)"
          >
            <Paperclip size={17} />
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={creating || (!value.trim() && !image)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white transition hover:bg-[#1D4ED8] disabled:bg-[#E5E7EB] disabled:text-[#C4C9D0]"
            aria-label="Iniciar conversa"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};

const SupportHelp = ({
  query,
  faqs,
  onQueryChange,
  onNewTicket,
}: {
  query: string;
  faqs: typeof FAQ_ITEMS;
  onQueryChange: (value: string) => void;
  onNewTicket: () => void;
}) => (
  <div className="space-y-3">
    <div className="flex h-11 items-center gap-2 rounded-[18px] bg-white px-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
      <Search size={18} className="shrink-0 text-[#2563EB]" />
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Buscar por ajuda"
        className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-semibold text-[#111827] outline-none placeholder:text-[#6B7280]"
      />
    </div>

    <div className="rounded-[18px] bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      {faqs.length === 0 ? (
        <EmptyLine label="Nenhuma resposta encontrada." />
      ) : (
        faqs.map((item) => (
          <details key={item.question} className="group rounded-[18px] px-3 py-2 open:bg-[#F8FAFC]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold leading-5 text-[#111827]">
              <span>{item.question}</span>
              <ChevronRight size={18} className="shrink-0 text-[#2563EB] transition group-open:rotate-90" />
            </summary>
            <p className="mt-2 text-[12px] leading-5 text-[#6B7280]">{item.answer}</p>
          </details>
        ))
      )}
    </div>

    <button
      type="button"
      onClick={onNewTicket}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-[18px] bg-[#111827] text-[12.5px] font-bold text-white transition hover:bg-black"
    >
      <MessageSquareText size={17} />
      Falar com suporte
    </button>
  </div>
);

const TicketRow = ({
  ticket,
  active = false,
  onClick,
}: {
  ticket: SupportTicket;
  active?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-left transition ${
      active ? "bg-[#EFF6FF]" : "bg-[#F8FAFC] hover:bg-[#F1F5F9]"
    }`}
  >
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#2563EB] shadow-sm">
      <Ticket size={15} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[12px] font-bold text-[#111827]">
        {ticket.subject || CATEGORY_LABEL[ticket.category]}
      </span>
      <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8A94A6]">
        {protocolo(ticket.id)} · {formatTicketDate(ticket.created_at)}
      </span>
    </span>
    <StatusBadge status={ticket.status} compact />
  </button>
);

const ConversationRow = ({
  ticket,
  active = false,
  onClick,
}: {
  ticket: SupportTicket;
  active?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
      active ? "bg-[#F2F5FF]" : "bg-white hover:bg-[#F8FAFF]"
    }`}
  >
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_8px_22px_rgba(37,99,235,0.16)] ring-1 ring-[#E3E9FF]">
      <AtlasAvatarIcon size={32} animated={false} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center justify-between gap-3">
        <span className="truncate text-[13.5px] font-bold tracking-[-0.015em] text-[#111827]">
          {ticket.subject || CATEGORY_LABEL[ticket.category]}
        </span>
        <span className="shrink-0 text-[11.5px] font-medium text-[#6B7280]">{formatTicketDate(ticket.updated_at)}</span>
      </span>
      <span className="mt-1 flex items-center gap-2">
        <span className="truncate text-[12px] leading-4 text-[#6B7280]">
          {CATEGORY_LABEL[ticket.category]} · {protocolo(ticket.id)}
        </span>
        {ticket.status === "open" && <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />}
      </span>
    </span>
  </button>
);

const StatusBadge = ({ status, compact = false }: { status: SupportTicket["status"]; compact?: boolean }) => (
  <span
    className={`shrink-0 rounded-full font-bold ${
      compact ? "px-2 py-1 text-[9.5px]" : "px-2.5 py-1 text-[10px]"
    } ${
      status === "open"
        ? "bg-[#DBEAFE] text-[#1D4ED8]"
        : "bg-[#DCFCE7] text-[#15803D]"
    }`}
  >
    {status === "open" ? "Aberto" : "Resolvido"}
  </span>
);

const SupportBubble = ({ message }: { message: SupportMessage }) => {
  const isUser = message.sender === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-[18px_6px_18px_18px] bg-[#2563EB] px-3.5 py-2.5 text-[13px] leading-5 text-white">
          <SupportMessageMedia value={message.message} textClassName="whitespace-pre-wrap" imageClassName="max-h-[260px] max-w-[300px] w-full" />
          <p className="mt-1 text-right text-[10px] font-medium text-white/70">{formatTicketTime(message.created_at)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#E3E9FF]">
        <AtlasAvatarIcon size={24} animated={false} />
      </span>
      <div className="max-w-[82%] rounded-[6px_18px_18px_18px] bg-white px-3.5 py-2.5 text-[13px] leading-5 text-[#111827] shadow-sm">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">Suporte Velo</p>
        <SupportMessageMedia value={message.message} textClassName="whitespace-pre-wrap" imageClassName="max-h-[260px] max-w-[300px] w-full" />
        <p className="mt-1 text-[10px] font-medium text-[#9CA3AF]">{formatTicketTime(message.created_at)}</p>
      </div>
    </div>
  );
};

const LoadingLine = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 rounded-2xl bg-[#F8FAFC] px-3 py-2.5 text-[11.5px] font-semibold text-[#6B7280]">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

const EmptyLine = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 rounded-2xl bg-[#F8FAFC] px-3 py-2.5 text-[11.5px] font-semibold text-[#6B7280]">
    <Inbox size={15} className="text-[#9CA3AF]" />
    {label}
  </div>
);

const TypingBubble = () => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#E3E9FF]">
      <AtlasAvatarIcon size={24} animated={false} />
    </span>
    <div className="flex items-center gap-1.5 rounded-[6px_18px_18px_18px] bg-white px-4 py-3 shadow-sm">
      {[0, 130, 260].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#6B7280]"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </div>
);

export default SupportFloatingWidget;
