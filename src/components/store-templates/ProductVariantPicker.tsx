import { useEffect, useState } from "react";

import type { ProductVariantOption } from "@/lib/userProjects";

/**
 * Seletor de variações do produto (Cor, Tamanho, Tipo...).
 *
 * Renderiza SOMENTE o que o fornecedor informa. Quando o produto não tem
 * variação — boa parte do catálogo C7Drop — não renderiza nada, em vez de
 * inventar tamanhos/cores que o lojista não consegue entregar.
 *
 * Pode ser usado controlado (`value` + `onChange`, que é como as páginas
 * públicas usam para levar a escolha até o carrinho) ou solto.
 */
export type ProductVariantPickerProps = {
  options: ProductVariantOption[];
  accent: string;
  /** Escolha atual por atributo ({ Cor: "Azul" }). */
  value?: Record<string, string>;
  onChange?: (next: Record<string, string>) => void;
  /** Sem seleção inicial: o comprador precisa escolher antes de comprar. */
  requireExplicitChoice?: boolean;
  /** Cor do texto base (páginas com fundo creme/escuro passam a sua). */
  textColor?: string;
  className?: string;
};

const ProductVariantPicker = ({
  options,
  accent,
  value,
  onChange,
  requireExplicitChoice = false,
  textColor = "#0F172A",
  className,
}: ProductVariantPickerProps) => {
  const [internal, setInternal] = useState<Record<string, string>>({});
  const selected = value ?? internal;

  // Sem escolha explícita obrigatória, pré-seleciona a primeira opção.
  useEffect(() => {
    if (requireExplicitChoice || options.length === 0) return;
    const defaults: Record<string, string> = {};
    options.forEach((option) => {
      if (option.options[0]) defaults[option.name] = option.options[0];
    });
    if (value) {
      const missing = options.some((option) => !value[option.name]);
      if (missing && onChange) onChange({ ...defaults, ...value });
    } else {
      setInternal((current) => ({ ...defaults, ...current }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, requireExplicitChoice]);

  if (options.length === 0) return null;

  const select = (name: string, option: string) => {
    const next = { ...selected, [name]: option };
    if (onChange) onChange(next);
    else setInternal(next);
  };

  return (
    <div className={className}>
      {options.map((option) => {
        const active = selected[option.name];
        return (
          <div key={option.name} className="mt-6">
            <p className="text-[14px] font-semibold" style={{ color: textColor }}>
              {option.name}:{" "}
              <span className="font-medium opacity-60">{active ?? "escolha uma opção"}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {option.options.map((entry) => {
                const isActive = active === entry;
                return (
                  <button
                    key={entry}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => select(option.name, entry)}
                    className={`h-11 min-w-[54px] rounded-[10px] border px-3 text-[14px] font-semibold transition ${isActive ? "border-transparent text-white" : "border-black/15 hover:border-black/50"}`}
                    style={isActive ? { backgroundColor: accent } : { color: textColor }}
                  >
                    {entry}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductVariantPicker;
