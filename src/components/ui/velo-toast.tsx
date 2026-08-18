import type React from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, Loader2, X } from "lucide-react";
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";

type ToastId = ReturnType<typeof sonnerToast.message>;

type ToastAction = {
  label: string;
  onClick: () => void;
};

type VeloToastOptions = {
  id?: ToastId;
  action?: ToastAction;
  duration?: number;
  fullscreen?: boolean;
  minDuration?: number;
};

type FullscreenToast = {
  id: ToastId;
  message: string;
  visibleAt: number;
  minDuration: number;
};

const fullscreenListeners = new Set<() => void>();
let fullscreenToast: FullscreenToast | null = null;
let fullscreenSequence = 0;

const emitFullscreenChange = () => fullscreenListeners.forEach((listener) => listener());

const setFullscreenToast = (toast: FullscreenToast | null) => {
  fullscreenToast = toast;
  emitFullscreenChange();
};

const subscribeToFullscreenToast = (listener: () => void) => {
  fullscreenListeners.add(listener);
  return () => fullscreenListeners.delete(listener);
};

const getFullscreenToast = () => fullscreenToast;

const getFullscreenDelay = (id: ToastId) => {
  if (!fullscreenToast || fullscreenToast.id !== id) return 0;
  return Math.max(0, fullscreenToast.minDuration - (Date.now() - fullscreenToast.visibleAt));
};

const dismissFullscreenToast = (id?: ToastId) => {
  if (!fullscreenToast || (id !== undefined && fullscreenToast.id !== id)) return false;
  setFullscreenToast(null);
  return true;
};

const iconBase = "text-white";
const pillCircle =
  "flex h-6 w-6 items-center justify-center rounded-full bg-[#2A2A2A] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]";

const LoadingIcon = () => <Loader2 size={18} strokeWidth={2} className={`${iconBase} animate-spin`} />;

const SuccessIcon = () => (
  <span className={pillCircle}>
    <Check size={16} strokeWidth={2.2} className={iconBase} />
  </span>
);

const ErrorIcon = () => (
  <span className={pillCircle}>
    <X size={16} strokeWidth={2.2} className={iconBase} />
  </span>
);

const InfoIcon = () => (
  <span className={pillCircle}>
    <Info size={16} strokeWidth={2.2} className={iconBase} />
  </span>
);

export const veloToast = {
  loading: (message: string, options?: VeloToastOptions) => {
    if (options?.fullscreen) {
      const id = options.id ?? `velo-fullscreen-${++fullscreenSequence}`;
      setFullscreenToast({
        id,
        message,
        visibleAt: Date.now(),
        minDuration: options.minDuration ?? 3000,
      });
      return id;
    }

    return sonnerToast.loading(message, {
      id: options?.id,
      icon: <LoadingIcon />,
      duration: Number.POSITIVE_INFINITY,
      action: options?.action,
    });
  },
  success: (message: string, options?: VeloToastOptions) =>
    sonnerToast.success(message, {
      id: options?.id,
      icon: <SuccessIcon />,
      duration: options?.duration ?? 4500,
      action: options?.action,
    }),
  error: (message: string, options?: VeloToastOptions) =>
    sonnerToast.error(message, {
      id: options?.id,
      icon: <ErrorIcon />,
      duration: options?.duration ?? 5000,
      action: options?.action,
    }),
  info: (message: string, options?: VeloToastOptions) =>
    sonnerToast.message(message, {
      id: options?.id,
      icon: <InfoIcon />,
      duration: options?.duration ?? 4500,
      action: options?.action,
    }),
  waitForMinimum: (id: ToastId) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, getFullscreenDelay(id))),
  dismiss: (id?: ToastId) => {
    const dismissedFullscreen = dismissFullscreenToast(id);
    if (!dismissedFullscreen || id === undefined) sonnerToast.dismiss(id);
  },
};

export const toast = veloToast;

export const useLoadingToast = (active: boolean, message: string) => {
  const toastIdRef = useRef<ToastId | undefined>(undefined);

  useEffect(() => {
    if (active) {
      if (!toastIdRef.current) {
        toastIdRef.current = veloToast.loading(message);
      }
      return;
    }

    if (toastIdRef.current) {
      veloToast.dismiss(toastIdRef.current);
      toastIdRef.current = undefined;
    }
  }, [active, message]);

  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        veloToast.dismiss(toastIdRef.current);
      }
    };
  }, []);
};

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export const VeloToaster = (props: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const activeFullscreenToast = useSyncExternalStore(
    subscribeToFullscreenToast,
    getFullscreenToast,
    getFullscreenToast
  );

  return (
    <>
      <SonnerToaster
        theme={theme as ToasterProps["theme"]}
        position="bottom-right"
        expand={false}
        closeButton={false}
        toastOptions={{
          classNames: {
            toast:
              "group toast !w-auto max-w-[min(calc(100vw-32px),560px)] !rounded-full !border !border-white/10 !bg-[#0A0A0A] !px-5 !py-3 !shadow-[0_18px_48px_rgba(0,0,0,0.42)] !backdrop-blur-0 before:absolute before:inset-[1px] before:rounded-full before:border before:border-white/[0.07] before:content-[''] flex items-center gap-3 overflow-hidden",
            title: "!text-[14px] !font-medium !leading-[18px] !text-white",
            description: "hidden",
            icon: "relative z-[1] shrink-0",
            actionButton:
              "!relative !z-[1] !ml-2 !rounded-none !bg-transparent !px-4 !py-0 !text-[14px] !font-medium !leading-[18px] !text-white/90 hover:!text-white !border-l !border-white/20",
            cancelButton: "hidden",
            closeButton: "hidden",
          },
        }}
        {...props}
      />

      <AnimatePresence>
        {activeFullscreenToast && (
          <motion.div
            key={String(activeFullscreenToast.id)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-live="polite"
            aria-label={activeFullscreenToast.message}
            data-velo-toast="fullscreen"
          >
            {/*
              Antes era a pílula preta com spinner. Agora reusa a tela de
              carregamento da marca — mesma identidade do carregamento de rota,
              com a logo atual vinda do componente compartilhado.
            */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: -6 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <VeloLoadingScreen message={activeFullscreenToast.message} fill={false} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
