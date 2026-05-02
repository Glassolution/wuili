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
import AdminRoute from "./components/AdminRoute";
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
import ResetPasswordPage from "./pages/ResetPasswordPage";
import CriarVideoPage from "./pages/dashboard/CriarVideoPage";
import ChatFornecedoresPage from "./pages/dashboard/ChatFornecedoresPage";
import DashboardHomePage from "./pages/dashboard/DashboardHomePage";
import Docs from "./pages/Docs";
import ClientesPage from "./pages/dashboard/ClientesPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — data stays fresh on navigation
      gcTime: 10 * 60 * 1000,   // 10 minutes in cache after unmount
      refetchOnWindowFocus: false,
    },
  },
});

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
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/suporte" element={<AdminRoute><AdminSupportPage /></AdminRoute>} />
          <Route path="/aliexpress/callback" element={<AliExpressCallbackPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHomePage />} />
            <Route path="saldos" element={<SaldosPage />} />
            <Route path="transacoes" element={<TransacoesPage />} />
            <Route path="pagamentos" element={<PagamentosPage />} />
            <Route path="planos" element={<Navigate to="/checkout" replace />} />
            <Route
              path="clientes"
              element={<ClientesPage />}
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
