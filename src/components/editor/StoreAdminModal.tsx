// Modal de Administração da Loja — layout com sidebar escura (estilo Lamfigo).
// 3 seções: Clientes (pedidos), Produtos (próprios + reordenar/categorizar) e
// Fluxo do cliente. Persiste tudo em user_projects.metadata.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
  Users,
  Package,
  ListOrdered,
  X,
  Settings2,
  ImageIcon,
} from "lucide-react";
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
  category?: string;
};

type Tab = "clientes" | "produtos" | "fluxo" | "marketing";

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

// Tokens de cor — sidebar #0f1114, conteúdo #17191d, bordas suaves #ffffff10.
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type StoreProductLite = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  category?: string;
};

export default function StoreAdminModal({
  open,
  onClose,
  project,
  onProjectUpdated,
  storeProducts = [],
}: {
  open: boolean;
  onClose: () => void;
  project: UserProject | null;
  onProjectUpdated: (next: UserProject) => void;
  storeProducts?: StoreProductLite[];
}) {

  const [tab, setTab] = useState<Tab>("clientes");
  const [orders, setOrders] = useState<StoreOrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const initial = useMemo(() => readAdminMeta(project), [project]);
  const [flow, setFlow] = useState<FlowStepId[]>(initial.flow);
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>(initial.customProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CustomProduct>({
    id: "",
    title: "",
    price: 0,
    imageUrl: "",
    description: "",
    category: "",
  });

  useEffect(() => {
    if (!open) return;
    const s = readAdminMeta(project);
    setFlow(s.flow);
    setCustomProducts(s.customProducts);
    setEditingId(null);
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

  const moveProduct = (index: number, dir: -1 | 1) => {
    const next = [...customProducts];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCustomProducts(next);
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
    setDraft({ id: "", title: "", price: 0, imageUrl: "", description: "", category: "" });
  };

  const removeProduct = (id: string) => {
    setCustomProducts((list) => list.filter((p) => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateProduct = (id: string, patch: Partial<CustomProduct>) => {
    setCustomProducts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const persist = async () => {
    if (!project) return;
    // Pixel: vazio limpa o campo; qualquer valor precisa ter 10–20 dígitos.
    const pixel = normalizePixelId(metaPixelId);
    if (pixel && !isValidPixelId(pixel)) {
      setTab("marketing");
      setPixelError("O Pixel ID deve conter apenas números, entre 10 e 20 dígitos.");
      return;
    }
    setPixelError(null);
    setSaving(true);
    try {
      const updated = await updateProjectMetadata(project, {
        customerFlow: flow,
        customProducts,
      });
      const nextPixel = pixel || null;
      if (nextPixel !== (project.meta_pixel_id ?? null)) {
        await supabase.from("user_projects").update({ meta_pixel_id: nextPixel }).eq("id", project.id);
      }
      onProjectUpdated({ ...updated, meta_pixel_id: nextPixel });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const categories = Array.from(
    new Set(customProducts.map((p) => (p.category || "").trim()).filter(Boolean)),
  );

  const navItems: { id: Tab; label: string; icon: typeof Users; hint: string }[] = [
    { id: "clientes", label: "Clientes", icon: Users, hint: "Pedidos & contatos" },
    { id: "produtos", label: "Produtos", icon: Package, hint: "Catálogo próprio" },
    { id: "fluxo", label: "Fluxo do cliente", icon: ListOrdered, hint: "Jornada de compra" },
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/75 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[88vh] w-full max-w-[1080px] overflow-hidden rounded-[20px] bg-[#17191d] shadow-[0_50px_140px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.06]"
          >
            {/* Sidebar */}
            <aside className="flex w-[248px] shrink-0 flex-col bg-[#0f1114] p-4">
              <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-black">
                  <Settings2 size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">Administração</p>
                  <p className="truncate text-[10.5px] text-white/45">{project?.nome || "Sua loja"}</p>
                </div>
              </div>

              <nav className="flex flex-col gap-1">
                {navItems.map(({ id, label, icon: Icon, hint }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={cx(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                        active
                          ? "bg-white/[0.08] text-white"
                          : "text-white/60 hover:bg-white/[0.04] hover:text-white/90",
                      )}
                    >
                      <Icon size={15} strokeWidth={1.9} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium leading-tight">{label}</p>
                        <p className="mt-0.5 text-[10.5px] text-white/40">{hint}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto rounded-xl bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/50">
                Alterações são aplicadas ao republicar a loja.
              </div>
            </aside>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col bg-[#17191d]">
              <header className="flex items-center justify-between border-b border-white/[0.05] px-7 py-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">
                    {tab === "clientes" && "Clientes"}
                    {tab === "produtos" && "Produtos"}
                    {tab === "fluxo" && "Fluxo do cliente"}
                  </h2>
                  <p className="mt-0.5 text-[12px] text-white/50">
                    {tab === "clientes" && "Pedidos e contatos recebidos pela sua loja."}
                    {tab === "produtos" && "Adicione, edite, organize e categorize seus produtos."}
                    {tab === "fluxo" && "Defina a sequência de telas que o cliente percorre."}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <X size={16} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-7 py-6">
                {/* CLIENTES */}
                {tab === "clientes" ? (
                  <div>
                    {loadingOrders ? (
                      <div className="flex items-center gap-2 text-[12.5px] text-white/60">
                        <Loader2 size={14} className="animate-spin" /> Carregando clientes…
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="rounded-2xl bg-white/[0.03] p-10 text-center">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[0.05] text-white/60">
                          <Users size={18} />
                        </div>
                        <p className="mt-3 text-[13px] font-medium text-white">Nenhum cliente ainda</p>
                        <p className="mt-1 text-[12px] text-white/50">
                          Assim que sua loja receber o primeiro pedido, ele aparece aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl bg-white/[0.03]">
                        <table className="w-full text-left text-[12.5px] text-white/85">
                          <thead className="bg-white/[0.04] text-[10.5px] uppercase tracking-[0.14em] text-white/45">
                            <tr>
                              <th className="px-4 py-3 font-medium">Cliente</th>
                              <th className="px-4 py-3 font-medium">E-mail</th>
                              <th className="px-4 py-3 font-medium">Total</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 font-medium">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map((o) => (
                              <tr key={o.id} className="border-t border-white/[0.04]">
                                <td className="px-4 py-3">{o.customer_name || "—"}</td>
                                <td className="px-4 py-3 text-white/60">{o.customer_email || "—"}</td>
                                <td className="px-4 py-3">{formatPriceBRL(o.total_amount ?? 0)}</td>
                                <td className="px-4 py-3 text-white/60">{o.status || "—"}</td>
                                <td className="px-4 py-3 text-white/50">
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

                {/* PRODUTOS */}
                {tab === "produtos" ? (
                  <div className="space-y-6">
                    {/* Adicionar */}
                    <section className="rounded-2xl bg-white/[0.03] p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[13.5px] font-semibold text-white">Adicionar produto</h3>
                          <p className="mt-1 text-[11.5px] text-white/50">
                            Produtos que você mesmo entrega — aparecerão junto ao catálogo.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        <input
                          value={draft.title}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                          placeholder="Nome do produto"
                          className="rounded-lg bg-black/40 px-3 py-2.5 text-[12.5px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                        />
                        <input
                          type="number"
                          value={draft.price || ""}
                          onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })}
                          placeholder="Preço (R$)"
                          className="rounded-lg bg-black/40 px-3 py-2.5 text-[12.5px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                        />
                        <input
                          value={draft.category || ""}
                          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                          placeholder="Categoria (ex.: Camisetas)"
                          list="admin-categories"
                          className="rounded-lg bg-black/40 px-3 py-2.5 text-[12.5px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                        />
                        <input
                          value={draft.imageUrl}
                          onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                          placeholder="URL da imagem"
                          className="rounded-lg bg-black/40 px-3 py-2.5 text-[12.5px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                        />
                        <textarea
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          placeholder="Descrição"
                          rows={2}
                          className="rounded-lg bg-black/40 px-3 py-2.5 text-[12.5px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25 md:col-span-2"
                        />
                      </div>
                      <datalist id="admin-categories">
                        {categories.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <button
                        onClick={addProduct}
                        disabled={!draft.title.trim() || draft.price <= 0}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
                      >
                        <Plus size={13} /> Adicionar produto
                      </button>
                    </section>

                    {/* Produtos da loja (vindos do catálogo escolhido na criação) */}
                    {storeProducts.length > 0 ? (
                      <section>
                        <div className="mb-3 flex items-baseline justify-between">
                          <h3 className="text-[13.5px] font-semibold text-white">
                            Produtos da loja
                            <span className="ml-1 text-white/40">({storeProducts.length})</span>
                          </h3>
                          <p className="text-[11px] text-white/45">
                            Vindos do catálogo escolhido ao criar a loja.
                          </p>
                        </div>
                        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {storeProducts.map((p) => (
                            <li
                              key={p.id}
                              className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.04]"
                            >
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-white/30">
                                    <ImageIcon size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12.5px] font-medium text-white">{p.title}</p>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/55">
                                  <span>{formatPriceBRL(p.price)}</span>
                                  {p.category ? (
                                    <>
                                      <span className="text-white/25">·</span>
                                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/70">
                                        {p.category}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    {/* Lista */}
                    <section>
                      <div className="mb-3 flex items-baseline justify-between">
                        <h3 className="text-[13.5px] font-semibold text-white">
                          Produtos próprios cadastrados{" "}
                          <span className="ml-1 text-white/40">({customProducts.length})</span>
                        </h3>
                        <p className="text-[11px] text-white/45">
                          Use as setas para reordenar. A ordem aparece na loja.
                        </p>
                      </div>


                      {customProducts.length === 0 ? (
                        <div className="rounded-2xl bg-white/[0.03] p-10 text-center">
                          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[0.05] text-white/60">
                            <Package size={18} />
                          </div>
                          <p className="mt-3 text-[13px] font-medium text-white">
                            Nenhum produto próprio ainda
                          </p>
                          <p className="mt-1 text-[12px] text-white/50">
                            Adicione o primeiro produto pelo formulário acima.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {customProducts.map((p, i) => {
                            const isEditing = editingId === p.id;
                            return (
                              <li
                                key={p.id}
                                className="overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/[0.04]"
                              >
                                <div className="flex items-center gap-3 p-3">
                                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[11px] font-semibold text-white/70">
                                    {i + 1}
                                  </span>
                                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                                    {p.imageUrl ? (
                                      <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="grid h-full w-full place-items-center text-white/30">
                                        <ImageIcon size={16} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium text-white">{p.title}</p>
                                    <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-white/55">
                                      <span>{formatPriceBRL(p.price)}</span>
                                      {p.category ? (
                                        <>
                                          <span className="text-white/25">·</span>
                                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-white/70">
                                            {p.category}
                                          </span>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => moveProduct(i, -1)}
                                      disabled={i === 0}
                                      className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                                      aria-label="Mover para cima"
                                    >
                                      <ArrowUp size={13} />
                                    </button>
                                    <button
                                      onClick={() => moveProduct(i, 1)}
                                      disabled={i === customProducts.length - 1}
                                      className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                                      aria-label="Mover para baixo"
                                    >
                                      <ArrowDown size={13} />
                                    </button>
                                    <button
                                      onClick={() => setEditingId(isEditing ? null : p.id)}
                                      className={cx(
                                        "rounded-full px-3 py-1.5 text-[11.5px] font-medium transition",
                                        isEditing
                                          ? "bg-white text-black"
                                          : "bg-white/[0.06] text-white/80 hover:bg-white/[0.1]",
                                      )}
                                    >
                                      {isEditing ? "Fechar" : "Editar"}
                                    </button>
                                    <button
                                      onClick={() => removeProduct(p.id)}
                                      className="grid h-8 w-8 place-items-center rounded-full text-white/50 transition hover:bg-red-500/15 hover:text-red-300"
                                      aria-label="Remover"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                                {isEditing ? (
                                  <div className="grid grid-cols-1 gap-2 border-t border-white/[0.05] bg-black/20 p-3 md:grid-cols-2">
                                    <input
                                      value={p.title}
                                      onChange={(e) => updateProduct(p.id, { title: e.target.value })}
                                      placeholder="Nome"
                                      className="rounded-lg bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                                    />
                                    <input
                                      type="number"
                                      value={p.price || ""}
                                      onChange={(e) =>
                                        updateProduct(p.id, { price: Number(e.target.value) || 0 })
                                      }
                                      placeholder="Preço"
                                      className="rounded-lg bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                                    />
                                    <input
                                      value={p.category || ""}
                                      onChange={(e) => updateProduct(p.id, { category: e.target.value })}
                                      placeholder="Categoria"
                                      list="admin-categories"
                                      className="rounded-lg bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                                    />
                                    <input
                                      value={p.imageUrl}
                                      onChange={(e) => updateProduct(p.id, { imageUrl: e.target.value })}
                                      placeholder="URL da imagem"
                                      className="rounded-lg bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25"
                                    />
                                    <textarea
                                      value={p.description}
                                      onChange={(e) => updateProduct(p.id, { description: e.target.value })}
                                      placeholder="Descrição"
                                      rows={2}
                                      className="rounded-lg bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/30 outline-none ring-1 ring-white/[0.06] focus:ring-white/25 md:col-span-2"
                                    />
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  </div>
                ) : null}

                {/* FLUXO */}
                {tab === "fluxo" ? (
                  <div className="space-y-5">
                    <label className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-[12.5px] text-white">
                      <input
                        type="checkbox"
                        checked={flow.includes("login")}
                        onChange={toggleLogin}
                        className="h-4 w-4 accent-white"
                      />
                      Exigir login / cadastro no fluxo
                    </label>
                    <ul className="space-y-2">
                      {flow.map((step, index) => (
                        <li
                          key={step}
                          className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.04]"
                        >
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.08] text-[11.5px] font-semibold text-white/80">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-[13px] text-white">{FLOW_STEP_LABELS[step]}</span>
                          <button
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            onClick={() => move(index, 1)}
                            disabled={index === flow.length - 1}
                            className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <footer className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-7 py-4">
                <button
                  onClick={onClose}
                  className="rounded-full px-4 py-2 text-[12.5px] font-medium text-white/70 transition hover:bg-white/[0.06]"
                >
                  Cancelar
                </button>
                <button
                  onClick={persist}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-[12.5px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  Salvar alterações
                </button>
              </footer>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
