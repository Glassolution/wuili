import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, Info, RefreshCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType = "warning" | "error" | "info" | "success";

type DBNotif = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
};

type Notif = {
  id: string;
  tipo: NotifType;
  titulo: string;
  descricao: string;
  tempo: string;
  lida: boolean;
  actionUrl: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapType(type: string): NotifType {
  if (type === "warning")           return "warning";
  if (type === "error")             return "error";
  if (type === "fulfillment_error") return "error";
  if (type === "low_balance")       return "warning";
  if (type === "success")           return "success";
  return "info";
}

function formatTempo(createdAt: string): string {
  const diff  = Date.now() - new Date(createdAt).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (days >= 3)  return `${days} dias atrás`;
  if (days === 2) return "2 dias atrás";
  if (days === 1) return "Ontem";
  if (hours >= 1) {
    const hhmm = new Date(createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `Hoje, ${hhmm}`;
  }
  if (mins >= 1) return `Há ${mins} min`;
  return "Agora mesmo";
}

function toNotif(n: DBNotif): Notif {
  return {
    id:       n.id,
    tipo:     mapType(n.type),
    titulo:   n.title,
    descricao: n.message,
    tempo:    formatTempo(n.created_at),
    lida:     n.read,
    actionUrl: n.action_url,
  };
}

// ── Icon / style maps ─────────────────────────────────────────────────────────

const icones: Record<NotifType, typeof Bell> = {
  warning: AlertTriangle,
  error:   X,
  info:    Info,
  success: CheckCircle2,
};

const iconeCls: Record<NotifType, string> = {
  warning: "bg-warning/10 text-warning",
  error:   "bg-destructive/10 text-destructive",
  info:    "bg-primary/10 text-primary",
  success: "bg-success-light text-success",
};

// ── Component ─────────────────────────────────────────────────────────────────

const NotificacoesPopover = () => {
  const [open, setOpen]  = useState(false);
  const ref              = useRef<HTMLDivElement>(null);
  const { user }         = useAuth();
  const qc               = useQueryClient();

  // ── Fetch notifications ──────────────────────────────────────────────────
  const { data: rawNotifs = [] } = useQuery<DBNotif[]>({
    queryKey: ["notifications", user?.id],
    enabled:  !!user?.id,
    refetchInterval: 60_000, // re-poll every 60 s while tab is active
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as DBNotif[];
    },
  });

  const notifs  = rawNotifs.map(toNotif);
  const naoLidas = notifs.filter((n) => !n.lida).length;

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user?.id]);

  // ── Mark single as read ──────────────────────────────────────────────────
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  // ── Mark all as read ─────────────────────────────────────────────────────
  const markAllRead = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  // ── Remove (soft: mark read + filter locally) ────────────────────────────
  const remove = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("notifications").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative">
        <Bell size={18} className="text-muted-foreground" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-80 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-sm font-bold text-foreground">Notificações</p>
              <p className="text-xs text-muted-foreground">
                {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}` : "Tudo em dia"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {naoLidas > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title="Marcar todas como lidas"
                >
                  <RefreshCcw size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* list */}
          <div className="overflow-y-auto max-h-96" style={{ scrollbarWidth: "none" }}>
            {notifs.length === 0 && (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">Tudo em dia</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma notificação por enquanto.</p>
              </div>
            )}
            {notifs.map((n) => {
              const Icon = icones[n.tipo];
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 ${
                    !n.lida ? "bg-muted/30" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconeCls[n.tipo]}`}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-xs text-foreground truncate ${
                          !n.lida ? "font-bold" : "font-semibold"
                        }`}
                      >
                        {n.titulo}
                      </p>
                      {!n.lida && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {n.descricao}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{n.tempo}</p>
                    {n.actionUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          markRead.mutate(n.id);
                          window.open(n.actionUrl!, "_blank", "noopener,noreferrer");
                        }}
                        className="mt-2 text-[11px] font-bold text-foreground underline underline-offset-2"
                      >
                        Abrir ação
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.lida && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        title="Marcar como lida"
                      >
                        <CheckCircle2 size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => remove.mutate(n.id)}
                      className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      title="Remover"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificacoesPopover;
