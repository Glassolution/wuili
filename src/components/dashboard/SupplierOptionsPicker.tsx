import {
  opcaoTemEstoque,
  type OpcaoDaFornecedora,
} from "../../../supabase/functions/_shared/supplierOptions";

export type EscolhaDeOpcao = { marcada: boolean; preco: number };

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Props = {
  opcoes: OpcaoDaFornecedora[];
  escolhas: Record<string, EscolhaDeOpcao>;
  onChange: (chave: string, escolha: EscolhaDeOpcao) => void;
  onMarcarTodas: () => void;
};

/**
 * Lista das opções da fornecedora (tamanho, cor, capacidade, qualquer uma) na
 * hora de publicar: o vendedor marca quais quer vender e o preço de cada uma.
 */
const SupplierOptionsPicker = ({ opcoes, escolhas, onChange, onMarcarTodas }: Props) => {
  const nomes = [...new Set(opcoes.map((o) => o.nome))].join(" / ");
  const marcadas = opcoes.filter((o) => escolhas[o.chave]?.marcada).length;
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-[#F4F8FF] px-4 py-3">
        <p className="text-[12px] leading-[1.6] text-[#475569]">
          Este produto tem opções de <span className="font-semibold text-[#0F172A]">{nomes.toLowerCase()}</span> com
          custos diferentes na fornecedora. Marque as que você quer vender e defina o preço de cada uma.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-gray-600">
          {marcadas === 0 ? "Nenhuma opção marcada" : `${marcadas} de ${opcoes.length} marcada${marcadas > 1 ? "s" : ""}`}
        </p>
        <button type="button" onClick={onMarcarTodas} className="min-h-9 text-[12.5px] font-semibold text-[#2563EB]">
          Marcar todas com estoque
        </button>
      </div>
      <ul className="space-y-2">
        {opcoes.map((o) => {
          const escolha = escolhas[o.chave] ?? { marcada: false, preco: 0 };
          const semEstoque = !opcaoTemEstoque(o);
          const sobra = Math.round((escolha.preco - o.custo) * 100) / 100;
          return (
            <li
              key={o.chave}
              className={`rounded-xl border px-3.5 py-3 ${escolha.marcada ? "border-[#2563EB] bg-[#F8FBFF]" : "border-[#DCE7FA] bg-white"} ${semEstoque ? "opacity-50" : ""}`}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#2563EB]"
                  checked={escolha.marcada}
                  disabled={semEstoque}
                  onChange={(e) => onChange(o.chave, { ...escolha, marcada: e.target.checked })}
                  aria-label={`Vender ${o.valor}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-[#0F172A]">{o.valor}</span>
                  <span className="block text-[11.5px] text-[#64748B]">
                    {o.nome} · custo {formatBRL(o.custo)}
                    {semEstoque ? " · sem estoque" : ""}
                  </span>
                </span>
              </label>
              {escolha.marcada && (
                <div className="mt-2.5 flex items-center gap-3 pl-7">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-gray-400">R$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={escolha.preco || ""}
                      onChange={(e) => onChange(o.chave, { ...escolha, preco: Number(e.target.value) || 0 })}
                      aria-label={`Preço de venda de ${o.valor}`}
                      className="w-full rounded-lg border border-[#DCE7FA] bg-white py-2 pl-9 pr-3 text-[14px] font-semibold text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                    />
                  </div>
                  <span className={`shrink-0 text-right text-[12px] font-semibold ${sobra > 0 ? "text-[#0F172A]" : "text-red-500"}`}>
                    Sobra {formatBRL(sobra)}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-4 text-[#64748B]">
        Sobra bruta: antes das taxas do Mercado Livre, frete e impostos. Com preços iguais, a Velo tenta um anúncio só
        em que o comprador escolhe a opção; se não der, publica um anúncio para cada opção, com o nome dela no título.
      </p>
    </div>
  );
};

export default SupplierOptionsPicker;
