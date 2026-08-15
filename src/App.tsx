import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import TourLab from "@/pages/__TourLab";
import { AtlasChatProvider } from "@/contexts/AtlasChatContext";
import DashboardIntroSessionGuard from "@/components/DashboardIntroSessionGuard";
import { VeloToaster } from "@/components/ui/velo-toast";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/lib/profileContext";
import AdminRoute from "@/components/AdminRoute";
import ProtectedRoute from "@/components/ProtectedRoute";
import { UpgradeModalProvider, useUpgradeModal } from "@/components/PlansUpgradeModal";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
// Fluxo de cadastro/onboarding (StartChoicePage + telas /onboarding/*) removido.
const StoreProjectsPage = lazy(() => import("./pages/StoreProjectsPage"));
const GeneratedStoreEditorPage = lazy(() => import("./pages/GeneratedStoreEditorPage"));
const StoreCatalogPage = lazy(() => import("./pages/StoreCatalogPage"));
const PreviewPage = lazy(() => import("./pages/PreviewPage"));
const PublicStorePage = lazy(() => import("./pages/PublicStorePage"));
const PublicStoreCatalogPage = lazy(() =>
  import("./pages/PublicStoreTemplateDispatcher").then((m) => ({ default: m.PublicStoreCatalogDispatcher })),
);
const PublicProductPage = lazy(() =>
  import("./pages/PublicStoreTemplateDispatcher").then((m) => ({ default: m.PublicProductDispatcher })),
);
const PublicStoreAccountPage = lazy(() =>
  import("./pages/PublicStoreTemplateDispatcher").then((m) => ({ default: m.PublicStoreAccountDispatcher })),
);
const SalesCartPage = lazy(() => import("./pages/public-sales/SalesCartPage"));
const SalesCheckoutPage = lazy(() => import("./pages/public-sales/SalesCheckoutPage"));
const SalesLoginPage = lazy(() => import("./pages/public-sales/SalesLoginPage"));
const SalesThankYouPage = lazy(() => import("./pages/public-sales/SalesThankYouPage"));
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
const AiProductPagesPage = lazy(() => import("./pages/dashboard/AiProductPagesPage"));
const AiProductPageCreatePendingPage = lazy(() =>
  import("./pages/dashboard/AiProductPagesPage").then((module) => ({ default: module.AiProductPageCreatePendingPage })),
);
const AiPageGeneratorPage = lazy(() => import("./pages/dashboard/AiPageGeneratorPage"));
const AiPagePreviewPage = lazy(() => import("./pages/dashboard/AiPagePreviewPage"));
const TemplatesPage = lazy(() => import("./pages/dashboard/ModelosPage"));
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
const DocumentacaoComunidadePage = lazy(() => import("./pages/dashboard/DocumentacaoComunidadePage"));
const SugestoesPage = lazy(() => import("./pages/dashboard/SugestoesPage"));
const DashboardHomePage = lazy(() => import("./pages/dashboard/DashboardHomePage"));
const AtlasChatPage = lazy(() => import("./pages/dashboard/AtlasChatPage"));
const IntegracoesPage = lazy(() => import("./pages/dashboard/IntegracoesPage"));
const AdicionarLojaShopifyPage = lazy(() => import("./pages/dashboard/AdicionarLojaShopifyPage"));
const Docs = lazy(() => import("./pages/Docs"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const AssinaturaConfirmadaPage = lazy(() => import("./pages/AssinaturaConfirmadaPage"));
const TemplatePreviewPage = lazy(() => import("./pages/TemplatePreviewPage"));
const TikTokPage = lazy(() => import("./pages/dashboard/TikTokPage"));
const AiImagesPage = lazy(() => import("./pages/dashboard/AiImagesPage"));
const PersonagemVideoPage = lazy(() => import("./pages/dashboard/PersonagemVideoPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ClientesPage = lazy(() => import("./pages/dashboard/ClientesPage"));
const CommissionsPage = lazy(() => import("./pages/dashboard/CommissionsPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminRefundsPage = lazy(() => import("./pages/admin/AdminRefundsPage"));
const AdminAliExpressPage = lazy(() => import("./pages/admin/AdminAliExpressPage"));
const AdminCommissionsPage = lazy(() => import("./pages/admin/AdminCommissionsPage"));
const AdminBlankPage = lazy(() => import("./pages/admin/AdminBlankPage"));
const AdminSalesPage = lazy(() => import("./pages/admin/AdminSalesPage"));
const AdminEvidencePage = lazy(() => import("./pages/admin/AdminEvidencePage"));
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

/**
 * Liga o atributo que desliga o relevo dos botões nas telas de catálogo.
 *
 * Fica no <body> e é controlado pela rota porque as páginas de catálogo têm
 * vários contêineres de topo — marcar no corpo do documento pega todas de uma
 * vez, inclusive o catálogo público fora do dashboard.
 */
const CATALOG_ROUTES = ["/dashboard/catalogo", "/catalogo"];

const FlatButtonsOnCatalog = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const noCatalogo = CATALOG_ROUTES.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
    if (noCatalogo) {
      document.body.dataset.veloFlatButtons = "true";
    } else {
      delete document.body.dataset.veloFlatButtons;
    }
  }, [pathname]);

  return null;
};

const RouteFallback = () => <VeloLoadingScreen message="Carregando..." />;

const DashboardShell = () => (
  <ProfileProvider>
    {/* O chat do Atlas vive acima das páginas: montado aqui, a conversa e o
        progresso do guia sobrevivem à troca de rota. */}
    <AtlasChatProvider>
      <DashboardLayout />
    </AtlasChatProvider>
  </ProfileProvider>
);

const OpenPlansModalRoute = () => {
  const navigate = useNavigate();
  const upgradeModal = useUpgradeModal();

  useEffect(() => {
    upgradeModal.open();
    navigate("/dashboard", { replace: true });
  }, [navigate, upgradeModal]);

  return null;
};


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
        <DashboardIntroSessionGuard />
        <BrowserRouter>
          <UpgradeModalProvider>
          <FlatButtonsOnCatalog />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/__tour-lab" element={<TourLab />} />
              {/* Fluxo de cadastro/onboarding removido — rotas antigas redirecionam ao dashboard. */}
              <Route path="/comecar" element={<Navigate to="/dashboard" replace />} />
              <Route path="/onboarding/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="/minha-loja" element={<Navigate to="/dashboard/minha-loja" replace />} />
              <Route path="/minha-loja/editor" element={<ProtectedRoute><ProfileProvider><GeneratedStoreEditorPage /></ProfileProvider></ProtectedRoute>} />
              <Route path="/minha-loja/editor/:projectId" element={<ProtectedRoute><ProfileProvider><GeneratedStoreEditorPage /></ProfileProvider></ProtectedRoute>} />
              <Route path="/minha-loja/blocos/:projectId" element={<Navigate to="/dashboard/paginas-com-ia" replace />} />
              <Route path="/produto/editor" element={<Navigate to="/dashboard/paginas-com-ia" replace />} />
              <Route path="/velods/produto/editor" element={<Navigate to="/dashboard/paginas-com-ia" replace />} />

              <Route path="/catalogo" element={<StoreCatalogPage />} />
              <Route path="/cadastro" element={<Navigate to="/login" replace />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/convite/:token" element={<ReferralAcceptPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/termos" element={<TermsPage />} />
              {/* Retorno da ValidaPay após pagamento aprovado. Pública: o
                  usuário volta do checkout externo, podendo não estar logado. */}
              <Route path="/assinatura/confirmada" element={<AssinaturaConfirmadaPage />} />
              {/* Só em dev: usada pelo script que gera as miniaturas dos modelos. */}
              {import.meta.env.DEV ? (
                <Route path="/__preview-template/:templateId" element={<TemplatePreviewPage />} />
              ) : null}
              <Route path="/privacidade" element={<PrivacyPage />} />
              <Route path="/preview/:slug" element={<PublicStorePage />} />
              <Route path="/loja/:slug" element={<PublicStorePage />} />
              <Route path="/loja/:slug/catalogo" element={<PublicStoreCatalogPage />} />
              <Route path="/loja/:slug/produto/:productId" element={<PublicProductPage />} />
              <Route path="/loja/:slug/conta" element={<PublicStoreAccountPage />} />
              <Route path="/loja/:slug/carrinho" element={<SalesCartPage />} />
              <Route path="/loja/:slug/checkout" element={<SalesCheckoutPage />} />
              <Route path="/loja/:slug/obrigado" element={<SalesThankYouPage />} />
              <Route path="/loja/:slug/login" element={<SalesLoginPage />} />
              {/* Alias em inglês — URL pública padrão exibida ao dono da loja. */}
              <Route path="/store/:slug" element={<PublicStorePage />} />
              <Route path="/store/:slug/catalogo" element={<PublicStoreCatalogPage />} />
              <Route path="/store/:slug/produto/:productId" element={<PublicProductPage />} />
              <Route path="/store/:slug/conta" element={<PublicStoreAccountPage />} />
              <Route path="/store/:slug/carrinho" element={<SalesCartPage />} />
              <Route path="/store/:slug/checkout" element={<SalesCheckoutPage />} />
              <Route path="/store/:slug/obrigado" element={<SalesThankYouPage />} />
              <Route path="/store/:slug/login" element={<SalesLoginPage />} />

              <Route path="/preview/:slug/carrinho" element={<SalesCartPage />} />
              <Route path="/preview/:slug/checkout" element={<SalesCheckoutPage />} />
              <Route path="/preview/:slug/login" element={<SalesLoginPage />} />
              <Route path="/preview/:slug/obrigado" element={<SalesThankYouPage />} />
              <Route path="/minha-loja/fluxo" element={<Navigate to="/dashboard/paginas-com-ia" replace />} />
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
              <Route path="/admin/vendas" element={<AdminRoute><AdminSalesPage /></AdminRoute>} />
              <Route path="/admin/evidencias" element={<AdminRoute><AdminEvidencePage /></AdminRoute>} />
              <Route path="/admin/aliexpress" element={<AdminRoute><AdminAliExpressPage /></AdminRoute>} />
              <Route path="/aliexpress/callback" element={<AliExpressCallbackPage />} />
              <Route path="/mercadopago/callback" element={<MercadoPagoCallbackPage />} />
              <Route path="/dashboard" element={<DashboardShell />}>
                <Route index element={<DashboardHomePage />} />
                <Route path="atlas" element={<AtlasChatPage />} />
                <Route path="atlas/:threadId" element={<AtlasChatPage />} />
                <Route path="tiktok" element={<TikTokPage />} />
                <Route path="personagem-video" element={<PersonagemVideoPage />} />
                <Route path="catalogo" element={<CatalogoPage />} />
                <Route path="catalogo/:id" element={<CatalogoProductDetailPage />} />
                <Route path="produtos-em-alta" element={<TrendingProductsPage />} />
                <Route path="paginas-com-ia" element={<AiProductPagesPage />} />
                <Route path="paginas-com-ia/criar" element={<AiProductPageCreatePendingPage />} />
                <Route path="paginas-com-ia/gerar" element={<AiPageGeneratorPage />} />
                <Route path="paginas-com-ia/previa/:pageId" element={<AiPagePreviewPage />} />
                <Route path="modelos" element={<TemplatesPage />} />
                <Route path="produtos-ml" element={<ProdutosMLPage />} />
                <Route path="saldos" element={<SaldosPage />} />
                <Route path="transacoes" element={<TransacoesPage />} />
                <Route path="comissoes" element={<CommissionsPage />} />
                <Route path="pagamentos" element={<PagamentosPage />} />
                <Route path="planos" element={<OpenPlansModalRoute />} />
                <Route path="clientes" element={<ClientesPage />} />
                <Route path="produtos" element={<CatalogPage />} />
                <Route path="pedidos" element={<OrdersPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />
                <Route path="publicacoes" element={<PublicationsPage />} />
                <Route path="publicacoes/:id" element={<ProductDetailPage />} />
                <Route path="imagens-ia" element={<AiImagesPage />} />
                {/* Relatórios deu lugar às imagens com IA; o caminho antigo
                    redireciona para não quebrar link já salvo. */}
                <Route path="relatorios" element={<Navigate to="/dashboard/imagens-ia" replace />} />
                <Route path="resultados" element={<ResultsPage />} />
                <Route path="minha-conta" element={<div />} />
                <Route path="mais" element={<MorePage />} />
                <Route path="integracoes" element={<IntegracoesPage />} />
                <Route path="integracoes/adicionar" element={<AdicionarLojaShopifyPage />} />
                <Route path="configuracoes" element={<SettingsPage />} />
                <Route path="criar-video" element={<CriarVideoPage />} />
                <Route path="chat-fornecedores" element={<ChatFornecedoresPage />} />
                <Route path="cursos-ecommerce" element={<DocumentacaoComunidadePage />} />
                <Route path="sugestoes" element={<SugestoesPage />} />
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
          </UpgradeModalProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
