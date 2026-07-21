// Modal de Administração da Loja acessado pelo botão "Administração" no editor.
// 3 abas: Clientes (pedidos/usuários), Produtos próprios (adicionar itens fora
// do catálogo Velo) e Fluxo (reordenar as telas que o cliente percorre — ex.:
// exigir login antes do checkout). Tudo persiste em user_projects.metadata.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Users, Package, ListOrdered, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateProjectMetadata, type UserProject } from "@/lib/userProjects";
import { formatPriceBRL } from "@/lib/priceFormat";

export type FlowStepId =
  | "home"
  | "catalogo"
  | "produto"
  | "login"
  | "carrinho"
  | "checkout"
  | "obrigado";

export const FLOW_STEP_LABELS: Record<FlowStepId, string> = {
  home: "Home da loja",
  catalogo: "Catálogo",
  produto: "Página do produto",
  login: "Login / Cadastro",
  carrinho: "Carrinho",
  checkout: "Checkout",
  obrigado: "Confirmação",
};

export const DEFAULT_FLOW: FlowStepId[] = [
  "home",
  "catalogo",
  "produto",
  "carrinho",
  "checkout",
  "obrigado",
];

export type CustomProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  description: string;
};

type Tab = "clientes" | "produtos" | "fluxo";

type StoreOrderRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  total_amount: number | null;
  status: string | null;
  created_at: string | null;
};

function readAdminMeta(project: UserProject | null) {
  const m = (project?.metadata ?? {}) as Record<string, unknown>;
  const flow = Array.isArray(m.customerFlow)
    ? (m.customerFlow.filter((v): v is FlowStepId => typeof v === "string" && v in FLOW_STEP_LABELS))
    : DEFAULT_FLOW;
  const customProducts = Array.isArray(m.customProducts)
    ? (m.customProducts as CustomProduct[])
    : [];
  return { flow: flow.length ? flow : DEFAULT_FLOW, customProducts };
}

