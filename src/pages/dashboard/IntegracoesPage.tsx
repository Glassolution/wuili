import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import PlatformLogo from "@/components/dashboard/PlatformLogo";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { resolveAfter } from "@/lib/requestTimeout";
import { toast } from "sonner";

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
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const {
    data: statuses = {},
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["integration-statuses", user?.id],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const { data } = await Promise.race([
        supabase
          .from("user_integrations")
          .select("platform, access_token")
          .eq("user_id", user!.id)
          .abortSignal(signal),
        resolveAfter(4500, { data: [], error: null } as any),
      ]);

      const map: Record<string, IntegrationStatus> = {};
      data?.forEach((row) => {
        if (row.access_token) map[row.platform] = "connected";
      });
      return map;
    },
  });

  const handleConnect = async (platformId: string) => {
    if (planLimits.loading) return;

    if (!planLimits.canConnectMarketplace && statuses[platformId] !== "connected") {
      setUpgradeModalOpen(true);
      return;
    }

    if (platformId === "mercadolivre" && user) {
      const { data, error } = await supabase.functions.invoke("ml-connect");
      const authUrl = data?.authUrl ?? data?.auth_url;
      if (error || !authUrl) {
        toast.error("Não foi possível iniciar a conexão com o Mercado Livre");
        return;
      }
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = async (platformId: string) => {
    if (!user) return;
    await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", platformId);
    void refetch();
  };

  const getStatus = (platform: PlatformCard): IntegrationStatus => {
    if (platform.status === "coming_soon") return "coming_soon";
    return statuses[platform.id] || "not_connected";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-[Sora] text-2xl font-semibold text-foreground">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conecte suas contas para publicar e gerenciar produtos.</p>
      </div>

      {isLoading ? (
        <div className="animate-pulse text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((platform) => {
            const status = getStatus(platform);
            return (
              <div
                key={platform.id}
                title={status === "coming_soon" ? "Disponível em breve" : undefined}
                className={`flex flex-col gap-4 rounded-xl border p-5 ${
                  status === "coming_soon" ? "border-zinc-200 bg-zinc-50" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E5] bg-white p-1">
                    <PlatformLogo platform={platform.name} size={38} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{platform.name}</h3>
                    <p className="text-xs text-muted-foreground">{platform.description}</p>
                  </div>
                  {status === "connected" && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Conectado</span>
                  )}
                  {status === "not_connected" && (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Não conectado</span>
                  )}
                  {status === "coming_soon" && (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Em breve</span>
                  )}
                </div>

                {status === "not_connected" && (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    className="w-full rounded-lg bg-black py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Conectar conta
                  </button>
                )}
                {status === "connected" && (
                  <button
                    onClick={() => handleDisconnect(platform.id)}
                    className="w-full rounded-lg border border-border py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Desconectar
                  </button>
                )}
                {status === "coming_soon" && (
                  <button
                    disabled
                    title="Disponível em breve"
                    className="w-full cursor-not-allowed rounded-lg bg-muted py-2 text-sm font-semibold text-muted-foreground opacity-70"
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
        cta="Ver planos"
      />
    </div>
  );
};

export default IntegracoesPage;
