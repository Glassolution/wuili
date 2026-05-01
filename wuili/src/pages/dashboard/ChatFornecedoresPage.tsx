import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Search, Send, Paperclip, Sparkles,
  ChevronRight, ArrowLeft, Package, ExternalLink,
  Headphones, Loader2, UserRound, Bot, Pause, Play,
  CheckCircle2, ShieldCheck, Inbox, UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useSupplierThreads,
  useSupplierMessages,
  useSendMessage,
  formatMessageTime,
  formatDateGroup,
  supplierInitials,
  supplierColor,
  type ChatMessage,
} from "@/hooks/useSupplierChat";

// ── AI quick-reply options ────────────────────────────────────────────────────

const AI_OPTIONS = [
  {
    key: "negotiate",
    label: "Negociar preço",
    desc: "Solicitar desconto por volume",
    text: (p: string) =>
      `Olá! Gostaria de negociar o preço do ${p}. Vocês oferecem desconto para pedidos maiores? Qual seria o melhor valor para um pedido de 50 unidades?`,
  },
  {
    key: "sample",
    label: "Pedir amostra",
    desc: "Solicitar amostra para avaliação",
    text: (p: string) =>
      `Boa tarde! Poderia enviar uma amostra do ${p} para avaliação antes de fecharmos um pedido maior?`,
  },
  {
    key: "tracking",
    label: "Cobrar envio",
    desc: "Solicitar atualização do rastreio",
    text: (p: string) =>
      `Olá! Gostaria de uma atualização sobre o envio do pedido referente ao ${p}. Poderia compartilhar o código de rastreio?`,
  },
  {
    key: "deadline",
    label: "Perguntar prazo",
    desc: "Consultar prazo de entrega",
    text: (p: string) =>
      `Bom dia! Qual é o prazo de entrega estimado para o ${p} com envio para o Brasil?`,
  },
];

type ChatArea = "suppliers" | "support";

type AdminTicket = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  ai_active: boolean;
  admin_last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  last_message: string | null;
  last_sender: "user" | "admin" | "ai" | null;
  last_message_at: string | null;
};

type SupportTicketRow = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  ai_active: boolean | null;
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

