import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "not_authenticated" }, 401);
    const jwt = authHeader.slice("Bearer ".length);

    // Valida o JWT com o servidor de auth
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, service);

    // Best-effort: apagar dados relacionados que não caem em CASCADE do auth.users.
    // Tabelas com FK direta para auth.users(id) com ON DELETE CASCADE serão limpas
    // automaticamente pelo admin.auth.admin.deleteUser abaixo.
    const cleanupTables: { table: string; column: string }[] = [
      { table: "notifications", column: "user_id" },
      { table: "user_page_views", column: "user_id" },
      { table: "user_sessions", column: "user_id" },
      { table: "user_integrations", column: "user_id" },
      { table: "user_publications", column: "user_id" },
      { table: "user_projects", column: "user_id" },
      { table: "orders", column: "user_id" },
      { table: "store_orders", column: "user_id" },
      { table: "sales_reports", column: "user_id" },
      { table: "conversations", column: "user_id" },
      { table: "messages", column: "user_id" },
      { table: "atlas_threads", column: "user_id" },
      { table: "atlas_messages", column: "user_id" },
      { table: "help_feed_posts", column: "author_id" },
      { table: "help_feed_comments", column: "author_id" },
      { table: "help_feed_likes", column: "user_id" },
      { table: "collections", column: "user_id" },
      { table: "affiliates", column: "user_id" },
      { table: "subscriptions", column: "user_id" },
      { table: "refund_requests", column: "user_id" },
      { table: "seller_mp_accounts", column: "user_id" },
      { table: "shopify_connections", column: "user_id" },
      { table: "support_tickets", column: "user_id" },
      { table: "profiles", column: "user_id" },
      { table: "user_roles", column: "user_id" },
    ];

    for (const { table, column } of cleanupTables) {
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) console.warn(`[delete-account] cleanup ${table}: ${error.message}`);
    }

    // Exclui o usuário do Auth (também remove referências com ON DELETE CASCADE).
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("[delete-account] deleteUser error:", delErr);
      return json({ error: "delete_failed", message: delErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("[delete-account] fatal", e);
    return json({ error: "internal_error", message: (e as Error)?.message }, 500);
  }
});
