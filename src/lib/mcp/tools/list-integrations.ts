import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { adminClient } from "../supabase";

// Never select access_token/refresh_token: credentials must not reach the MCP caller.
const SAFE_COLUMNS = "id,user_id,platform,ml_user_id,expires_at,created_at,updated_at";

export default defineTool({
  name: "list_integrations",
  title: "Listar integrações de marketplace",
  description:
    "Lista as contas conectadas (Mercado Livre, Shopee etc.) dos usuários, sem tokens. Filtre por user_id, platform ou ml_user_id.",
  inputSchema: {
    user_id: z.string().uuid().optional(),
    platform: z.string().optional(),
    ml_user_id: z.number().int().optional(),
    limit: z.number().int().min(1).max(500).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const supabase = await adminClient(ctx);
    let q = supabase.from("user_integrations").select(SAFE_COLUMNS).order("updated_at", { ascending: false }).limit(input.limit);
    if (input.user_id) q = q.eq("user_id", input.user_id);
    if (input.platform) q = q.eq("platform", input.platform);
    if (input.ml_user_id) q = q.eq("ml_user_id", input.ml_user_id);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ rows: data ?? [] }) }] };
  },
});
