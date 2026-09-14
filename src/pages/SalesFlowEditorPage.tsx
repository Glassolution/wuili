import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Editor em modo "Fluxo" — as três telas do fluxo do cliente final aparecem
 * lado a lado (Produto → Carrinho → Checkout), interligadas por setas.
 * Cada card é um iframe do preview real da rota pública, com escala reduzida.
 * Inspirado no Google Stitch: fluxo horizontal, painel único visualizando as
 * telas conectadas.
 */
const SalesFlowEditorPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialSlug = searchParams.get("slug");
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [projects, setProjects] = useState<Array<{ slug: string; nome: string }>>([]);
  const [zoom, setZoom] = useState(0.55);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: userProjects } = await supabase
        .from("user_projects")
        .select("nome, metadata, status")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      const withSlug = (userProjects ?? [])
        .map((p) => ({ nome: p.nome as string, slug: (p.metadata as { slug?: string })?.slug ?? "" }))
        .filter((p) => p.slug);
      setProjects(withSlug);
      if (!slug && withSlug[0]?.slug) setSlug(withSlug[0].slug);
    })();
  }, [user?.id, slug]);

  const screens = useMemo(() => {
    if (!slug) return [];
    return [
      { key: "produto", label: "Tela 1 · Produto", path: `/loja/${slug}` },
      { key: "carrinho", label: "Tela 2 · Carrinho", path: `/loja/${slug}/carrinho` },
      { key: "checkout", label: "Tela 3 · Checkout", path: `/loja/${slug}/checkout` },
    ];
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0F0F10] text-white">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/minha-loja/editor" className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-white">
            <ArrowLeft size={16} /> Voltar ao editor
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <h1 className="text-[15px] font-semibold">Fluxo de compra do cliente</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={slug ?? ""}
            onChange={(e) => setSlug(e.target.value)}
            className="h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none"
          >
            <option value="">Selecione uma loja</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>{p.nome}</option>
            ))}
          </select>
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-1 text-[12px]">
            <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} className="h-7 w-7 rounded-md hover:bg-white/10">−</button>
            <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1, z + 0.1))} className="h-7 w-7 rounded-md hover:bg-white/10">+</button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        {slug ? (
          <div className="flex min-w-max items-stretch gap-6">
            {screens.map((screen, idx) => (
              <div key={screen.key} className="flex items-center gap-6">
                <div className="flex flex-col">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-white/70">{screen.label}</span>
                    <Link to={screen.path} target="_blank" className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white">
                      Abrir <ExternalLink size={11} />
                    </Link>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
                    <div
                      style={{
                        width: 1280 * zoom,
                        height: 820 * zoom,
                      }}
                    >
                      <iframe
                        src={screen.path}
                        title={screen.label}
                        style={{
                          width: 1280,
                          height: 820,
                          transform: `scale(${zoom})`,
                          transformOrigin: "top left",
                          border: 0,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {idx < screens.length - 1 && (
                  <ArrowRight size={22} className="shrink-0 text-white/25" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid place-items-center py-24 text-center text-white/50">
            <p>Selecione uma loja publicada para visualizar o fluxo.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesFlowEditorPage;
