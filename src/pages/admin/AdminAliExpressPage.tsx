import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, Trash2, CheckCircle2, XCircle, Loader2, Link2, Power } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminKPIStat } from "@/components/admin/AdminPrimitives";
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

type AliExpressConnectResponse = {
  authUrl?: string;
  auth_url?: string;
  url?: string;
};

type AliExpressProfileConnection = {
  aliexpress_access_token?: string | null;
};

type CronStatusRow = {
  active?: boolean | null;
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
      supabase.rpc("get_aliexpress_cron_status" as never),
    ]);
    if (m.data) setMappings(m.data as Mapping[]);
    if (l.data) setLogs(l.data as SyncLog[]);
    const profileConnection = p.data as AliExpressProfileConnection | null;
    const cronRows = c.data as unknown;
    setIsConnected(Boolean(profileConnection?.aliexpress_access_token));
    const row = Array.isArray(cronRows) ? cronRows[0] as CronStatusRow | undefined : null;
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
      const connection = data as AliExpressConnectResponse | null;
      const authUrl = connection?.authUrl || connection?.auth_url || connection?.url;
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

  const toggleCron = async () => {
    if (cronActive === null) return;
    const next = !cronActive;
    if (!confirm(next ? "Reativar o cron do AliExpress (executa a cada 6h)?" : "Desligar o cron do AliExpress? Nenhuma sincronização automática vai rodar até você reativar.")) return;
    setTogglingCron(true);
    try {
      const { error } = await supabase.rpc("set_aliexpress_cron_active" as never, { p_active: next } as never);
      if (error) throw error;
      setCronActive(next);
      veloToast.success(next ? "Cron reativado" : "Cron desligado");
    } catch (err) {
      veloToast.error(err instanceof Error ? err.message : "Falha ao alterar cron");
    } finally {
      setTogglingCron(false);
    }
  };

  return (
    <AdminShell
      active="settings"
      userId={user?.id ?? ""}
      title="Sincronização AliExpress"
      subtitle="Mapeamento de categorias e status da sincronização automática (a cada 6h)."
      actions={
        <>
          {isConnected === false && (
            <button
              onClick={connectAliExpress}
              disabled={connecting}
              className="admin-pill inline-flex items-center disabled:opacity-60"
            >
              {connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              {connecting ? "Conectando..." : "Conectar AliExpress"}
            </button>
          )}
          <button
            onClick={toggleCron}
            disabled={togglingCron || cronActive === null}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
              cronActive
                ? "bg-[#fcecee] text-[#c85c6d] hover:bg-[#f8dce1]"
                : "bg-[#eaf8f0] text-[#1c9a61] hover:bg-[#dcf3e6]"
            }`}
            title={cronActive ? "Desligar sincronização automática (6h)" : "Reativar sincronização automática (6h)"}
          >
            {togglingCron ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            {cronActive === null ? "Cron —" : cronActive ? "Desligar cron" : "Ligar cron"}
          </button>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="admin-control inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold disabled:opacity-60"
          >
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </>
      }
    >
      <div className="space-y-6">

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
        <section className="admin-card p-4">
          <h2 className="text-lg font-semibold text-[#1c1918]">Mapeamento de categorias</h2>
          <p className="mt-1 text-xs text-[#827a75]">Vincule cada categoria da Velo a uma categoria da AliExpress.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              placeholder="Categoria Velo (ex: eletronicos)"
              value={form.velo_category}
              onChange={(e) => setForm({ ...form, velo_category: e.target.value })}
              className="admin-control h-8 px-2.5 text-[12px] outline-none placeholder:text-[#aaa19b]"
            />
            <input
              placeholder="AliExpress category_id"
              value={form.aliexpress_category_id}
              onChange={(e) => setForm({ ...form, aliexpress_category_id: e.target.value })}
              className="admin-control h-8 px-2.5 text-[12px] outline-none placeholder:text-[#aaa19b]"
            />
            <input
              placeholder="Nome (opcional)"
              value={form.aliexpress_category_name}
              onChange={(e) => setForm({ ...form, aliexpress_category_name: e.target.value })}
              className="admin-control h-8 px-2.5 text-[12px] outline-none placeholder:text-[#aaa19b]"
            />
            <button
              onClick={addMapping}
              className="admin-btn-primary inline-flex items-center justify-center"
            >
              <Plus size={16} />
              Adicionar
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-[10px] border">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[#827a75]">
                <tr>
                  <th className="px-3 py-2">Velo</th>
                  <th className="px-3 py-2">AliExpress ID</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="text-[#1c1918]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#aaa19b]">
                      Carregando...
                    </td>
                  </tr>
                ) : mappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#aaa19b]">
                      Nenhum mapeamento cadastrado.
                    </td>
                  </tr>
                ) : (
                  mappings.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{m.velo_category}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#494340]">{m.aliexpress_category_id}</td>
                      <td className="px-3 py-2 text-[#827a75]">{m.aliexpress_category_name || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleActive(m)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            m.active ? "bg-[#eaf8f0] text-[#1c9a61]" : "bg-[#f3eee8] text-[#827a75]"
                          }`}
                        >
                          {m.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {m.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => removeMapping(m.id)}
                          className="rounded-lg p-1.5 text-[#aaa19b] hover:bg-[#fcecee] hover:text-[#c85c6d]"
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
        <section className="admin-card p-4">
          <h2 className="text-lg font-semibold text-[#1c1918]">Últimas execuções</h2>
          <div className="mt-3 overflow-hidden rounded-[10px] border">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[#827a75]">
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
              <tbody className="text-[#1c1918]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-[#aaa19b]">
                      Sem execuções ainda.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2 text-[#494340]">{fmtDate(l.started_at)}</td>
                      <td className="px-3 py-2 text-[#827a75]">{l.triggered_by}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            l.status === "success"
                              ? "bg-[#eaf8f0] text-[#1c9a61]"
                              : l.status === "failed"
                                ? "bg-[#fcecee] text-[#c85c6d]"
                                : "bg-[#fff4df] text-[#b87725]"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{l.categories_processed}</td>
                      <td className="px-3 py-2 text-[#1c9a61]">{l.products_new}</td>
                      <td className="px-3 py-2">{l.products_updated}</td>
                      <td className="px-3 py-2 text-[#827a75]">{l.products_dropped_from_top}</td>
                      <td className="px-3 py-2 text-[#c85c6d]" title={l.error_message ?? ""}>
                        {l.error_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {lastLog?.error_message ? (
            <p className="mt-3 rounded-[12px] border border-[#f2cbd2] bg-[#fcecee] p-3 text-xs text-[#c85c6d]">
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
}: {
  label: string;
  value: string;
  tone?: "ok" | "err" | "neutral";
}) => {
  return (
    <AdminKPIStat label={label} value={<span className="admin-kpi-value">{value}</span>} />
  );
};
