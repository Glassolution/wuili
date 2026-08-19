/* eslint-disable @typescript-eslint/no-explicit-any -- As tabelas de suporte ainda não constam nos tipos gerados do Supabase; os resultados são normalizados nos tipos locais abaixo. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Archive,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Hash,
  HandCoins,
  Inbox,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plug,
  Search,
  Send,
  Trash2,
  UserCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { notifyTicketReplyEmail } from "@/lib/supportEmail";
import {
  buildSupportImageMessage,
  parseSupportMessage,
  removeSupportImage,
  supportMessagePreview,
  uploadSupportImage,
  validateSupportImage,
} from "@/lib/support";
import SupportImagePreview from "@/components/support/SupportImagePreview";
import SupportMessageMedia from "@/components/support/SupportMessageMedia";

type TicketCategory = "financeiro" | "bug" | "integracao" | "conta" | "reembolso" | "outros";
type TicketView = "all" | "new" | "in_progress";
type TicketStatusFilter = "all" | "open" | "closed";
type TicketDateFilter = "all" | "today" | "7d" | "30d";

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
  user_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  has_admin_reply: boolean;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  sender: "user" | "admin";
  created_at: string;
};

type CustomerContextData = {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string | null;
  subscription_status: string | null;
  subscription_started_at: string | null;
  customer_since: string | null;
  last_seen_at: string | null;
};

type DirectRefundTarget = {
  ticket: AdminTicket;
  customer: CustomerContextData;
};

const CATEGORY_META: Record<
  TicketCategory,
  { label: string; icon: LucideIcon; dot: string; badge: string }
> = {
  financeiro: {
    label: "Financeiro",
    icon: CreditCard,
    dot: "bg-[#64748b]",
    badge: "border-[#dfe4ea] bg-[#f4f6f8] text-[#596273]",
  },
  bug: {
    label: "Bug / Erro",
    icon: Bug,
    dot: "bg-[#ef5b67]",
    badge: "border-[#f5d6d9] bg-[#fff2f3] text-[#b8434d]",
  },
  integracao: {
    label: "Integração",
    icon: Plug,
    dot: "bg-[#4f7cff]",
    badge: "border-[#d9e2ff] bg-[#f1f5ff] text-[#4164c7]",
  },
  conta: {
    label: "Conta",
    icon: UserCircle2,
    dot: "bg-[#8b6ee8]",
    badge: "border-[#e4def7] bg-[#f7f4ff] text-[#7158bd]",
  },
  reembolso: {
    label: "Reembolso",
    icon: Archive,
    dot: "bg-[#e49a31]",
    badge: "border-[#f1dfbf] bg-[#fff8e9] text-[#a46a17]",
  },
  outros: {
    label: "Outros",
    icon: AlertTriangle,
    dot: "bg-[#8a8f98]",
    badge: "border-[#e2e3e5] bg-[#f5f5f5] text-[#686d76]",
  },
};

const VIEW_OPTIONS: Array<{ value: TicketView; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Novos" },
  { value: "in_progress", label: "Em andamento" },
];

const STATUS_OPTIONS: Array<{ value: TicketStatusFilter; label: string }> = [
  { value: "all", label: "Abertos e fechados" },
  { value: "open", label: "Abertos" },
  { value: "closed", label: "Fechados" },
];

const DATE_OPTIONS: Array<{ value: TicketDateFilter; label: string }> = [
  { value: "all", label: "Todos os dias" },
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

const getTicketActivityTime = (ticket: Pick<AdminTicket, "last_message_at" | "updated_at" | "created_at">) => {
  const time = new Date(ticket.last_message_at ?? ticket.updated_at ?? ticket.created_at).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const matchesTicketStatus = (ticket: AdminTicket, status: TicketStatusFilter) =>
  status === "all" || ticket.status === status;

const matchesTicketDate = (ticket: AdminTicket, dateFilter: TicketDateFilter) => {
  if (dateFilter === "all") return true;
  const activity = getTicketActivityTime(ticket);
  if (!activity) return false;
  const now = Date.now();
  if (dateFilter === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return activity >= today.getTime();
  }
  const days = dateFilter === "7d" ? 7 : 30;
  return activity >= now - days * 24 * 60 * 60 * 1000;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(".", "");
};

const relativeTime = (value: string | null) => {
  if (!value) return "Sem atividade";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Sem atividade";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `${days} dias atrás`;
};

const elapsedTime = (value: string | null) => {
  if (!value) return "Não informado";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Não informado";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 2) return "menos de 2 minutos";
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hora" : `${hours} horas`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "1 dia" : `${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano" : `${years} anos`;
};

const formatPlan = (plan: string | null) => {
  const normalized = (plan ?? "gratuito").toLowerCase();
  if (normalized === "business") return "Business";
  if (normalized === "pro") return "Pro";
  if (["base", "starter"].includes(normalized)) return "Base";
  if (["free", "gratis", "gratuito"].includes(normalized)) return "Gratuito";
  return plan || "Não informado";
};

const formatSubscriptionStatus = (status: string | null) => {
  const normalized = (status ?? "").toLowerCase();
  if (["active", "paid", "approved", "authorized"].includes(normalized)) return "Ativa";
  if (["pending", "in_process", "waiting_payment"].includes(normalized)) return "Pendente";
  if (["cancelled", "canceled", "inactive"].includes(normalized)) return "Cancelada";
  if (["past_due", "overdue"].includes(normalized)) return "Em atraso";
  return status || "Sem assinatura";
};

const getInitials = (name?: string | null, email?: string | null) =>
  (name || email || "Velo")
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const AdminSupportPage = () => {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<TicketView>("all");
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("open");
  const [dateFilter, setDateFilter] = useState<TicketDateFilter>("all");
  const [directRefundTarget, setDirectRefundTarget] = useState<DirectRefundTarget | null>(null);

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

  useEffect(() => {
    setReplyImage(null);
  }, [openTicketId]);

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["admin-support-tickets-crm"],
    enabled: !!user?.id && isAdmin,
    queryFn: async () => {
      const { data: ticketsData, error: ticketsError } = await (supabase as any)
        .from("support_tickets")
        .select("id,user_id,status,category,subject,created_at,updated_at")
        .order("updated_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      const ticketsList = (ticketsData ?? []) as any[];
      if (ticketsList.length === 0) return [] as AdminTicket[];

      const ticketIds = ticketsList.map((ticket) => ticket.id);
      const userIds = Array.from(new Set(ticketsList.map((ticket) => ticket.user_id)));
      const profilesByUser = new Map<
        string,
        { display_name: string | null; email: string | null; avatar_url: string | null }
      >();

      const { data: profilesData } = await (supabase as any)
        .from("profiles")
        .select("user_id,display_name,email,full_name,avatar_url")
        .in("user_id", userIds);

      for (const item of (profilesData ?? []) as any[]) {
        profilesByUser.set(item.user_id, {
          display_name: item.full_name ?? item.display_name ?? null,
          email: item.email ?? null,
          avatar_url: item.avatar_url ?? null,
        });
      }

      const needsFallback = userIds.filter((userId) => {
        const item = profilesByUser.get(userId);
        return !item?.email || !item.display_name || !item.avatar_url;
      });

      if (needsFallback.length > 0) {
        try {
          // Nunca deixa a lista de tickets travar caso a função demore.
          const adminData = await Promise.race([
            supabase.functions
              .invoke("admin-users", { body: { user_ids: needsFallback } })
              .then((res) => res.data),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ]);

          const responseUsers =
            adminData && typeof adminData === "object" && "users" in adminData
              ? (adminData as { users?: unknown }).users
              : null;
          const list = Array.isArray(adminData) ? adminData : Array.isArray(responseUsers) ? responseUsers : [];
          for (const item of list as Array<{
            user_id?: string;
            id?: string;
            display_name?: string | null;
            full_name?: string | null;
            name?: string | null;
            email?: string | null;
            avatar_url?: string | null;
          }>) {
            const userId = item.user_id ?? item.id;
            if (!userId) continue;
            const existing = profilesByUser.get(userId);
            profilesByUser.set(userId, {
              display_name: existing?.display_name ?? item.display_name ?? item.full_name ?? item.name ?? null,
              email: existing?.email ?? item.email ?? null,
              avatar_url: existing?.avatar_url ?? item.avatar_url ?? null,
            });
          }
        } catch (error) {
          console.warn("admin-users fallback failed", error);
        }
      }

      const { data: messagesData } = await (supabase as any)
        .from("support_messages")
        .select("id,ticket_id,user_id,message,sender,created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });

      const lastByTicket = new Map<string, SupportMessage>();
      const messageCountByTicket = new Map<string, number>();
      const adminReplyByTicket = new Set<string>();

      for (const message of (messagesData ?? []) as SupportMessage[]) {
        messageCountByTicket.set(message.ticket_id, (messageCountByTicket.get(message.ticket_id) ?? 0) + 1);
        if (!lastByTicket.has(message.ticket_id)) lastByTicket.set(message.ticket_id, message);
        if (message.sender === "admin") adminReplyByTicket.add(message.ticket_id);
      }

      return ticketsList.map((ticket) => {
        const customer = profilesByUser.get(ticket.user_id);
        const lastMessage = lastByTicket.get(ticket.id);
        return {
          id: ticket.id,
          user_id: ticket.user_id,
          status: ticket.status,
          category: (ticket.category ?? "outros") as TicketCategory,
          subject: ticket.subject ?? null,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          user_name: customer?.display_name ?? null,
          user_email: customer?.email ?? null,
          user_avatar_url: customer?.avatar_url ?? null,
          last_message: lastMessage ? supportMessagePreview(lastMessage.message) : null,
          last_message_at: lastMessage?.created_at ?? null,
          message_count: messageCountByTicket.get(ticket.id) ?? 0,
          has_admin_reply: adminReplyByTicket.has(ticket.id),
        } satisfies AdminTicket;
      }).sort((a, b) => getTicketActivityTime(b) - getTicketActivityTime(a));
    },
    retry: false,
  });

  const visibleTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesView =
        view === "all" ||
        (view === "new" && !ticket.has_admin_reply) ||
        (view === "in_progress" && ticket.has_admin_reply);
      const matchesStatus = matchesTicketStatus(ticket, statusFilter);
      const matchesDate = matchesTicketDate(ticket, dateFilter);
      const matchesSearch =
        !term ||
        [
          ticket.user_name,
          ticket.user_email,
          ticket.subject,
          ticket.last_message,
          CATEGORY_META[ticket.category].label,
        ].some((value) => value?.toLowerCase().includes(term));
      return matchesView && matchesStatus && matchesDate && matchesSearch;
    });
  }, [dateFilter, search, statusFilter, tickets, view]);

  useEffect(() => {
    if (visibleTickets.length === 0) {
      setOpenTicketId(null);
      return;
    }
    if (!visibleTickets.some((ticket) => ticket.id === openTicketId)) {
      setOpenTicketId(visibleTickets[0].id);
    }
  }, [openTicketId, visibleTickets]);

  const openTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === openTicketId) ?? null,
    [openTicketId, tickets],
  );

  const { data: customerContext, isLoading: loadingCustomerContext } = useQuery({
    queryKey: ["admin-support-customer-context", openTicket?.user_id],
    enabled: !!openTicket?.user_id && isAdmin,
    queryFn: async (): Promise<CustomerContextData> => {
      const userId = openTicket!.user_id;
      const [profileResult, subscriptionsResult, sessionResult] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("user_id,display_name,avatar_url,plano,created_at")
          .eq("user_id", userId)
          .maybeSingle(),
        (supabase as any)
          .from("subscriptions")
          .select("plan,status,created_at,updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("user_sessions")
          .select("last_seen_at")
          .eq("user_id", userId)
          .order("last_seen_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (profileResult.error) console.warn("Não foi possível carregar o perfil do atendimento", profileResult.error);
      if (subscriptionsResult.error) console.warn("Não foi possível carregar a assinatura do atendimento", subscriptionsResult.error);
      if (sessionResult.error) console.warn("Não foi possível carregar a atividade do atendimento", sessionResult.error);

      const profileRow = profileResult.data as any | null;
      const subscriptionRows = (subscriptionsResult.data ?? []) as Array<{
        plan: string | null;
        status: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      const activeStatuses = new Set(["active", "paid", "approved", "authorized"]);
      const subscription =
        subscriptionRows.find((item) => activeStatuses.has((item.status ?? "").toLowerCase())) ??
        subscriptionRows[0] ??
        null;

      return {
        name: profileRow?.display_name ?? openTicket?.user_name ?? null,
        email: openTicket?.user_email ?? null,
        avatar_url: profileRow?.avatar_url ?? openTicket?.user_avatar_url ?? null,
        plan: subscription?.plan ?? profileRow?.plano ?? null,
        subscription_status: subscription?.status ?? null,
        subscription_started_at: subscription?.created_at ?? null,
        customer_since: profileRow?.created_at ?? null,
        last_seen_at: sessionResult.data?.last_seen_at ?? openTicket?.last_message_at ?? openTicket?.updated_at ?? null,
      };
    },
    retry: false,
  });

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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, openTicketId]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-support-crm")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, (payload) => {
        const message = payload.new as SupportMessage;
        void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
        if (payload.eventType === "INSERT") {
          qc.setQueryData<SupportMessage[]>(
            ["admin-support-messages", message.ticket_id],
            (previous = []) => (previous.some((item) => item.id === message.id) ? previous : [...previous, message]),
          );
        } else {
          void qc.invalidateQueries({ queryKey: ["admin-support-messages", message.ticket_id] });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  const sendReply = useMutation({
    mutationFn: async () => {
      const trimmed = reply.trim();
      if ((!trimmed && !replyImage) || !openTicket?.id || !user?.id) return null;

      let uploadedPath: string | null = null;
      try {
        const attachment = replyImage
          ? await uploadSupportImage({ file: replyImage, ticketId: openTicket.id, userId: user.id })
          : null;
        uploadedPath = attachment?.path ?? null;
        const messageValue = attachment ? buildSupportImageMessage(attachment, trimmed) : trimmed;
        const { data, error } = await (supabase as any)
          .from("support_messages")
          .insert({ ticket_id: openTicket.id, user_id: user.id, message: messageValue, sender: "admin" })
          .select("*")
          .single();
        if (error) throw error;
        return data as SupportMessage;
      } catch (error) {
        if (uploadedPath) await removeSupportImage(uploadedPath);
        throw error;
      }
    },
    onSuccess: (message) => {
      if (!message) return;
      setReply("");
      setReplyImage(null);
      qc.setQueryData<SupportMessage[]>(
        ["admin-support-messages", message.ticket_id],
        (previous = []) =>
          previous.some((item) => item.id === message.id) ? previous : [...previous, message],
      );
      void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      notifyTicketReplyEmail(message.ticket_id, message.id).catch((error) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Resposta enviada, mas o email não foi notificado.");
      });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Não foi possível enviar a resposta.");
    },
  });

  const editMessage = useMutation({
    mutationFn: async ({ message, text }: { message: SupportMessage; text: string }) => {
      const parsed = parseSupportMessage(message.message);
      const trimmed = text.trim();
      if (!trimmed && !parsed.attachment) throw new Error("A mensagem não pode ficar vazia.");
      const nextMessage = parsed.attachment ? buildSupportImageMessage(parsed.attachment, trimmed) : trimmed;
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .update({ message: nextMessage })
        .eq("id", message.id)
        .eq("sender", "admin")
        .select("*")
        .single();
      if (error) throw error;
      return data as SupportMessage;
    },
    onSuccess: (updated) => {
      qc.setQueryData<SupportMessage[]>(
        ["admin-support-messages", updated.ticket_id],
        (previous = []) => previous.map((item) => (item.id === updated.id ? updated : item)),
      );
      void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      toast.success("Mensagem atualizada.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível editar a mensagem.");
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (message: SupportMessage) => {
      const parsed = parseSupportMessage(message.message);
      const { error } = await (supabase as any)
        .from("support_messages")
        .delete()
        .eq("id", message.id)
        .eq("sender", "admin");
      if (error) throw error;
      if (parsed.attachment?.path) await removeSupportImage(parsed.attachment.path);
      return message;
    },
    onSuccess: (removed) => {
      qc.setQueryData<SupportMessage[]>(
        ["admin-support-messages", removed.ticket_id],
        (previous = []) => previous.filter((item) => item.id !== removed.id),
      );
      void qc.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      toast.success("Mensagem excluída.");
    },
    onError: () => toast.error("Não foi possível excluir a mensagem."),
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

  const directRefund = useMutation({
    mutationFn: async (target: DirectRefundTarget) => {
      const { data, error } = await supabase.functions.invoke("admin-refund-action", {
        body: {
          action: "approve",
          user_id: target.ticket.user_id,
          reason: "Reembolso direto pelo suporte",
          reason_details: `Reembolso direto confirmado no suporte pelo admin no ticket #${target.ticket.id.slice(0, 8)} para ${target.customer.email || "cliente sem e-mail"}.`,
        },
      });
      if (error || (data && data.error)) {
        // supabase-js esconde o corpo do erro atrás de "non-2xx status code";
        // aqui lemos a resposta real para mostrar o motivo ao admin.
        let detail = (data && data.error) || "";
        const response = (error as { context?: Response } | null)?.context;
        if (!detail && response && typeof response.json === "function") {
          try {
            const body = await response.clone().json();
            detail = body?.error || body?.message || "";
          } catch {
            /* corpo não é JSON */
          }
        }
        throw new Error(detail || error?.message || "Não foi possível processar o reembolso.");
      }
      return data;
    },

    onSuccess: () => {
      toast.success("Reembolso enviado para processamento.");
      void qc.invalidateQueries({ queryKey: ["admin-refunds-all"] });
      void qc.invalidateQueries({ queryKey: ["admin-subs-eligible"] });
      void qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
      void qc.invalidateQueries({ queryKey: ["admin-support-customer-context", directRefundTarget?.ticket.user_id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível processar o reembolso.");
    },
    onSettled: () => setDirectRefundTarget(null),
  });

  if (loading) return <VeloLoadingScreen message="Carregando suporte..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (loadingProfile) return <VeloLoadingScreen message="Carregando suporte..." />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-[#181817]">
        <div className="w-full max-w-md rounded-3xl border border-[#e6e6e2] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f2ef]">
            <Lock size={21} />
          </div>
          <h1 className="mt-5 text-[20px] font-bold">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#777772]">Esta página é exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell active="support" userId={user.id} fullBleed>
      <>
        <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)_300px] overflow-hidden bg-[#f7f7f5]">
          <TicketInbox
            tickets={visibleTickets}
            allTickets={tickets}
            loading={loadingTickets}
            selectedId={openTicketId}
            onSelect={setOpenTicketId}
            search={search}
            onSearch={setSearch}
            view={view}
            onView={setView}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            dateFilter={dateFilter}
            onDateFilter={setDateFilter}
          />

          <ConversationPanel
            ticket={openTicket}
            messages={messages}
            loadingMessages={loadingMessages}
            reply={reply}
            setReply={setReply}
            replyImage={replyImage}
            onReplyImage={(file) => {
              const validationError = validateSupportImage(file);
              if (validationError) {
                toast.error(validationError);
                return;
              }
              setReplyImage(file);
            }}
            onRemoveReplyImage={() => setReplyImage(null)}
            onSend={() => sendReply.mutate()}
            sending={sendReply.isPending}
            onResolve={() => closeTicket.mutate()}
            resolving={closeTicket.isPending}
            onEditMessage={(message, text) => editMessage.mutateAsync({ message, text })}
            onDeleteMessage={(message) => deleteMessage.mutateAsync(message)}
            messageActionPending={editMessage.isPending || deleteMessage.isPending}
            chatEndRef={chatEndRef}
          />

          <CustomerContextPanel
            ticket={openTicket}
            customer={customerContext ?? null}
            loading={loadingCustomerContext}
            refunding={directRefund.isPending}
            onDirectRefund={(ticket, customer) => setDirectRefundTarget({ ticket, customer })}
          />
        </div>

        {directRefundTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/35 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                  <HandCoins size={19} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#171715]">Dar reembolso agora?</h2>
                  <p className="mt-1 text-[12.5px] leading-5 text-[#667085]">
                    Isso vai processar automaticamente o reembolso da assinatura ativa deste cliente.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[12px] text-[#475569]">
                <p className="font-semibold text-[#171715]">{directRefundTarget.customer.name || "Cliente sem nome"}</p>
                <p className="mt-0.5">{directRefundTarget.customer.email || "E-mail não informado"}</p>
                <p className="mt-2 text-[11px] text-[#64748B]">Ticket #{directRefundTarget.ticket.id.slice(0, 8)}</p>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDirectRefundTarget(null)}
                  disabled={directRefund.isPending}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-[12px] font-semibold text-[#475569] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => directRefund.mutate(directRefundTarget)}
                  disabled={directRefund.isPending}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8] disabled:opacity-70"
                >
                  {directRefund.isPending ? <Loader2 size={14} className="animate-spin" /> : <HandCoins size={14} />}
                  Confirmar reembolso
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </AdminShell>
  );
};

const TicketInbox = ({
  tickets,
  allTickets,
  loading,
  selectedId,
  onSelect,
  search,
  onSearch,
  view,
  onView,
  statusFilter,
  onStatusFilter,
  dateFilter,
  onDateFilter,
}: {
  tickets: AdminTicket[];
  allTickets: AdminTicket[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  view: TicketView;
  onView: (value: TicketView) => void;
  statusFilter: TicketStatusFilter;
  onStatusFilter: (value: TicketStatusFilter) => void;
  dateFilter: TicketDateFilter;
  onDateFilter: (value: TicketDateFilter) => void;
}) => (
  <aside className="flex min-h-0 flex-col border-r border-[#e4e4e0] bg-[#fafaf9]">
    <div className="border-b border-[#e7e7e3] px-4 pb-3 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#deded9] bg-white text-[#333330] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <Inbox size={16} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1d1d1b]">Caixa de entrada</h1>
            <p className="text-[10.5px] text-[#969690]">
              {allTickets.filter((ticket) => ticket.status === "open").length} tickets abertos
            </p>
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#83837e] transition hover:bg-[#eeeeeb] hover:text-[#1d1d1b]" aria-label="Mais opções">
          <MoreHorizontal size={17} />
        </button>
      </div>

      <label className="mt-3 flex h-9 items-center gap-2 rounded-[9px] border border-[#deded9] bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:border-[#aeb9d6] focus-within:ring-2 focus-within:ring-[#dfe6f8]">
        <Search size={14} className="text-[#9a9a94]" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar cliente ou motivo"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-[#252522] outline-none placeholder:text-[#a0a09a]"
        />
        <kbd className="rounded border border-[#e4e4df] bg-[#f6f6f4] px-1.5 py-0.5 text-[9px] font-medium text-[#8a8a84]">⌘K</kbd>
      </label>

      <div className="mt-3 flex gap-1 overflow-x-auto">
        {VIEW_OPTIONS.map((option) => {
          const count =
            option.value === "all"
              ? allTickets.filter((ticket) => matchesTicketStatus(ticket, statusFilter) && matchesTicketDate(ticket, dateFilter)).length
              : allTickets.filter((ticket) =>
                  matchesTicketStatus(ticket, statusFilter) &&
                  matchesTicketDate(ticket, dateFilter) &&
                  (option.value === "new" ? !ticket.has_admin_reply : ticket.has_admin_reply),
                ).length;
          return (
            <button
              key={option.value}
              onClick={() => onView(option.value)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[10.5px] font-medium transition ${
                view === option.value
                  ? "bg-[#e9eefc] text-[#315cc4]"
                  : "text-[#777772] hover:bg-[#f0f0ed] hover:text-[#252522]"
              }`}
            >
              {option.label} <span className="ml-0.5 opacity-65">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <FilterDropdown
          label="Filtrar por período"
          value={dateFilter}
          options={DATE_OPTIONS}
          onChange={onDateFilter}
        />
        <FilterDropdown
          label="Filtrar por status"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={onStatusFilter}
        />
      </div>
    </div>

    <div className="flex items-center justify-between border-b border-[#e8e8e4] px-4 py-2.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[#999993]">Conversas</span>
      <span className="flex items-center gap-1 text-[10px] text-[#8b8b85]">
        Recentes <ChevronDown size={11} />
      </span>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {loading ? (
        <TicketListSkeleton />
      ) : tickets.length === 0 ? (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-8 text-center">
          <MessageCircle size={23} strokeWidth={1.5} className="text-[#b0b0aa]" />
          <p className="mt-3 text-[12px] font-medium text-[#53534f]">Nenhuma conversa encontrada</p>
          <p className="mt-1 text-[10.5px] leading-4 text-[#999993]">Ajuste a busca ou aguarde um novo chamado.</p>
        </div>
      ) : (
        tickets.map((ticket) => (
          <TicketListItem
            key={ticket.id}
            ticket={ticket}
            selected={ticket.id === selectedId}
            onClick={() => onSelect(ticket.id)}
          />
        ))
      )}
    </div>
  </aside>
);

const CustomerContextPanel = ({
  ticket,
  customer,
  loading,
  refunding,
  onDirectRefund,
}: {
  ticket: AdminTicket | null;
  customer: CustomerContextData | null;
  loading: boolean;
  refunding: boolean;
  onDirectRefund: (ticket: AdminTicket, customer: CustomerContextData) => void;
}) => {
  if (!ticket) {
    return (
      <aside className="flex min-h-0 items-center justify-center border-l border-[#e4e4e0] bg-[#fafaf9] px-8 text-center">
        <div>
          <UserCircle2 size={24} strokeWidth={1.4} className="mx-auto text-[#afafa9]" />
          <p className="mt-3 text-[11px] leading-5 text-[#8d8d87]">Selecione um atendimento para visualizar os dados do cliente.</p>
        </div>
      </aside>
    );
  }

  const data: CustomerContextData = customer ?? {
    name: ticket.user_name,
    email: ticket.user_email,
    avatar_url: ticket.user_avatar_url,
    plan: null,
    subscription_status: null,
    subscription_started_at: null,
    customer_since: null,
    last_seen_at: ticket.last_message_at ?? ticket.updated_at,
  };
  const subscriptionActive = ["active", "paid", "approved", "authorized"].includes(
    (data.subscription_status ?? "").toLowerCase(),
  );

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-[#e4e4e0] bg-[#fafaf9]">
      <div className="border-b border-[#e6e6e2] bg-white px-5 py-5">
        <div className="flex items-center gap-3">
          <Avatar name={data.name} email={data.email} image={data.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#252522]">
              {data.name || "Usuário sem nome"}
            </p>
            <p className="mt-0.5 truncate text-[9.5px] text-[#969690]">Cliente Velo</p>
          </div>
          <button
            type="button"
            onClick={() => onDirectRefund(ticket, data)}
            disabled={refunding || loading}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#d8e5ff] bg-[#eef5ff] px-2.5 text-[10.5px] font-semibold text-[#2563EB] transition hover:border-[#2563EB] hover:bg-[#dbeafe]"
            title="Abrir reembolsos deste cliente"
          >
            {refunding ? <Loader2 size={13} className="animate-spin" /> : <HandCoins size={13} strokeWidth={2.1} />}
            Dar reembolso
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex rounded-[6px] border border-[#dce3f5] bg-[#f2f5fd] px-2 py-1 text-[9px] font-semibold text-[#52699f]">
            Plano {formatPlan(data.plan)}
          </span>
          <span className={`inline-flex rounded-[6px] border px-2 py-1 text-[9px] font-semibold ${subscriptionActive ? "border-[#d9ead4] bg-[#f1f8ee] text-[#4f8247]" : "border-[#e4e4df] bg-[#f5f5f3] text-[#767670]"}`}>
            {formatSubscriptionStatus(data.subscription_status)}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <ContextCard title="Informações do cliente">
          <ContextRow icon={Mail} label="E-mail" value={data.email || "Não informado"} breakValue />
          <ContextRow icon={CalendarDays} label="Cliente há" value={elapsedTime(data.customer_since)} />
          <ContextRow icon={Activity} label="Última atividade" value={relativeTime(data.last_seen_at)} />
        </ContextCard>

        <ContextCard title="Assinatura">
          <ContextRow icon={CreditCard} label="Plano atual" value={formatPlan(data.plan)} />
          <ContextRow icon={CheckCircle2} label="Status" value={formatSubscriptionStatus(data.subscription_status)} />
          <ContextRow icon={Clock3} label="Assinante há" value={elapsedTime(data.subscription_started_at)} />
        </ContextCard>

        <ContextCard title="Atendimento">
          <ContextRow icon={MessageCircle} label="Motivo" value={CATEGORY_META[ticket.category].label} />
          <ContextRow icon={Hash} label="Ticket" value={`#${ticket.id.slice(0, 8)}`} />
          <ContextRow icon={Clock3} label="Aberto há" value={elapsedTime(ticket.created_at)} />
          <ContextRow icon={MessageCircle} label="Mensagens" value={String(ticket.message_count)} />
        </ContextCard>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-2 text-[9.5px] text-[#999993]">
            <Loader2 size={12} className="animate-spin" /> Atualizando informações
          </div>
        ) : null}
      </div>
    </aside>
  );
};

const ContextCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="overflow-hidden rounded-[12px] border border-[#e3e3df] bg-white shadow-[0_1px_2px_rgba(28,28,26,0.025)]">
    <div className="border-b border-[#ecece8] bg-[#fafaf8] px-3.5 py-2.5">
      <h3 className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#85857f]">{title}</h3>
    </div>
    <div className="divide-y divide-[#efefec] px-3.5">{children}</div>
  </section>
);

const ContextRow = ({
  icon: Icon,
  label,
  value,
  breakValue = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  breakValue?: boolean;
}) => (
  <div className="flex items-start gap-2.5 py-3">
    <Icon size={13} strokeWidth={1.65} className="mt-0.5 shrink-0 text-[#8d8d87]" />
    <div className="min-w-0 flex-1">
      <p className="text-[9px] text-[#999993]">{label}</p>
      <p className={`mt-0.5 text-[10.5px] font-medium leading-4 text-[#3d3d39] ${breakValue ? "break-all" : "truncate"}`}>{value}</p>
    </div>
  </div>
);

const FilterDropdown = <T extends string,>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<FilterOption<T>>;
  onChange: (value: T) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-[8px] border border-[#deded9] bg-white px-2.5 text-left text-[10.5px] font-semibold text-[#4a4a46] outline-none transition hover:border-[#c9d5f5] focus:border-[#4f72df] focus:ring-2 focus:ring-[#dfe6f8]"
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown size={12} className={`shrink-0 text-[#778092] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[10px] border border-[#dce7fa] bg-white p-1 shadow-[0_14px_30px_rgba(15,23,42,0.14)]"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex h-8 w-full items-center justify-between rounded-[7px] px-2 text-left text-[10.5px] font-semibold transition ${
                  selected
                    ? "bg-[#2563EB] text-white"
                    : "text-[#4f5664] hover:bg-[#eef4ff] hover:text-[#2563EB]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {selected ? <CheckCircle2 size={12} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const TicketListItem = ({ ticket, selected, onClick }: { ticket: AdminTicket; selected: boolean; onClick: () => void }) => {
  const meta = CATEGORY_META[ticket.category];
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full gap-3 border-b border-[#ecece8] px-4 py-3.5 text-left transition ${
        selected ? "bg-[#edf2ff]" : "bg-transparent hover:bg-[#f3f3f0]"
      }`}
    >
      {selected ? <span className="absolute inset-y-0 left-0 w-[3px] bg-[#4f72df]" /> : null}
      <Avatar name={ticket.user_name} email={ticket.user_email} image={ticket.user_avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#252522]">{ticket.user_name || "Usuário sem nome"}</p>
          {!ticket.has_admin_reply ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#ff725c]" title="Novo atendimento" /> : null}
        </div>
        <p className="mt-1 line-clamp-1 text-[10.5px] font-medium leading-4 text-[#686863]">{ticket.subject || ticket.last_message || meta.label}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[9.5px] text-[#8e8e88]">
            <CalendarDays size={11} className="shrink-0" />
            <span className="truncate">{formatDateTime(ticket.last_message_at ?? ticket.updated_at)}</span>
          </span>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[9.5px] font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.03)] ${meta.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
      </div>
    </button>
  );
};

const ConversationPanel = ({
  ticket,
  messages,
  loadingMessages,
  reply,
  setReply,
  replyImage,
  onReplyImage,
  onRemoveReplyImage,
  onSend,
  sending,
  onResolve,
  resolving,
  onEditMessage,
  onDeleteMessage,
  messageActionPending,
  chatEndRef,
}: {
  ticket: AdminTicket | null;
  messages: SupportMessage[];
  loadingMessages: boolean;
  reply: string;
  setReply: (value: string) => void;
  replyImage: File | null;
  onReplyImage: (file: File) => void;
  onRemoveReplyImage: () => void;
  onSend: () => void;
  sending: boolean;
  onResolve: () => void;
  resolving: boolean;
  onEditMessage: (message: SupportMessage, text: string) => Promise<SupportMessage>;
  onDeleteMessage: (message: SupportMessage) => Promise<SupportMessage>;
  messageActionPending: boolean;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!ticket) {
    return (
      <section className="flex min-h-0 items-center justify-center bg-white">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e3e3df] bg-[#fafaf8] text-[#797973]">
            <MessageCircle size={21} strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-[15px] font-semibold text-[#2b2b28]">Selecione uma conversa</h2>
          <p className="mt-1.5 text-[11.5px] leading-5 text-[#8b8b85]">Escolha um cliente na fila para ler e responder ao atendimento.</p>
        </div>
      </section>
    );
  }

  const meta = CATEGORY_META[ticket.category];
  const closed = ticket.status === "closed";

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-white">
      <header className="border-b border-[#e5e5e1] bg-white px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
              <h2 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#20201e]">
                {ticket.subject || meta.label}
              </h2>
              <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold lg:inline-flex ${meta.badge}`}>
                {meta.label}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-[#8f8f89]">
              <span className="flex items-center gap-1"><Hash size={10} /> {ticket.id.slice(0, 8)}</span>
              <span className="h-1 w-1 rounded-full bg-[#c2c2bd]" />
              <span>{ticket.message_count} {ticket.message_count === 1 ? "mensagem" : "mensagens"}</span>
              <span className="h-1 w-1 rounded-full bg-[#c2c2bd]" />
              <span>aberto {relativeTime(ticket.created_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onResolve}
              disabled={resolving || closed}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dcdcd7] bg-white px-3 text-[10.5px] font-semibold text-[#555550] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-[#bfc7bb] hover:bg-[#f5f8f3] hover:text-[#3b6f39] disabled:opacity-50"
            >
              {resolving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              {closed ? "Resolvido" : "Resolver"}
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e2de] text-[#777772] transition hover:bg-[#f4f4f1]" aria-label="Mais ações">
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f8f9fb] px-5 py-5">
        {loadingMessages ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[320px] items-center justify-center text-center">
            <div>
              <MessageCircle size={22} className="mx-auto text-[#b1b1ab]" strokeWidth={1.5} />
              <p className="mt-3 text-[12px] font-medium text-[#60605b]">O usuário ainda não enviou mensagens.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[820px] space-y-4">
            {messages.map((message, index) => (
              <ThreadMessage
                key={message.id}
                message={message}
                index={index}
                customerName={ticket.user_name}
                customerEmail={ticket.user_email}
                customerAvatar={ticket.user_avatar_url}
                onEditMessage={onEditMessage}
                onDeleteMessage={onDeleteMessage}
                actionPending={messageActionPending}
              />
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[#e4e6eb] bg-white p-3.5">
        <div className="mx-auto max-w-[860px] overflow-hidden rounded-[16px] border border-[#dfe3ec] bg-white shadow-[0_10px_30px_rgba(34,44,68,0.07)] transition focus-within:border-[#7b9cf2] focus-within:ring-2 focus-within:ring-[#dfe8ff]">
          <div className="flex items-center justify-between border-b border-[#eef0f4] bg-[#fbfcfe] px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[10px] text-[#777772]">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-[#dce6ff] bg-white shadow-[0_1px_3px_rgba(46,102,235,0.1)]">
                <AtlasAvatarIcon size={18} animated />
              </span>
              <span>Respondendo como <strong className="font-semibold text-[#334155]">Suporte Velo</strong></span>
              <ChevronDown size={11} />
            </div>
            <span className="text-[9.5px] text-[#a0a09a]">Enter para enviar</span>
          </div>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if ((reply.trim() || replyImage) && !sending && !closed) onSend();
              }
            }}
            disabled={closed}
            placeholder={closed ? "Ticket resolvido" : `Responder para ${ticket.user_name || "o cliente"}...`}
            className="min-h-[80px] w-full resize-none bg-white px-4 py-3 text-[12.5px] leading-5 text-[#252522] outline-none placeholder:text-[#a6aab3] disabled:bg-[#fafafa] disabled:text-[#9ca3af]"
          />
          {replyImage ? <SupportImagePreview file={replyImage} onRemove={onRemoveReplyImage} /> : null}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onReplyImage(file);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || closed}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${replyImage ? "bg-[#eaf0ff] text-[#2f66eb]" : "text-[#8c8c86] hover:bg-[#f0f0ed] hover:text-[#343431]"}`}
                aria-label="Anexar imagem"
                title="Anexar imagem (até 8 MB)"
              >
                <Paperclip size={14} />
              </button>
            </div>
            <button
              onClick={onSend}
              disabled={closed || sending || (!reply.trim() && !replyImage)}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#2f66eb] px-4 text-[10.5px] font-semibold text-white shadow-[0_5px_14px_rgba(47,102,235,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2459d8] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Enviar resposta
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const ThreadMessage = ({
  message,
  index,
  customerName,
  customerEmail,
  customerAvatar,
  onEditMessage,
  onDeleteMessage,
  actionPending,
}: {
  message: SupportMessage;
  index: number;
  customerName: string | null;
  customerEmail: string | null;
  customerAvatar: string | null;
  onEditMessage: (message: SupportMessage, text: string) => Promise<SupportMessage>;
  onDeleteMessage: (message: SupportMessage) => Promise<SupportMessage>;
  actionPending: boolean;
}) => {
  const admin = message.sender === "admin";
  const parsed = parseSupportMessage(message.message);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(parsed.text);

  useEffect(() => {
    setDraft(parsed.text);
  }, [parsed.text]);

  const saveEdit = async () => {
    await onEditMessage(message, draft);
    setEditing(false);
  };

  const deleteCurrentMessage = async () => {
    if (!window.confirm("Excluir esta mensagem do suporte?")) return;
    await onDeleteMessage(message);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.025, 0.18), ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-end gap-2.5 ${admin ? "justify-end" : "justify-start"}`}
    >
      {!admin ? <Avatar name={customerName} email={customerEmail} image={customerAvatar} size="sm" /> : null}
      <div className={`min-w-0 max-w-[82%] ${admin ? "items-end" : "items-start"}`}>
        <div className={`mb-1.5 flex items-center gap-2 px-1 ${admin ? "justify-end" : "justify-start"}`}>
          <span className="truncate text-[9.5px] font-semibold text-[#626977]">
            {admin ? "Suporte Velo" : customerName || "Usuário"}
          </span>
          <span className="shrink-0 text-[8.5px] text-[#a0a5af]">{formatDateTime(message.created_at)}</span>
        </div>
        <div
          className={`px-4 py-3 shadow-[0_3px_12px_rgba(25,35,55,0.055)] ${
            admin
              ? "rounded-[18px_18px_5px_18px] bg-[#2f66eb] text-white"
              : "rounded-[18px_18px_18px_5px] border border-[#e3e6eb] bg-white text-[#34363b]"
          }`}
        >
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[120px] w-full resize-none rounded-[12px] border border-white/35 bg-white px-3 py-2 text-[12.5px] leading-5 text-[#172033] outline-none focus:ring-2 focus:ring-white/70"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(parsed.text);
                    setEditing(false);
                  }}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/25"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={actionPending}
                  className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-[#2563EB] transition hover:bg-[#EFF6FF] disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <SupportMessageMedia
              value={message.message}
              textClassName={`whitespace-pre-wrap text-[12.5px] leading-[1.62] ${admin ? "text-white" : "text-[#34363b]"}`}
              imageClassName="max-h-[340px] max-w-[460px] w-full"
            />
          )}
        </div>
        {admin && !editing ? (
          <div className="mt-1 flex justify-end gap-0.5 px-0.5">
            <button
              type="button"
              aria-label="Editar mensagem"
              title="Editar"
              onClick={() => setEditing(true)}
              disabled={actionPending}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#EEF4FF] hover:text-[#2563EB] disabled:opacity-50"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              aria-label="Excluir mensagem"
              title="Excluir"
              onClick={() => void deleteCurrentMessage()}
              disabled={actionPending}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:opacity-50"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : null}
        {!admin && customerEmail ? (
          <p className="mt-1 px-1 text-[8.5px] text-[#a3a7b0]">{customerEmail}</p>
        ) : null}
      </div>
      {admin ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#dce6ff] bg-white shadow-[0_2px_8px_rgba(46,102,235,0.12)]">
          <AtlasAvatarIcon size={21} animated />
        </span>
      ) : null}
    </motion.article>
  );
};

const Avatar = ({
  name,
  email,
  image,
  size,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size: "xs" | "sm" | "md" | "lg";
}) => {
  const sizeClass =
    size === "lg"
      ? "h-12 w-12 text-[12px]"
      : size === "md"
        ? "h-10 w-10 text-[11px]"
        : size === "sm"
          ? "h-8 w-8 text-[9.5px]"
          : "h-5 w-5 text-[7px]";
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9edf4] font-semibold text-[#4d5f7b] ring-1 ring-inset ring-[#dce2ea] ${sizeClass}`}>
      <span>{getInitials(name, email)}</span>
      {image ? (
        <img
          src={image}
          alt={`Foto de ${name || "cliente"}`}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
};

const TicketListSkeleton = () => (
  <div className="divide-y divide-[#ecece8]">
    {Array.from({ length: 7 }, (_, index) => (
      <div key={index} className="flex gap-3 px-4 py-4">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#e9e9e5]" />
        <div className="flex-1">
          <div className="h-2.5 w-2/3 animate-pulse rounded bg-[#e5e5e1]" />
          <div className="mt-2 h-2 w-4/5 animate-pulse rounded bg-[#eeeeeb]" />
          <div className="mt-3 h-4 w-20 animate-pulse rounded-full bg-[#e9e9e5]" />
        </div>
      </div>
    ))}
  </div>
);

const MessageSkeleton = () => (
  <div className="mx-auto max-w-[760px] space-y-4">
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className="rounded-[13px] border border-[#e6e6e2] bg-white p-4">
        <div className="flex gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-[#e9e9e5]" />
          <div className="flex-1">
            <div className="h-2.5 w-28 animate-pulse rounded bg-[#e5e5e1]" />
            <div className="mt-4 h-2.5 w-full animate-pulse rounded bg-[#eeeeeb]" />
            <div className="mt-2 h-2.5 w-4/5 animate-pulse rounded bg-[#eeeeeb]" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default AdminSupportPage;
