// Fase 4: Área do cliente da loja (AERO STEP).
// Login/registro leve baseado em localStorage por slug + histórico de pedidos via RPC pública.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, LogOut, MapPin, Package, ShoppingBag, User, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicProject,
  getProjectLogoImage,
  getProjectStoreName,
  type UserProject,
} from "@/lib/userProjects";

type Customer = {
  name: string;
  email: string;
  phone?: string;
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
};

type Order = {
  id: string;
  product_title: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
};

const storageKey = (slug: string) => `velo:loja:${slug}:customer`;

const statusLabel = (s: string) => {
  const map: Record<string, { label: string; color: string }> = {
    approved: { label: "Pago", color: "bg-[#dfe7c9] text-[#3d4a2a]" },
    paid: { label: "Pago", color: "bg-[#dfe7c9] text-[#3d4a2a]" },
    pending: { label: "Aguardando", color: "bg-[#f2e4bf] text-[#7a5a10]" },
    rejected: { label: "Recusado", color: "bg-[#f2d0d0] text-[#7a1010]" },
    cancelled: { label: "Cancelado", color: "bg-[#e5e0d3] text-[#1a1a1a]/60" },
  };
  return map[s] || { label: s, color: "bg-[#e5e0d3] text-[#1a1a1a]/70" };
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PublicStoreAccountPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<UserProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tab, setTab] = useState<"perfil" | "pedidos" | "endereco">("pedidos");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // login form state
  const [form, setForm] = useState<Customer>({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const p = await fetchPublicProject(slug);
      setProject(p);
      try {
        const raw = localStorage.getItem(storageKey(slug));
        if (raw) setCustomer(JSON.parse(raw));
      } catch {
        // ignore
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!customer || !slug) return;
    setOrdersLoading(true);
    supabase
      .rpc("get_customer_orders", { p_slug: slug, p_email: customer.email })
      .then(({ data }) => {
        setOrders((data as Order[]) ?? []);
        setOrdersLoading(false);
      });
  }, [customer, slug]);

  const storeName = project ? getProjectStoreName(project) || project.nome : "Loja";
  const logoImage = project ? getProjectLogoImage(project) : null;
  const storeHref = slug ? `/loja/${slug}` : "/";
  const catalogHref = slug ? `/loja/${slug}/catalogo` : "/";
  const cartHref = slug ? `/loja/${slug}/carrinho` : "/carrinho";

  const initials = useMemo(() => {
    if (!customer?.name) return "?";
    return customer.name
      .split(" ")
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");
  }, [customer?.name]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    const next: Customer = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone?.trim(),
    };
    localStorage.setItem(storageKey(slug), JSON.stringify(next));
    setCustomer(next);
    setSaving(false);
  };

  const handleUpdate = (patch: Partial<Customer>) => {
    if (!slug || !customer) return;
    const next = { ...customer, ...patch };
    localStorage.setItem(storageKey(slug), JSON.stringify(next));
    setCustomer(next);
  };

  const handleLogout = () => {
    if (!slug) return;
    localStorage.removeItem(storageKey(slug));
    setCustomer(null);
    setOrders([]);
    setForm({ name: "", email: "", phone: "" });
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea]">
        <Loader2 className="animate-spin text-[#3d4a2a]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea] p-6 text-center">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1a1a1a]">Loja não encontrada</h1>
          <p className="mt-2 text-[13px] text-[#1a1a1a]/60">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-[#1a1a1a]">
      {/* NAVBAR */}
      <header className="relative z-30 flex items-center justify-between gap-6 px-6 py-5 md:px-10">
        <Link to={storeHref} className="flex items-center gap-2.5">
          {logoImage ? (
            <img src={logoImage} alt={storeName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[11px] font-semibold text-[#f5f2ea]">
              {storeName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-[15px] font-semibold uppercase tracking-[-0.01em]">{storeName}</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link to={storeHref} className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#3d4a2a]">
            Início
          </Link>
          <Link to={catalogHref} className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#3d4a2a]">
            Catálogo
          </Link>
          <span className="text-[13px] font-semibold text-[#3d4a2a]">Minha conta</span>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to={cartHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea] transition hover:bg-[#2c3620]"
          >
            <ShoppingBag size={14} strokeWidth={2} />
            Carrinho
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-6 pb-24 md:px-10">
        {!customer ? (
          <section className="mx-auto max-w-[440px] rounded-[28px] bg-white p-8 shadow-[0_20px_60px_-40px_rgba(26,60,42,0.4)] md:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef1de] text-[#3d4a2a]">
              <UserRound size={22} strokeWidth={2} />
            </div>
            <h1 className="mt-5 text-center text-[24px] font-semibold uppercase tracking-[-0.02em]">
              Acesse sua conta
            </h1>
            <p className="mt-2 text-center text-[13px] text-[#1a1a1a]/60">
              Informe seus dados para acompanhar seus pedidos na {storeName}.
            </p>
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1a1a1a]/60">
                  Nome completo
                </span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-full border border-[#1a1a1a]/12 bg-[#f5f2ea] px-5 py-3 text-[13px] outline-none transition focus:border-[#3d4a2a]"
                  placeholder="Como podemos te chamar"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1a1a1a]/60">
                  E-mail da compra
                </span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-full border border-[#1a1a1a]/12 bg-[#f5f2ea] px-5 py-3 text-[13px] outline-none transition focus:border-[#3d4a2a]"
                  placeholder="voce@email.com"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1a1a1a]/60">
                  Telefone (opcional)
                </span>
                <input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-full border border-[#1a1a1a]/12 bg-[#f5f2ea] px-5 py-3 text-[13px] outline-none transition focus:border-[#3d4a2a]"
                  placeholder="(11) 99999-9999"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3c2a] px-6 py-3.5 text-[13px] font-semibold text-[#f5f2ea] transition hover:bg-[#12291d] disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />}
                Entrar na minha conta
              </button>
            </form>
            <p className="mt-6 text-center text-[11px] text-[#1a1a1a]/50">
              Use o mesmo e-mail informado no momento da compra para ver seus pedidos.
            </p>
          </section>
        ) : (
          <div className="grid gap-8 md:grid-cols-[280px_1fr]">
            {/* Sidebar */}
            <aside className="h-fit rounded-[24px] bg-white p-6 shadow-[0_10px_40px_-30px_rgba(26,60,42,0.4)]">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef1de] text-[13px] font-semibold text-[#3d4a2a]">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{customer.name}</p>
                  <p className="truncate text-[11px] text-[#1a1a1a]/55">{customer.email}</p>
                </div>
              </div>
              <nav className="mt-6 space-y-1">
                {[
                  { id: "pedidos" as const, label: "Meus pedidos", icon: Package },
                  { id: "perfil" as const, label: "Perfil", icon: User },
                  { id: "endereco" as const, label: "Endereço", icon: MapPin },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-left text-[13px] font-medium transition ${
                      tab === id
                        ? "bg-[#1a3c2a] text-[#f5f2ea]"
                        : "text-[#1a1a1a]/75 hover:bg-[#f5f2ea]"
                    }`}
                  >
                    <Icon size={14} strokeWidth={2} />
                    {label}
                  </button>
                ))}
              </nav>
              <button
                onClick={handleLogout}
                className="mt-6 flex w-full items-center gap-2.5 rounded-full border border-[#1a1a1a]/12 px-4 py-2.5 text-[12px] font-medium text-[#1a1a1a]/70 transition hover:border-[#3d4a2a]/40 hover:text-[#3d4a2a]"
              >
                <LogOut size={14} strokeWidth={2} />
                Sair
              </button>
            </aside>

            {/* Content */}
            <section className="rounded-[24px] bg-white p-8 shadow-[0_10px_40px_-30px_rgba(26,60,42,0.4)] md:p-10">
              {tab === "pedidos" && (
                <div>
                  <h2 className="text-[22px] font-semibold uppercase tracking-[-0.02em]">Meus pedidos</h2>
                  <p className="mt-1 text-[13px] text-[#1a1a1a]/60">
                    Histórico de compras vinculadas a {customer.email}.
                  </p>
                  <div className="mt-6 space-y-3">
                    {ordersLoading && (
                      <div className="grid place-items-center py-10">
                        <Loader2 className="animate-spin text-[#3d4a2a]" />
                      </div>
                    )}
                    {!ordersLoading && orders.length === 0 && (
                      <div className="rounded-[20px] border border-dashed border-[#1a1a1a]/15 bg-[#f5f2ea] p-8 text-center">
                        <Package size={22} className="mx-auto text-[#3d4a2a]" />
                        <p className="mt-3 text-[13px] font-semibold">Nenhum pedido encontrado</p>
                        <p className="mt-1 text-[12px] text-[#1a1a1a]/55">
                          Assim que você concluir uma compra, ela aparecerá aqui.
                        </p>
                        <Link
                          to={catalogHref}
                          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1a3c2a] px-5 py-2.5 text-[12px] font-semibold text-[#f5f2ea] hover:bg-[#12291d]"
                        >
                          Explorar catálogo
                        </Link>
                      </div>
                    )}
                    {orders.map((o) => {
                      const st = statusLabel(o.payment_status);
                      return (
                        <article
                          key={o.id}
                          className="flex items-center gap-4 rounded-[20px] border border-[#1a1a1a]/8 bg-[#faf8f1] p-4"
                        >
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-[#eef1de]">
                            {o.product_image_url ? (
                              <img
                                src={o.product_image_url}
                                alt={o.product_title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-[#3d4a2a]">
                                <Package size={18} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{o.product_title}</p>
                            <p className="mt-0.5 text-[11px] text-[#1a1a1a]/55">
                              {new Date(o.created_at).toLocaleDateString("pt-BR")} · Qtde: {o.quantity} ·{" "}
                              {o.payment_method?.toUpperCase() || "—"}
                            </p>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${st.color}`}
                            >
                              {st.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-semibold">{brl(Number(o.total))}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "perfil" && (
                <div>
                  <h2 className="text-[22px] font-semibold uppercase tracking-[-0.02em]">Perfil</h2>
                  <p className="mt-1 text-[13px] text-[#1a1a1a]/60">Seus dados de contato.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <ProfileField
                      label="Nome"
                      value={customer.name}
                      onChange={(v) => handleUpdate({ name: v })}
                    />
                    <ProfileField
                      label="E-mail"
                      value={customer.email}
                      onChange={(v) => handleUpdate({ email: v.toLowerCase() })}
                      type="email"
                    />
                    <ProfileField
                      label="Telefone"
                      value={customer.phone ?? ""}
                      onChange={(v) => handleUpdate({ phone: v })}
                    />
                  </div>
                </div>
              )}

              {tab === "endereco" && (
                <div>
                  <h2 className="text-[22px] font-semibold uppercase tracking-[-0.02em]">Endereço</h2>
                  <p className="mt-1 text-[13px] text-[#1a1a1a]/60">
                    Usaremos esse endereço para acelerar seu próximo checkout.
                  </p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <ProfileField
                      label="CEP"
                      value={customer.cep ?? ""}
                      onChange={(v) => handleUpdate({ cep: v })}
                    />
                    <ProfileField
                      label="Cidade"
                      value={customer.city ?? ""}
                      onChange={(v) => handleUpdate({ city: v })}
                    />
                    <ProfileField
                      label="Rua"
                      value={customer.street ?? ""}
                      onChange={(v) => handleUpdate({ street: v })}
                    />
                    <ProfileField
                      label="Número"
                      value={customer.number ?? ""}
                      onChange={(v) => handleUpdate({ number: v })}
                    />
                    <ProfileField
                      label="Estado"
                      value={customer.state ?? ""}
                      onChange={(v) => handleUpdate({ state: v })}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1a1a1a]/60">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-[#1a1a1a]/12 bg-[#f5f2ea] px-5 py-3 text-[13px] outline-none transition focus:border-[#3d4a2a]"
      />
    </label>
  );
}
