import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AdminFrame } from "@/components/admin/AdminShell";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";
import { ADMIN_PAGE_SCROLL_CLASS, AdminLayoutContext, AdminTabActiveContext } from "@/components/admin/adminLayoutContext";
import { getAdminPanelStyle } from "@/lib/adminPanelStyle";
import { preloadAdminPages } from "@/pages/admin/adminPages";

/** Quantas abas ficam vivas (montadas e escondidas) para a volta ser instantânea. */
const MAX_LIVE_TABS = 6;

type LiveTab = { element: ReactNode; search: string };


/**
 * Layout das rotas do admin. Monta a moldura (barra de cima, sidebar, tema)
 * uma vez só e mantém as últimas abas visitadas vivas: voltar para uma aba
 * mostra o que já estava lá — dados, rolagem e filtros — sem recarregar.
 */
export const AdminLayout = () => {
  const location = useLocation();
  const outlet = useOutlet();
  const [panelStyle] = useState(() => getAdminPanelStyle());
  const tabs = useRef(new Map<string, LiveTab>());
  const recent = useRef<string[]>([]);

  // Depois que a página aberta assentar, baixa o código das outras abas em
  // segundo plano, uma de cada vez.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void preloadAdminPages(() => cancelled);
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (panelStyle === "old") return <>{outlet}</>;

  const activePath = location.pathname;
  const current = tabs.current.get(activePath);
  // `?aba=` muda o que a página mostra ao abrir: com outra busca, a aba reabre.
  if (!current || current.search !== location.search) {
    tabs.current.set(activePath, { element: outlet, search: location.search });
  }
  recent.current = [activePath, ...recent.current.filter((path) => path !== activePath)].slice(0, MAX_LIVE_TABS);
  for (const path of [...tabs.current.keys()]) {
    if (!recent.current.includes(path)) tabs.current.delete(path);
  }

  return (
    <AdminLayoutContext.Provider value>
      <MotionConfig reducedMotion="user">
        <AdminFrame>
          {[...tabs.current.entries()].map(([path, tab]) => {
            const active = path === activePath;
            return (
              <section
                key={path + tab.search}
                hidden={!active}
                aria-hidden={!active}
                data-active={active || undefined}
                className={`admin-tab absolute inset-0 ${ADMIN_PAGE_SCROLL_CLASS}`}
              >
                <AdminTabActiveContext.Provider value={active}>
                  <Suspense fallback={<AdminPageLoading message="Carregando página" />}>{tab.element}</Suspense>
                </AdminTabActiveContext.Provider>
              </section>
            );
          })}
        </AdminFrame>
      </MotionConfig>
    </AdminLayoutContext.Provider>
  );
};

export default AdminLayout;
