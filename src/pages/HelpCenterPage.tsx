import HelpCenterView from "@/components/help-center/HelpCenterView";
import HelpCenterShell, { useSupportLink } from "@/components/help-center/HelpCenterShell";

/**
 * Central de Ajuda (/ajuda). Fica fora de todos os menus do app: só chega
 * aqui quem tem o link (enviado pelo suporte). Cabeçalho, noindex e botão de
 * suporte moram em HelpCenterShell.
 */
const HelpCenterPage = () => {
  const supportTo = useSupportLink();
  return (
    <HelpCenterShell>
      <HelpCenterView basePath="/ajuda" supportPath={supportTo} />
    </HelpCenterShell>
  );
};

export default HelpCenterPage;
