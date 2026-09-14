/**
 * makeMlWebhookHandler
 * --------------------
 * Fast-ack handler shared by ml-orders-webhook (v1) and ml-orders-webhook-v2.
 * Validates the payload shape, discards `items` notifications for items that
 * are not ours, enqueues the raw event and answers 200 immediately.
 * Real processing happens in ml-webhook-processor (pg_cron) / waitUntil.
 */

import {
  adminClient,
  corsHeaders,
  enqueue,
  extractItemId,
  isKnownItem,
  parseTopic,
  processQueue,
} from "./mlWebhookQueue.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function makeMlWebhookHandler(source: string, tag: string) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // Health check: ML validates the URL before accepting it.
    if (req.method === "GET" || req.method === "HEAD") return json({ ok: true });

    const started = Date.now();
    try {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ ok: true, ignored: "bad_payload" });

      const topic = parseTopic(body as Record<string, unknown>);
      if (!topic || (!topic.includes("item") && !topic.includes("order"))) {
        return json({ ok: true, ignored: "topic" });
      }

      const supabase = adminClient();

      // Dedupe: drop `items` notifications for items we do not own.
      if (topic.includes("item")) {
        const mlItemId = extractItemId(body as Record<string, unknown>);
        if (!mlItemId) return json({ ok: true, ignored: "no_item_id" });
        if (!(await isKnownItem(supabase, mlItemId))) {
          return json({ ok: true, ignored: "unknown_item" });
        }
      }

      const res = await enqueue(supabase, body as Record<string, unknown>, source);
      if (!res.queued) console.error(`[${tag}] enqueue failed:`, res.error);

      // Drain the queue after the response is already on the wire.
      try {
        // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(
          processQueue(supabase, 10).catch((e) =>
            console.error(`[${tag}] background processing error:`, (e as Error).message)
          ),
        );
      } catch {
        // waitUntil unavailable — pg_cron picks the events up anyway
      }

      console.log(`[${tag}] acked topic=${topic} in ${Date.now() - started}ms`);
      return json({ ok: true });
    } catch (e) {
      console.error(`[${tag}] unhandled:`, (e as Error).message);
      // Always 200 so ML does not retry forever / disable the topic
      return json({ ok: true });
    }
  };
}
