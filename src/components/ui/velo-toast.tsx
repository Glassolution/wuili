import type React from "react";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Check, Info, Loader2, X } from "lucide-react";
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

type ToastId = ReturnType<typeof sonnerToast.message>;

type ToastAction = {
  label: string;
  onClick: () => void;
};

type VeloToastOptions = {
  id?: ToastId;
  action?: ToastAction;
  duration?: number;
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
  loading: (message: string, options?: VeloToastOptions) =>
    sonnerToast.loading(message, {
      id: options?.id,
      icon: <LoadingIcon />,
      duration: Number.POSITIVE_INFINITY,
      action: options?.action,
    }),
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
  dismiss: (id?: ToastId) => sonnerToast.dismiss(id),
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

  return (
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
  );
};
