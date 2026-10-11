import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTables from "./tools/list-tables";
import queryTable from "./tools/query-table";
import runReport from "./tools/run-report";
import listIntegrations from "./tools/list-integrations";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "velo",
  title: "Velo",
  version: "0.1.0",
  instructions:
    "Ferramentas administrativas somente leitura da Velo. Use list_tables para ver o que existe, query_table para ler e contar linhas com filtros (respostas do ML ficam em ml_publish_errors, ml_seller_readiness, ml_republication_log, ml_compliance_fixes), list_integrations para contas conectadas (sem tokens) e run_report para relatórios. Exige conta admin.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTables, queryTable, runReport, listIntegrations],
});
