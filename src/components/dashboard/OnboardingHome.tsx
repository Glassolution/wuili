import { useNavigate } from "react-router-dom";
import { CheckCircle2, Link2, Package, ArrowRight, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import ProductScoutAI from "@/components/dashboard/ProductScoutAI";

interface OnboardingHomeProps {
  name: string;
  mlConnected: boolean;
  hasPublication: boolean;
}

const OnboardingHome = ({ name, mlConnected, hasPublication }: OnboardingHomeProps) => {
  const navigate = useNavigate();

  const handleConnectML = async () => {
    const { data, error } = await supabase.functions.invoke("ml-connect");
    const authUrl = data?.authUrl ?? data?.auth_url;
    if (error || !authUrl) {
      veloToast.error("Não foi possível iniciar a conexão com o Mercado Livre");
      return;
    }
    window.location.href = authUrl;
  };

  const step2Locked = !mlConnected && !hasPublication;

  return (
    <main
      className="min-h-full w-full bg-[#f4f4f4] text-[#111111] pb-16"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 py-8 lg:px-0">
        {/* Faixa superior: Upgrade Pro */}
        <div className="flex items-center gap-3 self-start">
          <div className="flex items-center gap-2 rounded-full bg-[#111111] py-2 pl-2 pr-4 text-white">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-[12px] font-semibold tracking-tight">
              Desbloqueie todo o potencial do Velo
            </span>
          </div>
          <button
            onClick={() => navigate("/dashboard/planos")}
            className="rounded-full bg-[#111111] px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Upgrade para Pro
          </button>
        </div>

        {/* Header central */}
        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.025em] text-neutral-500">
            Boas-vindas ao Velo, {name}!
          </h1>
          <h2 className="text-[34px] font-bold leading-[1.15] tracking-[-0.025em] text-neutral-900">
            Por onde quer começar?
          </h2>
        </div>

        {/* Atlas search input */}
        <div className="mx-auto w-full max-w-[720px]">
          <div className="flex justify-center">
            <ProductScoutAI
              onResults={(results) =>
                navigate("/dashboard/catalogo", { state: { atlasResults: results } })
              }
            />
          </div>
        </div>

        {/* Checklist 2 cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Passo 1: Conectar ML */}
          <article className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                  <Link2 className="h-5 w-5" />
                </span>
                {mlConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Conectado
                  </span>
                )}
              </div>

              <h3 className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-neutral-900">
                Conecte sua conta do Mercado Livre
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
                Autorize o Velo a publicar e gerenciar seus anúncios direto da plataforma do Mercado Livre — leva menos de 1 minuto.
              </p>
            </div>

            <div className="mt-6 flex">
              {mlConnected ? (
                <button
                  onClick={() => navigate("/dashboard/configuracoes")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[12px] font-bold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Gerenciar conexão
                </button>
              ) : (
                <button
                  onClick={handleConnectML}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  Conectar ML
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </article>

          {/* Passo 2: Publicar 1º produto */}
          <article
            className={`group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all ${
              step2Locked ? "opacity-60" : "hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
            }`}
          >
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                  <Package className="h-5 w-5" />
                </span>
                {hasPublication ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Publicado
                  </span>
                ) : step2Locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                    <Lock className="h-3 w-3" />
                    Conecte o ML primeiro
                  </span>
                ) : null}
              </div>

              <h3 className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-neutral-900">
                Publique seu primeiro produto
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
                Escolha um produto do catálogo Velo e publique no Mercado Livre com 1 clique — título, fotos e categoria já otimizados pela IA.
              </p>
            </div>

            <div className="mt-6 flex">
              {hasPublication ? (
                <button
                  onClick={() => navigate("/dashboard/produtos")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[12px] font-bold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Ver produtos publicados
                </button>
              ) : (
                <button
                  onClick={() => navigate("/dashboard/catalogo")}
                  disabled={step2Locked}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Importar e Publicar
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </article>
        </div>

        {/* Progresso */}
        <div className="mx-auto flex items-center gap-2 text-[11.5px] font-semibold text-neutral-500">
          <span>
            {[mlConnected, hasPublication].filter(Boolean).length} de 2 passos concluídos
          </span>
          <div className="flex gap-1.5">
            {[mlConnected, hasPublication].map((done, i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full ${done ? "bg-emerald-500" : "bg-neutral-200"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default OnboardingHome;
