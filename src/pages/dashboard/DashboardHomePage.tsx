import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
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
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const AtlasAvatar = ({ size = 28 }: { size?: number }) => (
  <div
    style={{ width: size, height: size }}
    className="shrink-0 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 grid place-items-center text-white text-[12px] font-bold shadow-sm"
  >
    A
  </div>
);

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inputText, setInputText] = useState("");
  const [creating, setCreating] = useState(false);

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

  const startAtlasThread = async (firstMessage?: string) => {
    if (!user?.id) {
      veloToast.error("Faça login para conversar com o Atlas");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("atlas_threads" as never)
        .insert({ user_id: user.id, title: firstMessage?.slice(0, 50) || "Nova conversa" })
        .select("id")
        .single();
      if (error || !data) throw error || new Error("erro");
      const id = (data as { id: string }).id;
      const qs = firstMessage ? `?first=${encodeURIComponent(firstMessage)}` : "";
      navigate(`/dashboard/atlas/${id}${qs}`);
    } catch {
      veloToast.error("Não foi possível abrir a conversa com o Atlas");
    } finally {
      setCreating(false);
    }
  };

  const handleSearchSubmit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setInputText("");
    startAtlasThread(t);
  };

  const handleConnectML = async () => {
    const { data, error } = await supabase.functions.invoke("ml-connect");
    const authUrl = (data as { authUrl?: string; auth_url?: string } | null)?.authUrl ?? (data as { auth_url?: string } | null)?.auth_url;
    if (error || !authUrl) {
      veloToast.error("Não foi possível iniciar a conexão com o Mercado Livre");
      return;
    }
    window.location.href = authUrl;
  };

  if (showOnboarding) {
    return <OnboardingHome name={name} mlConnected={mlConnected} hasPublication={hasPublication} />;
  }

  return (
    <main
      className="min-h-full w-full bg-[#f4f4f4] text-[#111111] pb-16"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-[1160px] px-4 lg:px-6 pt-4">
        {/* Header bar */}
        <header className="flex items-center justify-between gap-4">
          <div
            onClick={() => navigate("/dashboard/planos")}
            className="flex items-center gap-3 rounded-full bg-[#111111] py-2 pl-[14px] pr-4 text-white cursor-pointer select-none text-[12.5px]"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="font-medium text-neutral-100">Aproveite 3 meses por R$ 1/mês</span>
            <span className="h-3.5 w-px bg-white/20 mx-1" />
            <span className="font-semibold">Selecionar um plano</span>
          </div>
          <div className="text-[12.5px] text-neutral-500 hidden sm:block">
            Dúvidas? <span className="text-neutral-900 font-semibold">contato@velo.com.br</span>
          </div>
        </header>

        {/* Welcome + Chat input */}
        <section className="mt-[18vh] flex flex-col items-center text-center">
          <h2 className="text-[28px] sm:text-[30px] font-medium tracking-tight text-neutral-500 leading-tight">
            Boas-vindas ao Velo{name ? `, ${name}` : ""}!
          </h2>
          <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-neutral-900 leading-tight mt-0.5">
            Por onde quer começar?
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit(inputText);
            }}
            className="mt-7 w-full max-w-[760px] flex items-center gap-2 bg-white border border-neutral-200 rounded-full pl-4 pr-2 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)] focus-within:border-neutral-400 transition-colors"
          >
            <AtlasAvatar size={24} />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pergunte ao Atlas… ou peça uma listagem completa"
              className="flex-1 bg-transparent outline-none text-[13.5px] text-neutral-800 placeholder:text-neutral-400 px-1.5"
              disabled={creating}
            />
            <button
              type="button"
              onClick={() => startAtlasThread()}
              className="h-8 w-8 rounded-full border border-neutral-200 text-neutral-500 grid place-items-center hover:bg-neutral-50 transition-colors"
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={!inputText.trim() || creating}
              className="h-8 w-8 rounded-full bg-neutral-900 text-white grid place-items-center disabled:opacity-40 hover:bg-neutral-800 transition-colors"
              aria-label="Enviar"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </section>

        {/* Card grid */}
        <section className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1 */}
          <article className="rounded-[20px] border border-black/[0.06] bg-white p-7 h-[280px] flex flex-col justify-between relative overflow-hidden">
            <div className="z-10 max-w-[80%]">
              <h3 className="text-[16px] font-bold text-neutral-900 leading-snug">Adicione seu primeiro produto</h3>
              <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed">
                Comece com título, preço e uma foto. Você sempre pode adicionar mais detalhes depois.
              </p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
              <div className="h-20 w-20 rounded-xl bg-neutral-100 border border-neutral-200 grid place-items-center text-neutral-300 text-2xl">+</div>
              <div className="h-24 w-20 rounded-xl bg-gradient-to-b from-emerald-200 to-emerald-400" />
            </div>
            <button
              onClick={() => navigate("/dashboard/catalogo")}
              className="z-10 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50 transition-colors self-start"
            >
              Adicione um produto
            </button>
          </article>

          {/* Card 2 */}
          <article className="rounded-[20px] border border-black/[0.06] bg-white p-7 h-[280px] flex flex-col justify-between relative overflow-hidden">
            <div className="z-10 max-w-[80%]">
              <h3 className="text-[16px] font-bold text-neutral-900 leading-snug">Conecte o Mercado Livre</h3>
              <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed">
                Autorize a Velo a publicar seus anúncios e sincronizar pedidos automaticamente.
              </p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
              <div className="h-12 w-12 rounded-full bg-neutral-900 grid place-items-center text-white text-[10px] font-bold">Velo</div>
              <span className="text-neutral-300">→</span>
              <div className="h-12 w-12 rounded-full bg-[#FFE600] grid place-items-center text-[#2D3277] text-[12px] font-black">ML</div>
            </div>
            <button
              onClick={handleConnectML}
              className="z-10 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50 transition-colors self-start"
            >
              Conectar conta
            </button>
          </article>

          {/* Card 3 */}
          <article className="rounded-[20px] border border-black/[0.06] bg-white p-7 h-[260px] flex flex-col justify-between relative overflow-hidden">
            <div className="z-10 max-w-[80%]">
              <h3 className="text-[16px] font-bold text-neutral-900 leading-snug">Veja seus anúncios no ML</h3>
              <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed">
                Acompanhe status, estoque e visitas dos produtos publicados pela Velo.
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard/produtos-ml")}
              className="z-10 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50 transition-colors self-start"
            >
              Ver anúncios
            </button>
          </article>

          {/* Card 4 */}
          <article className="rounded-[20px] border border-black/[0.06] bg-white p-7 h-[260px] flex flex-col justify-between relative overflow-hidden">
            <div className="z-10 max-w-[80%]">
              <h3 className="text-[16px] font-bold text-neutral-900 leading-snug">Explore as métricas da loja</h3>
              <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed">
                Acompanhe faturamento, vendas e conversão da sua loja em tempo real.
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard/saldos")}
              className="z-10 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50 transition-colors self-start"
            >
              Ver métricas
            </button>
          </article>
        </section>
      </div>
    </main>
  );
};

export default DashboardHomePage;
