import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Info, RefreshCcw, X } from "lucide-react";

type Notif = {
  id: number;
  tipo: "warning" | "error" | "info" | "success";
  titulo: string;
  descricao: string;
  tempo: string;
  lida: boolean;
};

const icones = {
  warning: AlertTriangle,
  error: X,
  info: Info,
  success: CheckCircle2,
};

const iconeCls = {
  warning: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
  success: "bg-success-light text-success",
};

const initialNotifs: Notif[] = [
  { id: 1, tipo: "error", titulo: "Erro de publicação", descricao: "Kit Skincare com erro na Loja própria. Verifique o anúncio.", tempo: "Hoje, 14:32", lida: false },
  { id: 2, tipo: "warning", titulo: "Cartão com queda de aprovação", descricao: "Taxa de aprovação de cartão de crédito caiu para 89,2%.", tempo: "Hoje, 13:10", lida: false },
  { id: 3, tipo: "warning", titulo: "Reserva de chargeback", descricao: "Pedido #4820 entrou em análise. R$ 890,00 reservados.", tempo: "Ontem", lida: false },
  { id: 4, tipo: "info", titulo: "Sincronização concluída", descricao: "Catálogo sincronizado com Mercado Livre e Shopee.", tempo: "Ontem", lida: true },
  { id: 5, tipo: "success", titulo: "Repasse confirmado", descricao: "R$ 4.200,00 do Mercado Livre confirmados para amanhã.", tempo: "2 dias atrás", lida: true },
  { id: 6, tipo: "warning", titulo: "Publicação em fila", descricao: "Mochila Urbana aguardando publicação na Shopee.", tempo: "2 dias atrás", lida: true },
  { id: 7, tipo: "info", titulo: "Novo pedido", descricao: "Pedido #4821 recebido via Mercado Livre — Fone TWS.", tempo: "3 dias atrás", lida: true },
  { id: 8, tipo: "error", titulo: "Erro de sincronização", descricao: "Mouse Sem Fio com erro na Shopee. Tente republicar.", tempo: "3 dias atrás", lida: true },
];

const NotificacoesPopover = () => {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const ref = useRef<HTMLDivElement>(null);

  const naoLidas = notifs.filter((n) => !n.lida).length;

  const marcarTodasLidas = () => setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
  const marcarLida = (id: number) => setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
  const remover = (id: number) => setNotifs((prev) => prev.filter((n) => n.id !== id));

  // close on outside click
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
            {naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-80 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-sm font-bold text-foreground">Notificações</p>
              <p className="text-xs text-muted-foreground">{naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}` : "Tudo em dia"}</p>
            </div>
            <div className="flex items-center gap-1">
              {naoLidas > 0 && (
                <button onClick={marcarTodasLidas} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Marcar todas como lidas">
                  <RefreshCcw size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
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
              </div>
            )}
            {notifs.map((n) => {
              const Icon = icones[n.tipo];
              return (
                <div key={n.id} className={`flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 ${!n.lida ? "bg-muted/30" : ""}`}>
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconeCls[n.tipo]}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs text-foreground truncate ${!n.lida ? "font-bold" : "font-semibold"}`}>{n.titulo}</p>
                      {!n.lida && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.descricao}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{n.tempo}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.lida && (
                      <button onClick={() => marcarLida(n.id)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Marcar como lida">
                        <CheckCircle2 size={12} />
                      </button>
                    )}
                    <button onClick={() => remover(n.id)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
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
