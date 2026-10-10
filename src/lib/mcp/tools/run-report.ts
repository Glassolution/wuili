import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { adminClient, READ_REPORTS } from "../supabase";

export default defineTool({
  name: "run_report",
  title: "Rodar relatório administrativo",
  description: "Executa um relatório administrativo somente leitura da Velo (funis, coortes, pagantes sem publicar, reembolsos etc.).",
  inputSchema: {
    report: z.enum(READ_REPORTS),
    args: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
      .describe("Parâmetros do relatório, ex: {\"p_days\": 30}."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ report, args }, ctx) => {
    const supabase = await adminClient(ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nome de RPC dinâmico
    const { data, error } = await (supabase.rpc as any)(report, args);
    if (error) throw new ToolError(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data ?? null) }] };
  },
});
