/**
 * Notificações de venda do admin: lista das últimas vendas, contador de não
 * lidas, preferência de som e o aviso que aparece na tela. Fica salvo no
 * navegador para sobreviver a um recarregamento da página.
 */

export type SaleAlert = {
  /** assinatura + início do período pago: identifica um pagamento */
  id: string;
  subscriptionId: string;
  userId: string | null;
  amount: number;
  plan: string | null;
  customer: string | null;
  /** quando o pagamento caiu */
  at: string;
  read: boolean;
};

type State = {
  alerts: SaleAlert[];
  soundOn: boolean;
  /** venda mostrada no aviso flutuante (ou um teste) */
  toast: (SaleAlert & { test?: boolean }) | null;
};

const ALERTS_KEY = "velo:admin-sale-alerts";
const SOUND_KEY = "velo:admin-sale-sound";
const MAX_ALERTS = 40;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // armazenamento bloqueado: vale só nesta visita
  }
};

let state: State = {
  alerts: typeof window === "undefined" ? [] : read<SaleAlert[]>(ALERTS_KEY, []).filter((alert) => alert && alert.id),
  soundOn: typeof window === "undefined" ? true : read<boolean>(SOUND_KEY, true) !== false,
  toast: null,
};

const listeners = new Set<() => void>();

const setState = (next: Partial<State>) => {
  state = { ...state, ...next };
  if ("alerts" in next) write(ALERTS_KEY, state.alerts);
  if ("soundOn" in next) write(SOUND_KEY, state.soundOn);
  listeners.forEach((listener) => listener());
};

export const saleAlerts = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  /** Registra a venda; devolve falso se ela já tinha sido avisada. */
  add(alert: SaleAlert) {
    if (state.alerts.some((existing) => existing.id === alert.id)) return false;
    setState({ alerts: [alert, ...state.alerts].slice(0, MAX_ALERTS), toast: alert });
    return true;
  },

  update(id: string, patch: Partial<SaleAlert>) {
    setState({
      alerts: state.alerts.map((alert) => (alert.id === id ? { ...alert, ...patch } : alert)),
      toast: state.toast?.id === id ? { ...state.toast, ...patch } : state.toast,
    });
  },

  markAllRead() {
    if (!state.alerts.some((alert) => !alert.read)) return;
    setState({ alerts: state.alerts.map((alert) => ({ ...alert, read: true })) });
  },

  clear() {
    setState({ alerts: [] });
  },

  setSound(on: boolean) {
    setState({ soundOn: on });
  },

  showTest(alert: SaleAlert) {
    setState({ toast: { ...alert, test: true } });
  },

  dismissToast() {
    setState({ toast: null });
  },
};

export const unreadSales = (alerts: SaleAlert[]) => alerts.filter((alert) => !alert.read).length;

const PLAN_LABELS: Record<string, string> = {
  base: "Velo Base",
  basic: "Velo Base",
  pro: "Velo Pro",
  business: "Velo Business",
};

export const salePlanLabel = (plan: string | null) => {
  if (!plan) return "Assinatura";
  const key = plan.trim().toLowerCase();
  return PLAN_LABELS[key] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
};

export const formatSaleAmount = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
