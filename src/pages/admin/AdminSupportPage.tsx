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
  Mail,
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
  financeiro: { label: "Financeiro", icon: CreditCard, accent: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" },
  bug: { label: "Bug / Erro", icon: Bug, accent: "bg-red-500/10 text-red-300 border border-red-500/20" },
  integracao: { label: "Integrações", icon: Plug, accent: "bg-blue-500/10 text-blue-300 border border-blue-500/20" },
  conta: { label: "Conta", icon: UserCircle2, accent: "bg-purple-500/10 text-purple-300 border border-purple-500/20" },
  reembolso: { label: "Reembolso", icon: RefreshCcw, accent: "bg-amber-500/10 text-amber-300 border border-amber-500/20" },
  outros: { label: "Outros", icon: AlertTriangle, accent: "bg-white/5 text-white/70 border border-white/10" },
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
        .select("user_id,display_name,email,full_name")
        .in("user_id", userIds);
      for (const p of (profs ?? []) as any[]) {
        profilesByUser.set(p.user_id, {
          display_name: p.full_name ?? p.display_name ?? null,
          email: p.email ?? null,
        });
      }

      // Fallback: fetch emails/names via admin-users edge function for users missing data
      const needsFallback = userIds.filter((uid) => {
        const p = profilesByUser.get(uid);
        return !p || !p.email || !p.display_name;
      });
      if (needsFallback.length > 0) {
        try {
          const { data: adminData } = await supabase.functions.invoke("admin-users", {
            body: { user_ids: needsFallback },
          });
          const list = (adminData as any)?.users ?? (adminData as any) ?? [];
          for (const u of list as any[]) {
            const existing = profilesByUser.get(u.user_id ?? u.id) ?? { display_name: null, email: null };
            profilesByUser.set(u.user_id ?? u.id, {
              display_name: existing.display_name ?? u.display_name ?? u.full_name ?? u.name ?? null,
              email: existing.email ?? u.email ?? null,
            });
          }
        } catch (e) {
          console.warn("admin-users fallback failed", e);
        }
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
    refetchInterval: 10000,
  });

  const openTicket = useMemo(() => tickets.find((t) => t.id === openTicketId), [tickets, openTicketId]);

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["admin-support-messages", openTicketId],
    enabled: !!openTicketId && isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .select("id,ticket_id,user_id,message,sender,created_at")
        .eq("ticket_id", openTicketId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as SupportMessage[];
    },
    refetchInterval: openTicketId ? 5000 : false,
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!openTicket || !reply.trim()) return;
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: openTicket.id,
        user_id: user!.id,
        message: reply.trim(),
        sender: "admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const sentText = reply.trim();
      setReply("");
      qc.invalidateQueries({ queryKey: ["admin-support-messages", openTicketId] });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      
      // Trigger background email notification via helper
      if (openTicket && openTicket.user_email) {
        notifyTicketReplyEmail(openTicket.user_email, openTicket.user_name || "Usuário", sentText).catch((err) => {
          console.error("Failed to send email notify", err);
        });
      }
    },
    onError: (e: any) => toast.error(`Erro ao responder: ${e.message}`),
  });

  const closeTicket = useMutation({
    mutationFn: async () => {
      if (!openTicketId) return;
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "closed" })
        .eq("id", openTicketId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket marcado como resolvido.");
      setOpenTicketId(null);
      qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
    },
    onError: (e: any) => toast.error(`Erro ao encerrar: ${e.message}`),
  });

  if (loading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0A0A0A] p-8 text-center">
          <Lock size={24} className="mx-auto" strokeWidth={1.5} />
          <h1 className="mt-4 text-[20px] font-bold">Acesso restrito</h1>
        </div>
      </div>
    );
  }

  return (
    <AdminShell active="support" userId={user.id}>
      <div className="min-h-full bg-transparent text-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
          <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8A8A8E]">Admin · CRM</p>
              <h1 className="text-[24px] font-semibold tracking-tight text-white mt-1">Suporte por setor</h1>
              <p className="mt-1 text-[13px] text-[#8A8A8E]">
                Tickets abertos organizados por categoria. Clique em um card para responder o usuário.
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.06] border border-white/10 px-4 py-2 text-[13px] font-semibold text-white">
              {tickets.length} abertos
            </div>
          </header>

          {loadingTickets ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
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

const COLUMN_ACCENTS: Record<TicketCategory, { dot: string; badge: string; statusBadge: string }> = {
  financeiro: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20", statusBadge: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" },
  bug: { dot: "bg-red-500", badge: "bg-red-500/10 text-red-300 border border-red-500/20", statusBadge: "bg-red-500/10 text-red-300 border border-red-500/20" },
  integracao: { dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-300 border border-blue-500/20", statusBadge: "bg-blue-500/10 text-blue-300 border border-blue-500/20" },
  conta: { dot: "bg-purple-500", badge: "bg-purple-500/10 text-purple-300 border border-purple-500/20", statusBadge: "bg-purple-500/10 text-purple-300 border border-purple-500/20" },
  reembolso: { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-300 border border-amber-500/20", statusBadge: "bg-amber-500/10 text-amber-300 border border-amber-500/20" },
  outros: { dot: "bg-neutral-400", badge: "bg-white/5 text-white/70 border border-white/10", statusBadge: "bg-white/5 text-white/70 border border-white/10" },
};

const CategoryColumn = ({
  category,
  tickets,
  onOpen,
}: {
  category: TicketCategory;
  tickets: AdminTicket[];
  onOpen: (id: string) => void;
}) => {
  const meta = CATEGORY_META[category];
  const accent = COLUMN_ACCENTS[category];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#0F0F0F] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
          <p className="text-[13px] font-semibold text-white">{meta.label}</p>
        </div>
        <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${accent.badge}`}>
          {tickets.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {tickets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] bg-transparent px-4 py-6 text-center text-[11px] text-[#8A8A8E]">
            Nenhum ticket
          </div>
        ) : (
          tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => onOpen(t.id)}
              className="group flex w-full flex-col gap-3 rounded-lg border border-white/[0.08] bg-transparent p-4 text-left transition hover:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white">
                    <UserRound size={14} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {t.user_name || "Usuário"}
                    </p>
                    <p className="text-[11px] text-[#8A8A8E]">{formatDateTime(t.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[12px] text-[#8A8A8E]">
                <Mail size={12} className="shrink-0 text-[#8A8A8E]/60" strokeWidth={1.5} />
                <span className="truncate">{t.user_email || "email indisponível"}</span>
              </div>

              {(t.last_message || t.subject) && (
                <div className="rounded-lg bg-white/[0.04] px-2.5 py-2 w-full">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8A8A8E]/60">
                    Última mensagem
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-white">
                    {t.last_message || t.subject}
                  </p>
                </div>
              )}

              <span
                className={`inline-flex w-fit items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ${accent.statusBadge}`}
              >
                {meta.label}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-transparent py-16 text-center">
    <MessageCircle className="h-8 w-8 text-[#8A8A8E]/40" strokeWidth={1.5} />
    <p className="mt-3 text-[14px] font-semibold">Nenhum ticket aberto</p>
    <p className="mt-1 text-[12px] text-[#8A8A8E]">Novas solicitações aparecerão aqui automaticamente.</p>
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[560px] flex-col bg-[#0F0F0F] border-l border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white">
              <UserRound size={18} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-white">{ticket.user_name || "Usuário"}</p>
              <p className="text-[12px] text-[#8A8A8E]">{ticket.user_email || "Email indisponível"}</p>
              <span className={`mt-1.5 inline-block rounded-lg px-2 py-0.5 text-[10px] font-semibold ${meta.accent}`}>
                {meta.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-[#8A8A8E] hover:bg-white/5 hover:text-white transition"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {ticket.subject && (
          <div className="border-b border-white/[0.08] bg-[#0A0A0A] px-6 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A8A8E]/60">Motivo</p>
            <p className="mt-1 text-[13px] leading-5 text-white">{ticket.subject}</p>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#0A0A0A] p-5">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/60" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-[13px] text-[#8A8A8E]">
              O usuário ainda não enviou mensagens.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                <div
                  className={[
                    "max-w-[80%] rounded-lg px-4 py-2.5 text-[14px] leading-6",
                    m.sender === "admin"
                      ? "rounded-br-none bg-white/[0.06] text-white"
                      : "rounded-bl-none bg-white/[0.03] border border-white/[0.08] text-white",
                  ].join(" ")}
                >
                  <p className="whitespace-pre-wrap">{m.message}</p>
                  <p
                    className={`mt-1.5 text-[10px] ${m.sender === "admin" ? "text-white/40" : "text-[#8A8A8E]/60"}`}
                  >
                    {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.08] bg-[#0F0F0F] p-4">
          <div className="mb-3 flex justify-end">
            <button
              onClick={onResolve}
              disabled={resolving}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.04] disabled:opacity-50 transition"
            >
              {resolving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} strokeWidth={1.5} />}
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
              className="min-h-[48px] flex-1 resize-none rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-4 py-3 text-[14px] leading-5 text-white outline-none focus:border-white/20 transition placeholder:text-[#8A8A8E]/60"
            />
            <button
              onClick={onSend}
              disabled={sending || !reply.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#22C55E] text-black transition hover:bg-[#16A34A] disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/30"
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
