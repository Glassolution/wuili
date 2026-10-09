import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatSaleAmount, saleAlerts, salePlanLabel, unreadSales, type SaleAlert } from "@/lib/adminSaleAlerts";
import { playSaleSound, unlockSaleSound } from "@/lib/saleSound";

/**
 * Avisa quando uma assinatura é paga (venda para a Velo), em tempo real:
 * toca o "ka-ching", mostra o aviso na tela e no sistema (mesmo com a aba em
 * segundo plano), põe a venda na lista do sino e soma o valor no painel na hora.
 *
 * Como uma venda é reconhecida: o validapay-webhook, ao confirmar um
 * pagamento, marca a assinatura como "active" e grava `current_period_start`
 * e `updated_at` com o mesmo instante. Outras mudanças na assinatura
 * (cancelamento, troca de cartão…) não batem essas duas datas.
 *
 * Além do tempo real, uma conferência leve a cada minuto busca assinaturas
 * pagas depois da última vista — cobre quedas da conexão com a aba escondida.
 */

type SubscriptionRow = {
  id: string;
  user_id: string | null;
  plan: string | null;
  amount: number | string | null;
  status: string | null;
  payment_method: string | null;
  mp_payment_id: string | null;
  provider: string | null;
  validapay_charge_id: string | null;
  validapay_subscription_id: string | null;
  charge_attempts: number | null;
  last_charge_attempt_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_charge_at: string | null;
  created_at: string;
  updated_at: string;
};

const SUBSCRIPTION_COLUMNS =
  "id,user_id,plan,amount,status,payment_method,mp_payment_id,provider,validapay_charge_id,validapay_subscription_id,charge_attempts,last_charge_attempt_at,current_period_start,current_period_end,next_charge_at,created_at,updated_at";

/** Chaves das consultas do painel principal (AdminBlankPage). */
const WALLET_QUERY_KEY = ["admin-wallet-v8-validapay-only"];
const FINANCE_QUERY_PREFIX = ["admin-wallet-finance-v2-validapay-only"];

const POLL_MS = 60_000;
/** Pagamentos mais antigos que isso não viram aviso (só entram no painel). */
const FRESH_MS = 15 * 60_000;

const isPaidNow = (row: Partial<SubscriptionRow>) => {
  if (String(row.status ?? "").toLowerCase() !== "active" || !row.current_period_start || !row.updated_at) return false;
  const start = Date.parse(row.current_period_start);
  const updated = Date.parse(row.updated_at);
  return Number.isFinite(start) && Math.abs(updated - start) < 5_000;
};

const saleIdOf = (row: Pick<SubscriptionRow, "id" | "current_period_start">) => `${row.id}:${row.current_period_start}`;

/** Soma a venda nos dados do painel que já estão na tela (sem esperar a busca pesada). */
const patchDashboard = (queryClient: QueryClient, row: SubscriptionRow, amount: number) => {
  queryClient.setQueryData(WALLET_QUERY_KEY, (old: unknown) => {
    if (!old || typeof old !== "object") return old;
    const wallet = old as {
      subscriptions: SubscriptionRow[];
      validapayEvents: Array<Record<string, unknown>>;
      validapayAvailable: boolean;
    };
    const subscriptions = [row, ...wallet.subscriptions.filter((item) => item.id !== row.id)];
    // Com a ValidaPay ligada, o painel conta pelos eventos de pagamento: entra
    // um evento "aprovado" equivalente até a próxima atualização trazer o real.
    const validapayEvents = wallet.validapayAvailable
      ? [
          {
            id: `ao-vivo-${saleIdOf(row)}`,
            event: "PAYMENT_CONFIRMED",
            charge_id: row.validapay_charge_id,
            subscription_id: row.validapay_subscription_id,
            payment_id: null,
            status: "approved",
            amount,
            payload: { paidAt: row.current_period_start, metadata: { user_id: row.user_id, plan: row.plan } },
            created_at: row.current_period_start,
          },
          ...wallet.validapayEvents,
        ]
      : wallet.validapayEvents;
    return { ...wallet, subscriptions, validapayEvents };
  });

  // Totais vindos da ValidaPay (Hoje / Este mês / Este ano): a venda entra em todos.
  // Só quando a ValidaPay já trouxe números — zerados, o painel usa o cálculo
  // local (que recebeu a venda acima); somar aqui faria o painel trocar de
  // fonte e mostrar só a venda nova.
  queryClient.setQueriesData({ queryKey: FINANCE_QUERY_PREFIX }, (old: unknown) => {
    if (!old || typeof old !== "object" || !("metrics" in old)) return old;
    const finance = old as { metrics: Record<string, number> };
    const metrics = finance.metrics;
    const hasProviderNumbers =
      Number(metrics.gross_revenue ?? 0) > 0 || Number(metrics.approved_sales ?? 0) > 0 || Number(metrics.refunds ?? 0) > 0;
    if (!hasProviderNumbers) return old;
    return {
      ...finance,
      metrics: {
        ...metrics,
        approved_sales: Number(metrics.approved_sales ?? 0) + 1,
        gross_revenue: Number(metrics.gross_revenue ?? 0) + amount,
        net_revenue: Number(metrics.net_revenue ?? 0) + amount,
      },
    };
  });
};

