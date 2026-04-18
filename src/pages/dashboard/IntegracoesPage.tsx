import { useEffect, useState } from "react";
import { Plug, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type IntegrationStatus = "connected" | "not_connected" | "coming_soon";

type PlatformCard = {
  id: string;
  name: string;
  description: string;
  color: string;
  initials: string;
  status: IntegrationStatus;
};

const platforms: PlatformCard[] = [
  { id: "mercadolivre", name: "Mercado Livre", description: "Publique produtos diretamente nos seus anúncios", color: "#FFE600", initials: "ML", status: "not_connected" },
  { id: "shopee", name: "Shopee", description: "Em breve disponível", color: "#F53D2D", initials: "S", status: "coming_soon" },
  { id: "aliexpress", name: "AliExpress", description: "Em breve disponível", color: "#E43225", initials: "AE", status: "coming_soon" },
];

const IntegracoesPage = () => {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState(true);

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

  const handleConnect = (platformId: string) => {
    if (platformId === "mercadolivre" && user) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      window.location.href = `${supabaseUrl}/functions/v1/ml-connect?user_id=${user.id}`;
    }
  };

  const handleDisconnect = async (platformId: string) => {
    if (!user) return;
    await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", platformId);
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
  };

  const getStatus = (p: PlatformCard): IntegrationStatus => {
    if (p.status === "coming_soon") return "coming_soon";
    return statuses[p.id] || "not_connected";
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-[Sora]">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">Conecte suas contas para publicar e gerenciar produtos.</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Carregando...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((p) => {
            const status = getStatus(p);
            return (
              <div key={p.id} className="rounded-xl border border-border bg-background p-5 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold"
                    style={{ backgroundColor: p.color, color: p.color === "#FFE600" ? "#333" : "#fff" }}
                  >
                    {p.initials}
                  </div>
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
                    className="w-full rounded-lg border border-border text-muted-foreground py-2 text-sm font-semibold hover:bg-muted transition-colors"
                  >
                    Desconectar
                  </button>
                )}
                {status === "coming_soon" && (
                  <button disabled className="w-full rounded-lg bg-muted text-muted-foreground py-2 text-sm font-semibold cursor-not-allowed opacity-60">
                    Em breve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IntegracoesPage;
