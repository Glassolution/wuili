import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BannerIA } from "./BannerIA";
import { MetricCard } from "./MetricCard";
import { SalesChart } from "./SalesChart";
import { MiniMetrics } from "./MiniMetrics";
import { ProductsTable } from "./ProductsTable";
import { Package, ShoppingCart, DollarSign, Headphones } from "lucide-react";

export function DashboardRedesign() {
  const miniMetricsData = [
    { label: "Visitantes na loja", value: 400, variation: -0.05 },
    { label: "Produtos visualizados", value: 8250, variation: -5.27 },
    { label: "Pedidos", value: 200, variation: -10.0 },
    { label: "Taxa de conversão", value: "4.50%", variation: 0.26 },
  ];

  return (
    <div className="min-h-screen bg-[#f3f5f9] text-slate-900">
      <Sidebar />
      <Header />

      <div className="pl-[220px]">
        <main className="min-h-screen px-4 pb-4 pt-[70px] xl:px-5 xl:pb-5 xl:pt-[74px]">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
            <BannerIA productsCount={12} />

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Produtos"
                values={[
                  { label: "Publicados", value: 120 },
                  { label: "Aguardando aprovação", value: 6 },
                ]}
                icon={<Package size={12} />}
              />
              <MetricCard
                title="Pedidos"
                values={[
                  { label: "Processando", value: 14 },
                  { label: "Concluídos", value: 210 },
                ]}
                icon={<ShoppingCart size={12} />}
              />
              <MetricCard
                title="Financeiro"
                values={[
                  { label: "Não recebido", value: "R$ 2.5k" },
                  { label: "Recebido", value: "R$ 45.2k" },
                ]}
                icon={<DollarSign size={12} />}
              />
              <MetricCard
                title="Suporte"
                values={[
                  { label: "Cancelamentos", value: 2 },
                  { label: "Devoluções", value: 4 },
                ]}
                icon={<Headphones size={12} />}
              />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.95fr)] xl:items-start">
                <SalesChart />
                <MiniMetrics metrics={miniMetricsData} />
              </div>
            </section>

            <ProductsTable />
          </div>
        </main>
      </div>
    </div>
  );
}
