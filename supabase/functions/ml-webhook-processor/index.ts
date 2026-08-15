/**
 * ml-webhook-processor
 * --------------------
 * Drains ml_webhook_queue out of the webhook critical path.
 * Scheduled via pg_cron (every minute).
 */
import { adminClient, corsHeaders, processQueue, pruneQueue } from "../_shared/mlWebhookQueue.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
    const summary = await processQueue(supabase, limit);
    const pruned = await pruneQueue(supabase);
    return new Response(JSON.stringify({ ...summary, pruned, ranAt: new Date().toISOString() }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
