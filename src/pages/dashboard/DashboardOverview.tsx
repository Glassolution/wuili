import { useEffect, useState } from "react";
import { ArrowUpRight, Boxes, Package, ShoppingCart, Users, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Integration {
  platform: string;
  access_token: string | null;
}

const KNOWN_PLATFORMS = ["Mercado Livre", "Shopee", "AliExpress", "Minha Loja"];
const platformDbMap: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  aliexpress: "AliExpress",
  minhaloja: "Minha Loja",
};

const DashboardOverview = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState("Semanal");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const periods = ["Últimas 24h", "Semanal", "Mensal", "Anual"];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_integrations")
        .select("platform, access_token")
        .eq("user_id", user.id);
      setIntegrations(data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const connectedPlatforms = new Set(
    integrations.filter((i) => i.access_token).map((i) => platformDbMap[i.platform] || i.platform)
  );

  const platforms = KNOWN_PLATFORMS.map((name) => ({
    name,
    connected: connectedPlatforms.has(name),
  }));

  const connectedCount = platforms.filter((p) => p.connected).length;

  const stats = [
    { icon: Wallet, label: "Lucro", value: "R$ 0,00", change: "0%" },
    { icon: ShoppingCart, label: "Pedidos", value: "0", change: "0%" },
    { icon: Package, label: "Produtos vendidos", value: "0", change: "0%" },
    { icon: Users, label: "Clientes", value: "0", change: "0%" },
  ];

  return (
    <div className="space-y-6">
      {/* Period tabs */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              period === p ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-background/80"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card-wuili p-5">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <s.icon size={18} />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {s.change}
              </span>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">{s.label}</p>
            <p className="mt-2 text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + Platforms */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 card-wuili p-6">
          <h3 className="text-sm font-bold mb-4">Faturamento semanal</h3>
          <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
            Nenhum dado de faturamento ainda
          </div>
        </div>

        <div className="lg:col-span-2 card-wuili p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Boxes size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Plataformas conectadas</h3>
              <p className="text-xs text-muted-foreground">
                {loading ? "Carregando..." : `${connectedCount} de ${KNOWN_PLATFORMS.length} conectadas`}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {platforms.map((p) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.connected ? "bg-success" : "bg-muted-foreground/40"}`} />
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                {p.connected ? (
                  <span className="rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-success">Conectado</span>
                ) : (
                  <button
                    onClick={() => window.location.href = "/dashboard/integracoes"}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground"
                  >
                    Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Lucro</p>
              <p className="text-sm font-bold">R$0</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Pedidos</p>
              <p className="text-sm font-bold">0</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Produtos</p>
              <p className="text-sm font-bold">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders table — empty state */}
      <div className="card-wuili overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-bold">Pedidos Recentes</h3>
        </div>
        <div className="p-10 text-center text-muted-foreground text-sm">
          Nenhum pedido ainda
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
