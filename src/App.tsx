import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/lib/profileContext";
import AdminRoute from "@/components/AdminRoute";
import ProtectedRoute from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
// AuthEntryPage removed — all auth flows consolidated in LoginPage
// CadastroPage removed — progressive login flow handles both signup and login
const SetupPage = lazy(() => import("./pages/SetupPage"));
const AliExpressCallbackPage = lazy(() => import("./pages/AliExpressCallbackPage"));
const RefCapturePage = lazy(() => import("./pages/RefCapturePage"));
const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const CatalogPage = lazy(() => import("./pages/dashboard/CatalogPage"));
const CatalogoPage = lazy(() => import("./pages/dashboard/CatalogoPage"));
const OrdersPage = lazy(() => import("./pages/dashboard/OrdersPage"));
const PublicationsPage = lazy(() => import("./pages/dashboard/PublicationsPage"));
const ProductDetailPage = lazy(() => import("./pages/dashboard/ProductDetailPage"));
const ProdutosMLPage = lazy(() => import("./pages/dashboard/ProdutosMLPage"));
const ReportsPage = lazy(() => import("./pages/dashboard/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const DashboardInfoPage = lazy(() => import("./pages/dashboard/DashboardInfoPage"));
const SaldosPage = lazy(() => import("./pages/dashboard/SaldosPage"));
const TransacoesPage = lazy(() => import("./pages/dashboard/TransacoesPage"));
const ProductsPage = lazy(() => import("./pages/dashboard/ProductsPage"));
const PagamentosPage = lazy(() => import("./pages/dashboard/PagamentosPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const CriarVideoPage = lazy(() => import("./pages/dashboard/CriarVideoPage"));
const ChatFornecedoresPage = lazy(() => import("./pages/dashboard/ChatFornecedoresPage"));
const DashboardHomePage = lazy(() => import("./pages/dashboard/DashboardHomePage"));
const Docs = lazy(() => import("./pages/Docs"));
const ClientesPage = lazy(() => import("./pages/dashboard/ClientesPage"));
const CommissionsPage = lazy(() => import("./pages/dashboard/CommissionsPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminRefundsPage = lazy(() => import("./pages/admin/AdminRefundsPage"));
const AdminCommissionsPage = lazy(() => import("./pages/admin/AdminCommissionsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-7 w-7 animate-spin rounded-full border-4 border-black border-t-transparent" />
  </div>
);

const DashboardShell = () => (
  <ProfileProvider>
    <DashboardLayout />
  </ProfileProvider>
);

const MorePage = () => (
  <DashboardInfoPage
    title="Mais"
    description="Agrupe atalhos operacionais e modulos complementares sem poluir a navegacao principal."
    primaryAction="Personalizar atalhos"
    stats={[
      { label: "Atalhos fixados", value: "6", hint: "Disponiveis para o time" },
      { label: "Automacoes", value: "14", hint: "Fluxos ativos no workspace" },
      { label: "Integracoes extras", value: "9", hint: "Apps conectados ao dashboard" },
    ]}
    items={[
      { title: "Central de ajuda", subtitle: "Tutoriais e base de conhecimento da equipe", meta: "Sempre ativo", status: "ok" },
      { title: "Webhooks", subtitle: "2 eventos aguardando revisao", meta: "Integracao", status: "warning" },
      { title: "Campos personalizados", subtitle: "Estrutura pronta para novos modulos", meta: "Flexivel", status: "neutral" },
    ]}
    summary={[
      { label: "Equipe conectada", value: "12 usuarios" },
      { label: "Ultima automacao", value: "Hoje" },
      { label: "Ambiente", value: "Producao" },
    ]}
  />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" expand={false} style={{ width: "100vw", left: 0, top: 0, transform: "none" }} />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cadastro" element={<Navigate to="/login" replace />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
              <Route path="/admin/comissoes" element={<AdminRoute><AdminCommissionsPage /></AdminRoute>} />
              <Route path="/admin/suporte" element={<AdminRoute><AdminSupportPage /></AdminRoute>} />
              <Route path="/admin/reembolsos" element={<AdminRoute><AdminRefundsPage /></AdminRoute>} />
              <Route path="/aliexpress/callback" element={<AliExpressCallbackPage />} />
              <Route path="/dashboard" element={<DashboardShell />}>
                <Route index element={<DashboardHomePage />} />
                <Route path="catalogo" element={<CatalogoPage />} />
                <Route path="produtos-ml" element={<ProdutosMLPage />} />
                <Route path="saldos" element={<SaldosPage />} />
                <Route path="transacoes" element={<TransacoesPage />} />
                <Route path="comissoes" element={<ProtectedRoute allowedRoles={["admin", "influencer", "affiliate"]}><CommissionsPage /></ProtectedRoute>} />
                <Route path="pagamentos" element={<PagamentosPage />} />
                <Route path="planos" element={<Navigate to="/checkout" replace />} />
                <Route path="clientes" element={<ClientesPage />} />
                <Route path="produtos" element={<CatalogPage />} />
                <Route path="pedidos" element={<OrdersPage />} />
                <Route path="publicacoes" element={<PublicationsPage />} />
                <Route path="publicacoes/:id" element={<ProductDetailPage />} />
                <Route path="relatorios" element={<ReportsPage />} />
                <Route path="mais" element={<MorePage />} />
                <Route path="integracoes" element={<Navigate to="/dashboard/produtos" replace />} />
                <Route path="configuracoes" element={<SettingsPage />} />
                <Route path="criar-video" element={<CriarVideoPage />} />
                <Route path="chat-fornecedores" element={<ChatFornecedoresPage />} />
              </Route>
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/ref/:code" element={<RefCapturePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
