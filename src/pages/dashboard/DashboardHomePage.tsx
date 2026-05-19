import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BadgeDollarSign, Copy, CreditCard, Network, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePlan, type PlanName } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

const PLAN_LABEL: Record<PlanName, string> = {
  gratis: "Gratuito",
  go: "Go",
  pro: "Pro",
  business: "Business",
};

const getFirstName = (userName?: string | null, email?: string | null) => {
  const source = userName?.trim() || email?.split("@")[0] || "empreendedor";
  return source.split(" ")[0];
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

const buildAffiliateLink = (ref?: string | null) => {
  const code = ref?.trim() || "CODIGO";
  return `https://velods.com.br/ref/${code}`;
};

type ActionCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  visual: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

const ActionCard = ({ eyebrow, title, description, visual, className, children }: ActionCardProps) => (
  <article
    className={cn(
      "group flex min-h-[300px] flex-col justify-between rounded-[16px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(0,0,0,0.07)]",
      className,
    )}
  >
    <div>
      {visual}
      <span className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6B7280]">{eyebrow}</span>
      <h2 className="mt-2 max-w-[22rem] text-[21px] font-semibold leading-[1.12] tracking-[-0.032em] text-[#1A1A1A]">
        {title}
      </h2>
      <p className="mt-2 max-w-[30rem] text-[14px] leading-5 text-[#6D7175]">{description}</p>
    </div>
    <div className="mt-6">{children}</div>
  </article>
);

const FloatingProductVisual = () => (
  <div className="relative h-[140px] overflow-visible">
    <img
      src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=160&q=80"
      alt=""
      className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-[92px] -translate-y-1/2 rotate-[-10deg] rounded-[14px] object-cover shadow-[0_14px_26px_rgba(0,0,0,0.13)]"
      loading="lazy"
    />
    <img
      src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=160&q=80"
      alt=""
      className="absolute left-1/2 top-1/2 z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-[14px] object-cover shadow-[0_18px_32px_rgba(0,0,0,0.16)]"
      loading="lazy"
    />
    <img
      src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=160&q=80"
      alt=""
      className="absolute left-1/2 top-1/2 h-20 w-20 -translate-y-1/2 translate-x-[12px] rotate-[10deg] rounded-[14px] object-cover shadow-[0_14px_26px_rgba(0,0,0,0.13)]"
      loading="lazy"
    />
  </div>
);

const MercadoLivreVisual = () => (
  <div className="relative flex h-[140px] items-center justify-center overflow-visible">
    <img
      src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadolivre/logo__large_plus.png"
      alt="Mercado Livre"
      className="h-auto w-[168px] object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.10)]"
      loading="lazy"
    />
  </div>
);

