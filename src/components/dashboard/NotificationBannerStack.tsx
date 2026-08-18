import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, BarChart3, Bell, MessageSquare, PackageCheck, PauseCircle, PlayCircle, ShoppingCart, Truck, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VeloMark } from "@/components/VeloLogo";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCES_EVENT,
  fetchNotificationPreferences,
  formatNotificationTime,
  isNotificationAllowed,
  normalizeNotificationPreferences,
  playSoftNotificationSound,
  shouldAnnounceNotification,
  type NotificationPreferences,
  type NotificationRow,
} from "@/lib/notifications";

type BannerNotification = NotificationRow & {
  isFresh?: boolean;
};

const iconByType = {
  new_sale: ShoppingCart,
  order_paid: ShoppingCart,
  product_published: PackageCheck,
  publication_success: PackageCheck,
  product_paused: PauseCircle,
  publication_paused: PauseCircle,
  product_activated: PlayCircle,
  publication_activated: PlayCircle,
  publication_error: AlertTriangle,
  publish_error: AlertTriangle,
  error: AlertTriangle,
  order_in_transit: Truck,
  shipping_update: Truck,
  weekly_report: BarChart3,
  support_reply: MessageSquare,
  support: MessageSquare,
};

const PAYMENT_NOTIFICATION_TYPES = new Set([
  "billing",
  "payment",
  "payment_confirmed",
  "completed_payment",
  "subscription_active",
  "subscription_activated",
  "trial_converted",
  "plan_activated",
]);

const getIcon = (type: string) => {
  const Icon = iconByType[type.toLowerCase() as keyof typeof iconByType] ?? Bell;
  return Icon;
};

const isPaymentNotification = (item: NotificationRow) => {
  const type = item.type.toLowerCase();
  if (PAYMENT_NOTIFICATION_TYPES.has(type)) return true;
  const title = item.title.toLowerCase();
  const message = item.message.toLowerCase();
  return title.includes("pagamento") || title.includes("assinatura") || message.includes("plano") || message.includes("cobrança");
};

const NotificationBannerStack = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BannerNotification[]>([]);
  const preferencesRef = useRef<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  const applyPreferences = (next: NotificationPreferences) => {
    preferencesRef.current = next;
  };

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      applyPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    let cancelled = false;

    const hydratePreferences = async () => {
      let prefs = DEFAULT_NOTIFICATION_PREFERENCES;
      try {
        prefs = await fetchNotificationPreferences(user.id);
      } catch (error) {
        console.warn("[notification-stack] usando preferencias padrao:", error);
      }

      if (cancelled) return;
      applyPreferences(prefs);
    };

    // O banner flutuante anuncia somente eventos recebidos nesta sessão.
    // O histórico de notificações permanece disponível no sino, sem reaparecer
    // como alerta novo a cada navegação ou atualização da página.
    setItems([]);
    void hydratePreferences();

    const syncLocalPreferences = (event: Event) => {
      const detail = (event as CustomEvent<{ preferences?: unknown }>).detail;
      const normalized = normalizeNotificationPreferences(detail?.preferences);
      applyPreferences(normalized);
      setItems((current) => current.filter((item) => isNotificationAllowed(item, normalized)));
    };

    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, syncLocalPreferences);

    const profileChannel = supabase
      .channel(`notification-preferences:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const nextPrefs = (payload.new as { notification_preferences?: unknown }).notification_preferences;
          const normalized = normalizeNotificationPreferences(nextPrefs);
          applyPreferences(normalized);
          setItems((current) => current.filter((item) => isNotificationAllowed(item, normalized)));
        },
      )
      .subscribe();

    const notificationChannel = supabase
      .channel(`notification-stack:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          if (!shouldAnnounceNotification(row, preferencesRef.current)) return;
          playSoftNotificationSound();
          setItems((current) => [
            { ...row, isFresh: true },
            ...current.filter((item) => item.id !== row.id),
          ].slice(0, 4));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, syncLocalPreferences);
      void supabase.removeChannel(profileChannel);
      void supabase.removeChannel(notificationChannel);
    };
  }, [queryClient, user?.id]);

  const visibleItems = useMemo(() => items.slice(0, 4), [items]);

  const dismiss = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    } catch (error) {
      console.warn("[notification-stack] nao foi possivel marcar como lida:", error);
    }
  };

  return (
    <div className="pointer-events-none fixed right-3 top-20 z-[95] flex w-[min(calc(100vw-24px),360px)] justify-end sm:right-5 sm:top-6">
      <div className="flex w-full flex-col gap-2">
        <AnimatePresence initial={false}>
          {visibleItems.map((item, index) => {
            const Icon = getIcon(item.type);
            const highlighted = index === 0 && item.isFresh;
            const payment = isPaymentNotification(item);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: 18, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 18, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={`pointer-events-auto overflow-hidden rounded-[18px] border bg-white px-3 py-2.5 text-[#111111] shadow-[0_12px_32px_rgba(15,23,42,0.12)] ${
                  highlighted || payment ? "border-[#BFDBFE]" : "border-[#E5E7EB]"
                }`}
                style={{
                  transformOrigin: "top right",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      highlighted || payment ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#F3F4F6] text-[#111111]"
                    }`}
                  >
                    {payment ? <VeloMark size={24} tone="solid" /> : <Icon size={17} strokeWidth={2} />}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[11px] font-semibold leading-5 text-[#8E8E87]">
                        {formatNotificationTime(item.created_at)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[12px] font-medium leading-4 text-[#777771]">
                      {item.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void dismiss(item.id)}
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#8E8E87] transition hover:bg-[#F3F4F6] hover:text-[#111111]"
                    aria-label="Fechar notificação"
                  >
                    <X size={15} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NotificationBannerStack;
