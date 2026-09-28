import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, RefreshCw } from "lucide-react";

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

const ROTULOS: Record<string, string> = {
  ml_nao_conectado: "Mercado Livre não conectado",
  conexao_expirada: "Conexão expirada ou desfeita",
  sem_perfil_vendedor: "Conectado, sem perfil de vendedor",
  apto_nunca_tentou: "Apto, nunca tentou publicar",
  erro_ao_publicar: "Tentou publicar e deu erro",
  desconhecido: "Motivo desconhecido",
};

const CORES: Record<string, string> = {
  ml_nao_conectado: "bg-[#fff1e6] text-[#9a4b00]",
  conexao_expirada: "bg-[#fdecec] text-[#9a1b1b]",
  sem_perfil_vendedor: "bg-[#fff8e1] text-[#8a6100]",
  apto_nunca_tentou: "bg-[#eaf5ff] text-[#11507f]",
  erro_ao_publicar: "bg-[#fdecec] text-[#9a1b1b]",
  desconhecido: "bg-[#f2f2ef] text-[#5c5c55]",
};

const PERIODOS = [7, 30, 90] as const;

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export default function AdminPaidNotPublishedPanel() {
  const [dias, setDias] = useState<number>(30);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("todos");

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

  const visiveis = useMemo(
    () => (filtro === "todos" ? linhas : linhas.filter((l) => l.categoria === filtro)),
    [linhas, filtro],
  );

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
        ROTULOS[l.categoria] ?? l.categoria,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-2xl border border-[#ececE6] bg-white p-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDias(p)}
              className={`rounded-xl px-3 py-1.5 text-[12px] font-medium transition ${
                dias === p ? "bg-[#171715] text-white" : "text-[#77776f] hover:bg-[#f6f6f3]"
              }`}
            >
              {p} dias
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={verificarAgora}
          disabled={verificando}
          className="inline-flex items-center gap-2 rounded-xl border border-[#ececE6] bg-white px-3 py-2 text-[12px] font-medium text-[#3d3d37] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${verificando ? "animate-spin" : ""}`} />
          Verificar contas agora
        </button>
        <button
          type="button"
          onClick={exportar}
          className="inline-flex items-center gap-2 rounded-xl bg-[#171715] px-3 py-2 text-[12px] font-medium text-white"
        >
          <Download className="h-4 w-4" />
          Baixar lista
        </button>
      </div>

      {aviso ? <p className="text-[12px] text-[#5c5c55]">{aviso}</p> : null}
      {erro ? <p className="text-[12px] text-[#9a1b1b]">{erro}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {resumo.map((r) => (
          <button
            key={r.categoria}
            type="button"
            onClick={() => setFiltro(filtro === r.categoria ? "todos" : r.categoria)}
            className={`rounded-2xl border p-3 text-left transition ${
              filtro === r.categoria ? "border-[#171715]" : "border-[#ececE6]"
            } bg-white`}
          >
            <p className="text-[12px] text-[#77776f]">{ROTULOS[r.categoria] ?? r.categoria}</p>
            <p className="mt-1 text-[22px] font-semibold text-[#171715]">{r.pessoas}</p>
            <p className="text-[11px] text-[#9a9a92]">
              {r.mediana_dias != null ? `parados há ${r.mediana_dias} dias (mediana)` : "sem tempo calculado"}
            </p>
          </button>
        ))}
        {!resumo.length && !carregando ? (
          <p className="text-[13px] text-[#77776f]">Ninguém pagou e ficou sem publicar neste período.</p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#ececE6] bg-white">
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="bg-[#fafaf7] text-[#77776f]">
            <tr>
              <th className="px-3 py-2 font-medium">Pessoa</th>
              <th className="px-3 py-2 font-medium">Contato</th>
              <th className="px-3 py-2 font-medium">Plano</th>
              <th className="px-3 py-2 font-medium">Pagou em</th>
              <th className="px-3 py-2 font-medium">Parado</th>
              <th className="px-3 py-2 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#9a9a92]">
                  Carregando…
                </td>
              </tr>
            ) : (
              visiveis.map((l) => (
                <tr key={l.user_id} className="border-t border-[#f1f1ec]">
                  <td className="px-3 py-2 text-[#171715]">{l.nome || "Sem nome"}</td>
                  <td className="px-3 py-2 text-[#5c5c55]">
                    {l.email || "—"}
                    {l.whatsapp ? <span className="block text-[11px] text-[#9a9a92]">{l.whatsapp}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-[#5c5c55]">{l.plano || "—"}</td>
                  <td className="px-3 py-2 text-[#5c5c55]">{dataCurta(l.pago_em)}</td>
                  <td className="px-3 py-2 text-[#5c5c55]">{Math.round(l.dias_parado)} dias</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-lg px-2 py-1 ${CORES[l.categoria] ?? CORES.desconhecido}`}>
                      {ROTULOS[l.categoria] ?? l.categoria}
                    </span>
                    {l.detalhe ? <span className="block pt-1 text-[11px] text-[#9a9a92]">{l.detalhe}</span> : null}
                  </td>
                </tr>
              ))
            )}
            {!carregando && !visiveis.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#9a9a92]">
                  Nenhuma pessoa nesta situação.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#9a9a92]">
        Uso interno de suporte. "Verificar contas agora" consulta o Mercado Livre com a conexão já autorizada pela
        pessoa e guarda se ela pode anunciar. Quem perdeu a conexão aparece como conexão expirada.
      </p>
    </div>
  );
}
