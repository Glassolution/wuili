import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Loader2 } from "lucide-react";

const STEPS = [
  "Analisando o seu produto...",
  "Estudando concorrentes no Brasil...",
  "Escrevendo copy persuasiva...",
  "Montando prova social...",
  "Otimizando imagens...",
  "Publicando sua prévia...",
];

export default function GerandoPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const productId = sessionStorage.getItem("velo-onboarding-product-id");
    if (!productId) {
      navigate("/onboarding/produto", { replace: true });
      return;
    }
    if (started.current) return;
    started.current = true;

    // Labor illusion — rota as mensagens
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1600);

    (async () => {
      const startedAt = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke("generate-sales-page", {
          body: { catalog_product_id: productId },
        });
        if (error) throw error;
        const slug = data?.page?.slug;
        if (!slug) throw new Error("Slug não retornado");
        // Garante mínimo de 6s pra o labor illusion não parecer instantâneo
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, 6000 - elapsed);
        setTimeout(() => {
          clearInterval(interval);
          if (user) {
            supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("user_id", user.id);
          }
          navigate(`/preview/${slug}`, { replace: true });
        }, wait);
      } catch (e: any) {
        clearInterval(interval);
        console.error(e);
        setError(e?.message ?? "Não foi possível gerar sua página. Tente novamente.");
      }
    })();

    return () => clearInterval(interval);
  }, [navigate, user]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto mb-8 h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 grid place-items-center border border-emerald-400/30">
          <Sparkles size={32} className="text-emerald-300 animate-pulse" />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Estamos criando sua página</h1>
        <p className="mt-3 text-white/60">Alguns segundos e você já pode ver funcionando.</p>

        {error ? (
          <div className="mt-8 rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
            <button onClick={() => navigate("/onboarding/produto")} className="mt-3 text-white underline">Voltar</button>
          </div>
        ) : (
          <>
            <div className="mt-10 space-y-3">
              {STEPS.map((s, i) => {
                const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
                return (
                  <div key={i} className={`flex items-center gap-3 text-sm ${state === "pending" ? "text-white/25" : "text-white/85"}`}>
                    <div className="w-5 flex justify-center">
                      {state === "done" ? (
                        <span className="text-emerald-400">✓</span>
                      ) : state === "active" ? (
                        <Loader2 className="animate-spin text-emerald-300" size={14} />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                      )}
                    </div>
                    <span>{s}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-1000"
                style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
