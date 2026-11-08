import { Navigate, useLocation } from "react-router-dom";

/**
 * A Central de Ajuda vive só em /ajuda (fora dos menus, sem indexação).
 * Links antigos para /dashboard/ajuda/... seguem funcionando: vão para o
 * mesmo endereço sem o /dashboard.
 */
const HelpCenterDashboardPage = () => {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/dashboard/, "")}${search}${hash}`} replace />;
};

export default HelpCenterDashboardPage;
