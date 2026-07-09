import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  MessageCircle,
  Plug,
  RefreshCcw,
  Send,
  UserCircle2,
  UserRound,
  X,
} from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminEmail } from "@/lib/adminAccess";
import { notifyTicketReplyEmail } from "@/lib/supportEmail";

type TicketCategory = "financeiro" | "bug" | "integracao" | "conta" | "reembolso" | "outros";

type AdminTicket = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  category: TicketCategory;
  subject: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  last_message: string | null;
  last_message_at: string | null;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  sender: "user" | "admin";
  created_at: string;
};

import type { LucideIcon } from "lucide-react";

const CATEGORY_META: Record<
  TicketCategory,
  { label: string; icon: LucideIcon; accent: string }
> = {
  financeiro: { label: "Financeiro", icon: CreditCard, accent: "bg-emerald-100 text-emerald-700" },
  bug: { label: "Bug / Erro", icon: Bug, accent: "bg-red-100 text-red-700" },
  integracao: { label: "Integrações", icon: Plug, accent: "bg-blue-100 text-blue-700" },
  conta: { label: "Conta", icon: UserCircle2, accent: "bg-purple-100 text-purple-700" },
  reembolso: { label: "Reembolso", icon: RefreshCcw, accent: "bg-amber-100 text-amber-700" },
  outros: { label: "Outros", icon: AlertTriangle, accent: "bg-neutral-200 text-neutral-700" },
};

const CATEGORY_ORDER: TicketCategory[] = ["financeiro", "bug", "integracao", "conta", "reembolso", "outros"];

