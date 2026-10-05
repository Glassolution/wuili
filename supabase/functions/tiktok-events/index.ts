// Eventos TikTok pelo servidor.
// - action "complete_registration": chamado pelo app logo após o cadastro,
//   com o MESMO event_id usado pelo pixel do navegador (dedupe no TikTok).
// - action "retry_failed": só admins; reenvia eventos que falharam.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { deliverTikTokEvent, loadTikTokUser, trackTikTokEvent } from "../_shared/tiktokEvents.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("complete_registration"),
    event_id: z.string().min(4).max(128),
    page_url: z.string().url().max(500).optional(),
    ttclid: z.string().max(500).optional(),
    ttp: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal("retry_failed"), limit: z.number().int().min(1).max(200).optional() }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const body = parsed.data;

  if (body.action === "complete_registration") {
    const u = await loadTikTokUser(admin, user.id);
    const result = await trackTikTokEvent(admin, {
      eventName: "CompleteRegistration",
      eventId: body.event_id,
      pageUrl: body.page_url,
      user: {
        ...u,
        email: u.email ?? user.email ?? null,
        ttclid: u.ttclid ?? body.ttclid ?? null,
        ttp: u.ttp ?? body.ttp ?? null,
        ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
        userAgent: req.headers.get("user-agent"),
      },
    });
    return json(result);
  }

  const { data: prof } = await admin.from("profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!prof?.is_admin) return json({ error: "forbidden" }, 403);
  const { data: rows } = await admin.from("tiktok_events")
    .select("id,payload,attempts").eq("status", "failed")
    .order("created_at", { ascending: true }).limit(body.limit ?? 50);
  const results = [];
  for (const r of rows ?? []) results.push({ id: r.id, ...(await deliverTikTokEvent(admin, r.id, r.payload, r.attempts)) });
  return json({ retried: results.length, results });
});
