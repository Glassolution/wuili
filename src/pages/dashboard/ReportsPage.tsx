import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, X, Maximize2, Download, FileText, Plus, Loader2, ChevronRight } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type ReportSection = { title: string; content: string };
type SalesReport = {
  id: string;
  title: string;
  overall_score: number;
  scores: Record<string, number>;
  metrics: {
    revenue?: number;
    profit?: number;
    orders?: number;
    avg_ticket?: number;
    margin_pct?: number;
    publications_active?: number;
  };
  sections: ReportSection[];
  summary: string | null;
  created_at: string;
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const scoreColor = (n: number) =>
  n >= 8 ? "text-emerald-600" : n >= 6 ? "text-amber-600" : "text-rose-600";

const scoreBadge = (n: number) =>
  n >= 8
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : n >= 6
    ? "bg-amber-50 text-amber-700 border-amber-100"
    : "bg-rose-50 text-rose-700 border-rose-100";

// ── Page ─────────────────────────────────────────────────────────────────────
const ReportsPage = () => {
  const { user } = useAuth();
  const planLimits = usePlanLimits();
  const qc = useQueryClient();
  const [openReport, setOpenReport] = useState<SalesReport | null>(null);
  const [expanded, setExpanded] = useState(false);

  const { data: reports = [], isLoading } = useQuery<SalesReport[]>({
    queryKey: ["sales-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sales_reports")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SalesReport[];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-sales-report");
      if (error) throw error;
      return data.report as SalesReport;
    },
    onSuccess: (r) => {
      toast.success("Relatório criado com sucesso");
      qc.invalidateQueries({ queryKey: ["sales-reports", user?.id] });
      setOpenReport(r);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao gerar relatório"),
  });

  // ── Plan gate ─────────────────────────────────────────────────────────────
  if (!planLimits.loading && !planLimits.hasAdvancedReports) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-black px-3 py-1 text-[11px] font-normal uppercase tracking-[0.12em] text-white">
                Disponível no plano Pro
              </span>
              <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
                Relatórios avançados bloqueados
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
                Faça upgrade para gerar relatórios de vendas analisados por IA com base nos seus pedidos, publicações e desempenho no Mercado Livre.
              </p>
            </div>
            <Link
              to="/dashboard/planos"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-zinc-800"
            >
              Fazer upgrade
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-foreground">Relatórios</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Gere análises inteligentes das suas vendas com um clique.
          </p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {generate.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Criar relatório
            </>
          )}
        </button>
      </div>

      {/* List / empty */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
            <FileText className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="mt-4 text-[16px] font-semibold text-foreground">Nenhum relatório ainda</h3>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            Clique em <span className="font-medium text-foreground">Criar relatório</span> para gerar sua primeira análise inteligente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => { setOpenReport(r); setExpanded(false); }}
              className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-black">
                  <Sparkles className="h-3 w-3 text-white" fill="white" />
                </div>
                <span className="text-[12px] font-semibold text-zinc-800">Velo Insights</span>
              </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${scoreBadge(r.overall_score)}`}>
                  {Number(r.overall_score).toFixed(1)}
                </span>
              </div>
              <h3 className="mt-4 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                {r.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                {r.summary || "Análise de vendas do período."}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[12px] text-muted-foreground">
                <span>{new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <ChevronRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Report modal */}
      {openReport && (
        <ReportModal
          report={openReport}
          expanded={expanded}
          onExpand={() => setExpanded((v) => !v)}
          onClose={() => setOpenReport(null)}
        />
      )}
    </div>
  );
};

// ── Modal ────────────────────────────────────────────────────────────────────
const ReportModal = ({
  report, expanded, onExpand, onClose,
}: {
  report: SalesReport;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
}) => {
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className={`flex w-full overflow-hidden rounded-3xl bg-white shadow-2xl transition-all ${
          expanded ? "h-[95vh] max-w-[1400px]" : "h-[85vh] max-w-[1150px]"
        }`}
      >
        {/* Left — article */}
        <div className="flex flex-1 flex-col border-r border-zinc-100">
          <div className="flex items-center justify-between px-8 pt-6">
            <div className="flex items-center gap-2.5 text-[14px] font-semibold text-zinc-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black">
                <Sparkles className="h-3.5 w-3.5 text-white" fill="white" />
              </div>
              Velo Insights
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
              {report.title}
            </h1>
            {report.summary && (
              <p className="mt-4 text-[14px] leading-7 text-zinc-600">{report.summary}</p>
            )}
            <div className="mt-8 space-y-8">
              {report.sections.map((s, i) => (
                <section key={i}>
                  <h2 className="text-[15px] font-semibold text-foreground">{s.title}</h2>
                  <div className="mt-2 space-y-3 text-[13.5px] leading-7 text-zinc-700">
                    {s.content.split(/\n\n+/).map((p, j) => (
                      <p key={j} className="whitespace-pre-wrap">{p}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-8 py-4">
            <button
              onClick={downloadJson}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-3.5 w-3.5" /> Baixar
            </button>
          </div>
        </div>

        {/* Right — sidebar */}
        <aside className="flex w-[340px] flex-col bg-zinc-50/60">
          <div className="flex items-center justify-between px-6 pt-6">
            <h3 className="text-[14px] font-semibold text-foreground">Análise do relatório</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={onExpand}
                className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white hover:text-foreground"
                aria-label="Expandir"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
            {/* Overall score */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-300 via-sky-300 to-emerald-300" />
                  <span className="text-[13px] font-medium text-zinc-700">Score geral</span>
                </div>
                <span className={`text-[20px] font-semibold ${scoreColor(report.overall_score)}`}>
                  {Number(report.overall_score).toFixed(2)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { k: "vendas", label: "Vendas" },
                  { k: "produtos", label: "Produtos" },
                  { k: "mercado_livre", label: "ML" },
                ].map(({ k, label }) => {
                  const n = Number(report.scores?.[k] ?? 0);
                  return (
                    <div key={k} className="rounded-xl bg-zinc-50 p-2 text-center">
                      <div className={`text-[15px] font-semibold ${scoreColor(n)}`}>{n.toFixed(2)}</div>
                      <div className="mt-0.5 text-[10.5px] uppercase tracking-wider text-zinc-500">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section list */}
            <div className="mt-4 space-y-2">
              {report.sections.map((s, i) => {
                // Attach one of the scores as small badge cycling
                const keys = ["vendas", "produtos", "mercado_livre", "oportunidades"];
                const badgeVal = Number(report.scores?.[keys[i % keys.length]] ?? 0);
                const showBadge = badgeVal > 0 && badgeVal < 7;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      <span className="text-[12.5px] font-medium text-zinc-700">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {showBadge && (
                        <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-600">
                          {Math.round(10 - badgeVal)}
                        </span>
                      )}
                      <Maximize2 className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Metrics */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                Métricas do período
              </h4>
              <dl className="mt-3 space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Receita</dt>
                  <dd className="font-semibold text-foreground">{fmt(report.metrics.revenue ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Lucro</dt>
                  <dd className="font-semibold text-foreground">{fmt(report.metrics.profit ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Pedidos</dt>
                  <dd className="font-semibold text-foreground">{report.metrics.orders ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Ticket médio</dt>
                  <dd className="font-semibold text-foreground">{fmt(report.metrics.avg_ticket ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Margem</dt>
                  <dd className="font-semibold text-foreground">{(report.metrics.margin_pct ?? 0).toFixed(1)}%</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-500">Anúncios ativos</dt>
                  <dd className="font-semibold text-foreground">{report.metrics.publications_active ?? 0}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
};

export default ReportsPage;
