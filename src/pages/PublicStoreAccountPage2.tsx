// Área do cliente — Template 2 (MARKETLY, azul/branco).
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, LogOut, MapPin, Package, ShoppingCart, User, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicProject, getProjectLogoImage, getProjectStoreName, type UserProject } from "@/lib/userProjects";

type Customer = { name: string; email: string; phone?: string; cep?: string; street?: string; number?: string; city?: string; state?: string; };
type Order = { id: string; product_title: string; product_image_url: string | null; quantity: number; unit_price: number; total: number; payment_status: string; payment_method: string; created_at: string; };

const storageKey = (slug: string) => `velo:loja:${slug}:customer`;
const statusLabel = (s: string) => {
  const m: Record<string, { label: string; color: string }> = {
    approved: { label: "Pago", color: "bg-[#DCFCE7] text-[#166534]" },
    paid: { label: "Pago", color: "bg-[#DCFCE7] text-[#166534]" },
    pending: { label: "Aguardando", color: "bg-[#FEF3C7] text-[#92400E]" },
    rejected: { label: "Recusado", color: "bg-[#FEE2E2] text-[#991B1B]" },
    cancelled: { label: "Cancelado", color: "bg-[#F1F5F9] text-[#475569]" },
  };
  return m[s] || { label: s, color: "bg-[#F1F5F9] text-[#475569]" };
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PublicStoreAccountPage2() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<UserProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tab, setTab] = useState<"perfil" | "pedidos" | "endereco">("pedidos");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [form, setForm] = useState<Customer>({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const p = await fetchPublicProject(slug);
      setProject(p);
      try { const raw = localStorage.getItem(storageKey(slug)); if (raw) setCustomer(JSON.parse(raw)); } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!customer || !slug) return;
    setOrdersLoading(true);
    supabase.rpc("get_customer_orders", { p_slug: slug, p_email: customer.email }).then(({ data }) => {
      setOrders((data as Order[]) ?? []);
      setOrdersLoading(false);
    });
  }, [customer, slug]);

  const storeName = project ? getProjectStoreName(project) || project.nome : "Loja";
  const logoImage = project ? getProjectLogoImage(project) : null;
  const storeHref = slug ? `/loja/${slug}` : "/";
  const catalogHref = slug ? `/loja/${slug}/catalogo` : "/";
  const cartHref = slug ? `/loja/${slug}/carrinho` : "/carrinho";

  const initials = useMemo(() => customer?.name ? customer.name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") : "?", [customer?.name]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    const next: Customer = { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone?.trim() };
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
    setCustomer(null); setOrders([]); setForm({ name: "", email: "", phone: "" });
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-white"><Loader2 className="animate-spin text-[#2563EB]" /></div>;
  if (!project) return <div className="grid min-h-screen place-items-center bg-white p-6 text-center"><h1 className="text-[20px] font-bold text-[#0F172A]">Loja não encontrada</h1></div>;

  return (
    <div className="min-h-screen bg-white text-[#0F172A]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-3 px-4 py-3 md:px-8">
          <Link to={storeHref} aria-label="Voltar" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F1F5F9]"><ChevronLeft size={20} /></Link>
          <Link to={storeHref} className="flex min-w-0 items-center gap-2">
            {logoImage ? <img src={logoImage} alt={storeName} className="h-9 w-9 rounded-lg object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2563EB] text-white"><ShoppingCart size={17} strokeWidth={2.4} /></span>}
            <span className="truncate text-[16px] font-bold">{storeName}</span>
          </Link>
          <Link to={cartHref} className="ml-auto grid h-10 w-10 place-items-center rounded-full hover:bg-[#F1F5F9]"><ShoppingCart size={19} /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 py-6 md:px-8">
        {!customer ? (
          <section className="mx-auto max-w-[440px] rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm md:p-8">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EFF6FF] text-[#2563EB]"><UserRound size={22} /></div>
            <h1 className="mt-4 text-center text-[22px] font-bold tracking-tight">Acesse sua conta</h1>
            <p className="mt-1 text-center text-[13px] text-[#64748B]">Entre para acompanhar seus pedidos na {storeName}.</p>
            <form onSubmit={handleLogin} className="mt-6 space-y-3">
              <Field label="Nome completo" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="Como podemos te chamar" />
              <Field label="E-mail" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required type="email" placeholder="voce@email.com" />
              <Field label="Telefone (opcional)" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
              <button type="submit" disabled={saving} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3.5 text-[13px] font-bold text-white shadow-md transition hover:bg-[#1D4ED8] disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />} Entrar
              </button>
            </form>
            <p className="mt-4 text-center text-[10px] text-[#94A3B8]">Use o mesmo e-mail da compra para ver seus pedidos.</p>
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-2xl border border-[#E2E8F0] bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#EFF6FF] text-[13px] font-bold text-[#2563EB]">{initials}</span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[#0F172A]">{customer.name}</p>
                  <p className="truncate text-[11px] text-[#64748B]">{customer.email}</p>
                </div>
              </div>
              <nav className="mt-4 space-y-1">
                {[
                  { id: "pedidos" as const, l: "Meus pedidos", i: Package },
                  { id: "perfil" as const, l: "Perfil", i: User },
                  { id: "endereco" as const, l: "Endereço", i: MapPin },
                ].map(({ id, l, i: Icon }) => (
                  <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition ${tab === id ? "bg-[#2563EB] text-white" : "text-[#334155] hover:bg-[#F1F5F9]"}`}>
                    <Icon size={15} /> {l}
                  </button>
                ))}
              </nav>
              <button onClick={handleLogout} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-semibold text-[#64748B] hover:border-[#EF4444]/40 hover:text-[#EF4444]">
                <LogOut size={13} /> Sair
              </button>
            </aside>

            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 md:p-7">
              {tab === "pedidos" && (
                <div>
                  <h2 className="text-[20px] font-bold tracking-tight">Meus pedidos</h2>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">Histórico de compras vinculadas a {customer.email}.</p>
                  <div className="mt-5 space-y-3">
                    {ordersLoading && <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-[#2563EB]" /></div>}
                    {!ordersLoading && orders.length === 0 && (
                      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
                        <Package size={22} className="mx-auto text-[#2563EB]" />
                        <p className="mt-2 text-[13px] font-bold">Nenhum pedido encontrado</p>
                        <p className="mt-0.5 text-[11px] text-[#64748B]">Suas compras aparecerão aqui.</p>
                        <Link to={catalogHref} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-4 py-2 text-[12px] font-semibold text-white">Explorar catálogo</Link>
                      </div>
                    )}
                    {orders.map((o) => {
                      const st = statusLabel(o.payment_status);
                      return (
                        <article key={o.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F8FAFC]">
                            {o.product_image_url ? <img src={o.product_image_url} alt={o.product_title} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[#2563EB]"><Package size={18} /></div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold">{o.product_title}</p>
                            <p className="mt-0.5 text-[10px] text-[#64748B]">{new Date(o.created_at).toLocaleDateString("pt-BR")} · Qtde: {o.quantity} · {o.payment_method?.toUpperCase() || "—"}</p>
                            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${st.color}`}>{st.label}</span>
                          </div>
                          <p className="text-[13px] font-bold text-[#2563EB]">{brl(Number(o.total))}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "perfil" && (
                <div>
                  <h2 className="text-[20px] font-bold tracking-tight">Perfil</h2>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">Seus dados de contato.</p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <Field label="Nome" value={customer.name} onChange={(v) => handleUpdate({ name: v })} />
                    <Field label="E-mail" value={customer.email} onChange={(v) => handleUpdate({ email: v.toLowerCase() })} type="email" />
                    <Field label="Telefone" value={customer.phone ?? ""} onChange={(v) => handleUpdate({ phone: v })} />
                  </div>
                </div>
              )}

              {tab === "endereco" && (
                <div>
                  <h2 className="text-[20px] font-bold tracking-tight">Endereço</h2>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">Usaremos para acelerar seu próximo checkout.</p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <Field label="CEP" value={customer.cep ?? ""} onChange={(v) => handleUpdate({ cep: v })} />
                    <Field label="Cidade" value={customer.city ?? ""} onChange={(v) => handleUpdate({ city: v })} />
                    <Field label="Rua" value={customer.street ?? ""} onChange={(v) => handleUpdate({ street: v })} />
                    <Field label="Número" value={customer.number ?? ""} onChange={(v) => handleUpdate({ number: v })} />
                    <Field label="Estado" value={customer.state ?? ""} onChange={(v) => handleUpdate({ state: v })} />
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

function Field({ label, value, onChange, type = "text", placeholder, required }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{label}</span>
      <input required={required} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-[#2563EB]" />
    </label>
  );
}
