// Envia um Purchase de TESTE (test_event_code obrigatório) para a aba "Testar eventos". Só admins.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { trackMetaPurchase } from "../_shared/metaCapi.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ error: "unauthorized" }, 401);
  const { data: me } = await admin.from("profiles").select("is_admin").eq("user_id", auth.user.id).maybeSingle();
  if (!me?.is_admin) return json({ error: "forbidden" }, 403);
  const b = await req.json().catch(() => ({}));
  const code = String(b.test_event_code ?? "").trim();
  if (!/^TEST[A-Z0-9]{1,20}$/i.test(code)) return json({ error: "test_event_code obrigatório (ex.: TEST12345)" }, 400);
  const subscriptionId = String(b.subscription_id ?? "");
  const { data: sub } = await admin.from("subscriptions").select("id,user_id,plan,amount").eq("id", subscriptionId).maybeSingle();
  if (!sub) return json({ error: "assinatura não encontrada" }, 404);
  // event_id próprio de teste: nunca ocupa o purchase_<id> da compra real.
  const r = await trackMetaPurchase(admin, {
    subscriptionId: sub.id, userId: sub.user_id, value: Number(sub.amount ?? 0), plan: sub.plan,
    testEventCode: code, eventIdOverride: `purchase_${sub.id}_test_${Date.now()}`,
  });
  return json(r);
});
