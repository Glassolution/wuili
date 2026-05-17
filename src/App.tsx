import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "./lib/profileContext";
import { ImportedProductsProvider } from "./lib/importedProductsContext";
import AdminRoute from "./components/AdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import { Navigate } from "react-router-dom";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const CadastroPage = lazy(() => import("./pages/CadastroPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const Docs = lazy(() => import("./pages/Docs"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const AliExpressCallbackPage = lazy(() => import("./pages/AliExpressCallbackPage"));
const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const DashboardHomePage = lazy(() => import("./pages/dashboard/DashboardHomePage"));
const CatalogPage = lazy(() => import("./pages/dashboard/CatalogPage"));
const OrdersPage = lazy(() => import("./pages/dashboard/OrdersPage"));
const PublicationsPage = lazy(() => import("./pages/dashboard/PublicationsPage"));
const ProductDetailPage = lazy(() => import("./pages/dashboard/ProductDetailPage"));
const ReportsPage = lazy(() => import("./pages/dashboard/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const IntegracoesPage = lazy(() => import("./pages/dashboard/IntegracoesPage"));
const DashboardInfoPage = lazy(() => import("./pages/dashboard/DashboardInfoPage"));
const SaldosPage = lazy(() => import("./pages/dashboard/SaldosPage"));
const TransacoesPage = lazy(() => import("./pages/dashboard/TransacoesPage"));
const PagamentosPage = lazy(() => import("./pages/dashboard/PagamentosPage"));
const CriarVideoPage = lazy(() => import("./pages/dashboard/CriarVideoPage"));
const ChatFornecedoresPage = lazy(() => import("./pages/dashboard/ChatFornecedoresPage"));
const ClientesPage = lazy(() => import("./pages/dashboard/ClientesPage"));
const CommissionsPage = lazy(() => import("./pages/dashboard/CommissionsPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminRefundsPage = lazy(() => import("./pages/admin/AdminRefundsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — data stays fresh on navigation
      gcTime: 10 * 60 * 1000,   // 10 minutes in cache after unmount
      refetchOnWindowFocus: false,
    },
  },
});

const AppFallback = () => (
  <div className="min-h-screen bg-background">
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6">
      <div className="h-2 w-44 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-foreground" />
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <ProfileProvider>
    <ImportedProductsProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" expand={false} style={{ width: "100vw", left: 0, top: 0, transform: "none" }} />
      <BrowserRouter>
        <Suspense fallback={<AppFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/suporte" element={<AdminRoute><AdminSupportPage /></AdminRoute>} />
          <Route path="/admin/reembolsos" element={<AdminRoute><AdminRefundsPage /></AdminRoute>} />
          <Route path="/aliexpress/callback" element={<AliExpressCallbackPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHomePage />} />
            <Route path="saldos" element={<SaldosPage />} />
            <Route path="transacoes" element={<TransacoesPage />} />
            <Route path="comissoes" element={<ProtectedRoute allowedRoles={["admin", "influencer"]}><CommissionsPage /></ProtectedRoute>} />
            <Route path="pagamentos" element={<PagamentosPage />} />
            <Route path="planos" element={<Navigate to="/checkout" replace />} />
            <Route
              path="clientes"
              element={<ClientesPage />}
            />
            <Route path="produtos" element={<CatalogPage />} />
            <Route path="pedidos" element={<OrdersPage />} />
            <Route path="publicacoes" element={<PublicationsPage />} />
            <Route path="publicacoes/:id" element={<ProductDetailPage />} />
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
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </ImportedProductsProvider>
    </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