const formatSupportTime = (value: string | null) => {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const getTicketNeedsReply = (ticket: AdminTicket) => ticket.last_sender === "user";

const adminRoleChecks = (userId: string) => [
  { _role: "admin" },
  { role: "admin" },
  { _user_id: userId, _role: "admin" },
  { user_id: userId, role: "admin" },
];

async function checkAdminAccess(userId: string) {
  for (const params of adminRoleChecks(userId)) {
    const { data, error } = await (supabase as any).rpc("has_role", params);
    if (!error && data === true) return true;
  }

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("role")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

const normalizeTicket = (ticket: any): AdminTicket => ({
  id: ticket.id,
  user_id: ticket.user_id,
  status: ticket.status,
  ai_active: ticket.ai_active ?? true,
  admin_last_seen_at: ticket.admin_last_seen_at ?? null,
  created_at: ticket.created_at,
  updated_at: ticket.updated_at,
  user_name: ticket.user_name ?? ticket.display_name ?? null,
  user_email: ticket.user_email ?? ticket.email ?? null,
  last_message: ticket.last_message ?? null,
  last_sender: ticket.last_sender ?? null,
  last_message_at: ticket.last_message_at ?? null,
});

async function fetchAdminTickets(): Promise<AdminTicket[]> {
  const { data: rpcData, error: rpcError } = await (supabase as any)
    .rpc("get_support_tickets_admin", { p_status: "open" });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map(normalizeTicket);
  }

  const { data: ticketsData, error: ticketsError } = await (supabase as any)
    .from("support_tickets")
    .select("id,user_id,status,ai_active,created_at,updated_at")
    .eq("status", "open")
    .order("updated_at", { ascending: false });

  if (ticketsError) throw ticketsError;

  const tickets = (ticketsData ?? []) as SupportTicketRow[];
  if (tickets.length === 0) return [];

  const ticketIds = tickets.map((ticket) => ticket.id);
  const userIds = Array.from(new Set(tickets.map((ticket) => ticket.user_id)));

  const profilesByUser = new Map<string, { display_name: string | null; email?: string | null }>();
  const { data: profilesWithEmail, error: profilesWithEmailError } = await (supabase as any)
    .from("profiles")
    .select("user_id,display_name,email")
    .in("user_id", userIds);

  if (!profilesWithEmailError) {
    for (const profile of profilesWithEmail ?? []) {
      profilesByUser.set(profile.user_id, {
        display_name: profile.display_name ?? null,
        email: profile.email ?? null,
      });
    }
  } else {
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", userIds);

    for (const profile of profiles ?? []) {
      profilesByUser.set(profile.user_id, { display_name: profile.display_name ?? null });
    }
  }

  const { data: messagesData, error: messagesError } = await (supabase as any)
    .from("support_messages")
    .select("id,ticket_id,user_id,message,sender,created_at")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: false });

  if (messagesError) throw messagesError;

  const lastMessageByTicket = new Map<string, SupportMessage>();
  for (const message of (messagesData ?? []) as SupportMessage[]) {
    if (!lastMessageByTicket.has(message.ticket_id)) {
      lastMessageByTicket.set(message.ticket_id, message);
    }
  }

  return tickets.map((ticket) => {
    const profile = profilesByUser.get(ticket.user_id);
    const lastMessage = lastMessageByTicket.get(ticket.id);

    return {
      id: ticket.id,
      user_id: ticket.user_id,
      status: ticket.status,
      ai_active: ticket.ai_active ?? true,
      admin_last_seen_at: null,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      user_name: profile?.display_name ?? null,
      user_email: profile?.email ?? null,
      last_message: lastMessage?.message ?? null,
      last_sender: lastMessage?.sender ?? null,
      last_message_at: lastMessage?.created_at ?? null,
    };
  });
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, prevMsg, supplierName, color, initials }: {
  msg: ChatMessage;
  prevMsg: ChatMessage | null;
  supplierName: string;
  color: string;
  initials: string;
}) {
  const isUser   = msg.sender === "user";
  const isSystem = msg.sender === "system";
  const showDate = !prevMsg || formatDateGroup(prevMsg.created_at) !== formatDateGroup(msg.created_at);
  const showAvatar = !isUser && !isSystem && (!prevMsg || prevMsg.sender !== "supplier");

  if (isSystem) {
    return (
      <>
        {showDate && <DateSep label={formatDateGroup(msg.created_at)} />}
        <div className="flex justify-center my-2">
          <span className="rounded-full border border-[#E5E5E5] dark:border-zinc-700 bg-[#F7F7F7] dark:bg-zinc-800 px-3 py-1 text-[11.5px] text-[#737373] dark:text-zinc-400">
            {msg.message_text}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      {showDate && <DateSep label={formatDateGroup(msg.created_at)} />}
      <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {/* Supplier avatar */}
        {!isUser && (
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white transition-opacity ${showAvatar ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
        )}

        <div className={`flex max-w-[68%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
          {showAvatar && (
            <span className="px-1 text-[11.5px] font-semibold text-[#525252] dark:text-zinc-300">
              {supplierName}
            </span>
          )}

          {msg.message_type === "image" && msg.image_url ? (
            <a href={msg.image_url} target="_blank" rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-[#E5E5E5] dark:border-zinc-700 shadow-sm">
              <img src={msg.image_url} alt="imagem" className="max-h-[220px] w-full object-cover" />
            </a>
          ) : (
            <div className={`rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
              isUser
                ? "rounded-br-sm bg-[#0A0A0A] dark:bg-white text-white dark:text-black"
                : "rounded-bl-sm bg-[#F0F0F0] dark:bg-zinc-800 text-[#0A0A0A] dark:text-zinc-100"
            }`}>
              {msg.message_text}
            </div>
          )}

          <span className="px-1 text-[10.5px] text-[#B0B0B0] dark:text-zinc-500">
            {formatMessageTime(msg.created_at)}
          </span>
        </div>
      </div>
    </>
  );
}

function DateSep({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-[#EBEBEB] dark:bg-zinc-800" />
      <span className="rounded-full border border-[#EBEBEB] dark:border-zinc-700 bg-[#F7F7F7] dark:bg-zinc-800 px-3 py-1 text-[11px] font-medium text-[#A3A3A3] dark:text-zinc-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-[#EBEBEB] dark:bg-zinc-800" />
    </div>
  );
}

// ── Chat window ───────────────────────────────────────────────────────────────

function ChatWindow({
  supplierId, supplierName, onBack,
}: {
  supplierId: string;
  supplierName: string;
  onBack?: () => void;
}) {
  const [text, setText] = useState("");
  const [showAi, setShowAi] = useState(false);
  const aiRef  = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useSupplierMessages(supplierId);
  const { mutate: send, isPending } = useSendMessage();

  const color    = supplierColor(supplierId);
  const initials = supplierInitials(supplierName);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset on supplier change
  useEffect(() => { setText(""); setShowAi(false); }, [supplierId]);

  // Close AI menu on outside click
  useEffect(() => {
    if (!showAi) return;
    const h = (e: MouseEvent) => {
      if (aiRef.current && !aiRef.current.contains(e.target as Node)) setShowAi(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showAi]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    send({ supplierId, text: trimmed });
    setText("");
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#EBEBEB] dark:border-zinc-800 px-4 py-3">
        {onBack && (
          <button onClick={onBack}
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#525252] dark:text-zinc-300 transition hover:bg-[#F5F5F5] dark:hover:bg-zinc-800 md:hidden">
            <ArrowLeft size={17} />
          </button>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: color }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-[#0A0A0A] dark:text-white">{supplierName}</p>
          <p className="text-[11.5px] text-[#A3A3A3] dark:text-zinc-400">Fornecedor</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-2/3 rounded-2xl" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Package size={32} className="text-[#D4D4D4] dark:text-zinc-600" />
            <p className="text-[13px] text-[#A3A3A3] dark:text-zinc-400">
              Nenhuma mensagem ainda. Inicie a conversa!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <Bubble
                key={msg.id}
                msg={msg}
                prevMsg={messages[i - 1] ?? null}
                supplierName={supplierName}
                color={color}
                initials={initials}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="relative border-t border-[#EBEBEB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        {/* AI menu */}
        {showAi && (
          <div ref={aiRef}
            className="absolute bottom-full left-3 mb-2 w-72 overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl z-10">
            <div className="flex items-center gap-2 border-b border-[#F0F0F0] dark:border-zinc-800 px-4 py-2.5">
              <Sparkles size={13} className="text-[#525252] dark:text-zinc-300" />
              <span className="text-[12.5px] font-semibold text-[#0A0A0A] dark:text-white">Gerar com IA</span>
            </div>
            {AI_OPTIONS.map(opt => (
              <button key={opt.key}
                onClick={() => { setText(opt.text(supplierName)); setShowAi(false); setTimeout(() => textareaRef.current?.focus(), 50); }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F7F7F7] dark:hover:bg-zinc-800">
                <div>
                  <p className="text-[13px] font-medium text-[#0A0A0A] dark:text-white">{opt.label}</p>
                  <p className="text-[11.5px] text-[#A3A3A3] dark:text-zinc-400">{opt.desc}</p>
                </div>
                <ChevronRight size={14} className="shrink-0 text-[#D4D4D4] dark:text-zinc-500" />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-[#E5E5E5] dark:border-zinc-700 bg-[#F7F7F7] dark:bg-zinc-800 px-3 py-2 transition focus-within:border-[#D4D4D4] dark:focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-[#0A0A0A]/6 dark:focus-within:ring-white/10">
          <button className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#A3A3A3] dark:text-zinc-400 transition hover:bg-[#EBEBEB] dark:hover:bg-zinc-700 hover:text-[#525252] dark:hover:text-zinc-200">
            <Paperclip size={15} />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Digite uma mensagem..."
            rows={1}
            className="flex-1 resize-none bg-transparent py-0.5 text-[13.5px] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] dark:placeholder:text-zinc-500 focus:outline-none"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => setShowAi(v => !v)}
            className={`mb-0.5 flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition ${showAi ? "bg-[#0A0A0A] dark:bg-white text-white dark:text-black" : "text-[#525252] dark:text-zinc-300 hover:bg-[#EBEBEB] dark:hover:bg-zinc-700"}`}>
            <Sparkles size={13} />
            <span className="hidden sm:inline">IA</span>
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim() || isPending}
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black transition hover:bg-[#2a2a2a] dark:hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30">
            <Send size={13} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-[#C0C0C0] dark:text-zinc-500">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}

// ── Conversation list ─────────────────────────────────────────────────────────

function ConversationList({
  selectedId, onSelect, search, onSearchChange,
}: {
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const { data: threads = [], isLoading } = useSupplierThreads();

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t => t.supplier_name.toLowerCase().includes(q));
  }, [threads, search]);

  return (
    <div className="flex h-full flex-col border-r border-[#EBEBEB] dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="border-b border-[#EBEBEB] dark:border-zinc-800 px-4 pb-3 pt-4">
        <h2 className="mb-3 text-[15px] font-bold text-[#0A0A0A] dark:text-white">Fornecedores</h2>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-zinc-500" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="w-full rounded-xl border border-[#EBEBEB] dark:border-zinc-700 bg-[#F7F7F7] dark:bg-zinc-800 py-2 pl-8 pr-3 text-[13px] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] dark:placeholder:text-zinc-500 focus:border-[#D4D4D4] dark:focus:border-zinc-500 focus:outline-none transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3 rounded" />
                <Skeleton className="h-2.5 w-full rounded" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
            <MessageSquare size={28} className="text-[#D4D4D4] dark:text-zinc-600" />
            <p className="text-[13px] text-[#A3A3A3] dark:text-zinc-400">
              {threads.length === 0
                ? "Você ainda não iniciou nenhuma conversa com fornecedores."
                : "Nenhum fornecedor encontrado."}
            </p>
          </div>
        ) : (
          filtered.map(t => {
            const isActive = t.supplier_id === selectedId;
            const color    = supplierColor(t.supplier_id);
            const initials = supplierInitials(t.supplier_name);
            return (
              <button
                key={t.supplier_id}
                onClick={() => onSelect(t.supplier_id, t.supplier_name)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? "bg-[#F5F5F5] dark:bg-zinc-800" : "hover:bg-[#FAFAFA] dark:hover:bg-zinc-800/70"}`}
              >
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: color }}>
                    {initials}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="truncate text-[13.5px] font-semibold text-[#0A0A0A] dark:text-white">
                      {t.supplier_name}
                    </p>
                    <span className="shrink-0 text-[11px] text-[#A3A3A3] dark:text-zinc-500">{t.last_time}</span>
                  </div>
                  <p className="truncate text-[12px] text-[#A3A3A3] dark:text-zinc-500 mt-0.5">
                    {t.last_message}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Admin support panel ───────────────────────────────────────────────────────

function AdminSupportPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["chat-admin-support-tickets"],
    enabled: !!user?.id,
    queryFn: fetchAdminTickets,
  });

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null,
    [selectedTicketId, tickets]
  );

  const unansweredCount = useMemo(
    () => tickets.filter(getTicketNeedsReply).length,
    [tickets]
  );

  useEffect(() => {
    if (!selectedTicketId && tickets[0]?.id) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [selectedTicketId, tickets]);

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["chat-admin-support-messages", selectedTicket?.id],
    enabled: !!selectedTicket?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket!.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as SupportMessage[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("chat-admin-support")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        () => {
          void qc.invalidateQueries({ queryKey: ["chat-admin-support-tickets"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        () => {
          void qc.invalidateQueries({ queryKey: ["chat-admin-support-tickets"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const message = payload.new as SupportMessage;
          void qc.invalidateQueries({ queryKey: ["chat-admin-support-tickets"] });
          qc.setQueryData<SupportMessage[]>(
            ["chat-admin-support-messages", message.ticket_id],
            (prev = []) => prev.some((item) => item.id === message.id) ? prev : [...prev, message]
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const sendReply = useMutation({
    mutationFn: async () => {
      const trimmed = reply.trim();
      if (!trimmed || !selectedTicket?.id || !user?.id) return null;

      const { data, error } = await (supabase as any)
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: trimmed,
          sender: "admin",
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as SupportMessage;
    },
    onSuccess: (message) => {
      if (!message) return;
      setReply("");
      qc.setQueryData<SupportMessage[]>(
        ["chat-admin-support-messages", message.ticket_id],
        (prev = []) => prev.some((item) => item.id === message.id) ? prev : [...prev, message]
      );
      void qc.invalidateQueries({ queryKey: ["chat-admin-support-tickets"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Não foi possível enviar a resposta.");
    },
  });

  const toggleAi = useMutation({
    mutationFn: async (active: boolean) => {
      if (!selectedTicket?.id) return;

      const { error } = await (supabase as any)
        .from("support_tickets")
        .update({ ai_active: active })
        .eq("id", selectedTicket.id);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chat-admin-support-tickets"] });
      toast.success("Status da IA atualizado.");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Não foi possível atualizar a IA.");
    },
  });

  const closeTicket = useMutation({
    mutationFn: async () => {
      if (!selectedTicket?.id) return;

      const { error } = await (supabase as any)
        .from("support_tickets")
        .update({ status: "closed" })
        .eq("id", selectedTicket.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket marcado como resolvido.");
      setSelectedTicketId(null);
      void qc.invalidateQueries({ queryKey: ["chat-admin-support-tickets"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Não foi possível resolver o ticket.");
    },
  });

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-white dark:bg-zinc-900 md:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r border-[#EBEBEB] bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-[#EBEBEB] px-4 py-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#0A0A0A] dark:text-white">Suporte ao Cliente</h2>
              <p className="mt-0.5 text-[12px] text-[#737373] dark:text-zinc-400">Tickets abertos em tempo real</p>
            </div>
            {unansweredCount > 0 && (
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-red-600 px-2 text-[12px] font-bold text-white">
                {unansweredCount}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loadingTickets ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-5 text-center">
              <Inbox size={30} className="text-[#D4D4D4] dark:text-zinc-600" />
              <p className="mt-3 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Nenhum ticket aberto</p>
              <p className="mt-1 text-[12px] leading-5 text-[#737373] dark:text-zinc-400">Novas solicitações de suporte aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const active = selectedTicket?.id === ticket.id;
                const needsReply = getTicketNeedsReply(ticket);

                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={[
                      "w-full rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-[#0A0A0A] bg-[#F7F7F7] dark:border-white dark:bg-zinc-800"
                        : "border-transparent hover:border-[#E5E5E5] hover:bg-[#FAFAFA] dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-bold text-[#0A0A0A] dark:text-white">
                          {ticket.user_email || ticket.user_name || `Usuário ${ticket.user_id.slice(0, 8)}`}
                        </p>
                        <p className="mt-1 text-[11px] text-[#A3A3A3] dark:text-zinc-500">
                          Aberto em {formatSupportTime(ticket.created_at)}
                        </p>
                      </div>
                      {needsReply && (
                        <span className="mt-0.5 shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Novo
                        </span>
                      )}
                    </div>

                    <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#525252] dark:text-zinc-300">
                      {ticket.last_message || "Ticket aberto sem mensagens ainda."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#0A0A0A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-white dark:bg-white dark:text-black">
                        {ticket.status}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${
                        ticket.ai_active
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        IA {ticket.ai_active ? "ativa" : "pausada"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col bg-[#FAFAFA] dark:bg-zinc-950">
        {selectedTicket ? (
          <>
            <div className="flex flex-col gap-3 border-b border-[#EBEBEB] bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-white dark:bg-white dark:text-black">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-[#0A0A0A] dark:text-white">
                    {selectedTicket.user_email || selectedTicket.user_name || `Usuário ${selectedTicket.user_id.slice(0, 8)}`}
                  </p>
                  <p className="text-[11.5px] text-[#737373] dark:text-zinc-400">
                    Ticket aberto em {formatSupportTime(selectedTicket.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleAi.mutate(!selectedTicket.ai_active)}
                  disabled={toggleAi.isPending}
                  className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition disabled:opacity-50 ${
                    selectedTicket.ai_active
                      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
                      : "border-[#D4D4D4] bg-white text-[#525252] hover:border-[#0A0A0A] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white"
                  }`}
                >
                  {selectedTicket.ai_active ? <Pause size={13} /> : <Play size={13} />}
                  IA {selectedTicket.ai_active ? "Ativa" : "Pausada"}
                </button>

                <button
                  onClick={() => closeTicket.mutate()}
                  disabled={closeTicket.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[#0A0A0A] bg-white px-3 text-[12px] font-semibold text-[#0A0A0A] transition hover:bg-[#0A0A0A] hover:text-white disabled:opacity-50 dark:border-white dark:bg-zinc-900 dark:text-white dark:hover:bg-white dark:hover:text-black"
                >
                  {closeTicket.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Resolver
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-[#737373]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <MessageSquare size={30} className="text-[#D4D4D4] dark:text-zinc-600" />
                  <p className="mt-3 text-[13px] text-[#737373] dark:text-zinc-400">Este ticket ainda não tem mensagens.</p>
                </div>
              ) : (
                messages.map((message) => (
                  <AdminSupportBubble key={message.id} msg={message} />
                ))
              )}
            </div>

            <div className="border-t border-[#EBEBEB] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-end gap-2 rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 transition focus-within:border-[#D4D4D4] focus-within:ring-2 focus-within:ring-[#0A0A0A]/6 dark:border-zinc-700 dark:bg-zinc-800">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendReply.mutate();
                    }
                  }}
                  placeholder="Responder como admin..."
                  rows={1}
                  className="max-h-[120px] min-h-8 flex-1 resize-none bg-transparent py-1 text-[13.5px] text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] dark:text-white dark:placeholder:text-zinc-500"
                />
                <button
                  onClick={() => sendReply.mutate()}
                  disabled={sendReply.isPending || !reply.trim()}
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A] text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  aria-label="Enviar resposta"
                >
                  {sendReply.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5E5E5] bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <Headphones size={23} className="text-[#A3A3A3] dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Selecione um ticket</p>
              <p className="mt-1 text-[13px] text-[#737373] dark:text-zinc-400">A conversa do cliente aparecerá aqui.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminSupportBubble({ msg }: { msg: SupportMessage }) {
  const isAdmin = msg.sender === "admin";
  const isAi = msg.sender === "ai";

  return (
    <div className={`flex ${isAdmin ? "justify-end" : isAi ? "justify-center" : "justify-start"}`}>
      <div
        className={[
          "max-w-[74%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-6 shadow-sm",
          isAdmin
            ? "rounded-br-sm bg-blue-600 text-white dark:bg-blue-500 dark:text-white"
            : isAi
              ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              : "rounded-bl-sm bg-white text-[#0A0A0A] dark:bg-zinc-900 dark:text-white",
        ].join(" ")}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] opacity-70">
          {isAdmin ? <ShieldCheck size={11} /> : isAi ? <Bot size={11} /> : <UserRound size={11} />}
          {isAdmin ? "Admin" : isAi ? "IA" : "Usuário"}
        </div>
        <p className="whitespace-pre-wrap">{msg.message}</p>
        <p className="mt-1 text-[10.5px] opacity-55">{formatSupportTime(msg.created_at)}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatFornecedoresPage() {
  const { user } = useAuth();
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [search,       setSearch]       = useState("");
  const [mobileView,   setMobileView]   = useState<"list" | "chat">("list");
  const [activeArea, setActiveArea] = useState<ChatArea>("suppliers");

  const { data: isAdmin = false } = useQuery({
    queryKey: ["chat-admin-access", user?.id],
    enabled: !!user?.id,
    queryFn: () => checkAdminAccess(user!.id),
  });

  useEffect(() => {
    if (!isAdmin && activeArea === "support") {
      setActiveArea("suppliers");
    }
  }, [activeArea, isAdmin]);

  const handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setMobileView("chat");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveArea("suppliers")}
          className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition ${
            activeArea === "suppliers"
              ? "border-[#0A0A0A] bg-[#0A0A0A] text-white dark:border-white dark:bg-white dark:text-black"
              : "border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white"
          }`}
        >
          <UsersRound size={15} />
          Chat com Fornecedores
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveArea("support")}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition ${
              activeArea === "support"
                ? "border-[#0A0A0A] bg-[#0A0A0A] text-white dark:border-white dark:bg-white dark:text-black"
                : "border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white"
            }`}
          >
            <Headphones size={15} />
            Suporte ao Cliente
          </button>
        )}
      </div>

      <div
        className="flex overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        style={{ height: "calc(100vh - 56px - 5.25rem)" }}
      >
        {activeArea === "support" && isAdmin ? (
          <AdminSupportPanel />
        ) : (
          <>
            {/* Left: conversation list */}
            <div className={`w-full shrink-0 md:w-[300px] lg:w-[320px] ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
              <ConversationList
                selectedId={selectedId}
                onSelect={handleSelect}
                search={search}
                onSearchChange={setSearch}
              />
            </div>

            {/* Right: chat window */}
            <div className={`min-w-0 flex-1 ${mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"}`}>
              {selectedId ? (
                <ChatWindow
                  supplierId={selectedId}
                  supplierName={selectedName}
                  onBack={() => setMobileView("list")}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#FAFAFA] text-center dark:bg-zinc-900">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5E5E5] bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    <MessageSquare size={22} className="text-[#A3A3A3] dark:text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">
                      Nenhuma conversa selecionada
                    </p>
                    <p className="mt-1 text-[13px] text-[#737373] dark:text-zinc-400">
                      Selecione um fornecedor para iniciar
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