const PaymentVisual = () => (
  <div className="grid h-[140px] grid-cols-2 gap-3 rounded-[14px] bg-[#F3F4F6] p-4">
    <div className="flex flex-col justify-between rounded-[14px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <BadgeDollarSign size={34} strokeWidth={1.65} className="text-emerald-600" />
      <span className="text-[13px] font-bold text-[#1A1A1A]">Pix</span>
    </div>
    <div className="flex flex-col justify-between rounded-[14px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <CreditCard size={34} strokeWidth={1.65} className="text-[#1F2937]" />
      <span className="text-[13px] font-bold text-[#1A1A1A]">Cartão</span>
    </div>
  </div>
);

const AffiliateVisual = () => (
  <div className="relative h-[140px] overflow-hidden rounded-[14px] bg-[#F3F4F6]">
    <div className="absolute left-1/2 top-1/2 h-px w-40 -translate-x-1/2 bg-[#D1D5DB]" />
    <div className="absolute left-[31%] top-[38%] flex h-14 w-14 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_12px_26px_rgba(0,0,0,0.08)]">
      <UsersRound size={24} strokeWidth={1.7} className="text-[#1A1A1A]" />
    </div>
    <div className="absolute right-[28%] top-[47%] flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_12px_26px_rgba(0,0,0,0.08)]">
      <Network size={20} strokeWidth={1.7} className="text-[#6D7175]" />
    </div>
  </div>
);

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan, loading: loadingPlan } = usePlan();
  const [command, setCommand] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, ref, plano, loja_nome, objetivo, onboarding_completed")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("[DashboardHomePage] erro ao buscar perfil:", error);
        return null;
      }

      return data as {
        display_name?: string | null;
        ref?: string | null;
        plano?: string | null;
        loja_nome?: string | null;
        objetivo?: string | null;
        onboarding_completed?: boolean | null;
      } | null;
    },
  });

  const userName = useMemo(() => {
    const metadataName =
      (user?.user_metadata?.name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined);
    return getFirstName(profile?.display_name ?? metadataName, user?.email);
  }, [profile, user]);

  const affiliateLink = useMemo(() => buildAffiliateLink(profile?.ref), [profile?.ref]);
  const isFreePlan = plan === "gratis" || plan === "go";

  const copyAffiliateLink = async () => {
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("[DashboardHomePage] erro ao copiar link:", error);
    }
  };

  const submitCommand = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = command.trim().toLowerCase();
    if (!normalized) return;

    if (normalized.includes("produto") || normalized.includes("import")) {
      navigate("/dashboard/produtos");
      return;
    }

    if (normalized.includes("pedido") || normalized.includes("venda")) {
      navigate("/dashboard/pedidos");
      return;
    }

    if (normalized.includes("pagamento") || normalized.includes("plano")) {
      navigate("/dashboard/configuracoes");
      return;
    }

    if (normalized.includes("afiliado") || normalized.includes("comiss")) {
      navigate("/dashboard/comissoes");
      return;
    }

    navigate("/dashboard/produtos");
  };

  return (
    <main className="-m-3 min-h-[calc(100vh-96px)] bg-[#F6F6F7] px-4 py-6 text-[#1A1A1A] sm:-m-4 sm:px-6 lg:-m-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
        {isFreePlan && (
          <section className="flex flex-col gap-3 rounded-[12px] bg-[#111111] px-4 py-3 text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] font-semibold tracking-[-0.01em]">
              Você está no plano gratuito — Faça upgrade e venda sem limites
            </p>
            <Button
              onClick={() => navigate("/checkout?plan=pro")}
              className="h-9 rounded-[10px] bg-white px-4 text-[12px] font-semibold text-[#111111] hover:bg-[#F3F4F6]"
            >
              Ver planos
            </Button>
          </section>
        )}

        <section className="py-1">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#6D7175]">
                  {profile?.loja_nome ? profile.loja_nome : "Início"}
                </p>
                <h1 className="mt-1 text-[26px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#1A1A1A] sm:text-[32px]">
                  {getGreeting()}, {userName}. Vamos começar.
                </h1>
                {profile?.objetivo && (
                  <p className="mt-2 text-[13px] text-[#6D7175]">
                    Foco inicial: <span className="font-medium text-[#1A1A1A]">{OBJETIVO_LABEL[profile.objetivo] ?? profile.objetivo}</span>
                  </p>
                )}
              </div>
              <span className="hidden rounded-full border border-black/[0.06] bg-white px-3 py-1.5 text-[12px] font-medium text-[#6D7175] sm:inline-flex">
                Velo Admin
              </span>
            </div>

            <form onSubmit={submitCommand} className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8C9196]" size={18} />
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Pesquise ou execute uma ação..."
                className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-white pl-11 pr-12 text-[14px] font-medium text-[#1A1A1A] shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-[#8C9196] focus:border-black/20 focus:ring-4 focus:ring-black/[0.035]"
              />
              <button
                type="submit"
                aria-label="Executar comando"
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#6D7175] transition hover:bg-[#F3F4F6] hover:text-[#1A1A1A]"
              >
                <ArrowUpRight size={16} strokeWidth={2} />
              </button>
            </form>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActionCard
            eyebrow="Catálogo"
            title="Importe seu primeiro produto"
            description="Escolha um item do catálogo e leve para sua operação com os dados organizados."
            visual={<FloatingProductVisual />}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => navigate("/dashboard/produtos")} className="h-10 rounded-[12px] px-4 text-[13px]">
                Importar produto
              </Button>
              <button
                type="button"
                onClick={() => navigate("/dashboard/produtos")}
                className="text-[13px] font-semibold text-[#4B5563] underline-offset-4 transition hover:text-[#1A1A1A] hover:underline"
              >
                Ver produtos de exemplo
              </button>
            </div>
          </ActionCard>

          <ActionCard
            eyebrow="Marketplace"
            title="Publique no Mercado Livre"
            description="Conecte seu marketplace e transforme produtos selecionados em anúncios prontos para venda."
            visual={<MercadoLivreVisual />}
          >
            <Button onClick={() => navigate("/dashboard/publicacoes")} className="h-10 rounded-[12px] px-4 text-[13px]">
              Publicar agora
            </Button>
          </ActionCard>

          <ActionCard
            eyebrow="Pagamento"
            title="Configure seu pagamento"
            description="Ative Pix e cartão para manter a assinatura e os fluxos financeiros em dia."
            visual={<PaymentVisual />}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => navigate("/checkout")} className="h-10 rounded-[12px] px-4 text-[13px]">
                Ativar
              </Button>
            </div>
          </ActionCard>

          <ActionCard
            eyebrow="Crescimento"
            title="Convide um afiliado"
            description="Compartilhe seu link e acompanhe as comissões pelo painel de afiliados."
            visual={<AffiliateVisual />}
          >
            <div className="flex flex-col gap-3">
              <div className="flex min-h-10 items-center justify-between gap-2 rounded-[12px] border border-black/[0.06] bg-[#F6F6F7] px-3">
                <span className="min-w-0 truncate text-[13px] font-medium text-[#4B5563]">{affiliateLink}</span>
                <button
                  type="button"
                  onClick={copyAffiliateLink}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#1A1A1A] transition hover:bg-[#ECECEF]"
                  aria-label="Copiar link de afiliado"
                >
                  <Copy size={15} />
                </button>
              </div>
              <Button onClick={copyAffiliateLink} variant="outline" className="h-10 rounded-[12px] px-4 text-[13px]">
                {copied ? "Link copiado" : "Copiar link"}
              </Button>
            </div>
          </ActionCard>
        </section>

        <footer className="flex flex-col gap-3 rounded-[18px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.02)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/40">Plano atual</p>
            <p className="mt-1 text-[15px] font-semibold text-[#1A1A1A]">
              {loadingPlan ? "Carregando plano..." : PLAN_LABEL[plan]}
            </p>
          </div>
          {isFreePlan ? (
            <Button onClick={() => navigate("/checkout?plan=pro")} className="h-10 rounded-[12px] px-4 text-[13px]">
              Fazer upgrade
            </Button>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
              Operação liberada
            </span>
          )}
        </footer>
      </div>
    </main>
  );
}
