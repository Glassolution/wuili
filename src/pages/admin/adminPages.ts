import { lazy } from "react";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Páginas do admin carregadas sob demanda. Os mesmos carregadores servem para
 * o pré-carregamento: o AdminLayout baixa todas em segundo plano assim que o
 * admin abre, e a sidebar adianta a aba quando o mouse passa por cima — a
 * troca de aba não espera o download do código.
 */
export const adminPageLoaders = {
  "/admin/painel": () => import("./AdminPanelPage"),
  "/admin/usuarios": () => import("./AdminUsersRoutePage"),
  "/admin/comissoes": () => import("./AdminCommissionsRoutePage"),
  "/admin/suporte": () => import("./AdminSupportPage"),
  "/admin/assistente-ia": () => import("./AdminAiEscalationsPage"),
  "/admin/reembolsos": () => import("./AdminRefundsRoutePage"),
  "/admin/vendas": () => import("./AdminSalesRoutePage"),
  "/admin/evidencias": () => import("./AdminEvidencePage"),
  "/admin/consulta": () => import("./AdminDiagnosticsPage"),
  "/admin/rastreio": () => import("./AdminTrackingPage"),
  "/admin/automacao-bot": () => import("./AdminBotAutomationPage"),
  "/admin/central-de-ajuda": () => import("./AdminHelpCenterPage"),
  "/admin/aliexpress": () => import("./AdminAliExpressPage"),
} as const;

type AdminPath = keyof typeof adminPageLoaders;

type DataModule = { prefetchAdminData?: (queryClient: QueryClient) => Promise<unknown> };

/** Abas que também têm os dados principais buscados de antemão. */
const adminDataModules: Partial<Record<AdminPath, () => Promise<DataModule>>> = {
  "/admin/usuarios": () => import("./AdminUsersPage"),
  "/admin/suporte": () => import("./AdminSupportPage"),
  "/admin/reembolsos": () => import("./AdminRefundsPage"),
  "/admin/comissoes": () => import("./AdminCommissionsPage"),
  "/admin/vendas": () => import("./AdminSalesPage"),
};

/** Ordem do pré-carregamento: as abas mais usadas primeiro. */
const PRELOAD_ORDER: AdminPath[] = [
  "/admin/painel",
  "/admin/vendas",
  "/admin/usuarios",
  "/admin/suporte",
  "/admin/comissoes",
  "/admin/reembolsos",
  "/admin/assistente-ia",
  "/admin/rastreio",
  "/admin/consulta",
  "/admin/evidencias",
  "/admin/automacao-bot",
  "/admin/central-de-ajuda",
  "/admin/aliexpress",
];

/**
 * Baixa o código da aba. Com `queryClient` (mouse ou foco no item da sidebar,
 * sinal de que a aba vai abrir), também busca os dados principais dela.
 */
export const preloadAdminPage = async (path: string, queryClient?: QueryClient) => {
  const load = adminPageLoaders[path as AdminPath];
  if (!load) return;
  try {
    await load();
    const dataModule = adminDataModules[path as AdminPath];
    if (queryClient && dataModule) await (await dataModule()).prefetchAdminData?.(queryClient);
  } catch {
    // pré-carregamento é só adiantamento: se falhar, a aba carrega ao abrir
  }
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Baixa o código das abas uma de cada vez, com uma pausa entre elas, para não
 * disputar rede e processador com a página aberta. Dados ficam de fora de
 * propósito: buscar tudo de todas as abas sobrecarregaria o banco.
 */
export const preloadAdminPages = async (isCancelled: () => boolean) => {
  for (const path of PRELOAD_ORDER) {
    if (isCancelled()) return;
    await preloadAdminPage(path);
    await pause(200);
  }
};

export const AdminPanelPage = lazy(adminPageLoaders["/admin/painel"]);
export const AdminUsersPage = lazy(adminPageLoaders["/admin/usuarios"]);
export const AdminCommissionsPage = lazy(adminPageLoaders["/admin/comissoes"]);
export const AdminSupportPage = lazy(adminPageLoaders["/admin/suporte"]);
export const AdminAiEscalationsPage = lazy(adminPageLoaders["/admin/assistente-ia"]);
export const AdminRefundsPage = lazy(adminPageLoaders["/admin/reembolsos"]);
export const AdminSalesPage = lazy(adminPageLoaders["/admin/vendas"]);
export const AdminEvidencePage = lazy(adminPageLoaders["/admin/evidencias"]);
export const AdminDiagnosticsPage = lazy(adminPageLoaders["/admin/consulta"]);
export const AdminTrackingPage = lazy(adminPageLoaders["/admin/rastreio"]);
export const AdminBotAutomationPage = lazy(adminPageLoaders["/admin/automacao-bot"]);
export const AdminHelpCenterPage = lazy(adminPageLoaders["/admin/central-de-ajuda"]);
export const AdminAliExpressPage = lazy(adminPageLoaders["/admin/aliexpress"]);
