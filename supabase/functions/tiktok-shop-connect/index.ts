import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getTikTokCredentials } from "../_shared/tiktokShop.ts";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);

  let serviceId: string;
  try {
    ({ serviceId } = getTikTokCredentials());
  } catch (e) {
    console.error("[tiktok-shop-connect]", (e as Error).message);
    return json({ error: "Configuracao do servidor incompleta" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Token invalido" }, 401);

  // Guarda a origem para o callback devolver o usuario ao ambiente correto
  // (preview, staging ou producao) em vez de sempre cair em producao.
  let redirectTo: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json() : {};
    const candidate = typeof body?.redirect_to === "string" ? body.redirect_to : null;
    const origin = candidate ?? req.headers.get("origin");
    if (origin && /^https?:\/\//.test(origin)) redirectTo = origin.replace(/\/+$/, "");
  } catch {
    redirectTo = req.headers.get("origin");
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const state = crypto.randomUUID();
  const { error } = await admin.from("tiktok_shop_oauth_states").insert({
    state,
    user_id: userData.user.id,
    redirect_to: redirectTo,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    console.error("[tiktok-shop-connect] state insert:", error.message);
    return json({ error: "Nao foi possivel iniciar a conexao" }, 500);
  }

  const authUrl = `https://services.tiktokshop.com/open/authorize?service_id=${encodeURIComponent(serviceId)}&state=${state}`;
  console.log("[tiktok-shop-connect] auth_url gerada:", authUrl, "redirect_to:", redirectTo);
  return json({ authUrl });
});
