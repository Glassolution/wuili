import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Overview {
  totalUsers: number;
  totalOrders: number;
  activeSubscriptions: number;
  totalRevenue: number;
  pendingOrders: number;
  fulfilledOrders: number;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const AdminDashboardPage = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("admin-overview");
      if (error) {
        setError(error.message);
      } else {
        setData(data as Overview);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Usuários totais", value: data?.totalUsers ?? 0 },
    { label: "Assinaturas ativas", value: data?.activeSubscriptions ?? 0 },
    { label: "Pedidos totais", value: data?.totalOrders ?? 0 },
    { label: "Pedidos pendentes", value: data?.pendingOrders ?? 0 },
    { label: "Pedidos enviados", value: data?.fulfilledOrders ?? 0 },
    { label: "Receita total", value: formatBRL(data?.totalRevenue ?? 0) },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Painel Admin</h1>
        <p className="text-sm text-muted-foreground">Métricas gerais da plataforma.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
