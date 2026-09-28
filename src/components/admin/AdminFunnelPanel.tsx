import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ArrowDown, Info } from "lucide-react";

/*
  Funil POR COORTE: só pessoas que criaram conta dentro do período escolhido e
  que ainda não assinavam antes dele. Todas as etapas usam a mesma janela de
  tempo, para nunca comparar evento recente com tabela histórica.
*/

type EtapaRow = {
  ordem: number;
  etapa: string;
  definicao: string;
  pessoas: number;
  nao_precisava: number;
  medicao_desde: string | null;
};
type EntradaRow = { total: number; via_landing: number; direto: number };
type PagouRow = { pagaram: number; ativaram: number; horas_medias: number | null; reembolsos: number };
type ErroRow = { tipo: string; motivo: string; ocorrencias: number; pessoas: number };

const PERIODOS = [7, 14, 30, 90];
const BASE_MINIMA = 30; // abaixo disso não mostramos porcentagem
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

const pctOuNada = (a: number, base: number) =>
  base >= BASE_MINIMA ? `${Math.round((a / base) * 100)}%` : null;

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

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
    queryKey: ["admin-funil-coorte", days, origem, device, browser],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC nova ainda não tipada
      const { data, error } = await (supabase as any).rpc("rpc_admin_cohort_funnel", { ...args, p_offset_days: 0 });
      if (error) throw error;
      return (data ?? []) as EtapaRow[];
    },
  });

  const anterior = useQuery({
    enabled: comparar,
    queryKey: ["admin-funil-coorte-ant", days, origem, device, browser],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_cohort_funnel", { ...args, p_offset_days: days });
      if (error) throw error;
      return (data ?? []) as EtapaRow[];
    },
  });

  const entrada = useQuery({
    queryKey: ["admin-funil-entrada", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_cohort_entry", { p_days: days, p_offset_days: 0 });
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as EntradaRow | null;
    },
  });

  const pagou = useQuery({
    queryKey: ["admin-pagou-sem-vendedor-coorte", days],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
      const { data, error } = await (supabase as any).rpc("rpc_admin_paid_without_seller_cohort", { p_days: days });
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
      const naoPrecisava = Number(e.nao_precisava ?? 0);
      const avancaram = pessoas + naoPrecisava;
      const anteriorQtd =
        i === 0 ? avancaram : Number(etapas[i - 1].pessoas) + Number(etapas[i - 1].nao_precisava ?? 0);
      const perda = Math.max(anteriorQtd - avancaram, 0);
      if (i > 0 && perda > maiorPerda) maiorPerda = perda;
      return {
        ...e,
        pessoas,
        naoPrecisava,
        avancaram,
        perda,
        avanco: i === 0 ? null : pctOuNada(avancaram, anteriorQtd),
        acumulado: pctOuNada(avancaram, inicio),
        comparado: antes.get(e.ordem) ?? null,
      };
    });
    return calc.map((l, i) => ({ ...l, destaque: i > 0 && l.perda > 0 && l.perda >= maiorPerda * 0.6 }));
  }, [atual.data, anterior.data]);

  /*
    Lacunas: etapa com menos gente do que a seguinte é impossível — significa que
    o registro daquela tela não está chegando.
  */
  const lacunas = useMemo(
    () =>
      linhas
        .filter((l, i) => i < linhas.length - 1 && l.avancaram < Number(linhas[i + 1]?.avancaram ?? 0))
        .map((l) => l.etapa),
    [linhas],
  );

  const medicaoDesde = useMemo(() => {
    const datas = (atual.data ?? []).map((e) => e.medicao_desde).filter(Boolean) as string[];
    if (!datas.length) return null;
    return datas.sort().at(-1) ?? null;
  }, [atual.data]);

  const maxPessoas = Math.max(1, ...linhas.map((l) => l.avancaram));
  const baseCoorte = Number(linhas.find((l) => l.ordem === 3)?.pessoas ?? 0);

  /*
    Taxa principal da landing: contas criadas por quem passou pela página, sobre os
    visitantes. Não depende de quais botões existem na página, ao contrário do clique.
    A contagem de "pela página inicial" não aceita filtros, então com filtro ligado
    a divisão misturaria bases diferentes.
  */
  const visitantesLanding = Number(linhas.find((l) => l.ordem === 1)?.pessoas ?? 0);
  const semFiltros = device === null && origem === null && browser === null;
  const conversaoLanding =
    semFiltros && visitantesLanding >= BASE_MINIMA
      ? `${((Number(entrada.data?.via_landing ?? 0) / visitantesLanding) * 100).toFixed(1).replace(".", ",")}%`
      : null;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#ececE6] bg-white p-4">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Período</p>
            <Chips<number> value={days} options={PERIODOS.map((p) => ({ id: p, label: `${p} dias` }))} onChange={setDays} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Origem</p>
              <Chips<string | null> value={origem} options={ORIGENS} onChange={setOrigem} />
            </div>
            <div>
              <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Aparelho</p>
              <Chips<string | null> value={device} options={DISPOSITIVOS} onChange={setDevice} />
            </div>
            <div>
              <p className="mb-1 text-[12px] font-medium text-[#8c8c87]">Navegador</p>
              <Chips<string | null> value={browser} options={NAVEGADORES} onChange={setBrowser} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#44443f]">
            <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} />
            Comparar com os {days} dias anteriores
          </label>
        </div>
      </section>

      <div className="rounded-2xl border border-[#dbe6ff] bg-[#f3f7ff] p-4 text-[12px] leading-relaxed text-[#1e3a8a]">
        <p className="font-semibold">Como ler este funil</p>
        <p>
          Só entram pessoas que criaram conta nos últimos {days} dias e que ainda não assinavam antes disso. Clientes
          antigos ficam de fora. Medição confiável a partir de <strong>{fmtData(medicaoDesde)}</strong> — antes disso
          não havia registro dessas telas.
        </p>
      </div>

      <section className="rounded-2xl border border-[#ececE6] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-[#171715]">Por onde as pessoas entraram</h2>
        <p className="mb-3 text-[12px] text-[#8c8c87]">
          Nem todo mundo passa pela página inicial: quem vem de um anúncio pode cair direto no cadastro.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Contas novas", v: entrada.data?.total ?? 0 },
            { label: "Pela página inicial", v: entrada.data?.via_landing ?? 0 },
            { label: "Direto no cadastro", v: entrada.data?.direto ?? 0 },
            {
              label: "Visitantes da página que criaram conta",
              v: conversaoLanding ?? (semFiltros ? "base pequena" : "tire os filtros"),
            },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-[#f1f1ee] bg-[#fbfbf9] p-3">
              <p className="text-[11px] text-[#8c8c87]">{k.label}</p>
              <p className="mt-1 text-[20px] font-semibold text-[#171715]">{k.v}</p>
            </div>
          ))}
        </div>
      </section>

      {baseCoorte > 0 && baseCoorte < BASE_MINIMA ? (
        <div className="flex gap-2 rounded-2xl border border-[#ececE6] bg-[#fbfbf9] p-4 text-[13px] text-[#44443f]">
          <Info className="mt-[2px] h-4 w-4 shrink-0 text-[#8c8c87]" />
          <p>
            Base pequena: {baseCoorte} pessoas novas no período. Mostramos só os números, sem porcentagem — com tão
            pouca gente, qualquer taxa engana.
          </p>
        </div>
      ) : null}

      {lacunas.length ? (
        <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
          <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Medição possivelmente falhando</p>
            <p>
              Estas etapas mostram menos gente do que a etapa seguinte, o que é impossível — o registro dessas telas
              não está chegando direito: {lacunas.join(", ")}.
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
                    {l.definicao} · desde {fmtData(l.medicao_desde)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[20px] font-semibold tracking-[-0.02em] text-[#171715]">{l.pessoas}</p>
                  {l.naoPrecisava > 0 ? (
                    <p className="text-[11px] text-[#8c8c87]">+{l.naoPrecisava} não precisavam passar</p>
                  ) : null}
                  <p className="text-[11px] text-[#8c8c87]">
                    {l.avanco ? `${l.avanco} da etapa anterior · ` : ""}
                    {l.acumulado ? `${l.acumulado} do início` : "pessoas (base pequena)"}
                  </p>
                  {comparar && l.comparado !== null ? (
                    <p className="text-[11px] text-[#77776f]">período anterior: {l.comparado}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#ececE6]">
                <div
                  className={`h-full rounded-full ${l.destaque ? "bg-rose-500" : "bg-[#2563EB]"}`}
                  style={{ width: `${Math.max((l.avancaram / maxPessoas) * 100, 2)}%` }}
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
        <h2 className="text-[14px] font-semibold text-[#171715]">Pagou antes de ligar o Mercado Livre</h2>
        <p className="mb-3 text-[12px] text-[#8c8c87]">
          Dentro da mesma coorte: quem assinou sem a conta do Mercado Livre ligada, quantos conseguiram ligar depois,
          em quanto tempo e quantos pediram dinheiro de volta.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pagaram sem conta ligada", v: pagou.data?.pagaram ?? 0 },
            { label: "Conseguiram ligar depois", v: pagou.data?.ativaram ?? 0 },
            { label: "Tempo médio até ligar", v: pagou.data?.horas_medias != null ? `${pagou.data.horas_medias}h` : "—" },
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
