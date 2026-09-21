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

    // Consulta direta (RPC security definer) — instantânea e independente do
    // número de usuários. listUsers paginado levava ~5s e estourava o timeout
    // do frontend, jogando quem estava criando conta para a tela de login.
    const { data, error } = await admin.rpc("auth_email_exists", { p_email: email });
    if (error) {
      console.error("auth-email-exists rpc error:", error.message);
      return json({ exists: false, unknown: true }, 200);
    }

    return json({ exists: data === true });

  } catch {
    return json({ exists: false });
  }
});
