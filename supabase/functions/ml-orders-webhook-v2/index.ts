/**
 * ml-orders-webhook-v2 (new DevCenter app)
 * ----------------------------------------
 * Fast-ack only: validates, dedupes and enqueues into ml_webhook_queue.
 * Real processing lives in _shared/mlWebhookQueue.ts (cron + waitUntil).
 */
import { makeMlWebhookHandler } from "../_shared/mlWebhookHandler.ts";

Deno.serve(makeMlWebhookHandler("v2", "ml-orders-webhook-v2"));
