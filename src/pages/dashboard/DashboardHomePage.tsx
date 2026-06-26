import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Star,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
    setInputText("");
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

  const suggestionPills = [
    "Encontre fones de ouvido bluetooth com boa margem",
    "Sugira produtos eletrônicos mais vendidos com estoque no Brasil",
    "Quais os produtos virais de beleza para importar hoje?",
    "Me dê ideias de produtos de cozinha com mais de 50% de margem",
  ];

  return (
    <main 
      className="min-h-full w-full bg-[#f4f4f4] text-[#111111] pb-10"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 px-1 py-4 sm:px-3 lg:px-0">
        
        {/* Breadcrumb e Header Superior */}
        <div className="flex flex-col gap-1 border-b border-black/[0.04] pb-4">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium leading-none">
            <span>Dashboard</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-600">Home</span>
            <button type="button" className="ml-1 text-neutral-400 hover:text-neutral-600 leading-none">
              <Star className="h-3.5 w-3.5 fill-none" />
            </button>
          </div>
          
          <header className="flex items-center justify-between gap-4 mt-2">
            <h1 className="text-[20px] font-bold leading-none tracking-[-0.035em] text-neutral-800">
              Olá, {name}!
            </h1>
            
            <div className="flex items-center gap-3">
              <ProductScoutAI
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
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-2xl mx-auto w-full">
          <div className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center mb-6 shadow-sm">
            <SaturnIcon />
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-neutral-800 mb-2">
            Olá, {name}!
          </h2>
          <p className="text-neutral-500 text-[14px] mb-8 font-medium">
            Como posso ajudar você a vender mais hoje?
          </p>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit(inputText);
            }}
            className="w-full flex items-center gap-2 bg-white border border-neutral-200/80 rounded-2xl p-2.5 pl-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] focus-within:border-neutral-400 transition-all duration-200"
          >
            <span className="text-neutral-400 shrink-0">
              <SaturnIcon />
            </span>
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pergunte ao Atlas... Ex: eletrônicos mais vendidos da CJ"
              className="bg-transparent text-[14px] font-medium outline-none text-neutral-800 w-full px-2"
            />
            <button 
              type="submit"
              className="h-9 w-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 hover:bg-neutral-800 transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Sugestões Rápidas (Pills) */}
          <div className="mt-8 w-full">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3.5">Sugestões de busca</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestionPills.map((pill, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSearchSubmit(pill)}
                  className="text-[11.5px] font-semibold text-neutral-600 bg-white hover:bg-neutral-50 hover:text-neutral-800 border border-neutral-200/60 rounded-full px-4 py-2 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] text-left"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
};

export default DashboardHomePage;