const formatDateTime = (value: string | null) => {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const AdminSupportPage = () => {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [activeCategory, setActiveCategory] = useState<TicketCategory | "todos">("todos");
  const fallbackAdmin = isAdminEmail(user?.email);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["admin-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("role, display_name")
        .or(`id.eq.${user!.id},user_id.eq.${user!.id}`)
        .maybeSingle();
      if (error) throw error;
      return data as { role: string | null; display_name: string | null } | null;
    },
  });

  const isAdmin = profile?.role === "admin" || fallbackAdmin;

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["admin-support-tickets-crm"],
    enabled: !!user?.id && isAdmin,
    queryFn: async () => {
      const { data: ticketsData, error: ticketsError } = await (supabase as any)
        .from("support_tickets")
        .select("id,user_id,status,category,subject,created_at,updated_at")
        .eq("status", "open")
        .order("updated_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      const ticketsList = (ticketsData ?? []) as any[];
      if (ticketsList.length === 0) return [] as AdminTicket[];

      const ticketIds = ticketsList.map((t) => t.id);
      const userIds = Array.from(new Set(ticketsList.map((t) => t.user_id)));

      const profilesByUser = new Map<string, { display_name: string | null; email?: string | null }>();
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("user_id,display_name,email")
        .in("user_id", userIds);
      for (const p of (profs ?? []) as any[]) {
        profilesByUser.set(p.user_id, { display_name: p.display_name ?? null, email: p.email ?? null });
      }

      const { data: msgs } = await (supabase as any)
        .from("support_messages")
        .select("id,ticket_id,user_id,message,sender,created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });

      const lastByTicket = new Map<string, any>();
      for (const m of (msgs ?? []) as any[]) {
        if (!lastByTicket.has(m.ticket_id)) lastByTicket.set(m.ticket_id, m);
      }

      return ticketsList.map((t) => {
        const p = profilesByUser.get(t.user_id);
        const last = lastByTicket.get(t.id);
        return {
          id: t.id,
          user_id: t.user_id,
          status: t.status,
          category: (t.category ?? "outros") as TicketCategory,
          subject: t.subject ?? null,
          created_at: t.created_at,
          updated_at: t.updated_at,
          user_name: p?.display_name ?? null,
          user_email: p?.email ?? null,
          last_message: last?.message ?? null,
          last_message_at: last?.created_at ?? null,
        } as AdminTicket;
      });
    },
    retry: false,
  });

  const openTicket = useMemo(
    () => tickets.find((t) => t.id === openTicketId) ?? null,
    [openTicketId, tickets],
  );

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["admin-support-messages", openTicket?.id],
    enabled: !!openTicket?.id && isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .select("*")
        .eq("ticket_id", openTicket!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupportMessage[];
    },
  });

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-support-crm")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const m = payload.new as SupportMessage;
        void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
        qc.setQueryData<SupportMessage[]>(
          ["admin-support-messages", m.ticket_id],
          (prev = []) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]),
        );
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  const sendReply = useMutation({
    mutationFn: async () => {
      const trimmed = reply.trim();
      if (!trimmed || !openTicket?.id || !user?.id) return null;
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .insert({ ticket_id: openTicket.id, user_id: user.id, message: trimmed, sender: "admin" })
        .select("*")
        .single();
      if (error) throw error;
      return data as SupportMessage;
    },
    onSuccess: (m) => {
      if (!m) return;
      setReply("");
      qc.setQueryData<SupportMessage[]>(
        ["admin-support-messages", m.ticket_id],
        (prev = []) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]),
      );
      void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      notifyTicketReplyEmail(m.ticket_id, m.id).catch(() => {});
    },
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível enviar a resposta.");
    },
  });

  const closeTicket = useMutation({
    mutationFn: async () => {
      if (!openTicket?.id) return;
      const { error } = await (supabase as any)
        .from("support_tickets")
        .update({ status: "closed" })
        .eq("id", openTicket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket marcado como resolvido.");
      setOpenTicketId(null);
      void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
    },
    onError: () => toast.error("Não foi possível resolver o ticket."),
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4]">
        <Loader2 className="h-7 w-7 animate-spin text-[#0A0A0A]" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4]">
        <Loader2 className="h-7 w-7 animate-spin text-[#0A0A0A]" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-6">
        <div className="w-full max-w-md rounded-3xl border border-[#E5E5E5] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F5]">
            <Lock size={21} />
          </div>
          <h1 className="mt-5 text-[20px] font-bold text-[#0A0A0A]">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#737373]">
            Esta página é exclusiva para administradores.
          </p>
        </div>
      </div>
    );
  }

  const filtered =
    activeCategory === "todos" ? tickets : tickets.filter((t) => t.category === activeCategory);

  const countsByCategory = CATEGORY_ORDER.reduce<Record<TicketCategory, number>>((acc, k) => {
    acc[k] = tickets.filter((t) => t.category === k).length;
    return acc;
  }, {} as Record<TicketCategory, number>);

  return (
    <AdminShell active="support" userId={user.id}>
      <div className="min-h-full bg-[#f5f5f4] p-5 text-[#0A0A0A] md:p-8">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
          <header className="flex flex-col gap-4 rounded-3xl border border-[#E5E5E5] bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">Admin · CRM</p>
              <h1 className="text-[24px] font-black tracking-tight">Suporte por setor</h1>
              <p className="mt-1 text-[13px] text-[#737373]">
                Tickets abertos organizados por categoria. Clique em um card para responder o usuário.
              </p>
            </div>
            <div className="rounded-full bg-[#0A0A0A] px-4 py-2 text-[13px] font-semibold text-white">
              {tickets.length} abertos
            </div>
          </header>

          {loadingTickets ? (
            <div className="flex items-center justify-center rounded-3xl border border-[#E5E5E5] bg-white py-24">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {CATEGORY_ORDER.map((k) => (
                <CategoryColumn
                  key={k}
                  category={k}
                  tickets={tickets.filter((t) => t.category === k)}
                  onOpen={(id) => setOpenTicketId(id)}
                />
              ))}
            </div>
          )}
        </div>

        {openTicket && (
          <ChatDrawer
            ticket={openTicket}
            messages={messages}
            loadingMessages={loadingMessages}
            reply={reply}
            setReply={setReply}
            onClose={() => setOpenTicketId(null)}
            onSend={() => sendReply.mutate()}
            sending={sendReply.isPending}
            onResolve={() => closeTicket.mutate()}
            resolving={closeTicket.isPending}
          />
        )}
      </div>
    </AdminShell>
  );
};

const CategoryPill = ({
  active,
  label,
  count,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  icon?: LucideIcon;
}) => (
  <button
    onClick={onClick}
    className={[
      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition",
      active
        ? "border-[#0A0A0A] bg-[#0A0A0A] text-white"
        : "border-[#E5E5E5] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]",
    ].join(" ")}
  >
    {Icon && <Icon size={14} />}
    {label}
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[11px] font-bold",
        active ? "bg-white/15 text-white" : "bg-[#F5F5F5] text-[#525252]",
      ].join(" ")}
    >
      {count}
    </span>
  </button>
);

