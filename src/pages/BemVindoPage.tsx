import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Store, X, PartyPopper, CheckCircle2 } from "lucide-react";

export default function BemVindoPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [pageSlug, setPageSlug] = useState<string | null>(null);
  const [showConfirmSkip, setShowConfirmSkip] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profileRes, pageRes] = await Promise.all([
        (supabase as any).from("profiles").select("display_name, full_store_upsell_status").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("generated_sales_pages").select("slug").eq("user_id", user.id).eq("published", true).order("published_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setDisplayName(profileRes.data?.display_name?.split(" ")[0] ?? "");
      // Se já viu o upsell, mandar direto pro dashboard
      if (profileRes.data?.full_store_upsell_status && profileRes.data.full_store_upsell_status !== "shown") {
        navigate("/dashboard", { replace: true });
        return;
      }
      setPageSlug(pageRes.data?.slug ?? null);
      // Marca que viu
      await (supabase as any).from("profiles").update({ full_store_upsell_status: "shown" }).eq("user_id", user.id);
    })();
  }, [user, navigate]);

  const handleAccept = async () => {
    if (!user) return;
    setProcessing(true);
    await (supabase as any).from("profiles").update({ full_store_upsell_status: "accepted" }).eq("user_id", user.id);
    // Redireciona pro checkout do upsell — reusa /checkout com flag
    navigate("/checkout?product=full_store&returnTo=" + encodeURIComponent("/dashboard"));
  };

  const handleSkipConfirm = async () => {
    if (!user) return;
    await (supabase as any).from("profiles").update({ full_store_upsell_status: "skipped" }).eq("user_id", user.id);
    navigate("/dashboard", { replace: true });
  };

  return (
    <main className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="border-b border-slate-100 py-5 px-6 grid place-items-center">
        <div className="text-xl font-bold">Velo</div>
      </header>

      <div className="bg-blue-50 border-b border-blue-100 py-2.5 px-6 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-blue-700"><Sparkles size={14} /> Oferta única — some quando você sair desta tela.</span>
        <button onClick={() => setShowConfirmSkip(true)} className="text-blue-600 hover:text-blue-700 font-medium">Pular oferta ›</button>
      </div>

      <section className="flex-1 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center px-6 py-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
            <PartyPopper size={12} /> Sua página está no ar
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
            Bem-vindo{displayName ? `, ${displayName}` : ""}! 🎉
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Você acabou de ver a Velo funcionando com 1 produto. Que tal expandir isso?
          </p>
          {pageSlug && (
            <a href={`/loja/${pageSlug}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
              <Store size={16} /> Ver minha página em velo.app/{pageSlug}
            </a>
          )}
        </div>

        <div className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-8 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500 text-white text-xs font-bold px-2.5 py-1">OFERTA ÚNICA</span>
            <span className="text-xs text-slate-500">Só aparece uma vez</span>
          </div>
          <h2 className="mt-4 text-2xl md:text-3xl font-bold">
            Quer que a IA monte sua loja completa?
          </h2>
          <p className="mt-3 text-slate-600">
            Você já viu funcionando com 1 produto. Deixa a Velo montar sua loja inteira com <strong>todos os produtos do seu nicho</strong>, prontos pra publicar no Mercado Livre em 1 clique.
          </p>

          <ul className="mt-6 space-y-3 text-sm">
            {[
              "30 produtos com landing pages personalizadas",
              "Otimização SEO em todas as páginas",
              "Publicação em massa no Mercado Livre",
              "Entrega em até 24 horas",
              "Garantia de 365 dias",
            ].map((b) => (
              <li key={b} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> {b}</li>
            ))}
          </ul>

          <div className="mt-6 rounded-xl bg-white p-4 flex items-baseline justify-between border border-slate-200">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Pagamento único</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">R$ 49</p>
                <p className="text-slate-400 line-through">R$ 297</p>
              </div>
            </div>
            <span className="text-xs text-emerald-600 font-semibold">Economize 83%</span>
          </div>

          <button onClick={handleAccept} disabled={processing}
            className="mt-6 w-full rounded-xl bg-slate-900 text-white py-4 font-semibold hover:bg-slate-800 disabled:opacity-60">
            {processing ? "Redirecionando..." : "Sim, montar minha loja completa"}
          </button>
          <button onClick={() => setShowConfirmSkip(true)} className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-800">
            Continuar sem
          </button>
        </div>
      </section>

      {showConfirmSkip && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center px-6">
          <div className="max-w-md w-full rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg">Tem certeza?</h3>
              <button onClick={() => setShowConfirmSkip(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <p className="mt-3 text-sm text-slate-500">Esta oferta única não voltará a aparecer. Você poderá montar a loja completa depois, mas pagando o valor cheio.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowConfirmSkip(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium">Cancelar</button>
              <button onClick={handleSkipConfirm} className="flex-1 rounded-lg bg-red-500 text-white py-2.5 text-sm font-semibold hover:bg-red-600">Sim, pular oferta</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
