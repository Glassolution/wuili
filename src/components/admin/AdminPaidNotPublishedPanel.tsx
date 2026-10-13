import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { supabase } from "@/integrations/supabase/client";

/**
 * Painel interno de suporte: quem pagou e ainda não publicou, com o motivo
 * provável, há quanto tempo está parado e contato para a equipe falar com a
 * pessoa. Dados vêm de RPCs que só respondem para administradores.
 */

type Linha = {
  user_id: string;
  nome: string | null;
  email: string | null;
  whatsapp: string | null;
  plano: string | null;
  pago_em: string;
  dias_parado: number;
  categoria: string;
  detalhe: string | null;
  apto: boolean | null;
  conectado_em: string | null;
  ultima_verificacao: string | null;
};

type Resumo = { categoria: string; pessoas: number; mediana_dias: number | null };

type Tom = "perigo" | "atencao" | "acao" | "neutro";

/** Rótulo, gravidade e o que o suporte deve fazer em cada motivo. */
const MOTIVOS: Record<string, { rotulo: string; tom: Tom; acao: string }> = {
  conexao_expirada: {
    rotulo: "Conexão expirada ou desfeita",
    tom: "perigo",
    acao: "Pedir para reconectar o Mercado Livre.",
  },
  erro_ao_publicar: {
    rotulo: "Tentou publicar e deu erro",
    tom: "perigo",
    acao: "Ver o erro e ajudar a corrigir o anúncio.",
  },
  ml_nao_conectado: {
    rotulo: "Mercado Livre não conectado",
    tom: "atencao",
    acao: "Ajudar a conectar a conta do Mercado Livre.",
  },
  sem_perfil_vendedor: {
    rotulo: "Conectado, sem perfil de vendedor",
    tom: "atencao",
    acao: "Orientar a completar o cadastro de vendedor no Mercado Livre.",
  },
  apto_nunca_tentou: {
    rotulo: "Apto, nunca tentou publicar",
    tom: "acao",
    acao: "Mostrar como publicar o primeiro produto.",
  },
  desconhecido: {
    rotulo: "Motivo desconhecido",
    tom: "neutro",
    acao: "Entrar em contato para entender o que travou.",
  },
};
const ORDEM = Object.keys(MOTIVOS);
const motivo = (categoria: string) => MOTIVOS[categoria] ?? { ...MOTIVOS.desconhecido, rotulo: categoria };

const TONS: Record<Tom, { cor: string; fundo: string }> = {
  perigo: { cor: "var(--ov-danger)", fundo: "var(--ov-danger-bg)" },
  atencao: { cor: "var(--ov-warning)", fundo: "var(--ov-warning-bg)" },
  acao: { cor: "var(--ov-accent-text)", fundo: "var(--ov-accent-soft)" },
  neutro: { cor: "var(--ov-text-3)", fundo: "var(--ov-surface)" },
};

const PERIODOS = [7, 30, 90] as const;

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const diasTexto = (n: number) => (Math.round(n) === 1 ? "1 dia" : `${int(n)} dias`);

