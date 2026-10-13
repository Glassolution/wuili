import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/20/solid";
import { supabase } from "@/integrations/supabase/client";

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

/** Etapas agrupadas pelo momento da jornada (números = `ordem` da RPC). */
const FASES = [
  { titulo: "Chegada", de: 1, ate: 3 },
  { titulo: "Primeiros passos na Velo", de: 4, ate: 7 },
  { titulo: "Mercado Livre e anúncio", de: 8, ate: 10 },
  { titulo: "Pagamento", de: 11, ate: 13 },
  { titulo: "Resultado", de: 14, ate: 15 },
];

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (a: number, base: number, casas = 0) =>
  `${((a / base) * 100).toFixed(casas).replace(".", ",")}%`;
const pctOuNada = (a: number, base: number) => (base >= BASE_MINIMA ? pct(a, base) : null);

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/* ------------------------------------------------------------------------ */
/* Peças                                                                    */
/* ------------------------------------------------------------------------ */

const Segmented = <T extends string | number | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div className="min-w-0">
    <p className="mb-1.5 text-[12.5px] text-[color:var(--ov-text-3)]">{label}</p>
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-[2px] rounded-[10px] bg-[color:var(--ov-surface)] p-[3px]">
      {options.map((o) => {
        const ativo = value === o.id;
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.id)}
            className={`h-7 whitespace-nowrap rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
              ativo
                ? "bg-[color:var(--ov-panel)] text-[color:var(--ov-text)] shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                : "text-[color:var(--ov-text-3)] hover:text-[color:var(--ov-text)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  </div>
);

const Card = ({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children: ReactNode }) => (
  <section className="ov-card px-5 pb-5 pt-5 sm:px-6">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium text-[color:var(--ov-text)]">{title}</h3>
        {hint ? <p className="mt-0.5 text-[13px] text-[color:var(--ov-text-3)]">{hint}</p> : null}
      </div>
      {right}
    </header>
    {children}
  </section>
);

const Stat = ({ label, value, sub, loading }: { label: string; value: string; sub?: ReactNode; loading?: boolean }) => (
  <div className="ov-stat">
    <p className="text-[13.5px] leading-5 text-[color:var(--ov-text-2)]">{label}</p>
    <div className="mt-2 text-[30px] font-medium leading-none tracking-[-0.03em] text-[color:var(--ov-text)] tabular-nums">
      {loading ? <span className="block h-8 w-20 animate-pulse rounded-md bg-[color:var(--ov-shimmer)]" /> : value}
    </div>
    {sub ? <p className="mt-2 text-[12.5px] leading-[18px] text-[color:var(--ov-text-3)]">{sub}</p> : null}
  </div>
);

/* ------------------------------------------------------------------------ */

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
    const calc = etapas.map((e, i) => {
      const pessoas = Number(e.pessoas);
      const naoPrecisava = Number(e.nao_precisava ?? 0);
      const avancaram = pessoas + naoPrecisava;
      const anteriorQtd =
        i === 0 ? avancaram : Number(etapas[i - 1].pessoas) + Number(etapas[i - 1].nao_precisava ?? 0);
      const perda = Math.max(anteriorQtd - avancaram, 0);
      return {
        ...e,
        pessoas,
        naoPrecisava,
        avancaram,
        anteriorQtd,
        perda,
        // acima de 100% só acontece quando a etapa anterior não foi bem registrada
        avanco: i === 0 || avancaram > anteriorQtd ? null : pctOuNada(avancaram, anteriorQtd),
        acumulado: pctOuNada(avancaram, inicio),
        comparado: antes.get(e.ordem) ?? null,
      };
    });
    /*
      Lacunas: etapa com menos gente do que a seguinte é impossível — significa que
      o registro daquela tela não está chegando. A perda que entra ou sai de uma
      lacuna não é confiável, então não disputa o destaque de "maior perda".
    */
    const lacuna = calc.map((l, i) => i < calc.length - 1 && l.avancaram < calc[i + 1].avancaram);
    const confiavel = (i: number) => i > 0 && !lacuna[i] && !lacuna[i - 1];
    const maiorPerda = Math.max(0, ...calc.filter((_, i) => confiavel(i)).map((l) => l.perda));
    return calc.map((l, i) => ({
      ...l,
      lacuna: lacuna[i],
      destaque: confiavel(i) && l.perda > 0 && l.perda >= maiorPerda * 0.6,
    }));
  }, [atual.data, anterior.data]);

  const lacunas = linhas.filter((l) => l.lacuna).length;

  const medicaoDesde = useMemo(() => {
    const datas = (atual.data ?? []).map((e) => e.medicao_desde).filter(Boolean) as string[];
    if (!datas.length) return null;
    return datas.sort().at(-1) ?? null;
  }, [atual.data]);

  const maxPessoas = Math.max(1, ...linhas.map((l) => l.avancaram));
  const etapa = (ordem: number) => linhas.find((l) => l.ordem === ordem);
  const baseCoorte = Number(etapa(3)?.pessoas ?? 0);

  /*
    Taxa principal da landing: contas criadas por quem passou pela página, sobre os
    visitantes. Não depende de quais botões existem na página, ao contrário do clique.
    A contagem de "pela página inicial" não aceita filtros, então com filtro ligado
    a divisão misturaria bases diferentes.
  */
  const visitantesLanding = Number(etapa(1)?.pessoas ?? 0);
  const semFiltros = device === null && origem === null && browser === null;
  const conversaoLanding =
    semFiltros && visitantesLanding >= BASE_MINIMA
      ? pct(Number(entrada.data?.via_landing ?? 0), visitantesLanding, 1)
      : null;

  const pagaram = Number(etapa(13)?.pessoas ?? 0);
  const publicaram = Number(etapa(15)?.pessoas ?? 0);
  const daCoorte = (n: number) =>
    baseCoorte >= BASE_MINIMA ? `${pct(n, baseCoorte, 1)} das contas novas` : "base pequena para porcentagem";

  const fases = useMemo(() => {
    const grupos = FASES.map((f) => ({ ...f, linhas: linhas.filter((l) => l.ordem >= f.de && l.ordem <= f.ate) }));
    const soltas = linhas.filter((l) => !FASES.some((f) => l.ordem >= f.de && l.ordem <= f.ate));
    if (soltas.length) grupos.push({ titulo: "Outras etapas", de: 0, ate: 0, linhas: soltas });
    return grupos.filter((g) => g.linhas.length);
  }, [linhas]);

  const totalEntrada = Number(entrada.data?.total ?? 0);
  const viaLanding = Number(entrada.data?.via_landing ?? 0);
  const direto = Number(entrada.data?.direto ?? 0);
  const loading = atual.isLoading;

  return (
    // data-admin-native: fica fora da normalização das páginas legadas, como o Painel
    <div className="space-y-4" data-admin-native>
      {/* cabeçalho e filtros */}
      <section className="ov-card px-5 pb-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="text-[17px] font-medium tracking-[-0.015em] text-[color:var(--ov-text)]">
              Do primeiro acesso ao anúncio publicado
            </h2>
            <p className="mt-1 text-[13.5px] leading-5 text-[color:var(--ov-text-3)]">
              Só entram pessoas que criaram conta nos últimos {days} dias e ainda não assinavam antes. Cada número é de
              pessoas diferentes, não de cliques.
              {medicaoDesde ? ` Registro completo das telas desde ${fmtData(medicaoDesde)}.` : ""}
            </p>
          </div>
          <Segmented<number>
            label="Período"
            value={days}
            options={PERIODOS.map((p) => ({ id: p, label: `${p} dias` }))}
            onChange={setDays}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-[color:var(--ov-divider)] pt-4">
          <Segmented<string | null> label="Origem" value={origem} options={ORIGENS} onChange={setOrigem} />
          <Segmented<string | null> label="Aparelho" value={device} options={DISPOSITIVOS} onChange={setDevice} />
          <Segmented<string | null> label="Navegador" value={browser} options={NAVEGADORES} onChange={setBrowser} />
          <button
            type="button"
            role="switch"
            aria-checked={comparar}
            onClick={() => setComparar((v) => !v)}
            className="ml-auto flex h-[34px] items-center gap-2.5 rounded-[10px] px-1 text-[13px] text-[color:var(--ov-text-2)]"
          >
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${
                comparar ? "bg-[color:var(--ov-accent)]" : "bg-[color:var(--ov-surface-hover)]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${comparar ? "left-[18px]" : "left-0.5"}`}
              />
            </span>
            Comparar com os {days} dias anteriores
          </button>
        </div>
      </section>

      {/* resumo: os quatro marcos da jornada */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Visitaram a página inicial"
          value={int(visitantesLanding)}
          loading={loading}
          sub={
            conversaoLanding
              ? `${conversaoLanding} desses visitantes criaram conta`
              : semFiltros
                ? "Base pequena para calcular conversão"
                : "Conversão só aparece sem filtros"
          }
        />
        <Stat
          label="Criaram conta"
          value={int(baseCoorte)}
          loading={loading}
          sub={totalEntrada ? `${int(viaLanding)} pela página inicial · ${int(direto)} direto no cadastro` : undefined}
        />
        <Stat label="Pagaram" value={int(pagaram)} loading={loading} sub={daCoorte(pagaram)} />
        <Stat label="Publicaram anúncio" value={int(publicaram)} loading={loading} sub={daCoorte(publicaram)} />
      </section>

      {baseCoorte > 0 && baseCoorte < BASE_MINIMA ? (
        <p className="flex items-start gap-2 rounded-xl bg-[color:var(--ov-surface)] px-4 py-3 text-[13px] text-[color:var(--ov-text-2)]">
          <InformationCircleIcon className="mt-[1px] h-4 w-4 shrink-0 text-[color:var(--ov-text-4)]" />
          Só {baseCoorte} pessoas novas no período: mostramos os números sem porcentagem — com tão pouca gente, qualquer
          taxa engana.
        </p>
      ) : null}

      {/* etapas */}
      <Card
        title="Etapa por etapa"
        hint="A barra mostra quanta gente chegou até ali. Em vermelho, as passagens onde mais gente desiste."
        right={
          lacunas ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--ov-warning-bg)] px-2.5 py-1 text-[12.5px] font-medium text-[color:var(--ov-warning)]">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              {lacunas} {lacunas === 1 ? "etapa com registro incompleto" : "etapas com registro incompleto"}
            </span>
          ) : null
        }
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="block h-11 animate-pulse rounded-lg bg-[color:var(--ov-shimmer)]" />
            ))}
          </div>
        ) : atual.isError ? (
          <p className="text-[13.5px] text-[color:var(--ov-danger)]">Não foi possível carregar o funil. Tente de novo em instantes.</p>
        ) : (
          <>
            {/* cabeçalho das colunas */}
            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_88px_150px] gap-4 px-3 pb-2 text-[12px] text-[color:var(--ov-text-4)] md:grid">
              <span>Etapa</span>
              <span />
              <span className="text-right">Pessoas</span>
              <span className="text-right">Da etapa anterior</span>
            </div>

            <div className="space-y-5">
              {fases.map((fase) => (
                <div key={fase.titulo}>
                  <p className="mb-1 px-3 text-[11.5px] font-medium uppercase tracking-[0.06em] text-[color:var(--ov-text-4)]">
                    {fase.titulo}
                  </p>
                  <ol className="divide-y divide-[color:var(--ov-divider)] overflow-hidden rounded-xl border border-[color:var(--ov-card-border)]">
                    {fase.linhas.map((l) => {
                      const lacuna = l.lacuna;
                      const cor = lacuna ? "var(--ov-warning)" : l.destaque ? "var(--ov-negative)" : "var(--ov-accent)";
                      const diff = l.comparado !== null ? l.pessoas - l.comparado : null;
                      return (
                        <li
                          key={l.ordem}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_88px_150px]"
                          style={l.destaque && !lacuna ? { background: "var(--ov-danger-bg)" } : undefined}
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-[13.5px] font-medium text-[color:var(--ov-text)]">
                              <span className="w-5 shrink-0 text-[12px] font-normal tabular-nums text-[color:var(--ov-text-4)]">
                                {l.ordem}
                              </span>
                              <span className="truncate">{l.etapa}</span>
                            </p>
                            <p className={`ml-7 text-[12px] text-[color:var(--ov-text-4)] ${lacuna ? "" : "truncate"}`} title={l.definicao}>
                              {lacuna ? (
                                <span className="text-[color:var(--ov-warning)]">
                                  Registro incompleto: aparece menos gente do que na etapa seguinte
                                </span>
                              ) : (
                                l.definicao
                              )}
                            </p>
                          </div>

                          {/* barra */}
                          <div className="col-span-2 row-start-2 h-2 overflow-hidden rounded-full bg-[color:var(--ov-surface)] md:col-span-1 md:row-start-auto">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max((l.avancaram / maxPessoas) * 100, 1.5)}%`, background: cor }}
                            />
                          </div>

                          <div className="text-right">
                            <p className="text-[17px] font-medium tabular-nums text-[color:var(--ov-text)]">{int(l.pessoas)}</p>
                            {l.naoPrecisava > 0 ? (
                              <p className="text-[11.5px] text-[color:var(--ov-text-4)]" title="Já tinham feito isso antes do período">
                                +{int(l.naoPrecisava)} já tinham
                              </p>
                            ) : null}
                            {comparar && l.comparado !== null && diff !== null ? (
                              <p className="text-[11.5px] tabular-nums text-[color:var(--ov-text-4)]">
                                antes {int(l.comparado)}{" "}
                                {diff !== 0 ? (
                                  <span style={{ color: diff > 0 ? "var(--ov-accent-text)" : "var(--ov-negative)" }}>
                                    {diff > 0 ? "↑" : "↓"}
                                  </span>
                                ) : null}
                              </p>
                            ) : null}
                          </div>

                          <div
                            className={`col-span-2 text-left text-[12.5px] tabular-nums md:col-span-1 md:block md:text-right ${
                              l.ordem === linhas[0]?.ordem || lacuna || l.avancaram > l.anteriorQtd ? "hidden" : ""
                            }`}
                          >
                            {l.ordem === linhas[0]?.ordem ? (
                              <span className="text-[color:var(--ov-text-4)]">início</span>
                            ) : lacuna || l.avancaram > l.anteriorQtd ? (
                              <span className="text-[color:var(--ov-text-4)]">—</span>
                            ) : (
                              <span className={l.destaque ? "font-medium text-[color:var(--ov-negative)]" : "text-[color:var(--ov-text-2)]"}>
                                {l.avanco ?? "—"}
                                {l.perda > 0 ? (
                                  <span className={l.destaque ? "" : "text-[color:var(--ov-text-4)]"}>
                                    {" "}· {int(l.perda)} {l.perda === 1 ? "saiu" : "saíram"}
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* por onde entraram */}
        <Card
          title="Por onde as contas novas entraram"
          hint="Quem vem de anúncio pode cair direto no cadastro, sem passar pela página inicial."
        >
          <div className="flex h-3 overflow-hidden rounded-full bg-[color:var(--ov-surface)]">
            {totalEntrada > 0 ? (
              <>
                <div style={{ width: `${(viaLanding / totalEntrada) * 100}%`, background: "var(--trk-visit)" }} />
                <div
                  className="border-l-2 border-[color:var(--ov-panel)]"
                  style={{ width: `${(direto / totalEntrada) * 100}%`, background: "var(--trk-login)" }}
                />
              </>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Contas novas", v: totalEntrada, cor: null },
              { label: "Pela página inicial", v: viaLanding, cor: "var(--trk-visit)" },
              { label: "Direto no cadastro", v: direto, cor: "var(--trk-login)" },
            ].map((k) => (
              <div key={k.label}>
                <dt className="flex items-center gap-1.5 text-[12.5px] text-[color:var(--ov-text-3)]">
                  {k.cor ? <span className="h-2 w-2 rounded-full" style={{ background: k.cor }} /> : null}
                  {k.label}
                </dt>
                <dd className="mt-1 text-[20px] font-medium tabular-nums text-[color:var(--ov-text)]">
                  {int(k.v)}
                  {k.cor && totalEntrada > 0 ? (
                    <span className="ml-1.5 text-[12.5px] font-normal text-[color:var(--ov-text-4)]">{pct(k.v, totalEntrada)}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* pagou antes de ligar o ML */}
        <Card
          title="Pagou antes de ligar o Mercado Livre"
          hint="Contas novas que assinaram sem a conta do Mercado Livre ligada."
        >
          <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
            {[
              { label: "Pagaram sem conta ligada", v: int(Number(pagou.data?.pagaram ?? 0)) },
              { label: "Ligaram depois", v: int(Number(pagou.data?.ativaram ?? 0)) },
              {
                label: "Tempo médio até ligar",
                v: pagou.data?.horas_medias != null ? `${String(pagou.data.horas_medias).replace(".", ",")} h` : "—",
              },
              { label: "Pediram reembolso", v: int(Number(pagou.data?.reembolsos ?? 0)) },
            ].map((k) => (
              <div key={k.label}>
                <dt className="text-[12.5px] leading-4 text-[color:var(--ov-text-3)]">{k.label}</dt>
                <dd className="mt-1.5 text-[20px] font-medium tabular-nums text-[color:var(--ov-text)]">{k.v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {/* erros */}
      <Card title="Erros que travam as pessoas" hint="Do mais frequente ao menos frequente, no período.">
        {erros.data?.length ? (
          <table className="w-full table-fixed text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] text-[color:var(--ov-text-4)]">
                <th className="pb-2 font-normal">Erro</th>
                <th className="w-20 pb-2 text-right font-normal">Vezes</th>
                <th className="w-24 pb-2 pl-4 text-right font-normal">Pessoas</th>
              </tr>
            </thead>
            <tbody>
              {erros.data.map((e, i) => (
                <tr key={`${e.tipo}-${e.motivo}-${i}`} className="border-t border-[color:var(--ov-divider)]">
                  <td className="py-2.5 pr-3">
                    <p className="truncate text-[color:var(--ov-text)]" title={e.motivo}>
                      {e.motivo}
                    </p>
                    <p className="text-[12px] text-[color:var(--ov-text-4)]">{e.tipo}</p>
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-[color:var(--ov-text)]">{int(Number(e.ocorrencias))}</td>
                  <td className="py-2.5 pl-4 text-right tabular-nums text-[color:var(--ov-text-2)]">{int(Number(e.pessoas))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13.5px] text-[color:var(--ov-text-3)]">Nenhum erro registrado no período.</p>
        )}
      </Card>
    </div>
  );
};

export default AdminFunnelPanel;
