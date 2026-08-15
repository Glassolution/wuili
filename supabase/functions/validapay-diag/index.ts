// Diagnóstico da integração ValidaPay: apenas confirma que a autenticação OAuth2
// funciona com as credenciais salvas. Não expõe nenhum secret.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getValidaPayToken, VALIDAPAY_API_URL, VALIDAPAY_AUTH_URL } from "../_shared/validapay.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return json({ error: "Não autenticado" }, 401);

  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!isAdmin) return json({ error: "not_admin" }, 403);

  try {
    const token = await getValidaPayToken();
    return json({
      ok: true,
      authUrl: VALIDAPAY_AUTH_URL,
      apiUrl: VALIDAPAY_API_URL,
      tokenLength: token.length,
      webhookTokenConfigured: Boolean(Deno.env.get("VALIDAPAY_WEBHOOK_TOKEN")),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message }, 500);
  }
});