const CategorySection = ({
  category,
  tickets,
  onOpen,
}: {
  category: TicketCategory;
  tickets: AdminTicket[];
  onOpen: (id: string) => void;
}) => {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <section className="rounded-3xl border border-[#E5E5E5] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F0F0F0] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.accent}`}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-[15px] font-bold">{meta.label}</p>
            <p className="text-[12px] text-[#737373]">{tickets.length} ticket(s) abertos</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-[#F0F0F0]">
        {tickets.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpen(t.id)}
            className="flex w-full items-start gap-4 px-6 py-4 text-left transition hover:bg-[#FAFAFA]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-white">
              <UserRound size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-bold text-[#0A0A0A]">{t.user_name || "Usuário"}</p>
                <span className="text-[12px] text-[#A3A3A3]">·</span>
                <p className="truncate text-[12px] text-[#737373]">{t.user_email || "sem email"}</p>
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#0A0A0A]">
                {t.subject || t.last_message || "Sem descrição."}
              </p>
              <p className="mt-1.5 text-[11px] text-[#A3A3A3]">
                Aberto em {formatDateTime(t.created_at)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-emerald-700">
              open
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#E5E5E5] bg-white py-16 text-center">
    <MessageCircle className="h-8 w-8 text-[#D4D4D4]" />
    <p className="mt-3 text-[14px] font-semibold">Nenhum ticket aberto</p>
    <p className="mt-1 text-[12px] text-[#737373]">Novas solicitações aparecerão aqui automaticamente.</p>
  </div>
);

const ChatDrawer = ({
  ticket,
  messages,
  loadingMessages,
  reply,
  setReply,
  onClose,
  onSend,
  sending,
  onResolve,
  resolving,
}: {
  ticket: AdminTicket;
  messages: SupportMessage[];
  loadingMessages: boolean;
  reply: string;
  setReply: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
  onResolve: () => void;
  resolving: boolean;
}) => {
  const meta = CATEGORY_META[ticket.category];
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#F0F0F0] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A0A0A] text-white">
              <UserRound size={18} />
            </div>
            <div>
              <p className="text-[15px] font-bold">{ticket.user_name || "Usuário"}</p>
              <p className="text-[12px] text-[#737373]">{ticket.user_email || "Email indisponível"}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.accent}`}>
                {meta.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-[#737373] hover:bg-[#F5F5F5]"
          >
            <X size={18} />
          </button>
        </div>

        {ticket.subject && (
          <div className="border-b border-[#F0F0F0] bg-[#FAFAFA] px-6 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A3A3A3]">Motivo</p>
            <p className="mt-1 text-[13px] leading-5 text-[#0A0A0A]">{ticket.subject}</p>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#FAFAFA] p-5">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-[13px] text-[#737373]">
              O usuário ainda não enviou mensagens.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                <div
                  className={[
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-6 shadow-sm",
                    m.sender === "admin"
                      ? "rounded-br-md bg-[#0A0A0A] text-white"
                      : "rounded-bl-md bg-white text-[#0A0A0A]",
                  ].join(" ")}
                >
                  <p className="whitespace-pre-wrap">{m.message}</p>
                  <p
                    className={`mt-1 text-[10px] ${m.sender === "admin" ? "text-white/60" : "text-[#A3A3A3]"}`}
                  >
                    {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[#F0F0F0] bg-white p-4">
          <div className="mb-3 flex justify-end">
            <button
              onClick={onResolve}
              disabled={resolving}
              className="inline-flex items-center gap-2 rounded-full border border-[#0A0A0A] px-3.5 py-1.5 text-[12px] font-semibold text-[#0A0A0A] transition hover:bg-[#0A0A0A] hover:text-white disabled:opacity-50"
            >
              {resolving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Marcar como resolvido
            </button>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Digite a resposta para o usuário..."
              className="min-h-[48px] flex-1 resize-none rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3 text-[14px] leading-5 outline-none transition focus:border-[#0A0A0A]"
            />
            <button
              onClick={onSend}
              disabled={sending || !reply.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSupportPage;
