import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Escalation = {
  id: string; user_id: string; status: string; reason: string; summary: string | null;
  ml_diagnostic: unknown; created_at: string; updated_at: string;
};
type Msg = { id: string; role: string; content: string; created_at: string; archived: boolean };
type Perfil = { user_id: string; display_name: string | null; email: string | null };

const STATUS: Record<string, string> = { aberto: "Aberto", em_atendimento: "Em atendimento", resolvido: "Resolvido" };
const MOTIVO: Record<string, string> = {
  pediu_humano: "Pediu uma pessoa", erro_desconhecido: "Erro não reconhecido", fora_da_base: "Fora da base",
  financeiro: "Financeiro", erro_assistente: "Falha do assistente", limite_diario: "Limite diário",
};

export default function AdminAiEscalationsPage() {
  const [filtro, setFiltro] = useState<"abertos" | "resolvido">("abertos");
  const [lista, setLista] = useState<Escalation[]>([]);
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [sel, setSel] = useState<Escalation | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [resposta, setResposta] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    let q = supabase.from("support_escalations").select("*").order("updated_at", { ascending: false }).limit(200);
    q = filtro === "abertos" ? q.neq("status", "resolvido") : q.eq("status", "resolvido");
    const { data } = await q;
    const items = (data ?? []) as Escalation[];
    setLista(items);
    const ids = [...new Set(items.map((i) => i.user_id))];
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", ids);
      setPerfis(Object.fromEntries(((ps ?? []) as Perfil[]).map((p) => [p.user_id, p])));
    }
    setLoading(false);
  };

  const abrir = async (e: Escalation) => {
    setSel(e);
    const { data } = await supabase.from("support_ai_messages").select("id, role, content, created_at, archived")
      .eq("user_id", e.user_id).order("created_at", { ascending: true }).limit(300);
    setMsgs((data ?? []) as Msg[]);
  };

  useEffect(() => { void carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filtro]);

  const agir = async (status?: string) => {
    if (!sel) return;
    setEnviando(true);
    await supabase.functions.invoke("support-assistant", {
      body: { action: "admin_reply", escalationId: sel.id, message: resposta.trim(), status },
    });
    setResposta("");
    setEnviando(false);
    await carregar();
    await abrir({ ...sel, status: status ?? (resposta.trim() ? "em_atendimento" : sel.status) });
  };

  const nome = (id: string) => perfis[id]?.display_name || perfis[id]?.email || id.slice(0, 8);

  return (
    <div className="flex h-screen flex-col bg-[#F8FAFC] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Assistente IA — pedidos de atendimento</h1>
          <p className="text-sm text-[#64748B]">Conversas em que o assistente precisou da equipe.</p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-white p-1 text-sm">
          {(["abertos", "resolvido"] as const).map((f) => (
            <button key={f} onClick={() => { setFiltro(f); setSel(null); }}
              className={`rounded-md px-3 py-1.5 ${filtro === f ? "bg-[#1E3A8A] text-white" : "text-[#475569]"}`}>
              {f === "abertos" ? `Pendentes${filtro === "abertos" ? ` (${lista.length})` : ""}` : "Resolvidos"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-4">
        <div className="overflow-y-auto rounded-xl border bg-white">
          {loading ? <div className="p-6 text-sm text-[#64748B]"><Loader2 className="inline animate-spin" size={14} /> Carregando…</div>
            : lista.length === 0 ? <div className="p-6 text-sm text-[#64748B]">Nenhum pedido.</div>
            : lista.map((e) => (
              <button key={e.id} onClick={() => void abrir(e)}
                className={`block w-full border-b px-4 py-3 text-left hover:bg-[#F1F5F9] ${sel?.id === e.id ? "bg-[#EFF6FF]" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-[#0F172A]">{nome(e.user_id)}</span>
                  <span className="text-[11px] text-[#64748B]">{new Date(e.updated_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="mt-1 flex gap-2 text-[11px]">
                  <span className="rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[#92400E]">{MOTIVO[e.reason] ?? e.reason}</span>
                  <span className="rounded bg-[#E2E8F0] px-1.5 py-0.5 text-[#334155]">{STATUS[e.status] ?? e.status}</span>
                </div>
                {e.summary && <p className="mt-1 line-clamp-2 text-xs text-[#475569]">{e.summary}</p>}
              </button>
            ))}
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border bg-white">
          {!sel ? <div className="m-auto text-sm text-[#64748B]">Selecione um pedido.</div> : (
            <>
              <div className="border-b px-5 py-3">
                <p className="font-medium text-[#0F172A]">{nome(sel.user_id)} <span className="text-xs text-[#64748B]">{perfis[sel.user_id]?.email}</span></p>
                {sel.summary && <p className="text-sm text-[#475569]">{sel.summary}</p>}
                {sel.ml_diagnostic != null && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-[#1E3A8A]">Verificação da conta do Mercado Livre</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-[#F1F5F9] p-2">{JSON.stringify(sel.ml_diagnostic, null, 2)}</pre>
                  </details>
                )}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4 text-sm">
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"} ${m.archived ? "opacity-50" : ""}`}>
                    <div className={`max-w-[75%] select-text whitespace-pre-wrap rounded-xl px-3 py-2 ${m.role === "user" ? "bg-[#F1F5F9] text-[#0F172A]" : m.role === "admin" ? "bg-[#1E3A8A] text-white" : "bg-[#EFF6FF] text-[#0F172A]"}`}>
                      <p className="mb-0.5 text-[10px] opacity-70">{m.role === "user" ? "Usuário" : m.role === "admin" ? "Equipe Velo" : "Assistente"} · {new Date(m.created_at).toLocaleString("pt-BR")}</p>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3">
                <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3}
                  placeholder="Responder ao usuário (aparece no chat de ajuda dele como Equipe Velo)…"
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
                <div className="mt-2 flex justify-end gap-2">
                  {sel.status !== "resolvido"
                    ? <button onClick={() => void agir("resolvido")} disabled={enviando} className="rounded-lg border px-3 py-2 text-sm">Marcar resolvido</button>
                    : <button onClick={() => void agir("aberto")} disabled={enviando} className="rounded-lg border px-3 py-2 text-sm">Reabrir</button>}
                  <button onClick={() => void agir()} disabled={enviando || !resposta.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                    <Send size={14} /> Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
