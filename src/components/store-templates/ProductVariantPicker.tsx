import { useState } from "react";

import type { ProductVariantOption } from "@/lib/userProjects";

/**
 * Seletor de variações do produto (Cor, Tamanho, Tipo...).
 *
 * Renderiza SOMENTE o que o fornecedor informa. Quando o produto não tem
 * variação — a maioria do catálogo C7Drop — não renderiza nada, em vez de
 * inventar tamanhos/cores que o lojista não consegue entregar.
 */
export type ProductVariantPickerProps = {
  options: ProductVariantOption[];
  accent: string;
};

const ProductVariantPicker = ({ options, accent }: ProductVariantPickerProps) => {
  const [selected, setSelected] = useState<Record<string, string>>({});

  if (options.length === 0) return null;

  return (
    <>
      {options.map((option) => {
        const active = selected[option.name] ?? option.options[0];
        return (
          <div key={option.name} className="mt-6">
            <p className="text-[14px] font-semibold text-black">
              {option.name}: <span className="font-medium text-black/55">{active}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {option.options.map((value) => {
                const isActive = active === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelected((current) => ({ ...current, [option.name]: value }))}
                    className={`h-11 min-w-[54px] rounded-[10px] border px-3 text-[14px] font-semibold transition ${isActive ? "border-transparent text-white" : "border-black/15 text-black hover:border-black/50"}`}
                    style={isActive ? { backgroundColor: accent } : undefined}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default ProductVariantPicker;
