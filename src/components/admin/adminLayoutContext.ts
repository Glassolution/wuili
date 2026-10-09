import { createContext, useContext } from "react";

/**
 * Verdadeiro quando a página do admin está dentro do AdminLayout (moldura
 * fixa). Nesse caso o AdminShell da página entrega só o conteúdo: a barra de
 * cima, a sidebar e o tema já estão montados uma vez só pelo layout.
 */
export const AdminLayoutContext = createContext(false);

/** Área rolável de uma página; embaixo, espaço para a barra de abas do celular. */
export const ADMIN_PAGE_SCROLL_CLASS =
  "admin-page-surface min-w-0 overflow-y-auto overflow-x-hidden max-md:pb-[calc(76px+env(safe-area-inset-bottom))]";

/**
 * Falso quando a página está numa aba viva, mas escondida. Consultas com
 * atualização automática usam isso para parar enquanto ninguém está olhando
 * (sem isso, até 6 abas escondidas ficariam consultando o banco).
 */
export const AdminTabActiveContext = createContext(true);

export const useAdminTabActive = () => useContext(AdminTabActiveContext);

/** Intervalo de atualização que pausa quando a aba está escondida. */
export const useAdminPolling = (ms: number) => (useAdminTabActive() ? ms : false);
