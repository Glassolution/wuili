import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import ProductScoutAI, { SaturnIcon } from "@/components/dashboard/ProductScoutAI";
import OnboardingHome from "@/components/dashboard/OnboardingHome";

type ProfileRow = {
  display_name: string | null;
  loja_nome: string | null;
};

const getName = (profile?: ProfileRow | null, email?: string | null) => {
  const raw = profile?.loja_nome || profile?.display_name || email?.split("@")[0] || "Velo";
  return raw
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scoutPrompt, setScoutPrompt] = useState("");
  const [inputText, setInputText] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles" as never)
        .select("display_name, loja_nome")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  const { data: onboardingState } = useQuery({
    queryKey: ["dashboard-home-onboarding-state", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [integrationRes, publicationRes] = await Promise.all([
        supabase
          .from("user_integrations" as never)
          .select("access_token")
          .eq("user_id", user!.id)
          .eq("platform", "mercadolivre")
          .maybeSingle(),
        supabase
          .from("user_publications" as never)
          .select("id")
          .eq("user_id", user!.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
      ]);

      const mlConnected = Boolean((integrationRes.data as { access_token?: string } | null)?.access_token);
      const hasPublication = Boolean(publicationRes.data);
      return { mlConnected, hasPublication };
    },
  });

  const mlConnected = onboardingState?.mlConnected ?? false;
  const hasPublication = onboardingState?.hasPublication ?? false;
  const showOnboarding = onboardingState ? !(mlConnected && hasPublication) : false;

  const name = getName(profile, user?.email);

  const handleSearchSubmit = (text: string) => {
    if (!text.trim()) return;
    setScoutPrompt(text);
    setScoutOpen(true);
    inputText("");
  };

  const handleConnectML = async () => {
    const { data, error } = await supabase.functions.invoke("ml-connect");
    const authUrl = data?.authUrl ?? data?.auth_url;
    if (error || !authUrl) {
      veloToast.error("Não foi possível iniciar a conexão com o Mercado Livre");
      return;
    }
    window.location.href = authUrl;
  };

  if (showOnboarding) {
    return (
      <OnboardingHome
        name={name}
        mlConnected={mlConnected}
        hasPublication={hasPublication}
      />
    );
  }

  return (
    <main 
      className="min-h-full w-full bg-[#f4f4f4] text-[#111111] pb-10"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 px-1 py-4 sm:px-3 lg:px-0">
        
        {/* Header Superior */}
        <div className="flex flex-col gap-1 border-b border-black/[0.04] pb-4">
          <header className="flex items-center justify-between gap-4 mt-2">
            <h1 className="text-[20px] font-bold leading-none tracking-[-0.035em] text-neutral-800">
              Olá, {name}!
            </h1>
            
            <div className="flex items-center gap-3">
              <ProductScoutAI
                showTriggerButton={false}
                open={scoutOpen}
                onOpenChange={setScoutOpen}
                initialPrompt={scoutPrompt}
                onResults={(results) =>
                  navigate("/dashboard/catalogo", { state: { atlasResults: results } })
                }
              />
            </div>
          </header>
        </div>

        {/* Central Chat/Atlas Interface */}
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center max-w-4xl mx-auto w-full">
          
          <h2 className="text-[22px] sm:text-[25px] font-medium tracking-tight text-[#6B7280] leading-tight">
            Boas-vindas ao Velo!
          </h2>
          <h3 className="text-[22px] sm:text-[25px] font-bold tracking-tight text-[#111111] leading-none mt-1 mb-6">
            Por onde quer começar?
          </h3>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit(inputText);
            }}
            className="w-full max-w-md flex items-center gap-2 bg-white border border-neutral-200/80 rounded-2xl p-1.5 pl-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.015)] focus-within:border-neutral-400 transition-all duration-200"
          >
            <span className="text-neutral-400 shrink-0 scale-90">
              <SaturnIcon />
            </span>
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pergunte ao Atlas... Ex: eletrônicos mais vendidos da CJ"
              className="bg-transparent text-[12.5px] font-medium outline-none text-neutral-800 w-full px-1.5"
            />
            <button 
              type="submit"
              className="h-7.5 w-7.5 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 hover:bg-neutral-800 transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Grid de Cards de Onboarding/Ação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 w-full text-left">
            
            {/* Card 1: Importar Produto */}
            <div className="bg-white border border-black/[0.06] rounded-[24px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between h-[255px]">
              <div>
                <h3 className="text-[13.5px] font-bold text-neutral-800 leading-none">Importe seu primeiro produto</h3>
                <p className="text-[11.5px] text-neutral-400 font-medium leading-relaxed mt-2">
                  Comece a importar produtos vencedores da CJ Dropshipping direto para a sua conta.
                </p>
                
                {/* Ilustração CSS Premium */}
                <div className="h-[85px] w-full relative overflow-hidden bg-neutral-50/50 rounded-xl mt-3.5 border border-black/[0.01] flex items-center justify-center">
                  <div className="absolute transform -rotate-6 translate-y-2 bg-white border border-black/[0.05] rounded-xl p-2.5 shadow-md flex items-center gap-3 w-[180px]">
                    <div className="h-8 w-8 bg-neutral-900 text-white rounded-lg flex items-center justify-center shrink-0 scale-95">
                      <SaturnIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-1.5 w-16 bg-neutral-200 rounded" />
                      <div className="h-1 w-10 bg-neutral-100 rounded mt-1.5" />
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="mt-3 px-3.5 py-1.5 text-[10.5px] font-bold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-full border border-neutral-200/60 transition-all self-start leading-none"
              >
                Adicionar um produto
              </button>
            </div>

            {/* Card 2: Conectar Mercado Livre */}
            <div className="bg-white border border-black/[0.06] rounded-[24px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between h-[255px]">
              <div>
                <h3 className="text-[13.5px] font-bold text-neutral-800 leading-none">Conecte o Mercado Livre</h3>
                <p className="text-[11.5px] text-neutral-400 font-medium leading-relaxed mt-2">
                  Publique seus produtos automaticamente na maior plataforma de vendas da América Latina.
                </p>
                
                {/* Ilustração CSS Premium */}
                <div className="h-[85px] w-full relative overflow-hidden bg-neutral-50/50 rounded-xl mt-3.5 border border-black/[0.01] flex items-center justify-center">
                  <div className="flex items-center gap-2.5 scale-90">
                    <div className="h-10 w-10 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-md shrink-0">
                      <SaturnIcon />
                    </div>
                    <div className="h-0.5 w-6 border-t-2 border-dashed border-neutral-300" />
                    <div className="h-10 w-10 rounded-full bg-[#FFE600] text-[#2D3277] font-black text-[13px] flex items-center justify-center shadow-md shrink-0 select-none">
                      ML
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectML}
                className="mt-3 px-3.5 py-1.5 text-[10.5px] font-bold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-full border border-neutral-200/60 transition-all self-start leading-none"
              >
                Conectar conta
              </button>
            </div>

            {/* Card 3: Veja seus produtos no ML */}
            <div className="bg-white border border-black/[0.06] rounded-[24px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between h-[255px]">
              <div>
                <h3 className="text-[13.5px] font-bold text-neutral-800 leading-none">Veja seus produtos no ML</h3>
                <p className="text-[11.5px] text-neutral-400 font-medium leading-relaxed mt-2">
                  Gerencie e acompanhe o status de sincronização dos seus produtos publicados.
                </p>
                
                {/* Ilustração CSS Premium */}
                <div className="h-[85px] w-full relative overflow-hidden bg-neutral-50/50 rounded-xl mt-3.5 border border-black/[0.01] flex items-center justify-center">
                  <div className="absolute transform rotate-3 translate-y-1 bg-white border border-black/[0.05] rounded-xl p-2 shadow-md w-[180px] scale-95">
                    <div className="flex items-center justify-between gap-2 border-b border-black/[0.03] pb-1 mb-1">
                      <span className="text-[8px] font-bold text-neutral-400">ANÚNCIO ML</span>
                      <span className="h-1.5 w-6 bg-emerald-100 text-emerald-600 rounded-full px-1 py-0.5 text-[5.5px] font-bold flex items-center justify-center">ATIVO</span>
                    </div>
                    <div className="h-1.5 w-24 bg-neutral-200 rounded" />
                    <div className="h-1 w-12 bg-neutral-100 rounded mt-1" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard/produtos-ml")}
                className="mt-3 px-3.5 py-1.5 text-[10.5px] font-bold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-full border border-neutral-200/60 transition-all self-start leading-none"
              >
                Ver anúncios
              </button>
            </div>

            {/* Card 4: Explore as métricas da loja */}
            <div className="bg-white border border-black/[0.06] rounded-[24px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between h-[255px]">
              <div>
                <h3 className="text-[13.5px] font-bold text-neutral-800 leading-none">Explore as métricas da loja</h3>
                <p className="text-[11.5px] text-neutral-400 font-medium leading-relaxed mt-2">
                  Acompanhe faturamento, visualizações e a conversão de vendas da sua loja.
                </p>
                
                {/* Ilustração CSS Premium */}
                <div className="h-[85px] w-full relative overflow-hidden bg-neutral-50/50 rounded-xl mt-3.5 border border-black/[0.01] flex items-center justify-center">
                  <div className="flex items-end gap-1.5 h-10 scale-90">
                    <div className="w-3 bg-neutral-200 rounded-t-sm h-4" />
                    <div className="w-3 bg-neutral-300 rounded-t-sm h-7" />
                    <div className="w-3 bg-neutral-900 rounded-t-sm h-10" />
                    <div className="w-3 bg-neutral-200 rounded-t-sm h-6" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="mt-3 px-3.5 py-1.5 text-[10.5px] font-bold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-full border border-neutral-200/60 transition-all self-start leading-none"
              >
                Ver métricas
              </button>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
};

export default DashboardHomePage;
