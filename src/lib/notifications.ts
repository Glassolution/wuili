import { supabase } from "@/integrations/supabase/client";

export type NotificationPreferenceKey =
  | "new_sale"
  | "product_published"
  | "publication_error"
  | "product_paused"
  | "product_activated"
  | "order_in_transit"
  | "weekly_report"
  | "support_reply";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean | null;
  created_at: string | null;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  new_sale: true,
  product_published: true,
  publication_error: true,
  product_paused: true,
  product_activated: true,
  order_in_transit: false,
  weekly_report: true,
  support_reply: true,
};

export const NOTIFICATION_PREFERENCE_OPTIONS: Array<{
  key: NotificationPreferenceKey;
  label: string;
  description: string;
}> = [
  { key: "new_sale", label: "Nova venda", description: "Quando um pedido novo entrar na sua loja." },
  { key: "product_published", label: "Produto publicado", description: "Quando um anúncio for publicado com sucesso." },
  { key: "product_paused", label: "Produto pausado", description: "Quando um anúncio mudar para pausado." },
  { key: "product_activated", label: "Produto ativado", description: "Quando um anúncio voltar a ficar ativo." },
  { key: "publication_error", label: "Erro de publicação", description: "Quando o Mercado Livre recusar ou travar uma publicação." },
  { key: "order_in_transit", label: "Pedido em trânsito", description: "Quando um pedido receber envio ou código de rastreio." },
  { key: "weekly_report", label: "Relatório semanal", description: "Resumo de vendas, produtos e pendências." },
  { key: "support_reply", label: "Respostas do suporte", description: "Quando o time responder um ticket aberto." },
];

export const NOTIFICATION_PREFERENCES_EVENT = "velo-notification-preferences";

const announcedNotificationIds = new Set<string>();

const localPreferencesKey = (userId: string) => `velo_notification_preferences:${userId}`;

function isMissingPreferencesColumn(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : String(error ?? "");
  return message.includes("notification_preferences") || message.includes("Supabase está desativado");
}

function readLocalPreferences(userId: string): NotificationPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localPreferencesKey(userId));
    return raw ? normalizeNotificationPreferences(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalPreferences(userId: string, preferences: NotificationPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localPreferencesKey(userId), JSON.stringify(preferences));
}

function broadcastNotificationPreferences(preferences: NotificationPreferences) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, { detail: { preferences } }));
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const source = value as Partial<Record<NotificationPreferenceKey, unknown>>;
  return NOTIFICATION_PREFERENCE_OPTIONS.reduce((acc, option) => {
    acc[option.key] = typeof source[option.key] === "boolean"
      ? Boolean(source[option.key])
      : DEFAULT_NOTIFICATION_PREFERENCES[option.key];
    return acc;
  }, {} as NotificationPreferences);
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingPreferencesColumn(error)) return readLocalPreferences(userId) ?? { ...DEFAULT_NOTIFICATION_PREFERENCES };
    throw error;
  }
  return normalizeNotificationPreferences(data?.notification_preferences);
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences) {
  const payload = {
    notification_preferences: preferences,
    updated_at: new Date().toISOString(),
  };

  const byUserId = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", userId);

  if (!byUserId.error) {
    writeLocalPreferences(userId, preferences);
    broadcastNotificationPreferences(preferences);
    return;
  }

  if (isMissingPreferencesColumn(byUserId.error)) {
    writeLocalPreferences(userId, preferences);
    broadcastNotificationPreferences(preferences);
    return;
  }

  const byId = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);

  if (byId.error) {
    if (isMissingPreferencesColumn(byId.error)) {
      writeLocalPreferences(userId, preferences);
      broadcastNotificationPreferences(preferences);
      return;
    }
    throw byId.error;
  }

  writeLocalPreferences(userId, preferences);
  broadcastNotificationPreferences(preferences);
}

export function preferenceKeyForNotification(
  type: string,
  metadata?: Record<string, unknown> | null,
): NotificationPreferenceKey | null {
  const normalized = type.toLowerCase();
  if (normalized === "new_sale" || normalized === "sale" || normalized === "order_paid") return "new_sale";
  if (normalized === "product_published" || normalized === "publication_success") return "product_published";
  if (normalized === "publication_error" || normalized === "publish_error" || normalized === "error") return "publication_error";
  if (normalized === "product_paused" || normalized === "publication_paused") return "product_paused";
  if (normalized === "product_activated" || normalized === "publication_activated") return "product_activated";
  if (normalized === "order_in_transit" || normalized === "shipping_update") return "order_in_transit";
  if (normalized === "weekly_report") return "weekly_report";
  if (normalized === "support_reply" || normalized === "support") return "support_reply";

  const event = typeof metadata?.event === "string" ? metadata.event.toLowerCase() : "";
  if (event === "product_paused") return "product_paused";
  if (event === "product_activated") return "product_activated";
  if (event === "order_in_transit") return "order_in_transit";
  return null;
}

export function isNotificationAllowed(row: NotificationRow, preferences: NotificationPreferences) {
  const key = preferenceKeyForNotification(row.type, row.metadata);
  if (!key) return true;
  return preferences[key];
}

export function shouldAnnounceNotification(row: NotificationRow, preferences: NotificationPreferences) {
  if (announcedNotificationIds.has(row.id)) return false;
  if (!isNotificationAllowed(row, preferences)) return false;
  announcedNotificationIds.add(row.id);
  return true;
}

export function formatNotificationTime(createdAt: string | null): string {
  if (!createdAt) return "agora";
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return days === 1 ? "ontem" : `há ${days} dias`;
  if (hours >= 1) return `há ${hours} h`;
  if (mins >= 1) return `há ${mins} min`;
  return "agora";
}

export function playSoftNotificationSound() {
  if (typeof window === "undefined") return;

  try {
    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.52);
    master.connect(context.destination);

    [587.33, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.14;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.28);
    });

    window.setTimeout(() => void context.close().catch(() => undefined), 800);
  } catch {
    // O navegador pode bloquear áudio até haver uma interação do usuário.
  }
}
