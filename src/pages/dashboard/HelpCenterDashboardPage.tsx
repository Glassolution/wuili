import HelpCenterView from "@/components/help-center/HelpCenterView";

/**
 * Mesma Central de Ajuda da rota pública, dentro do painel (/dashboard/ajuda).
 * Sem a moldura do DashboardPageShell: a página segue a referência, solta no
 * fundo branco (o DashboardLayout pinta o <main> de branco nesta rota).
 */
const HelpCenterDashboardPage = () => (
  <div className="mx-auto w-full max-w-[1240px] pb-10 pt-1 lg:pl-4">
    <HelpCenterView basePath="/dashboard/ajuda" />
  </div>
);

export default HelpCenterDashboardPage;