export default function StoreAdminModal({
  open,
  onClose,
  project,
  onProjectUpdated,
}: {
  open: boolean;
  onClose: () => void;
  project: UserProject | null;
  onProjectUpdated: (next: UserProject) => void;
}) {
  const [tab, setTab] = useState<Tab>("clientes");
  const [orders, setOrders] = useState<StoreOrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const initial = useMemo(() => readAdminMeta(project), [project]);
  const [flow, setFlow] = useState<FlowStepId[]>(initial.flow);
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>(initial.customProducts);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CustomProduct>({
    id: "",
    title: "",
    price: 0,
    imageUrl: "",
    description: "",
  });

  useEffect(() => {
    if (!open) return;
    const s = readAdminMeta(project);
    setFlow(s.flow);
    setCustomProducts(s.customProducts);
  }, [open, project]);

  useEffect(() => {
    if (!open || tab !== "clientes" || !project) return;
    let active = true;
    setLoadingOrders(true);
    void (async () => {
      const { data } = await supabase
        .from("store_orders")
        .select("id, customer_name, customer_email, total_amount, status, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (active) {
        setOrders((data as StoreOrderRow[] | null) ?? []);
        setLoadingOrders(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, tab, project]);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...flow];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFlow(next);
  };

  const toggleLogin = () => {
    setFlow((f) => (f.includes("login") ? f.filter((s) => s !== "login") : [...f, "login"]));
  };

  const addProduct = () => {
    if (!draft.title.trim() || draft.price <= 0) return;
    setCustomProducts((list) => [
      ...list,
      { ...draft, id: `custom-${Date.now().toString(36)}` },
    ]);
    setDraft({ id: "", title: "", price: 0, imageUrl: "", description: "" });
  };

  const removeProduct = (id: string) => {
    setCustomProducts((list) => list.filter((p) => p.id !== id));
  };

  const persist = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await updateProjectMetadata(project, {
        customerFlow: flow,
        customProducts,
      });
      onProjectUpdated(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[86vh] w-full max-w-[960px] flex-col overflow-hidden rounded-[22px] border border-white/[0.04] bg-[#0b0d10] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
          >
            <header className="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Administração da loja</h2>
                <p className="mt-0.5 text-[12px] text-white/50">
                  Gerencie clientes, produtos próprios e o fluxo do checkout.
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/8 hover:text-white"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex items-center gap-1 border-b border-white/[0.05] px-4 pt-3">
              {(
                [
                  { id: "clientes", label: "Clientes", icon: Users },
                  { id: "produtos", label: "Produtos próprios", icon: Package },
                  { id: "fluxo", label: "Fluxo do cliente", icon: ListOrdered },
                ] as { id: Tab; label: string; icon: typeof Users }[]
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12px] font-medium transition ${
                    tab === id
                      ? "bg-white/8 text-white"
                      : "text-white/55 hover:bg-white/4 hover:text-white/80"
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tab === "clientes" ? (
                <div>
                  {loadingOrders ? (
                    <div className="flex items-center gap-2 text-[12px] text-white/60">
                      <Loader2 size={13} className="animate-spin" />
                      Carregando clientes…
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[12px] text-white/55">
                      Nenhum cliente ainda. Assim que sua loja receber o primeiro pedido, ele aparece aqui.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-white/[0.04]">
                      <table className="w-full text-left text-[12px] text-white/80">
                        <thead className="bg-white/4 text-[11px] uppercase tracking-wider text-white/50">
                          <tr>
                            <th className="px-3 py-2 font-medium">Cliente</th>
                            <th className="px-3 py-2 font-medium">E-mail</th>
                            <th className="px-3 py-2 font-medium">Total</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => (
                            <tr key={o.id} className="border-t border-white/[0.04]">
                              <td className="px-3 py-2">{o.customer_name || "—"}</td>
                              <td className="px-3 py-2 text-white/60">{o.customer_email || "—"}</td>
                              <td className="px-3 py-2">{formatPriceBRL(o.total_amount ?? 0)}</td>
                              <td className="px-3 py-2 text-white/60">{o.status || "—"}</td>
                              <td className="px-3 py-2 text-white/50">
                                {o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "produtos" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <h3 className="text-[13px] font-semibold text-white">Adicionar produto próprio</h3>
                    <p className="mt-1 text-[11.5px] text-white/50">
                      Produtos que você mesmo entrega — aparecerão junto aos itens do catálogo Velo.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <input
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        placeholder="Nome do produto"
                        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-white/25"
                      />
                      <input
                        type="number"
                        value={draft.price || ""}
                        onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })}
                        placeholder="Preço (R$)"
                        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-white/25"
                      />
                      <input
                        value={draft.imageUrl}
                        onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                        placeholder="URL da imagem"
                        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-white/25 md:col-span-2"
                      />
                      <textarea
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="Descrição"
                        rows={2}
                        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-white/25 md:col-span-2"
                      />
                    </div>
                    <button
                      onClick={addProduct}
                      disabled={!draft.title.trim() || draft.price <= 0}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-medium text-white transition hover:bg-white/15 disabled:opacity-40"
                    >
                      <Plus size={13} /> Adicionar
                    </button>
                  </div>

                  {customProducts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-[12px] text-white/50">
                      Nenhum produto próprio adicionado ainda.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {customProducts.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3"
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-white">{p.title}</p>
                            <p className="text-[11.5px] text-white/50">{formatPriceBRL(p.price)}</p>
                          </div>
                          <button
                            onClick={() => removeProduct(p.id)}
                            className="grid h-8 w-8 place-items-center rounded-full text-white/50 transition hover:bg-white/8 hover:text-white"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {tab === "fluxo" ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[13px] font-semibold text-white">Ordem das telas</h3>
                    <p className="mt-1 text-[11.5px] text-white/50">
                      Defina a jornada que o cliente percorrerá — por exemplo, exigir login antes do checkout, ou
                      logo no início.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 text-[12.5px] text-white">
                    <input
                      type="checkbox"
                      checked={flow.includes("login")}
                      onChange={toggleLogin}
                      className="h-4 w-4 accent-white"
                    />
                    Exigir login/cadastro no fluxo
                  </label>
                  <ul className="space-y-2">
                    {flow.map((step, index) => (
                      <li
                        key={step}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                      >
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/8 text-[11px] font-semibold text-white/80">
                          {index + 1}
                        </span>
                        <span className="flex-1 text-[12.5px] text-white">{FLOW_STEP_LABELS[step]}</span>
                        <button
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="grid h-7 w-7 place-items-center rounded-full text-white/60 transition hover:bg-white/8 hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          onClick={() => move(index, 1)}
                          disabled={index === flow.length - 1}
                          className="grid h-7 w-7 place-items-center rounded-full text-white/60 transition hover:bg-white/8 hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <footer className="flex items-center justify-between border-t border-white/[0.05] px-6 py-3">
              <span className="text-[11.5px] text-white/45">
                Alterações são aplicadas ao republicar a loja.
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-full px-4 py-1.5 text-[12px] font-medium text-white/70 transition hover:bg-white/6"
                >
                  Cancelar
                </button>
                <button
                  onClick={persist}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  Salvar alterações
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
