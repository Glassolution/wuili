import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, Trash2, CheckCircle2, XCircle, Loader2, Link2, Power } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";

type Mapping = {
  id: string;
  velo_category: string;
  aliexpress_category_id: string;
  aliexpress_category_name: string | null;
  active: boolean;
};

type SyncLog = {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: string;
  triggered_by: string;
  categories_processed: number;
  products_new: number;
  products_updated: number;
  products_dropped_from_top: number;
  error_count: number;
  error_message: string | null;
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

export default function AdminAliExpressPage() {
  const { user } = useAuth();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [cronActive, setCronActive] = useState<boolean | null>(null);
  const [togglingCron, setTogglingCron] = useState(false);
  const [form, setForm] = useState({ velo_category: "", aliexpress_category_id: "", aliexpress_category_name: "" });

  const lastLog = useMemo(() => logs[0] ?? null, [logs]);

  const load = async () => {
    setLoading(true);
    const [m, l, p, c] = await Promise.all([
      supabase.from("category_mapping").select("*").order("velo_category"),
      supabase.from("aliexpress_sync_log").select("*").order("started_at", { ascending: false }).limit(10),
      user?.id
        ? supabase.from("profiles").select("aliexpress_access_token").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      (supabase.rpc as any)("get_aliexpress_cron_status"),
    ]);
    if (m.data) setMappings(m.data as Mapping[]);
    if (l.data) setLogs(l.data as SyncLog[]);
    setIsConnected(Boolean((p as any)?.data?.aliexpress_access_token));
    const row = Array.isArray((c as any)?.data) ? (c as any).data[0] : null;
    setCronActive(row ? Boolean(row.active) : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const connectAliExpress = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("aliexpress-connect");
      if (error) throw error;
      const authUrl = (data as any)?.authUrl || (data as any)?.auth_url || (data as any)?.url;
      if (!authUrl) throw new Error("URL de autorização não retornada");
      window.location.href = authUrl;
    } catch (err) {
      veloToast.error(err instanceof Error ? err.message : "Falha ao iniciar conexão");
      setConnecting(false);
    }
  };

  const addMapping = async () => {
    if (!form.velo_category.trim() || !form.aliexpress_category_id.trim()) {
      veloToast.error("Preencha categoria Velo e ID AliExpress");
      return;
    }
    const { error } = await supabase.from("category_mapping").insert({
      velo_category: form.velo_category.trim().toLowerCase(),
      aliexpress_category_id: form.aliexpress_category_id.trim(),
      aliexpress_category_name: form.aliexpress_category_name.trim() || null,
    });
    if (error) {
      veloToast.error(error.message);
      return;
    }
    veloToast.success("Mapeamento adicionado");
    setForm({ velo_category: "", aliexpress_category_id: "", aliexpress_category_name: "" });
    load();
  };

  const toggleActive = async (m: Mapping) => {
    const { error } = await supabase
      .from("category_mapping")
      .update({ active: !m.active })
      .eq("id", m.id);
    if (error) return veloToast.error(error.message);
    load();
  };

  const removeMapping = async (id: string) => {
    if (!confirm("Remover este mapeamento?")) return;
    const { error } = await supabase.from("category_mapping").delete().eq("id", id);
    if (error) return veloToast.error(error.message);
    veloToast.success("Removido");
    load();
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("aliexpress-sync-top-products", {
        body: { triggered_by: "manual" },
      });
      if (error) throw error;
      veloToast.success(
        `Sincronização concluída: ${data?.products_new ?? 0} novos, ${data?.products_updated ?? 0} atualizados`,
      );
      load();
    } catch (err) {
      veloToast.error(err instanceof Error ? err.message : "Falha na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AdminShell active="settings" userId={user?.id ?? ""}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Sincronização AliExpress</h1>
            <p className="mt-1 text-sm text-white/60">
              Mapeamento de categorias e status da sincronização automática (a cada 6h).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isConnected === false && (
              <button
                onClick={connectAliExpress}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {connecting ? "Conectando..." : "Conectar AliExpress"}
              </button>
            )}
            <button
              onClick={syncNow}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </button>
          </div>
        </header>

        {/* Status card */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard label="Última execução" value={fmtDate(lastLog?.started_at ?? null)} />
          <StatusCard
            label="Status"
            value={lastLog ? lastLog.status : "—"}
            tone={lastLog?.status === "success" ? "ok" : lastLog?.status === "failed" ? "err" : "neutral"}
          />
          <StatusCard label="Novos / Atualizados" value={`${lastLog?.products_new ?? 0} / ${lastLog?.products_updated ?? 0}`} />
          <StatusCard label="Saíram do top 50" value={String(lastLog?.products_dropped_from_top ?? 0)} />
        </section>

        {/* Mapeamentos */}
        <section className="rounded-xl border border-white/10 bg-[#161617] p-5">
          <h2 className="text-lg font-bold text-white">Mapeamento de categorias</h2>
          <p className="mt-1 text-xs text-white/60">Vincule cada categoria da Velo a uma categoria da AliExpress.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              placeholder="Categoria Velo (ex: eletronicos)"
              value={form.velo_category}
              onChange={(e) => setForm({ ...form, velo_category: e.target.value })}
              className="rounded-lg border border-white/10 bg-[#161617] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
            />
            <input
              placeholder="AliExpress category_id"
              value={form.aliexpress_category_id}
              onChange={(e) => setForm({ ...form, aliexpress_category_id: e.target.value })}
              className="rounded-lg border border-white/10 bg-[#161617] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
            />
            <input
              placeholder="Nome (opcional)"
              value={form.aliexpress_category_name}
              onChange={(e) => setForm({ ...form, aliexpress_category_name: e.target.value })}
              className="rounded-lg border border-white/10 bg-[#161617] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
            />
            <button
              onClick={addMapping}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              <Plus size={16} />
              Adicionar
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
                <tr>
                  <th className="px-3 py-2">Velo</th>
                  <th className="px-3 py-2">AliExpress ID</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="text-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-white/50">
                      Carregando...
                    </td>
                  </tr>
                ) : mappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-white/50">
                      Nenhum mapeamento cadastrado.
                    </td>
                  </tr>
                ) : (
                  mappings.map((m) => (
                    <tr key={m.id} className="border-t border-white/10">
                      <td className="px-3 py-2 font-medium">{m.velo_category}</td>
                      <td className="px-3 py-2 font-mono text-xs text-white/80">{m.aliexpress_category_id}</td>
                      <td className="px-3 py-2 text-white/70">{m.aliexpress_category_name || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleActive(m)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            m.active ? "bg-green-500/15 text-green-300" : "bg-white/10 text-white/60"
                          }`}
                        >
                          {m.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {m.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => removeMapping(m.id)}
                          className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                          aria-label="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Histórico */}
        <section className="rounded-xl border border-white/10 bg-[#161617] p-5">
          <h2 className="text-lg font-bold text-white">Últimas execuções</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
                <tr>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Trigger</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Categorias</th>
                  <th className="px-3 py-2">Novos</th>
                  <th className="px-3 py-2">Atualizados</th>
                  <th className="px-3 py-2">Saíram</th>
                  <th className="px-3 py-2">Erros</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-white/50">
                      Sem execuções ainda.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-t border-white/10">
                      <td className="px-3 py-2 text-white/80">{fmtDate(l.started_at)}</td>
                      <td className="px-3 py-2 text-white/70">{l.triggered_by}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            l.status === "success"
                              ? "bg-green-500/15 text-green-300"
                              : l.status === "failed"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-white/10 text-white/60"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{l.categories_processed}</td>
                      <td className="px-3 py-2 text-green-300">{l.products_new}</td>
                      <td className="px-3 py-2">{l.products_updated}</td>
                      <td className="px-3 py-2 text-white/70">{l.products_dropped_from_top}</td>
                      <td className="px-3 py-2 text-red-300" title={l.error_message ?? ""}>
                        {l.error_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {lastLog?.error_message ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <strong>Erros na última rodada:</strong> {lastLog.error_message}
            </p>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}

const StatusCard = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "err" | "neutral";
}) => {
  const toneCls =
    tone === "ok"
      ? "text-green-300"
      : tone === "err"
        ? "text-red-300"
        : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-[#161617] p-4">
      <p className="text-xs uppercase tracking-wider text-white/50">{label}</p>
      <p className={`mt-2 text-lg font-bold ${toneCls}`}>{value}</p>
    </div>
  );
};
