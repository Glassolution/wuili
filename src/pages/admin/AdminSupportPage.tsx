import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Lock, MessageCircle, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { VeloLogo } from "@/components/VeloLogo";

type AdminTicket = {
  id: string;
  user_id: string;
  status: "open" | "closed";
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
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

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

  const isAdmin = profile?.role === "admin";

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["admin-support-tickets"],
    enabled: !!user?.id && isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc("get_support_tickets_admin", { p_status: "open" });

      if (error) throw error;
      return (data ?? []) as AdminTicket[];
    },
  });

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null,
    [selectedTicketId, tickets]
  );

  useEffect(() => {
    if (!selectedTicketId && tickets[0]?.id) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [selectedTicketId, tickets]);

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["admin-support-messages", selectedTicket?.id],
    enabled: !!selectedTicket?.id && isAdmin,
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
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin-support")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        () => {
          void qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        () => {
          void qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const message = payload.new as SupportMessage;
          void qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
          qc.setQueryData<SupportMessage[]>(
            ["admin-support-messages", message.ticket_id],
            (prev = []) => prev.some((item) => item.id === message.id) ? prev : [...prev, message]
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

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
        ["admin-support-messages", message.ticket_id],
        (prev = []) => prev.some((item) => item.id === message.id) ? prev : [...prev, message]
      );
      void qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Não foi possível enviar a resposta.");
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
      void qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Não foi possível resolver o ticket.");
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <Loader2 className="h-7 w-7 animate-spin text-[#0A0A0A]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <Loader2 className="h-7 w-7 animate-spin text-[#0A0A0A]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7] p-6">
        <div className="w-full max-w-md rounded-3xl border border-[#E5E5E5] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F5]">
            <Lock size={21} />
          </div>
          <h1 className="mt-5 text-[20px] font-bold text-[#0A0A0A]">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#737373]">
            Esta página é exclusiva para usuários com role admin em profiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] p-5 text-[#0A0A0A] md:p-8">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-[#E5E5E5] bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <VeloLogo size="sm" variant="dark" />
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">Admin</p>
              <h1 className="text-[24px] font-black tracking-tight">Suporte humano</h1>
            </div>
          </div>
          <div className="rounded-full bg-[#0A0A0A] px-4 py-2 text-[13px] font-semibold text-white">
            {tickets.length} tickets abertos
          </div>
        </header>

        <main className="grid min-h-[calc(100vh-180px)] gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-sm">
            <div className="border-b border-[#F0F0F0] px-5 py-4">
              <p className="text-[15px] font-bold">Fila de atendimento</p>
              <p className="mt-0.5 text-[12px] text-[#737373]">Tickets abertos em tempo real</p>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-3">
              {loadingTickets ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <MessageCircle className="h-8 w-8 text-[#D4D4D4]" />
                  <p className="mt-3 text-[14px] font-semibold">Nenhum ticket aberto</p>
                  <p className="mt-1 text-[12px] text-[#737373]">Novas solicitações aparecerão aqui.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => {
                    const active = ticket.id === selectedTicket?.id;

                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition",
                          active
                            ? "border-[#0A0A0A] bg-[#FAFAFA]"
                            : "border-transparent hover:border-[#E5E5E5] hover:bg-[#FAFAFA]",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-bold">{ticket.user_name || "Usuário"}</p>
                            <p className="truncate text-[12px] text-[#737373]">{ticket.user_email || "Email indisponível"}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-emerald-700">
                            open
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#525252]">
                          {ticket.last_message || "Ticket aberto sem mensagens ainda."}
                        </p>
                        <p className="mt-3 text-[11px] text-[#A3A3A3]">
                          Aberto em {formatDateTime(ticket.created_at)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-sm">
            {selectedTicket ? (
              <>
                <div className="flex flex-col gap-3 border-b border-[#F0F0F0] px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A0A0A] text-white">
                      <UserRound size={18} />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold">{selectedTicket.user_name || "Usuário"}</p>
                      <p className="text-[12px] text-[#737373]">{selectedTicket.user_email || "Email indisponível"}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => closeTicket.mutate()}
                    disabled={closeTicket.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0A0A0A] px-4 py-2 text-[13px] font-semibold text-[#0A0A0A] transition hover:bg-[#0A0A0A] hover:text-white disabled:opacity-50"
                  >
                    {closeTicket.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Marcar como resolvido
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-[#FAFAFA] p-5">
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-[13px] text-[#737373]">
                      O usuário ainda não enviou mensagens neste ticket.
                    </div>
                  ) : (
                    messages.map((message) => (
                      <AdminChatBubble key={message.id} msg={message} />
                    ))
                  )}
                </div>

                <div className="border-t border-[#F0F0F0] bg-white p-4">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendReply.mutate();
                        }
                      }}
                      placeholder="Digite a resposta para o usuário..."
                      className="min-h-[48px] flex-1 resize-none rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3 text-[14px] leading-5 outline-none transition focus:border-[#0A0A0A]"
                    />
                    <button
                      onClick={() => sendReply.mutate()}
                      disabled={sendReply.isPending || !reply.trim()}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Enviar resposta"
                    >
                      {sendReply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageCircle className="h-10 w-10 text-[#D4D4D4]" />
                <p className="mt-4 text-[17px] font-bold">Selecione um ticket</p>
                <p className="mt-1 text-[13px] text-[#737373]">A conversa completa aparecerá aqui.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

const AdminChatBubble = ({ msg }: { msg: SupportMessage }) => {
  const isAdmin = msg.sender === "admin";

  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[72%] rounded-2xl px-4 py-2.5 text-[14px] leading-6 shadow-sm",
          isAdmin
            ? "rounded-br-md bg-[#0A0A0A] text-white"
            : "rounded-bl-md bg-white text-[#0A0A0A]",
        ].join(" ")}
      >
        <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.08em] ${isAdmin ? "text-white/60" : "text-[#A3A3A3]"}`}>
          {isAdmin ? "Admin" : "Usuário"}
        </p>
        <p className="whitespace-pre-wrap">{msg.message}</p>
        <p className={`mt-1 text-[10px] ${isAdmin ? "text-white/50" : "text-[#A3A3A3]"}`}>
          {formatDateTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
};

export default AdminSupportPage;
