import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ArrowDown, Info } from "lucide-react";

/*
  Funil completo: do primeiro acesso na landing até o anúncio publicado.
  Cada etapa conta PESSOAS diferentes (não cliques) e traz a definição do que
  está sendo contado, para o número nunca ficar aberto a interpretação.
*/

type EtapaRow = { ordem: number; etapa: string; definicao: string; pessoas: number };
type PagouRow = { pagaram: number; ativaram: number; horas_medias: number | null; reembolsos: number };
type ErroRow = { tipo: string; motivo: string; ocorrencias: number; pessoas: number };

const PERIODOS = [7, 14, 30, 90];
const DISPOSITIVOS = [
  { id: null as string | null, label: "Todos" },
  { id: "mobile", label: "Celular" },
  { id: "desktop", label: "Computador" },
];
const NAVEGADORES = [
  { id: null as string | null, label: "Todos" },
  { id: "interno", label: "Dentro de app" },
  { id: "normal", label: "Navegador normal" },
];
const ORIGENS = [
  { id: null as string | null, label: "Todas" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "google", label: "Google" },
  { id: "direto", label: "Direto" },
];

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

const Chips = <T extends string | number | null>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#ececE6] bg-white p-1">
    {options.map((o) => (
      <button
        key={String(o.id)}
        type="button"
        onClick={() => onChange(o.id)}
        className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
          value === o.id ? "bg-[#171715] text-white" : "text-[#77776f] hover:bg-[#f6f6f3]"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const AdminFunnelPanel = () => {
  const [days, setDays] = useState(30);
  const [device, setDevice] = useState<string | null>(null);
  const [browser, setBrowser] = useState<string | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const [comparar, setComparar] = useState(false);

  const args = { p_days: days, p_origem: origem, p_device: device, p_browser: browser };

  const atual = useQuery({
    queryKey: ["admin-funil", days, origem, device, browser],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC nova ainda não tipada
      const { data, error } = await (supabase as any).rpc("rpc_admin_full_funnel", { ...args, p_offset_days: 0 });
      if (error) throw error;
      return (data ?? []) as EtapaRow[];
    },
  });

  const anterior = useQuery({
    enabled: comparar,
    queryKey: ["admin-funil-ant", days, origem, device, browser],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_full_funnel", { ...args, p_offset_days: days });
      if (error) throw error;
      return (data ?? []) as EtapaRow[];
    },
  });

  const pagou = useQuery({
    queryKey: ["admin-pagou-sem-vendedor", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_paid_without_seller", { p_days: days });
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as PagouRow | null;
    },
  });

  const erros = useQuery({
    queryKey: ["admin-erros", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_error_breakdown", { p_days: days });
      if (error) throw error;
      return (data ?? []) as ErroRow[];
    },
  });

  const linhas = useMemo(() => {
    const etapas = (atual.data ?? []).slice().sort((a, b) => a.ordem - b.ordem);
    const antes = new Map((anterior.data ?? []).map((e) => [e.ordem, Number(e.pessoas)]));
    const inicio = Number(etapas[0]?.pessoas ?? 0);
    let maiorPerda = 0;
    const calc = etapas.map((e, i) => {
      const pessoas = Number(e.pessoas);
      const anteriorQtd = i === 0 ? pessoas : Number(etapas[i - 1].pessoas);
      const perda = Math.max(anteriorQtd - pessoas, 0);
      if (i > 0 && perda > maiorPerda) maiorPerda = perda;
      return {
        ...e,
        pessoas,
        perda,
        avanco: i === 0 ? "100%" : pct(pessoas, anteriorQtd),
        acumulado: pct(pessoas, inicio),
        comparado: antes.get(e.ordem) ?? null,
      };
    });
    return calc.map((l, i) => ({ ...l, destaque: i > 0 && l.perda > 0 && l.perda >= maiorPerda * 0.6 }));
  }, [atual.data, anterior.data]);

  // Lacunas de medição: etapa zerada com gente na etapa seguinte = evento não disparou.
  const lacunas = useMemo(
    () =>
      linhas
        .filter((l, i) => l.pessoas === 0 && Number(linhas[i + 1]?.pessoas ?? 0) > 0)
        .map((l) => l.etapa),
    [linhas],
  );

  const maxPessoas = Math.max(1, ...linhas.map((l) => l.pessoas));

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#ececE6] bg-white p-4">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Período</p>
            <Chips value={days} options={PERIODOS.map((p) => ({ id: p, label: `${p} dias` }))} onChange={setDays} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Origem</p>
              <Chips value={origem} options={ORIGENS} onChange={setOrigem} />
            </div>
            <div>
              <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Aparelho</p>
              <Chips value={device} options={DISPOSITIVOS} onChange={setDevice} />
            </div>
            <div>
              <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Navegador</p>
              <Chips value={browser} options={NAVEGADORES} onChange={setBrowser} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#44443f]">
            <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} />
            Comparar com os {days} dias anteriores
          </label>
        </div>
      </section>

      {lacunas.length ? (
        <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
          <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Medição possivelmente falhando</p>
            <p>
              Estas etapas estão com zero pessoas, mas há gente nas etapas seguintes — o aviso do navegador não está
              chegando: {lacunas.join(", ")}.
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#ececE6] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-[#171715]">Do primeiro acesso ao anúncio publicado</h2>
        <p className="mb-3 text-[12px] text-[#8c8c87]">
          Cada linha conta pessoas diferentes, não cliques. Em vermelho, onde mais gente some.
        </p>

        {atual.isLoading ? <p className="text-[13px] text-[#8c8c87]">Carregando…</p> : null}

        <ol className="space-y-2">
          {linhas.map((l, i) => (
            <li
              key={l.ordem}
              className={`rounded-2xl border p-3 ${
                l.destaque ? "border-rose-200 bg-rose-50" : "border-[#f1f1ee] bg-[#fbfbf9]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#171715]">
                    {i + 1}. {l.etapa}
                  </p>
                  <p className="mt-[2px] flex items-start gap-1 text-[11px] leading-snug text-[#8c8c87]">
                    <Info className="mt-[2px] h-3 w-3 shrink-0" />
                    {l.definicao}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[20px] font-semibold tracking-[-0.02em] text-[#171715]">{l.pessoas}</p>
                  <p className="text-[11px] text-[#8c8c87]">
                    {l.avanco} da etapa anterior · {l.acumulado} do início
                  </p>
                  {comparar && l.comparado !== null ? (
                    <p className="text-[11px] text-[#77776f]">período anterior: {l.comparado}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#ececE6]">
                <div
                  className={`h-full rounded-full ${l.destaque ? "bg-rose-500" : "bg-[#2563EB]"}`}
                  style={{ width: `${Math.max((l.pessoas / maxPessoas) * 100, 2)}%` }}
                />
              </div>
              {i > 0 && l.perda > 0 ? (
                <p className={`mt-2 flex items-center gap-1 text-[12px] ${l.destaque ? "text-rose-700" : "text-[#77776f]"}`}>
                  <ArrowDown className="h-3 w-3" />
                  {l.perda} {l.perda === 1 ? "pessoa saiu" : "pessoas saíram"} nesta passagem
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-[#ececE6] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-[#171715]">Pagou antes da conta de vendedor ficar pronta</h2>
        <p className="mb-3 text-[12px] text-[#8c8c87]">
          Quem assinou sem a conta do Mercado Livre liberada: quantos conseguiram ativar, em quanto tempo e quantos
          pediram dinheiro de volta.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pagaram sem conta apta", v: pagou.data?.pagaram ?? 0 },
            { label: "Conseguiram ativar", v: pagou.data?.ativaram ?? 0 },
            { label: "Tempo médio até ativar", v: pagou.data?.horas_medias != null ? `${pagou.data.horas_medias}h` : "—" },
            { label: "Pediram reembolso", v: pagou.data?.reembolsos ?? 0 },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-[#f1f1ee] bg-[#fbfbf9] p-3">
              <p className="text-[11px] text-[#8c8c87]">{k.label}</p>
              <p className="mt-1 text-[20px] font-semibold text-[#171715]">{k.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#ececE6] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-[#171715]">Erros por tipo</h2>
        <p className="mb-3 text-[12px] text-[#8c8c87]">O que está travando as pessoas, do mais frequente ao menos.</p>
        {erros.data?.length ? (
          <ul className="divide-y divide-[#f1f1ee]">
            {erros.data.map((e, i) => (
              <li key={`${e.tipo}-${e.motivo}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-[#171715]">{e.motivo}</p>
                  <p className="text-[11px] text-[#8c8c87]">{e.tipo}</p>
                </div>
                <p className="shrink-0 text-[13px] font-semibold text-[#171715]">
                  {e.ocorrencias}
                  <span className="ml-1 text-[11px] font-normal text-[#8c8c87]">({e.pessoas} pessoas)</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[#8c8c87]">Nenhum erro registrado no período.</p>
        )}
      </section>
    </div>
  );
};

export default AdminFunnelPanel;
