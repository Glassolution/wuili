import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import CatalogPage from "./pages/dashboard/CatalogPage";
import OrdersPage from "./pages/dashboard/OrdersPage";
import PublicationsPage from "./pages/dashboard/PublicationsPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import DashboardInfoPage from "./pages/dashboard/DashboardInfoPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route
              path="saldos"
              element={
                <DashboardInfoPage
                  title="Saldos"
                  description="Acompanhe o saldo disponível, valores a liberar e movimentações recentes das suas operações."
                  primaryAction="Solicitar repasse"
                  stats={[
                    { label: "Disponível", value: "R$ 12.480,00", hint: "Atualizado hoje às 14:32" },
                    { label: "A liberar", value: "R$ 3.240,00", hint: "Previsão para os próximos 3 dias" },
                    { label: "Reservado", value: "R$ 890,00", hint: "Valores em análise e estorno" },
                  ]}
                  items={[
                    { title: "Repasse Mercado Livre", subtitle: "Saldo confirmado para saque", meta: "Hoje", status: "ok" },
                    { title: "Reserva de chargeback", subtitle: "Pedido #4820 em análise", meta: "Ontem", status: "warning" },
                    { title: "Recebimento Minha Loja", subtitle: "Lote 0314 conciliado", meta: "2 dias", status: "ok" },
                  ]}
                  summary={[
                    { label: "Conta principal", value: "Banco Inter" },
                    { label: "Último repasse", value: "R$ 4.200,00" },
                    { label: "Próxima previsão", value: "Amanhã" },
                  ]}
                />
              }
            />
            <Route
              path="transacoes"
              element={
                <DashboardInfoPage
                  title="Transações"
                  description="Centralize entradas, saídas e eventos financeiros com status claros para auditoria rápida."
                  primaryAction="Exportar extrato"
                  stats={[
                    { label: "Entradas", value: "R$ 18.920,00", hint: "Últimos 30 dias" },
                    { label: "Saídas", value: "R$ 6.480,00", hint: "Taxas, frete e custos operacionais" },
                    { label: "Conciliação", value: "98,7%", hint: "Operações validadas automaticamente" },
                  ]}
                  items={[
                    { title: "Pagamento Shopee", subtitle: "Pedido #4818 conciliado", meta: "14:10", status: "ok" },
                    { title: "Tarifa logística", subtitle: "Transportadora parceira", meta: "13:48", status: "neutral" },
                    { title: "Ajuste manual", subtitle: "Diferença identificada na liquidação", meta: "Ontem", status: "warning" },
                  ]}
                  summary={[
                    { label: "Transações hoje", value: "27" },
                    { label: "Última exportação", value: "Hoje" },
                    { label: "Canal principal", value: "Mercado Livre" },
                  ]}
                />
              }
            />
            <Route
              path="clientes"
              element={
                <DashboardInfoPage
                  title="Clientes"
                  description="Visualize recorrência, ticket médio e interações importantes para priorizar atendimento."
                  primaryAction="Criar segmento"
                  stats={[
                    { label: "Clientes ativos", value: "1.248", hint: "Compraram nos últimos 90 dias" },
                    { label: "Recorrentes", value: "36%", hint: "Voltaram a comprar no período" },
                    { label: "Ticket médio", value: "R$ 142,00", hint: "Média por pedido concluído" },
                  ]}
                  items={[
                    { title: "Mariana Costa", subtitle: "3 compras no mês e ticket acima da média", meta: "VIP", status: "ok" },
                    { title: "Eduardo Lima", subtitle: "Solicitou suporte no último pedido", meta: "Hoje", status: "warning" },
                    { title: "Juliana Rocha", subtitle: "Lead novo vindo da loja própria", meta: "Novo", status: "neutral" },
                  ]}
                  summary={[
                    { label: "Novos hoje", value: "18" },
                    { label: "Avaliação média", value: "4,8/5" },
                    { label: "Canal com mais clientes", value: "Shopee" },
                  ]}
                />
              }
            />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="pedidos" element={<OrdersPage />} />
            <Route path="publicacoes" element={<PublicationsPage />} />
            <Route
              path="payments"
              element={
                <DashboardInfoPage
                  title="Payments"
                  description="Gerencie meios de pagamento, aprovações e falhas para manter a conversão do checkout saudável."
                  primaryAction="Adicionar método"
                  stats={[
                    { label: "Aprovadas", value: "92,4%", hint: "Taxa média nas últimas 24h" },
                    { label: "Pix", value: "41%", hint: "Participação no total pago" },
                    { label: "Falhas", value: "23", hint: "Necessitam revisão ou nova tentativa" },
                  ]}
                  items={[
                    { title: "Pix instantâneo", subtitle: "Fluxo normalizado com confirmação automática", meta: "Online", status: "ok" },
                    { title: "Cartão de crédito", subtitle: "Queda leve na aprovação em emissor específico", meta: "Alerta", status: "warning" },
                    { title: "Boleto", subtitle: "Método disponível para loja própria", meta: "Opcional", status: "neutral" },
                  ]}
                  summary={[
                    { label: "Gateway principal", value: "Stripe" },
                    { label: "Chargebacks", value: "0,7%" },
                    { label: "Tempo de liquidação", value: "D+1" },
                  ]}
                />
              }
            />
            <Route
              path="billing"
              element={
                <DashboardInfoPage
                  title="Billing"
                  description="Acompanhe faturas, cobranças recorrentes e eventos de faturamento em um painel simples."
                  primaryAction="Gerar fatura"
                  stats={[
                    { label: "Emitidas", value: "184", hint: "Ciclo atual de cobrança" },
                    { label: "Em aberto", value: "12", hint: "Cobranças aguardando pagamento" },
                    { label: "Recebidas", value: "R$ 28.340,00", hint: "Total faturado no mês" },
                  ]}
                  items={[
                    { title: "Fatura PRO-1032", subtitle: "Plano trimestral da loja TrendStore", meta: "Hoje", status: "ok" },
                    { title: "Cobrança ML-2048", subtitle: "Aguardando confirmação bancária", meta: "Ontem", status: "neutral" },
                    { title: "Recorrência SHOP-551", subtitle: "Cartão expirado para renovação", meta: "Revisar", status: "warning" },
                  ]}
                  summary={[
                    { label: "Próximo vencimento", value: "05/04" },
                    { label: "Método principal", value: "Cartão" },
                    { label: "Inadimplência", value: "1,8%" },
                  ]}
                />
              }
            />
            <Route path="relatorios" element={<ReportsPage />} />
            <Route
              path="mais"
              element={
                <DashboardInfoPage
                  title="Mais"
                  description="Agrupe atalhos operacionais e módulos complementares sem poluir a navegação principal."
                  primaryAction="Personalizar atalhos"
                  stats={[
                    { label: "Atalhos fixados", value: "6", hint: "Disponíveis para o time" },
                    { label: "Automações", value: "14", hint: "Fluxos ativos no workspace" },
                    { label: "Integrações extras", value: "9", hint: "Apps conectados ao dashboard" },
                  ]}
                  items={[
                    { title: "Central de ajuda", subtitle: "Tutoriais e base de conhecimento da equipe", meta: "Sempre ativo", status: "ok" },
                    { title: "Webhooks", subtitle: "2 eventos aguardando revisão", meta: "Integração", status: "warning" },
                    { title: "Campos personalizados", subtitle: "Estrutura pronta para novos módulos", meta: "Flexível", status: "neutral" },
                  ]}
                  summary={[
                    { label: "Equipe conectada", value: "12 usuários" },
                    { label: "Última automação", value: "Hoje" },
                    { label: "Ambiente", value: "Produção" },
                  ]}
                />
              }
            />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
