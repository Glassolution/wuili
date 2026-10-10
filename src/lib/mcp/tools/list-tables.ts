import { defineTool } from "@lovable.dev/mcp-js";
import { adminClient, READABLE_TABLES, READ_REPORTS } from "../supabase";

export default defineTool({
  name: "list_tables",
  title: "Listar tabelas e relatórios",
  description: "Lista as tabelas da Velo e os relatórios administrativos que podem ser consultados.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    await adminClient(ctx);
    const payload = { tables: [...READABLE_TABLES], reports: [...READ_REPORTS] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
