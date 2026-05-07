import { useEffect, useState } from "react";
import { X, Network } from "lucide-react";
import { toast } from "sonner";
import PlatformLogo from "./PlatformLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";

type Platform = {
  id: string;
  name: string;
  subtitle: string;
  section: "available" | "coming_soon";
};

const initialPlatforms: Platform[] = [
  { id: "mercadolivre", name: "Mercado Livre", subtitle: "Integração disponível", section: "available" },
  { id: "shopee", name: "Shopee", subtitle: "Disponível em breve", section: "coming_soon" },
  { id: "amazon", name: "Amazon", subtitle: "Disponível em breve", section: "coming_soon" },
  { id: "shopify", name: "Shopify", subtitle: "Disponível em breve", section: "coming_soon" },
];

const Toggle = ({ on, onChange, disabled = false }: { on: boolean; onChange: () => void; disabled?: boolean }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    title={disabled ? "Disponível em breve" : undefined}
    className={`relative h-6 w-11 rounded-full transition-colors ${
      disabled ? "cursor-not-allowed bg-gray-200 opacity-60 dark:bg-zinc-800" : on ? "bg-green-500" : "bg-gray-200 dark:bg-zinc-700"
    }`}
  >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
  </button>
);

const PlatformLogoBadge = ({ name }: { name: string }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-1.5 overflow-hidden dark:bg-zinc-900 dark:border-white/10">
    <PlatformLogo platform={name} size={22} />
  </div>
);

type Props = { open: boolean; onClose: () => void };

const PlatformIntegrationModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const planLimits = usePlanLimits();
  const [connectedML, setConnectedML] = useState(false);
  const [loadingML, setLoadingML] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    setLoadingML(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("user_integrations")
          .select("access_token")
          .eq("user_id", user.id)
          .eq("platform", "mercadolivre")
          .maybeSingle();
        setConnectedML(!!data?.access_token);
      } finally {
        setLoadingML(false);
      }
    })();
  }, [open, user]);

  const connectML = async () => {
    if (!user) return;

    if (!planLimits.loading && !connectedML && !planLimits.canConnectMarketplace) {
      setUpgradeModalOpen(true);
      return;
    }

    const { data, error } = await supabase.functions.invoke("ml-connect");
    const authUrl = data?.authUrl ?? data?.auth_url;
    if (error || !authUrl) {
      toast.error("Não foi possível iniciar a conexão com o Mercado Livre");
      return;
    }
    window.location.href = authUrl;
  };

  const disconnectML = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", "mercadolivre");

    if (error) {
      toast.error("Não foi possível desconectar o Mercado Livre");
      return;
    }

    setConnectedML(false);
    void planLimits.refreshUsage();
    toast.success("Mercado Livre desconectado");
  };

  if (!open) return null;

  const available = initialPlatforms.filter(p => p.section === "available");
  const comingSoon = initialPlatforms.filter(p => p.section === "coming_soon");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Network size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Integração de Plataformas</h2>
              <p className="text-xs text-muted-foreground">Conecte suas plataformas de venda.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* Available */}
          <div>
            <p className="text-sm font-bold text-foreground mb-3">Disponível</p>
            <div className="grid grid-cols-1 gap-3">
              {available.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2.5">
                    <PlatformLogoBadge name={p.name} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      connectedML ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    }`}>
                      {loadingML ? "Verificando..." : connectedML ? "Conectado" : "Desconectado"}
                    </span>
                    <button
                      onClick={connectedML ? disconnectML : connectML}
                      disabled={loadingML}
                      className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-black"
                    >
                      {connectedML ? "Desconectar" : "Conectar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coming soon */}
          <div>
            <p className="text-sm font-bold text-foreground mb-3">Em breve</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {comingSoon.map((p) => (
                <div
                  key={p.id}
                  title="Disponível em breve"
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 opacity-75 grayscale dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <PlatformLogoBadge name={p.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                      Em breve
                    </span>
                    <Toggle on={false} onChange={() => {}} disabled />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Saiba mais sobre{" "}
            <a href="#" className="text-primary hover:underline">Plataformas</a>
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm font-medium text-foreground underline hover:text-muted-foreground transition-colors">
              Cancelar
            </button>
            <button onClick={onClose} className="btn-primary btn-primary--md">
              Concluir
            </button>
          </div>
        </div>
      </div>
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

export default PlatformIntegrationModal;
