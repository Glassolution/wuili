import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { VeloLoadingPill, VeloToaster } from "@/components/ui/velo-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/lib/profileContext";
import AdminRoute from "@/components/AdminRoute";
import ProtectedRoute from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const StartChoicePage = lazy(() => import("./pages/StartChoicePage"));
const CreateStoreStubPage = lazy(() => import("./pages/CreateStoreStubPage"));
const ProductPreparationPage = lazy(() => import("./pages/ProductPreparationPage"));
const ExampleProductSelectionPage = lazy(() => import("./pages/ExampleProductSelectionPage"));
const StoreLanguagePage = lazy(() => import("./pages/StoreLanguagePage"));
const CustomerPersonaPage = lazy(() => import("./pages/CustomerPersonaPage"));
const SalesAnglePage = lazy(() => import("./pages/SalesAnglePage"));
const StoreImagesGenerationPage = lazy(() => import("./pages/StoreImagesGenerationPage"));
const StoreBuildProgressPage = lazy(() => import("./pages/StoreBuildProgressPage"));
const StoreProjectsPage = lazy(() => import("./pages/StoreProjectsPage"));
const GeneratedStoreEditorPage = lazy(() => import("./pages/GeneratedStoreEditorPage"));
const StoreCatalogPage = lazy(() => import("./pages/StoreCatalogPage"));
const PreviewPage = lazy(() => import("./pages/PreviewPage"));
const PublicStorePage = lazy(() => import("./pages/PublicStorePage"));
const SalesCartPage = lazy(() => import("./pages/public-sales/SalesCartPage"));
const SalesCheckoutPage = lazy(() => import("./pages/public-sales/SalesCheckoutPage"));
const SalesThankYouPage = lazy(() => import("./pages/public-sales/SalesThankYouPage"));
const SalesFlowEditorPage = lazy(() => import("./pages/SalesFlowEditorPage"));
const BemVindoPage = lazy(() => import("./pages/BemVindoPage"));
// AuthEntryPage removed — all auth flows consolidated in LoginPage
// CadastroPage removed — progressive login flow handles both signup and login
const SetupPage = lazy(() => import("./pages/SetupPage"));
const AliExpressCallbackPage = lazy(() => import("./pages/AliExpressCallbackPage"));
const MercadoPagoCallbackPage = lazy(() => import("./pages/MercadoPagoCallbackPage"));
const RefCapturePage = lazy(() => import("./pages/RefCapturePage"));
const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const CatalogPage = lazy(() => import("./pages/dashboard/CatalogPage"));
const CatalogoPage = lazy(() => import("./pages/dashboard/CatalogoPage"));
const CatalogoProductDetailPage = lazy(() => import("./pages/dashboard/CatalogoProductDetailPage"));
const TrendingProductsPage = lazy(() => import("./pages/dashboard/TrendingProductsPage"));
const OrdersPage = lazy(() => import("./pages/dashboard/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/dashboard/OrderDetailPage"));
const PublicationsPage = lazy(() => import("./pages/dashboard/PublicationsPage"));
const ProductDetailPage = lazy(() => import("./pages/dashboard/ProductDetailPage"));
const ProdutosMLPage = lazy(() => import("./pages/dashboard/ProdutosMLPage"));
const ReportsPage = lazy(() => import("./pages/dashboard/ReportsPage"));
const ResultsPage = lazy(() => import("./pages/dashboard/ResultsPage"));
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
const AtlasChatPage = lazy(() => import("./pages/dashboard/AtlasChatPage"));
const IntegracoesPage = lazy(() => import("./pages/dashboard/IntegracoesPage"));
const Docs = lazy(() => import("./pages/Docs"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ClientesPage = lazy(() => import("./pages/dashboard/ClientesPage"));
const CommissionsPage = lazy(() => import("./pages/dashboard/CommissionsPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminRefundsPage = lazy(() => import("./pages/admin/AdminRefundsPage"));
const AdminAliExpressPage = lazy(() => import("./pages/admin/AdminAliExpressPage"));
const AdminCommissionsPage = lazy(() => import("./pages/admin/AdminCommissionsPage"));
const AdminBlankPage = lazy(() => import("./pages/admin/AdminBlankPage"));
const ReferralAcceptPage = lazy(() => import("./pages/ReferralAcceptPage"));

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
    <VeloLoadingPill message="Carregando..." />
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
        <VeloToaster />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/comecar" element={<ProtectedRoute><StartChoicePage /></ProtectedRoute>} />
              <Route path="/onboarding/criar-loja" element={<Navigate to="/onboarding/escolher-produto" replace />} />
              <Route path="/onboarding/preparando-produto" element={<ProtectedRoute><ProductPreparationPage /></ProtectedRoute>} />
              <Route path="/onboarding/escolher-produto" element={<ProtectedRoute><ExampleProductSelectionPage /></ProtectedRoute>} />
              <Route path="/onboarding/idioma" element={<ProtectedRoute><StoreLanguagePage /></ProtectedRoute>} />
              <Route path="/onboarding/persona" element={<ProtectedRoute><CustomerPersonaPage /></ProtectedRoute>} />
              <Route path="/onboarding/angulo-vendas" element={<ProtectedRoute><SalesAnglePage /></ProtectedRoute>} />
              <Route path="/onboarding/gerando-imagens" element={<ProtectedRoute><StoreImagesGenerationPage /></ProtectedRoute>} />
              <Route path="/onboarding/preparando-loja" element={<ProtectedRoute><StoreBuildProgressPage /></ProtectedRoute>} />
              <Route path="/minha-loja" element={<Navigate to="/dashboard/minha-loja" replace />} />
              <Route path="/minha-loja/editor" element={<ProtectedRoute><ProfileProvider><GeneratedStoreEditorPage /></ProfileProvider></ProtectedRoute>} />
              <Route path="/minha-loja/editor/:projectId" element={<ProtectedRoute><ProfileProvider><GeneratedStoreEditorPage /></ProfileProvider></ProtectedRoute>} />
              <Route path="/produto/editor" element={<Navigate to="/dashboard" replace />} />
              <Route path="/velods/produto/editor" element={<Navigate to="/dashboard" replace />} />

              <Route path="/catalogo" element={<StoreCatalogPage />} />
              <Route path="/cadastro" element={<Navigate to="/login" replace />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/termos" element={<TermsPage />} />
              <Route path="/privacidade" element={<PrivacyPage />} />
              <Route path="/onboarding/nicho" element={<Navigate to="/comecar" replace />} />
              <Route path="/onboarding/produto" element={<Navigate to="/comecar" replace />} />
              <Route path="/onboarding/gerando" element={<Navigate to="/comecar" replace />} />
              <Route path="/preview/:slug" element={<PublicStorePage />} />
              <Route path="/loja/:slug" element={<PublicStorePage />} />
              <Route path="/loja/:slug/carrinho" element={<SalesCartPage />} />
              <Route path="/loja/:slug/checkout" element={<SalesCheckoutPage />} />
              <Route path="/loja/:slug/obrigado" element={<SalesThankYouPage />} />
              <Route path="/preview/:slug/carrinho" element={<SalesCartPage />} />
              <Route path="/preview/:slug/checkout" element={<SalesCheckoutPage />} />
              <Route path="/preview/:slug/obrigado" element={<SalesThankYouPage />} />
              <Route path="/minha-loja/fluxo" element={<ProtectedRoute><SalesFlowEditorPage /></ProtectedRoute>} />
              <Route path="/bem-vindo" element={<ProtectedRoute><BemVindoPage /></ProtectedRoute>} />
              <Route path="/admin" element={<Navigate to="/admin/painel" replace />} />
              <Route path="/admin/painel" element={<AdminRoute><AdminBlankPage /></AdminRoute>} />
              <Route path="/admin/dashboard" element={<Navigate to="/admin/painel" replace />} />
              <Route path="/admin/product-analytics" element={<Navigate to="/admin/painel" replace />} />
              <Route path="/admin/reporting" element={<Navigate to="/admin/painel" replace />} />
              <Route path="/admin/order-summary" element={<Navigate to="/admin/painel" replace />} />
              <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
              <Route path="/admin/comissoes" element={<AdminRoute><AdminCommissionsPage /></AdminRoute>} />
              <Route path="/admin/suporte" element={<AdminRoute><AdminSupportPage /></AdminRoute>} />
              <Route path="/admin/reembolsos" element={<AdminRoute><AdminRefundsPage /></AdminRoute>} />
              <Route path="/admin/aliexpress" element={<AdminRoute><AdminAliExpressPage /></AdminRoute>} />
              <Route path="/aliexpress/callback" element={<AliExpressCallbackPage />} />
              <Route path="/mercadopago/callback" element={<MercadoPagoCallbackPage />} />
              <Route path="/dashboard" element={<DashboardShell />}>
                <Route index element={<DashboardHomePage />} />
                <Route path="atlas" element={<AtlasChatPage />} />
                <Route path="atlas/:threadId" element={<AtlasChatPage />} />
                <Route path="catalogo" element={<CatalogoPage />} />
                <Route path="catalogo/:id" element={<CatalogoProductDetailPage />} />
                <Route path="produtos-em-alta" element={<TrendingProductsPage />} />
                <Route path="produtos-ml" element={<ProdutosMLPage />} />
                <Route path="saldos" element={<SaldosPage />} />
                <Route path="transacoes" element={<TransacoesPage />} />
                <Route path="comissoes" element={<ProtectedRoute allowedRoles={["admin", "influencer", "affiliate"]}><CommissionsPage /></ProtectedRoute>} />
                <Route path="pagamentos" element={<PagamentosPage />} />
                <Route path="planos" element={<Navigate to="/checkout" replace />} />
                <Route path="clientes" element={<ClientesPage />} />
                <Route path="produtos" element={<CatalogPage />} />
                <Route path="pedidos" element={<OrdersPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />
                <Route path="publicacoes" element={<PublicationsPage />} />
                <Route path="publicacoes/:id" element={<ProductDetailPage />} />
                <Route path="relatorios" element={<ReportsPage />} />
                <Route path="resultados" element={<ResultsPage />} />
                <Route path="minha-conta" element={<div />} />
                <Route path="mais" element={<MorePage />} />
                <Route path="integracoes" element={<IntegracoesPage />} />
                <Route path="configuracoes" element={<SettingsPage />} />
                <Route path="criar-video" element={<CriarVideoPage />} />
                <Route path="chat-fornecedores" element={<ChatFornecedoresPage />} />
                <Route path="minha-loja" element={<StoreProjectsPage />} />
              </Route>
              <Route path="/colecoes" element={<DashboardShell />}>
                <Route index element={<DashboardHomePage />} />
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