/** Link do WhatsApp: números brasileiros sem DDI ganham o 55. */
const linkWhatsapp = (numero: string) => {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`;
};

const Badge = ({ categoria }: { categoria: string }) => {
  const m = motivo(categoria);
  const t = TONS[m.tom];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-medium"
      style={{ color: t.cor, background: t.fundo }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.cor }} aria-hidden="true" />
      {m.rotulo}
    </span>
  );
};

export default function AdminPaidNotPublishedPanel() {
  const [dias, setDias] = useState<number>(30);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPCs novas ainda não tipadas
    const client = supabase as any;
    const [l, r] = await Promise.all([
      client.rpc("rpc_admin_paid_not_published", { p_days: dias }),
      client.rpc("rpc_admin_paid_not_published_summary", { p_days: dias }),
    ]);
    if (l.error || r.error) setErro(l.error?.message ?? r.error?.message ?? "Falha ao carregar");
    setLinhas((l.data ?? []) as Linha[]);
    setResumo((r.data ?? []) as Resumo[]);
    setCarregando(false);
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const verificarAgora = async () => {
    setVerificando(true);
    setAviso(null);
    const { data, error } = await supabase.functions.invoke("ml-seller-readiness-refresh");
    setVerificando(false);
    if (error) {
      setAviso("Não foi possível verificar agora. Tente de novo em alguns minutos.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta simples da função
    const d = data as any;
    setAviso(
      `Verificamos ${d?.verificados ?? 0} contas: ${d?.aptos ?? 0} podem anunciar, ${d?.bloqueados ?? 0} bloqueadas, ${d?.semResposta ?? 0} sem resposta.`,
    );
    void carregar();
  };

  // categorias na ordem de gravidade, as desconhecidas no fim
  const categorias = useMemo(
    () =>
      resumo
        .slice()
        .sort((a, b) => (ORDEM.indexOf(a.categoria) + 1 || 99) - (ORDEM.indexOf(b.categoria) + 1 || 99)),
    [resumo],
  );
  const total = categorias.reduce((acc, r) => acc + Number(r.pessoas), 0);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas
      .filter((l) => filtro === "todos" || l.categoria === filtro)
      .filter(
        (l) =>
          !termo ||
          [l.nome, l.email, l.whatsapp].some((v) => (v ?? "").toLowerCase().includes(termo)),
      )
      .sort((a, b) => b.dias_parado - a.dias_parado);
  }, [linhas, filtro, busca]);

  const exportar = () => {
    const cab = ["nome", "email", "whatsapp", "plano", "pago_em", "dias_parado", "motivo", "detalhe"];
    const corpo = visiveis.map((l) =>
      [
        l.nome ?? "",
        l.email ?? "",
        l.whatsapp ?? "",
        l.plano ?? "",
        l.pago_em,
        String(l.dias_parado),
        motivo(l.categoria).rotulo,
        l.detalhe ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[cab.join(","), ...corpo].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagou-sem-publicar-${dias}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    // data-admin-native: fica fora da normalização das páginas legadas, como o Painel
    <div className="space-y-4" data-admin-native>
      {/* cabeçalho */}
      <section className="ov-card px-5 pb-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="text-[17px] font-medium tracking-[-0.015em] text-[color:var(--ov-text)]">
              Pagou e ainda não publicou
            </h2>
            <p className="mt-1 text-[13.5px] leading-5 text-[color:var(--ov-text-3)]">
              Assinantes que pagaram nos últimos {dias} dias e ainda não têm anúncio no Mercado Livre, com o motivo
              provável e o contato para o suporte chamar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Período" className="inline-flex gap-[2px] rounded-[10px] bg-[color:var(--ov-surface)] p-[3px]">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={dias === p}
                  onClick={() => setDias(p)}
                  className={`h-7 whitespace-nowrap rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
                    dias === p
                      ? "bg-[color:var(--ov-panel)] text-[color:var(--ov-text)] shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                      : "text-[color:var(--ov-text-3)] hover:text-[color:var(--ov-text)]"
                  }`}
                >
                  {p} dias
                </button>
              ))}
            </div>
            <button type="button" onClick={verificarAgora} disabled={verificando} className="ov-chip-filled disabled:opacity-60">
              <ArrowPathIcon aria-hidden="true" className={verificando ? "animate-spin" : ""} />
              {verificando ? "Verificando…" : "Verificar contas agora"}
            </button>
          </div>
        </div>

        {aviso ? (
          <p className="mt-4 rounded-xl bg-[color:var(--ov-surface)] px-4 py-3 text-[13px] text-[color:var(--ov-text-2)]">{aviso}</p>
        ) : null}
        {erro ? (
          <p className="mt-4 rounded-xl bg-[color:var(--ov-danger-bg)] px-4 py-3 text-[13px] text-[color:var(--ov-danger)]">
            Não foi possível carregar a lista: {erro}
          </p>
        ) : null}

        {/* total e distribuição por motivo */}
        <div className="mt-5 border-t border-[color:var(--ov-divider)] pt-5">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-[40px] font-medium leading-none tracking-[-0.035em] text-[color:var(--ov-text)] tabular-nums">
              {carregando ? "—" : int(total)}
            </span>
            <span className="pb-1 text-[14px] text-[color:var(--ov-text-2)]">
              {total === 1 ? "pessoa pagou e está sem anúncio" : "pessoas pagaram e estão sem anúncio"}
            </span>
          </div>
          {total > 0 ? (
            <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
              {categorias.map((r) => (
                <div
                  key={r.categoria}
                  style={{ width: `${(Number(r.pessoas) / total) * 100}%`, background: TONS[motivo(r.categoria).tom].cor }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* motivos: cada cartão filtra a lista */}
      {categorias.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categorias.map((r) => {
            const m = motivo(r.categoria);
            const t = TONS[m.tom];
            const ativo = filtro === r.categoria;
            return (
              <button
                key={r.categoria}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(ativo ? "todos" : r.categoria)}
                className="ov-stat text-left transition-shadow"
                style={ativo ? { boxShadow: `0 0 0 2px ${t.cor}`, borderColor: "transparent" } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.cor }} aria-hidden="true" />
                  <p className="text-[14px] leading-5 text-[color:var(--ov-text-2)]">{m.rotulo}</p>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[30px] font-medium leading-none tracking-[-0.03em] text-[color:var(--ov-text)] tabular-nums">
                    {int(Number(r.pessoas))}
                  </span>
                  {total > 0 ? (
                    <span className="text-[13px] text-[color:var(--ov-text-4)] tabular-nums">
                      {Math.round((Number(r.pessoas) / total) * 100)}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[12.5px] text-[color:var(--ov-text-3)]">
                  {r.mediana_dias != null ? `Parados há ${diasTexto(Number(r.mediana_dias))}, em geral` : "Sem tempo calculado"}
                </p>
                <p className="mt-3 border-t border-[color:var(--ov-divider)] pt-3 text-[12.5px] leading-[18px] text-[color:var(--ov-text-2)]">
                  <span className="font-medium">O que fazer:</span> {m.acao}
                </p>
              </button>
            );
          })}
        </section>
      ) : null}

      {/* lista */}
      <section className="ov-card px-5 pb-3 pt-5 sm:px-6">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-medium text-[color:var(--ov-text)]">
              {carregando ? "Pessoas" : `${int(visiveis.length)} ${visiveis.length === 1 ? "pessoa" : "pessoas"}`}
            </h3>
            {filtro !== "todos" ? (
              <button
                type="button"
                onClick={() => setFiltro("todos")}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--ov-surface)] py-1 pl-2.5 pr-2 text-[12.5px] text-[color:var(--ov-text-2)] hover:bg-[color:var(--ov-surface-hover)]"
              >
                {motivo(filtro).rotulo}
                <XMarkIcon className="h-3.5 w-3.5" aria-label="Tirar filtro" />
              </button>
            ) : (
              <span className="text-[12.5px] text-[color:var(--ov-text-4)]">quem está parado há mais tempo primeiro</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Buscar por nome, e-mail ou WhatsApp</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ov-text-4)]" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome, e-mail…"
                className="h-[34px] w-[220px] rounded-[10px] border border-[color:var(--ov-input-border)] bg-[color:var(--ov-input)] pl-8 pr-3 text-[13px] text-[color:var(--ov-text)] outline-none placeholder:text-[color:var(--ov-text-4)] focus:border-[color:var(--ov-accent)]"
              />
            </label>
            <button
              type="button"
              onClick={exportar}
              disabled={!visiveis.length}
              className="inline-flex h-[34px] items-center gap-2 rounded-[10px] bg-[color:var(--ov-accent)] px-3 text-[13px] font-medium text-white hover:bg-[color:var(--ov-accent-hover)] disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
              Baixar lista
            </button>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13.5px]">
            <thead>
              <tr className="text-[12.5px] text-[color:var(--ov-text-4)]">
                <th className="py-2 pr-3 font-normal">Pessoa</th>
                <th className="py-2 pr-3 font-normal">WhatsApp</th>
                <th className="py-2 pr-3 font-normal">Plano</th>
                <th className="py-2 pr-3 font-normal">Pagou em</th>
                <th className="py-2 pr-3 text-right font-normal">Parado há</th>
                <th className="py-2 pl-3 font-normal">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-t border-[color:var(--ov-divider)]">
                    <td colSpan={6} className="py-3">
                      <span className="block h-5 animate-pulse rounded-md bg-[color:var(--ov-shimmer)]" />
                    </td>
                  </tr>
                ))
              ) : visiveis.length ? (
                visiveis.map((l) => {
                  const wa = l.whatsapp ? linkWhatsapp(l.whatsapp) : null;
                  const parado = Math.round(l.dias_parado);
                  return (
                    <tr key={l.user_id} className="border-t border-[color:var(--ov-divider)] align-top">
                      <td className="max-w-[260px] py-3 pr-3">
                        <p className="truncate font-medium text-[color:var(--ov-text)]">{l.nome || "Sem nome"}</p>
                        <p className="truncate text-[12.5px] text-[color:var(--ov-text-3)]">{l.email || "sem e-mail"}</p>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3">
                        {l.whatsapp ? (
                          wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[color:var(--ov-accent-text)] hover:underline"
                              title="Abrir conversa no WhatsApp"
                            >
                              {l.whatsapp}
                            </a>
                          ) : (
                            <span className="text-[color:var(--ov-text-2)]">{l.whatsapp}</span>
                          )
                        ) : (
                          <span className="text-[color:var(--ov-text-4)]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 capitalize text-[color:var(--ov-text-2)]">{l.plano || "—"}</td>
                      <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-[color:var(--ov-text-2)]">{dataCurta(l.pago_em)}</td>
                      <td className="whitespace-nowrap py-3 pr-3 text-right tabular-nums">
                        <span
                          className={parado >= 7 ? "font-medium" : ""}
                          style={{ color: parado >= 7 ? "var(--ov-danger)" : "var(--ov-text-2)" }}
                        >
                          {diasTexto(parado)}
                        </span>
                      </td>
                      <td className="py-3 pl-3">
                        <Badge categoria={l.categoria} />
                        {l.detalhe ? (
                          <p className="mt-1 max-w-[320px] text-[12px] leading-4 text-[color:var(--ov-text-4)]">{l.detalhe}</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-[color:var(--ov-divider)]">
                  <td colSpan={6} className="py-8 text-center text-[color:var(--ov-text-3)]">
                    {busca.trim()
                      ? "Ninguém encontrado com essa busca."
                      : total === 0
                        ? "Ninguém pagou e ficou sem publicar neste período."
                        : "Nenhuma pessoa nesta situação."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="px-1 text-[12px] leading-[18px] text-[color:var(--ov-text-4)]">
        Uso interno de suporte. "Verificar contas agora" consulta o Mercado Livre com a conexão já autorizada pela pessoa
        e guarda se ela pode anunciar. Quem perdeu a conexão aparece como conexão expirada. Em vermelho, quem está parado
        há 7 dias ou mais.
      </p>
    </div>
  );
}
