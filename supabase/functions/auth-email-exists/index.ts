import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email: rawEmail } = await req.json().catch(() => ({ email: null }));
    const email = normalizeEmail(rawEmail);
    if (!email) return json({ exists: false });

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("DB_URL") ?? "";
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("DB_SERVICE_ROLE_KEY") ??
      "";

    if (!supabaseUrl || !serviceKey) return json({ exists: false });

    const admin = createClient(supabaseUrl, serviceKey);

    // Paginação para escalar além de 50 usuários (default do listUsers).
    let page = 1;
    const perPage = 1000;
    while (page <= 10) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return json({ exists: false });
      const users = data?.users ?? [];
      if (users.some((u) => u.email?.toLowerCase() === email)) {
        return json({ exists: true });
      }
      if (users.length < perPage) break;
      page++;
    }

    return json({ exists: false });
  } catch {
    return json({ exists: false });
  }
});
