import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { veloToast } from "@/components/ui/velo-toast";
import PlatformLogo from "@/components/dashboard/PlatformLogo";

type IntegrationStatus = "connected" | "not_connected" | "coming_soon";

type PlatformCard = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
};

const platforms: PlatformCard[] = [
  { id: "mercadolivre", name: "Mercado Livre", description: "Publique produtos diretamente nos seus anúncios", status: "not_connected" },
  { id: "shopee", name: "Shopee", description: "Disponível em breve", status: "coming_soon" },
  { id: "amazon", name: "Amazon", description: "Disponível em breve", status: "coming_soon" },
  { id: "shopify", name: "Shopify", description: "Disponível em breve", status: "coming_soon" },
];

const IntegracoesPage = () => {
  const { user } = useAuth();
  const planLimits = usePlanLimits();
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("platform, access_token")
        .eq("user_id", user.id);

      const map: Record<string, IntegrationStatus> = {};
      data?.forEach((row) => {
        if (row.access_token) map[row.platform] = "connected";
      });
      setStatuses(map);
      setLoading(false);
    })();
  }, [user]);

  const handleConnect = async (platformId: string) => {
    if (planLimits.loading) return;

    if (!planLimits.canConnectMarketplace && statuses[platformId] !== "connected") {
      setUpgradeModalOpen(true);
      return;
    }

    if (platformId === "mercadolivre" && user) {
      const toastId = veloToast.loading("Conectando com o Mercado Livre...");
      const { data, error } = await supabase.functions.invoke("ml-connect");
      const authUrl = data?.authUrl ?? data?.auth_url;
      if (error || !authUrl) {
        veloToast.error("Não foi possível iniciar a conexão com o Mercado Livre", { id: toastId });
        return;
      }
      veloToast.dismiss(toastId);
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = async (platformId: string) => {
    if (!user) return;
    const toastId = veloToast.loading("Desconectando...");
    try {
      const { error } = await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", user.id)
        .eq("platform", platformId);
      
      if (error) throw error;

      setStatuses((prev) => {
        const next = { ...prev };
        delete next[platformId];
        return next;
      });
      veloToast.success("Desconectado com sucesso.", { id: toastId });
    } catch (err) {
      veloToast.error("Não foi possível desconectar.", { id: toastId });
    }
  };

  const getStatus = (p: PlatformCard): IntegrationStatus => {
    if (p.status === "coming_soon") return "coming_soon";
    return statuses[p.id] || "not_connected";
  };
  const marketplaceUpgradeTargetPlan: "pro" | "business" = planLimits.plan === "pro" ? "business" : "pro";
  const marketplaceUpgradeBenefits = marketplaceUpgradeTargetPlan === "business"
    ? ["Marketplaces ilimitados", "Produtos ilimitados", "Analytics premium", "Processamento prioritário"]
    : ["Até 2 marketplaces", "Publicação automática", "Monitoramento básico 24h", "Suporte prioritário"];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground font-[Sora]">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">Conecte suas contas para publicar e gerenciar produtos.</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Carregando...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((p) => {
            const status = getStatus(p);
            return (
              <div
                key={p.id}
                title={status === "coming_soon" ? "Disponível em breve" : undefined}
                className={`rounded-xl border p-5 flex flex-col gap-4 ${
                  status === "coming_soon"
                    ? "border-zinc-200 bg-zinc-50 opacity-75"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E5] bg-white p-1 dark:border-white/10 dark:bg-white">
                    <PlatformLogo platform={p.name} size={35} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  {status === "connected" && (
                    <span className="shrink-0 rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-semibold">Conectado</span>
                  )}
                  {status === "not_connected" && (
                    <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-semibold">Não conectado</span>
                  )}
                  {status === "coming_soon" && (
                    <span className="shrink-0 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-semibold">Em breve</span>
                  )}
                </div>

                {status === "not_connected" && (
                  <button
                    onClick={() => handleConnect(p.id)}
                    className="w-full rounded-lg bg-black text-white py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Conectar conta
                  </button>
                )}
                {status === "connected" && (
                  <button
                    onClick={() => handleDisconnect(p.id)}
                    className="w-full rounded-lg border border-black bg-black text-white py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Desconectar
                  </button>
                )}
                {status === "coming_soon" && (
                  <button
                    disabled
                    title="Disponível em breve"
                    className="w-full rounded-lg bg-muted text-muted-foreground py-2 text-sm font-semibold cursor-not-allowed opacity-70"
                  >
                    Em breve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <UpgradeLimitModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Limite de marketplaces atingido"
        message="Seu plano atual não permite conectar outro marketplace. Faça upgrade para liberar mais integrações."
        cta={marketplaceUpgradeTargetPlan === "business" ? "Upgrade Business" : "Desbloquear operação completa"}
        targetPlan={marketplaceUpgradeTargetPlan}
        benefits={marketplaceUpgradeBenefits}
      />
    </div>
  );
};

export default IntegracoesPage;
