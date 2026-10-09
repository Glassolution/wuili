import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "@phosphor-icons/react";
import { BanknotesIcon, SpeakerWaveIcon, SpeakerXMarkIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { formatSaleAmount, saleAlerts, salePlanLabel, unreadSales, type SaleAlert } from "@/lib/adminSaleAlerts";
import { playSaleSound, unlockSaleSound } from "@/lib/saleSound";

const useSaleAlerts = () => useSyncExternalStore(saleAlerts.subscribe, saleAlerts.getSnapshot);

const timeAgo = (iso: string) => {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "agora";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `há ${minutes} min`;
  const date = new Date(iso);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `hoje, ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return `ontem, ${time}`;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}, ${time}`;
};

const TEST_ALERT: SaleAlert = {
  id: "teste",
  subscriptionId: "teste",
  userId: null,
  amount: 39.9,
  plan: "base",
  customer: "Teste de aviso",
  at: new Date().toISOString(),
  read: true,
};

type Permission = NotificationPermission | "unsupported";
const currentPermission = (): Permission => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

/** Sino da barra de cima: vendas recentes, som e avisos do computador. */
export const AdminNotificationsBell = () => {
  const { alerts, soundOn } = useSaleAlerts();
  const unread = unreadSales(alerts);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<Permission>(currentPermission);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setPermission(currentPermission());
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // abrir o sino conta como "vi as vendas"
  useEffect(() => {
    if (open) saleAlerts.markAllRead();
  }, [open, alerts.length]);

  const enableSystemNotifications = async () => {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  };

  const runTest = async () => {
    unlockSaleSound();
    if (soundOn) await playSaleSound();
    saleAlerts.showTest({ ...TEST_ALERT, at: new Date().toISOString() });
    if (currentPermission() === "granted") {
      try {
        new Notification(`Nova venda · ${formatSaleAmount(TEST_ALERT.amount)}`, {
          body: "Velo Base · Teste de aviso",
          icon: "/logo.png",
          tag: "teste",
          silent: true,
        });
      } catch {
        // sem suporte a notificação direta neste navegador
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="admin-topbar-icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificações: ${unread} vendas novas` : "Notificações"}
        title="Notificações de venda"
      >
        <Bell aria-hidden="true" weight={unread > 0 ? "fill" : "regular"} />
        <AnimatePresence>
          {unread > 0 ? (
            <motion.span
              key="contador"
              className="admin-bell-count"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 26 }}
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Notificações de venda"
            className="admin-bell-panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <p className="text-[14px] font-semibold">Notificações</p>
              {alerts.length > 0 ? (
                <button type="button" className="admin-bell-link" onClick={() => saleAlerts.clear()}>
                  Limpar
                </button>
              ) : null}
            </header>

            <div className="admin-bell-settings">
              <button
                type="button"
                className="admin-bell-setting"
                aria-pressed={soundOn}
                onClick={() => {
                  unlockSaleSound();
                  saleAlerts.setSound(!soundOn);
                }}
              >
                {soundOn ? <SpeakerWaveIcon aria-hidden="true" /> : <SpeakerXMarkIcon aria-hidden="true" />}
                <span className="flex-1 text-left">Som de venda</span>
                <span className="admin-bell-switch" data-on={soundOn || undefined} aria-hidden="true" />
              </button>

              <div className="admin-bell-setting">
                <Bell aria-hidden="true" weight="fill" />
                <span className="flex-1 text-left">Avisos no computador</span>
                {permission === "granted" ? (
                  <span className="admin-bell-status">Ativados</span>
                ) : permission === "denied" ? (
                  <span className="admin-bell-status" title="Libere as notificações deste site nas configurações do navegador">
                    Bloqueados
                  </span>
                ) : permission === "unsupported" ? (
                  <span className="admin-bell-status">Indisponível</span>
                ) : (
                  <button type="button" className="admin-bell-enable" onClick={() => void enableSystemNotifications()}>
                    Ativar
                  </button>
                )}
              </div>

              <button type="button" className="admin-bell-test" onClick={() => void runTest()}>
                Testar aviso de venda
              </button>
            </div>

            <ul className="max-h-[360px] overflow-y-auto px-2 pb-2">
              {alerts.length === 0 ? (
                <li className="px-3 py-8 text-center text-[13px] leading-5 text-[color:var(--ov-text-4)]">
                  Nenhuma venda ainda.
                  <br />
                  Quando uma assinatura for paga, ela aparece aqui com som.
                </li>
              ) : (
                alerts.map((alert) => (
                  <li key={alert.id} className="admin-bell-item">
                    <span className="admin-bell-item-icon">
                      <BanknotesIcon aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-medium">Nova venda</span>
                        <span className="text-[13.5px] font-semibold tabular-nums">{formatSaleAmount(alert.amount)}</span>
                      </p>
                      <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[12.5px] text-[color:var(--ov-text-3)]">
                        <span className="truncate">{[salePlanLabel(alert.plan), alert.customer].filter(Boolean).join(" · ")}</span>
                        <span className="shrink-0 text-[color:var(--ov-text-4)]">{timeAgo(alert.at)}</span>
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/** Aviso flutuante de venda, no canto da tela. Some sozinho depois de alguns segundos. */
export const AdminSaleToast = () => {
  const { toast } = useSaleAlerts();
  const navigate = useNavigate();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => saleAlerts.dismissToast(), 8000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="admin-sale-toast-area" aria-live="polite">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id + toast.at}
            className="admin-sale-toast"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => {
                saleAlerts.dismissToast();
                if (!toast.test) navigate("/admin/painel");
              }}
            >
              <span className="admin-sale-toast-icon">
                <BanknotesIcon aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-[color:var(--ov-text-3)]">
                  {toast.test ? "Teste · Nova venda" : "Nova venda"}
                </span>
                <span className="block text-[20px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">
                  {formatSaleAmount(toast.amount)}
                </span>
                <span className="block truncate text-[12.5px] text-[color:var(--ov-text-3)]">
                  {[salePlanLabel(toast.plan), toast.customer].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label="Fechar aviso"
              className="admin-sale-toast-close"
              onClick={() => saleAlerts.dismissToast()}
            >
              <XMarkIcon aria-hidden="true" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