const showSystemNotification = (alert: SaleAlert) => {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!document.hidden) return; // com a aba à vista, o aviso na tela basta
  try {
    const notification = new Notification(`Nova venda · ${formatSaleAmount(alert.amount)}`, {
      body: [salePlanLabel(alert.plan), alert.customer].filter(Boolean).join(" · "),
      icon: "/logo.png",
      tag: alert.id,
      silent: true, // o som é o nosso "ka-ching"
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // alguns navegadores só permitem notificação via service worker
  }
};

const fetchCustomerName = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("display_name,email")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = data as { display_name?: string | null; email?: string | null } | null;
  return profile?.display_name || profile?.email || null;
};

export const useAdminSaleWatcher = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    // vendas anteriores à abertura do admin não viram aviso
    let lastSeen = new Date().toISOString();

    const handleSale = (row: SubscriptionRow, source: "tempo-real" | "conferencia") => {
      if (!isPaidNow(row) || !row.current_period_start) return;
      if (row.current_period_start > lastSeen) lastSeen = row.current_period_start;
      const amount = Number(row.amount ?? 0);
      const alert: SaleAlert = {
        id: saleIdOf(row),
        subscriptionId: row.id,
        userId: row.user_id,
        amount: Number.isFinite(amount) ? amount : 0,
        plan: row.plan,
        customer: null,
        at: row.current_period_start,
        read: false,
      };
      if (!saleAlerts.add(alert)) return; // já avisada (tempo real + conferência)

      patchDashboard(queryClient, row, alert.amount);
      const fresh = Date.now() - Date.parse(alert.at) < FRESH_MS;
      if (fresh && saleAlerts.getSnapshot().soundOn) void playSaleSound();

      void (async () => {
        const customer = row.user_id ? await fetchCustomerName(row.user_id).catch(() => null) : null;
        if (customer) saleAlerts.update(alert.id, { customer });
        if (fresh) showSystemNotification({ ...alert, customer });
      })();
      if (import.meta.env.DEV) console.info("[vendas] nova assinatura paga", source, alert);
    };

    // Só em desenvolvimento: simula uma assinatura paga (sem tocar no banco)
    // para conferir som, aviso e valor subindo — window.__simularVenda(39.9)
    if (import.meta.env.DEV) {
      (window as unknown as { __simularVenda?: (valor?: number) => void }).__simularVenda = (valor = 39.9) => {
        const agora = new Date().toISOString();
        handleSale(
          {
            id: `simulada-${Date.now()}`,
            user_id: null,
            plan: "pro",
            amount: valor,
            status: "active",
            payment_method: "pix",
            mp_payment_id: null,
            provider: "validapay",
            validapay_charge_id: `simulada-${Date.now()}`,
            validapay_subscription_id: null,
            charge_attempts: 0,
            last_charge_attempt_at: null,
            current_period_start: agora,
            current_period_end: null,
            next_charge_at: null,
            created_at: agora,
            updated_at: agora,
          },
          "tempo-real",
        );
      };
    }

    // tempo real
    const channel = supabase
      .channel("admin-vendas-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, (payload) => {
        const row = payload.new as SubscriptionRow | undefined;
        if (row?.id) handleSale(row, "tempo-real");
      })
      .subscribe();

    // conferência leve: assinaturas pagas depois da última vista
    const poll = async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(SUBSCRIPTION_COLUMNS)
        .eq("status", "active")
        .gt("current_period_start", lastSeen)
        .order("current_period_start", { ascending: true })
        .limit(20);
      if (disposed || error) return;
      ((data ?? []) as unknown as SubscriptionRow[]).forEach((row) => handleSale(row, "conferencia"));
    };
    const timer = window.setInterval(() => void poll(), POLL_MS);

    const onVisibility = () => {
      if (!document.hidden) {
        void poll();
        saleAlerts.dismissToast();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // o navegador só libera o som depois de um clique ou tecla na página
    const unlock = () => unlockSaleSound();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  // título da aba: "(2) Nova venda" enquanto houver vendas não vistas
  useEffect(() => {
    if (!enabled) return;
    const baseTitle = document.title;
    const render = () => {
      const unread = unreadSales(saleAlerts.getSnapshot().alerts);
      document.title = unread > 0 ? `(${unread}) Nova venda · Velo Admin` : baseTitle;
    };
    render();
    const unsubscribe = saleAlerts.subscribe(render);
    return () => {
      unsubscribe();
      document.title = baseTitle;
    };
  }, [enabled]);
};
