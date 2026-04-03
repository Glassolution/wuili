import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, RefreshCcw, ShoppingCart, Wallet, X } from "lucide-react";

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
  { id: 2, tipo: "warning", titulo: "Cartão com queda de aprovação", descricao: "Taxa de aprovação de cartão de crédito caiu para 89,2% nas últimas horas.", tempo: "Hoje, 13:10", lida: false },
  { id: 3, tipo: "warning", titulo: "Reserva de chargeback", descricao: "Pedido #4820 entrou em análise. R$ 890,00 reservados.", tempo: "Ontem", lida: false },
  { id: 4, tipo: "info", titulo: "Sincronização concluída", descricao: "Catálogo sincronizado com Mercado Livre e Shopee com sucesso.", tempo: "Ontem", lida: true },
  { id: 5, tipo: "success", titulo: "Repasse confirmado", descricao: "R$ 4.200,00 do Mercado Livre confirmados para amanhã.", tempo: "2 dias atrás", lida: true },
  { id: 6, tipo: "warning", titulo: "Publicação em fila", descricao: "Mochila Urbana ainda aguardando publicação na Shopee.", tempo: "2 dias atrás", lida: true },
  { id: 7, tipo: "info", titulo: "Novo pedido", descricao: "Pedido #4821 recebido via Mercado Livre — Fone TWS.", tempo: "3 dias atrás", lida: true },
  { id: 8, tipo: "error", titulo: "Erro de sincronização", descricao: "Mouse Sem Fio com erro na Shopee. Tente republicar.", tempo: "3 dias atrás", lida: true },
];

const filters = ["Todas", "Não lidas", "Avisos", "Erros"];

const NotificacoesPage = () => {
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const [filter, setFilter] = useState("Todas");

  const marcarTodasLidas = () => setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
  const marcarLida = (id: number) => setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
  const remover = (id: number) => setNotifs((prev) => prev.filter((n) => n.id !== id));

  const filtered = notifs.filter((n) => {
    if (filter === "Não lidas") return !n.lida;
    if (filter === "Avisos") return n.tipo === "warning";
    if (filter === "Erros") return n.tipo === "error";
    return true;
  });

  const naoLidas = notifs.filter((n) => !n.lida).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card-wuili p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground">Notificações</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}` : "Tudo em dia"}
          </p>
        </div>
        {naoLidas > 0 && (
          <button
            onClick={marcarTodasLidas}
            className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
          >
            <RefreshCcw size={14} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {f}
            {f === "Não lidas" && naoLidas > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5">
                {naoLidas}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="card-wuili overflow-hidden">
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhuma notificação aqui</p>
            <p className="text-xs text-muted-foreground mt-1">Tudo limpo por enquanto.</p>
          </div>
        )}
        {filtered.map((n) => {
          const Icon = icones[n.tipo];
          return (
            <div
              key={n.id}
              className={`flex items-start gap-4 border-b border-border px-5 py-4 last:border-0 transition-colors ${
                !n.lida ? "bg-muted/30" : ""
              }`}
            >
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconeCls[n.tipo]}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold text-foreground ${!n.lida ? "font-bold" : ""}`}>{n.titulo}</p>
                  {!n.lida && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.descricao}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">{n.tempo}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.lida && (
                  <button
                    onClick={() => marcarLida(n.id)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    title="Marcar como lida"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => remover(n.id)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title="Remover"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificacoesPage;
