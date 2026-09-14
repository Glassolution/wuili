import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AffiliatePixKey } from "@/lib/affiliatePixKeys";

/**
 * Seletor das chaves Pix que o afiliado já cadastrou no formulário de solicitação.
 * O saque nunca pede a chave digitada na hora — só escolhe entre as cadastradas.
 */
export const WithdrawPixKeySelector = ({
  pixKeys,
  loading,
  selectedValue,
  onSelect,
  onRegisterPixKey,
}: {
  pixKeys: AffiliatePixKey[];
  loading: boolean;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  onRegisterPixKey: () => void;
}) => (
  <div className="space-y-2">
    <span className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">
      Chave Pix para receber <span className="text-red-500">*</span>
    </span>

    {loading ? (
      <div className="flex h-11 items-center gap-2 text-[13px] text-[#737373] dark:text-zinc-400">
        <Loader2 size={14} className="animate-spin" /> Carregando suas chaves…
      </div>
    ) : pixKeys.length === 0 ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
          Cadastre uma chave Pix no seu perfil de afiliado pra poder sacar.
        </p>
        <button
          type="button"
          onClick={onRegisterPixKey}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-800 px-3 text-[12px] font-semibold text-white transition hover:bg-amber-900 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30"
        >
          Cadastrar chave Pix
          <ArrowRight size={14} />
        </button>
      </div>
    ) : (
      <>
        <div className="space-y-2">
          {pixKeys.map((item) => {
            const active = item.value === selectedValue;
            return (
              <label
                key={item.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition",
                  active
                    ? "border-[#0A0A0A] bg-[#FAFAFA] dark:border-zinc-400 dark:bg-zinc-950"
                    : "border-[#E5E5E5] bg-white hover:border-[#A3A3A3] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600",
                )}
              >
                <input
                  type="radio"
                  name="withdraw-pix-key"
                  value={item.value}
                  checked={active}
                  onChange={() => onSelect(item.value)}
                  className="h-4 w-4 shrink-0 accent-[#0A0A0A] dark:accent-white"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-widest text-[#A3A3A3] dark:text-zinc-500">
                    {item.type || "Chave Pix"}
                  </span>
                  <span className="mt-0.5 block break-all font-mono text-[13px] text-[#0A0A0A] dark:text-white">
                    {item.value}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[12px] leading-relaxed text-[#737373] dark:text-zinc-400">
          {pixKeys.length === 1
            ? "Chave cadastrada no seu perfil de afiliado."
            : "Escolha qual das suas chaves cadastradas vai receber este saque."}
        </p>
      </>
    )}
  </div>
);

export default WithdrawPixKeySelector;
