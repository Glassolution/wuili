import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "./lib/profileContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import CadastroPage from "./pages/CadastroPage";
import AliExpressCallbackPage from "./pages/AliExpressCallbackPage";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import AIChatPage from "./pages/dashboard/GitChatPage";
import CatalogPage from "./pages/dashboard/CatalogPage";
import OrdersPage from "./pages/dashboard/OrdersPage";
import PublicationsPage from "./pages/dashboard/PublicationsPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import IntegracoesPage from "./pages/dashboard/IntegracoesPage";
import DashboardInfoPage from "./pages/dashboard/DashboardInfoPage";
import SaldosPage from "./pages/dashboard/SaldosPage";
import TransacoesPage from "./pages/dashboard/TransacoesPage";
import PagamentosPage from "./pages/dashboard/PagamentosPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <ProfileProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/aliexpress/callback" element={<AliExpressCallbackPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardOverview />} />
            <Route path="ia" element={<AIChatPage />} />
            <Route path="saldos" element={<SaldosPage />} />
            <Route path="transacoes" element={<TransacoesPage />} />
            <Route path="pagamentos" element={<PagamentosPage />} />
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
            <Route path="integracoes" element={<IntegracoesPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
