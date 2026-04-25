import { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare, Search, Send, Paperclip, Sparkles,
  ChevronRight, ArrowLeft, Package, ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatFornecedoresPage() {
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [search,       setSearch]       = useState("");
  const [mobileView,   setMobileView]   = useState<"list" | "chat">("list");

  const handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setMobileView("chat");
  };

  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
      style={{ height: "calc(100vh - 56px - 2rem)" }}
    >
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
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#FAFAFA] dark:bg-zinc-900 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5E5E5] dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm">
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
    </div>
  );
}
