import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "./lib/profileContext";
import { ImportedProductsProvider } from "./lib/importedProductsContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import CadastroPage from "./pages/CadastroPage";
import AliExpressCallbackPage from "./pages/AliExpressCallbackPage";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import { Navigate } from "react-router-dom";
import CatalogPage from "./pages/dashboard/CatalogPage";
import OrdersPage from "./pages/dashboard/OrdersPage";
import PublicationsPage from "./pages/dashboard/PublicationsPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import IntegracoesPage from "./pages/dashboard/IntegracoesPage";
import DashboardInfoPage from "./pages/dashboard/DashboardInfoPage";
import SaldosPage from "./pages/dashboard/SaldosPage";
import TransacoesPage from "./pages/dashboard/TransacoesPage";
import ProductsPage from "./pages/dashboard/ProductsPage";
import PagamentosPage from "./pages/dashboard/PagamentosPage";
import CheckoutPage from "./pages/CheckoutPage";
import CriarVideoPage from "./pages/dashboard/CriarVideoPage";
import ChatFornecedoresPage from "./pages/dashboard/ChatFornecedoresPage";
import Docs from "./pages/Docs";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <ProfileProvider>
    <ImportedProductsProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" expand={false} style={{ width: "100vw", left: 0, top: 0, transform: "none" }} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/aliexpress/callback" element={<AliExpressCallbackPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard/produtos" replace />} />
            <Route path="saldos" element={<SaldosPage />} />
            <Route path="transacoes" element={<TransacoesPage />} />
            <Route path="pagamentos" element={<PagamentosPage />} />
            <Route path="planos" element={<Navigate to="/checkout" replace />} />
            <Route
              path="clientes"
              element={
                <DashboardInfoPage
                  title="Clientes"
                  description="Visualize recorrência, ticket médio e interações importantes para priorizar atendimento."
                  primaryAction="Criar segmento"
                  stats={[
                    { label: "Clientes ativos", value: "5", hint: "Compraram nos últimos 90 dias" },
                    { label: "Recorrentes", value: "0%", hint: "Nenhum cliente recorrente ainda" },
                    { label: "Ticket médio", value: "R$ 56,41", hint: "Média por pedido" },
                  ]}
                  items={[
                    { title: "Ana Souza", subtitle: "Organizador de Gaveta — Magalu", meta: "24/05/2025", status: "ok" },
                    { title: "Bruno Ferreira", subtitle: "Elástico de Resistência Set — Mercado Livre", meta: "07/10/2025", status: "neutral" },
                    { title: "Camila Santos", subtitle: "LEGO Compatível City — AliExpress", meta: "03/06/2025", status: "neutral" },
                    { title: "Diego Oliveira", subtitle: "Elástico de Resistência Set — Mercado Livre", meta: "01/09/2025", status: "neutral" },
                    { title: "Elisa Martins", subtitle: "Tênis Running Lite — Mercado Livre", meta: "02/08/2025", status: "neutral" },
                  ]}
                  summary={[
                    { label: "Total de clientes", value: "5" },
                    { label: "Novos este mês", value: "5" },
                    { label: "Canal principal", value: "Mercado Livre" },
                  ]}
                />
              }
            />
            <Route path="produtos" element={<CatalogPage />} />
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
            <Route path="criar-video" element={<CriarVideoPage />} />
            <Route path="chat-fornecedores" element={<ChatFornecedoresPage />} />
          </Route>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ImportedProductsProvider>
    </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
