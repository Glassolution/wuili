import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { adminClient, READABLE_TABLES } from "../supabase";

const filterSchema = z.object({
  column: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is", "in"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number()]))]),
});

export default defineTool({
  name: "query_table",
  title: "Consultar tabela",
  description: "Lê linhas de uma tabela da Velo com filtros, ordenação e limite (somente leitura). Use count_only para contar.",
  inputSchema: {
    table: z.enum(READABLE_TABLES),
    columns: z.string().default("*").describe("Colunas separadas por vírgula, ex: 'id,email,plan'."),
    filters: z.array(filterSchema).max(10).default([]),
    order_by: z.string().regex(/^[a-z_][a-z0-9_]*$/).optional(),
    ascending: z.boolean().default(false),
    limit: z.number().int().min(1).max(500).default(50),
    offset: z.number().int().min(0).default(0),
    count_only: z.boolean().default(false),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const supabase = await adminClient(ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela dinâmica, não tipável estaticamente
    let q: any = supabase
      .from(input.table)
      .select(input.count_only ? "*" : input.columns, input.count_only ? { count: "exact", head: true } : { count: "exact" });
    for (const f of input.filters) {
      if (f.op === "in") {
        if (!Array.isArray(f.value)) throw new ToolError("O filtro 'in' precisa de uma lista.");
        q = q.in(f.column, f.value);
      } else if (f.op === "is") {
        q = q.is(f.column, f.value);
      } else {
        q = q[f.op](f.column, f.value);
      }
    }
    if (!input.count_only) {
      if (input.order_by) q = q.order(input.order_by, { ascending: input.ascending });
      q = q.range(input.offset, input.offset + input.limit - 1);
    }
    const { data, error, count } = await q;
    if (error) throw new ToolError(error.message);
    const payload = { count: count ?? null, rows: input.count_only ? [] : (data ?? []) };
    return { content: [{ type: "text", text: JSON.stringify(payload) }] };
  },
});
