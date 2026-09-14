import type { CSSProperties, ReactNode } from "react";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";

/**
 * Moldura branca do conteúdo — o card arredondado que envolve busca, tabelas e
 * listas nas telas do dashboard. Padrão herdado de "Páginas com IA".
 *
 * Telas com mais de um bloco podem usar vários painéis; o `DashboardPageShell`
 * cobre o caso comum (um cabeçalho + um painel).
 */
export const DashboardPanel = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`overflow-hidden rounded-[20px] border border-black/[0.16] bg-white p-4 shadow-[0_2px_5px_rgba(15,17,23,0.13)] sm:p-5 ${className}`}
  >
    {children}
  </div>
);

/**
 * Cabeçalho + moldura numa peça só: o esqueleto padrão de uma tela do
 * dashboard.
 *
 * ```tsx
 * <DashboardPageShell title="Publicações" actions={<BotaoNovo />}>
 *   {conteudo}
 * </DashboardPageShell>
 * ```
 *
 * O Catálogo fica de fora do padrão de propósito: a grade de produtos tem
 * layout próprio, sem moldura.
 */
const DashboardPageShell = ({
  title,
  actions,
  children,
  /** Conteúdo solto, sem a moldura branca (telas que desenham os próprios cards). */
  bare = false,
  className = "",
  panelClassName = "",
  style,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  bare?: boolean;
  className?: string;
  panelClassName?: string;
  style?: CSSProperties;
}) => (
  <div className={`mx-auto w-full max-w-[1560px] ${className}`} style={style}>
    <DashboardPageHeader title={title} actions={actions} />
    {bare ? children : <DashboardPanel className={panelClassName}>{children}</DashboardPanel>}
  </div>
);

export default DashboardPageShell;
