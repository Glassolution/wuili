import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Truck, Star, Package, Rocket, Lock, X, CheckCircle2, Loader2 } from "lucide-react";

type Page = {
  id: string;
  user_id: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  benefits: Array<{ title: string; description: string }>;
  testimonials: Array<{ name: string; text: string; rating: number }>;
  cta_text: string;
  hero_image_url: string | null;
  price_brl: number | null;
  product_title: string | null;
  published: boolean;
};

export default function PreviewPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const isOwner = !!user && !!page && page.user_id === user.id;
  const isPreview = page && !page.published;

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("generated_sales_pages")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setPage(data as Page);
      setLoading(false);
    })();
  }, [slug]);

  const handlePublish = async () => {
    if (!page || !user) return;
    // Checar assinatura ativa
    const { data: sub } = await (supabase as any)
      .from("subscriptions")
      .select("status, plan")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const active = sub && ["active", "paid", "approved", "trialing"].includes(String(sub.status).toLowerCase());
    if (!active) {
      setShowPaywall(true);
      return;
    }
    setPublishing(true);
    const { error } = await (supabase as any)
      .from("generated_sales_pages")
      .update({ published: true, published_at: new Date().toISOString() })
      .eq("id", page.id);
    setPublishing(false);
    if (!error) {
      navigate("/bem-vindo", { replace: true });
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="animate-spin" /></div>;
  }
  if (notFound || !page) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-800 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Página não encontrada</h1>
          <p className="mt-2 text-slate-500">Este link não existe ou foi removido.</p>
          <Link to="/" className="mt-6 inline-block text-emerald-600 underline">Voltar</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Banner preview (só dono e não publicada) */}
      {isOwner && isPreview && (
        <div className="sticky top-0 z-40 bg-slate-900 text-white text-sm py-3 px-6 flex items-center justify-between">
          <span className="flex items-center gap-2"><Lock size={14} /> Modo Preview — só você vê essa página. Publique para tornar público.</span>
          <button onClick={handlePublish} disabled={publishing} className="rounded-lg bg-emerald-400 text-slate-950 px-4 py-1.5 font-semibold hover:bg-emerald-300 disabled:opacity-50">
            {publishing ? "Publicando..." : "Publicar em velo.app"}
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 max-w-7xl mx-auto px-6 py-12">
        {/* Landing */}
        <div>
          <section className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                <Star size={12} className="fill-emerald-500 text-emerald-500" /> Mais vendido
              </span>
              <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight leading-tight">{page.headline}</h1>
              <p className="mt-4 text-lg text-slate-600">{page.subheadline}</p>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-slate-900">R$ {page.price_brl?.toFixed(2) ?? "—"}</span>
                {page.price_brl && <span className="text-slate-400 line-through">R$ {(page.price_brl * 1.4).toFixed(2)}</span>}
              </div>
              <button
                onClick={() => navigate(`/loja/${page.slug}/carrinho`)}
                className="mt-8 w-full md:w-auto rounded-xl bg-slate-900 text-white px-8 py-4 font-semibold text-lg hover:bg-slate-800 transition"
              >
                {page.cta_text}
              </button>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Truck size={14} /> Frete rápido</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Garantia 7 dias</span>
                <span className="flex items-center gap-1.5"><Lock size={14} /> Pagamento seguro</span>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden bg-slate-100 aspect-square">
              {page.hero_image_url && <img src={page.hero_image_url} alt={page.product_title ?? ""} className="w-full h-full object-cover" />}
            </div>
          </section>

          <section className="mt-20 grid md:grid-cols-3 gap-6">
            {page.benefits.map((b, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 grid place-items-center text-emerald-600">
                  <CheckCircle2 size={20} />
                </div>
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{b.description}</p>
              </div>
            ))}
          </section>

          <section className="mt-20">
            <h2 className="text-2xl font-bold text-center">O que dizem os clientes</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-6">
              {page.testimonials.map((t, i) => (
                <div key={i} className="rounded-2xl bg-slate-50 p-6">
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: t.rating || 5 }).map((_, j) => <Star key={j} size={14} className="fill-current" />)}
                  </div>
                  <p className="mt-3 text-sm text-slate-700">"{t.text}"</p>
                  <p className="mt-3 text-xs font-semibold text-slate-500">— {t.name}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-10 md:p-14 text-center">
            <ShieldCheck className="mx-auto mb-4 text-emerald-400" size={36} />
            <h2 className="text-2xl md:text-3xl font-bold">Garantia de 7 dias ou seu dinheiro de volta</h2>
            <p className="mt-3 text-white/70 max-w-lg mx-auto">Se não gostar, devolvemos 100% do valor. Sem burocracia.</p>
            <button onClick={() => setShowBuyModal(true)} className="mt-8 rounded-xl bg-emerald-400 text-slate-950 px-8 py-3.5 font-semibold hover:bg-emerald-300">
              {page.cta_text}
            </button>
          </section>
        </div>

        {/* Side upsell visual — só dono e preview */}
        {isOwner && isPreview && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 grid place-items-center text-blue-600 shrink-0"><Package size={18} /></div>
                  <div>
                    <p className="text-sm font-semibold">Seu catálogo completo</p>
                    <p className="mt-1 text-xs text-slate-500">500+ produtos prontos no seu nicho, esperando você criar mais páginas.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 grid place-items-center text-amber-600 shrink-0"><Rocket size={18} /></div>
                  <div>
                    <p className="text-sm font-semibold">Publique no Mercado Livre</p>
                    <p className="mt-1 text-xs text-slate-500">Em 1 clique você espelha essa página no ML e começa a vender.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-900 text-white p-5">
                <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">Próximo passo</p>
                <p className="mt-2 text-sm font-medium">Publicar sua página em <span className="font-mono">velo.app/{page.slug}</span></p>
                <button onClick={handlePublish} className="mt-4 w-full rounded-lg bg-white text-slate-900 py-2.5 font-semibold text-sm hover:bg-slate-100">
                  Publicar agora
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Modal "Comprar" — só na preview */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center px-6">
          <div className="max-w-md w-full rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">Esta é uma prévia</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isOwner ? "Publique sua página para ativar as vendas de verdade." : "Esta página ainda não foi publicada."}
                </p>
              </div>
              <button onClick={() => setShowBuyModal(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowBuyModal(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium">Fechar</button>
              {isOwner && (
                <button onClick={() => { setShowBuyModal(false); handlePublish(); }} className="flex-1 rounded-lg bg-slate-900 text-white py-2.5 text-sm font-semibold">Publicar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paywall */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center px-6">
          <div className="max-w-lg w-full rounded-2xl bg-white p-8">
            <button onClick={() => setShowPaywall(false)} className="float-right text-slate-400 hover:text-slate-700"><X size={20} /></button>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 grid place-items-center text-white mb-4">
              <Rocket size={22} />
            </div>
            <h3 className="text-2xl font-bold">Publique sua página no ar</h3>
            <p className="mt-2 text-slate-500">Sua landing ficará acessível em <span className="font-mono font-semibold text-slate-900">velo.app/{page.slug}</span> — link real, pronto pra compartilhar.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Link público em velo.app/sua-loja", "SSL grátis e certificado", "Edições ilimitadas", "Analytics de visitas e conversão", "Suporte prioritário"].map((b) => (
                <li key={b} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> {b}</li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-slate-50 p-4 flex items-baseline justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Plano Pro</p>
                <p className="text-2xl font-bold">R$ 47<span className="text-sm font-normal text-slate-500">/mês</span></p>
              </div>
              <span className="text-xs text-emerald-600 font-semibold">Cancele quando quiser</span>
            </div>
            <button onClick={() => navigate("/checkout?returnTo=" + encodeURIComponent(`/preview/${page.slug}`))}
              className="mt-6 w-full rounded-xl bg-slate-900 text-white py-3.5 font-semibold hover:bg-slate-800">
              Assinar e publicar
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">Você continua editando sua página gratuitamente. Cobramos só quando você publicar.</p>
          </div>
        </div>
      )}
    </main>
  );
}
