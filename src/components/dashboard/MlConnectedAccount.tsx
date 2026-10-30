import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";

export type MlAccountInfo = {
  connected: boolean;
  ml_user_id?: string | null;
  nickname?: string | null;
  warning?: string | null;
};

/** Apelido + ID da conta do Mercado Livre conectada. `userId` só para admins (suporte). */
export const useMlAccountInfo = (enabled: boolean, userId?: string | null) =>
  useQuery({
    queryKey: ["ml-account-info", userId ?? "me"],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<MlAccountInfo> => {
      const { data, error } = await supabase.functions.invoke("ml-account-info", {
        body: userId ? { user_id: userId } : {},
      });
      if (error) throw error;
      return data as MlAccountInfo;
    },
  });

const copyId = async (id: string) => {
  try {
    await navigator.clipboard.writeText(id);
    veloToast.success("ID copiado");
  } catch {
    veloToast.error("Não foi possível copiar o ID");
  }
};

export const MlConnectedAccount = ({
  info,
  loading,
  failed,
  compact = false,
}: {
  info: MlAccountInfo | undefined;
  loading: boolean;
  failed?: boolean;
  compact?: boolean;
}) => {
  if (loading) {
    return <p className="text-[11px] text-[#A3A3A3] dark:text-zinc-500">Carregando conta conectada...</p>;
  }
  if (failed) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-[#B45309] dark:text-amber-400">
        <AlertTriangle size={12} className="shrink-0" /> Não conseguimos carregar a conta conectada agora.
      </p>
    );
  }
  if (!info?.connected) {
    return compact ? <p className="text-[11px] text-[#8A8A8A]">Mercado Livre não conectado</p> : null;
  }

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#525252] dark:text-zinc-300">
        {info.nickname ? (
          <span className="min-w-0 truncate font-semibold text-[#0A0A0A] dark:text-white">{info.nickname}</span>
        ) : null}
        {info.ml_user_id ? (
          <span className="inline-flex items-center gap-1 text-[#737373] dark:text-zinc-400">
            ID {info.ml_user_id}
            <button
              type="button"
              onClick={() => void copyId(info.ml_user_id as string)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[#737373] transition hover:bg-black/[0.06] hover:text-[#0A0A0A] dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Copiar ID da conta do Mercado Livre"
              title="Copiar ID"
            >
              <Copy size={12} />
            </button>
          </span>
        ) : null}
      </div>
      {info.warning ? (
        <p className="flex items-start gap-1 text-[10.5px] leading-4 text-[#B45309] dark:text-amber-400">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {info.warning}
        </p>
      ) : null}
    </div>
  );
};
