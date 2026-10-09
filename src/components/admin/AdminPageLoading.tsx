import { useContext } from "react";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";
import { AdminLayoutContext } from "@/components/admin/adminLayoutContext";

/**
 * Carregamento de uma página do admin. Dentro da moldura fixa (AdminLayout) é
 * só uma linha fina no topo do conteúdo — a barra e a sidebar continuam ali.
 * Fora dela (painel no estilo antigo), mantém a tela cheia de sempre.
 */
export const AdminPageLoading = ({ message }: { message: string }) => {
  const insideLayout = useContext(AdminLayoutContext);
  if (!insideLayout) return <VeloLoadingScreen message={message} />;
  return (
    <div className="admin-tab-loading" role="progressbar" aria-label={message}>
      <span />
    </div>
  );
};

export default AdminPageLoading;
