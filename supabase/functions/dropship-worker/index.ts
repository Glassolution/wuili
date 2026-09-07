// Ponte para o worker Node.js externo.
// Autenticação: header `x-worker-token` com o valor do secret DROPSHIP_WORKER_TOKEN.
// Nunca expomos a service role key: ela fica só aqui dentro.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Headers": "content-type, x-worker-token",
      "Content-Type": "application/json",
    },
  });

const ORDER_FIELDS = [
  "status",
  "payment_status",
  "payment_method",
  "payment_reference",
  "pix_gerado_at",
  "pix_expires_at",
  "payment_retry_requested_at",
  "payment_retry_expires_at",
  "payment_retry_count",
  "carrier",
  "tracking_code",
  "tracking_url",
  "notes",
  "locked_by",
  "locked_at",
  "error_detail",
  "support_ticket_required",
  "ml_price_update_status",
  "ml_price_update_error",
  "ml_price_updated_at",
  "c7drop_cart_ref",
  "c7drop_order_ref",
  "c7drop_shipping_method",
  "c7drop_payment_method",
  "c7drop_order_status_text",
  "frete_real",
  "preco_produto",
  "reservado_at",
  "c7drop_checkout_confirmed_at",
  "fornecedor_finalizado_at",
  "etiqueta_ml_anexada_at",
  "cancelado_at",
  "c7drop_cancelled_at",
  "refund_required",
  "refund_status",
  "refund_requested_at",
  "refund_completed_at",
  "refund_error",
] as const;

const ListSchema = z.object({
  action: z.literal("list_orders"),
  status: z.string().min(1).max(50).optional(),
  updated_since: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  // Por padrão o worker ignora pedidos incompletos (sem SKU do C7Drop ou sem
  // etiqueta do Mercado Livre). Use true para listar todos.
  include_incomplete: z.boolean().default(false),
});

const GetSchema = z.object({
  action: z.literal("get_order"),
  order_id: z.string().uuid().optional(),
  order_number: z.string().min(1).max(120).optional(),
}).refine((v) => !!(v.order_id || v.order_number), {
  message: "Informe order_id ou order_number",
});

const UpdateSchema = z.object({
  action: z.literal("update_order"),
  order_id: z.string().uuid().optional(),
  order_number: z.string().min(1).max(120).optional(),
  patch: z.object({
    status: z.string().min(1).max(50).optional(),
    payment_status: z.string().min(1).max(50).optional(),
    payment_method: z.string().max(50).nullable().optional(),
    payment_reference: z.string().max(200).nullable().optional(),
    pix_gerado_at: z.string().datetime().nullable().optional(),
    pix_expires_at: z.string().datetime().nullable().optional(),
    payment_retry_requested_at: z.string().datetime().nullable().optional(),
    payment_retry_expires_at: z.string().datetime().nullable().optional(),
    payment_retry_count: z.number().int().min(0).optional(),
    carrier: z.string().max(100).nullable().optional(),
    tracking_code: z.string().max(120).nullable().optional(),
    codigo_rastreio: z.string().max(120).nullable().optional(),
    tracking_url: z.string().url().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    locked_by: z.string().max(120).nullable().optional(),
    locked_at: z.string().datetime().nullable().optional(),
    error_detail: z.string().max(2000).nullable().optional(),
    erro_detalhe: z.string().max(2000).nullable().optional(),
    support_ticket_required: z.boolean().optional(),
    ml_price_update_status: z.string().max(50).nullable().optional(),
    ml_price_update_error: z.string().max(2000).nullable().optional(),
    ml_price_updated_at: z.string().datetime().nullable().optional(),
    c7drop_cart_ref: z.string().max(200).nullable().optional(),
    c7drop_order_ref: z.string().max(200).nullable().optional(),
    c7drop_shipping_method: z.string().max(120).nullable().optional(),
    c7drop_payment_method: z.string().max(50).nullable().optional(),
    c7drop_order_status_text: z.string().max(500).nullable().optional(),
    frete_real: z.number().nullable().optional(),
    preco_produto: z.number().nullable().optional(),
    reservado_at: z.string().datetime().nullable().optional(),
    c7drop_checkout_confirmed_at: z.string().datetime().nullable().optional(),
    fornecedor_finalizado_at: z.string().datetime().nullable().optional(),
    etiqueta_ml_anexada_at: z.string().datetime().nullable().optional(),
    cancelado_at: z.string().datetime().nullable().optional(),
    c7drop_cancelled_at: z.string().datetime().nullable().optional(),
    refund_required: z.boolean().optional(),
    refund_status: z.string().max(50).nullable().optional(),
    refund_requested_at: z.string().datetime().nullable().optional(),
    refund_completed_at: z.string().datetime().nullable().optional(),
    refund_error: z.string().max(2000).nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).refine((p) => Object.keys(p).length > 0, { message: "patch vazio" }),
  event: z.object({
    event_type: z.string().min(1).max(60).default("status_change"),
    message: z.string().max(1000).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
}).refine((v) => !!(v.order_id || v.order_number), {
  message: "Informe order_id ou order_number",
});

const EventSchema = z.object({
  action: z.literal("log_event"),
  order_id: z.string().uuid(),
  event_type: z.string().min(1).max(60).default("status_change"),
  previous_status: z.string().max(50).optional(),
  new_status: z.string().max(50).optional(),
  message: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const HeartbeatSchema = z.object({
  action: z.literal("worker_heartbeat"),
  worker_id: z.string().min(1).max(120),
  status: z.string().min(1).max(50).default("unknown"),
  current_order_id: z.string().uuid().nullable().optional(),
  current_order_number: z.string().max(120).nullable().optional(),
  details: z.record(z.unknown()).optional(),
});

const AlertSchema = z.object({
  action: z.literal("create_alert"),
  worker_id: z.string().max(120).nullable().optional(),
  order_id: z.string().uuid().nullable().optional(),
  order_number: z.string().max(120).nullable().optional(),
  severity: z.string().min(1).max(30).default("warning"),
  code: z.string().max(120).nullable().optional(),
  message: z.string().max(2000),
  details: z.record(z.unknown()).optional(),
});

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Headers": "content-type, x-worker-token" },
    });
  }
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const expected = Deno.env.get("DROPSHIP_WORKER_TOKEN");
  if (!expected) {
    console.error("[dropship-worker] DROPSHIP_WORKER_TOKEN não configurado");
    return json({ error: "Serviço não configurado" }, 500);
  }
  const provided = req.headers.get("x-worker-token") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "Não autorizado" }, 401);
  }

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") return json({ error: "JSON inválido" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // deno-lint-ignore no-explicit-any -- payload validado logo abaixo por action
  const body = raw as any;

  try {
    switch (body.action) {
      case "list_orders": {
        const parsed = ListSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
        const { status, updated_since, limit, offset, include_incomplete } = parsed.data;
        let q = admin
          .from("dropship_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (!include_incomplete) {
          q = q
            .eq("needs_manual_sku", false)
            .not("etiqueta_ml_url", "is", null);
        }
        if (status) q = q.eq("status", status);
        if (updated_since) q = q.gte("updated_at", updated_since);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json({ orders: data });
      }

      case "get_order": {
        const parsed = GetSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
        const { order_id, order_number } = parsed.data;
        const q = admin.from("dropship_orders").select("*");
        const { data, error } = await (order_id
          ? q.eq("id", order_id)
          : q.eq("order_number", order_number!)
        ).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Pedido não encontrado" }, 404);
        const { data: events } = await admin
          .from("dropship_order_events")
          .select("*")
          .eq("order_id", data.id)
          .order("created_at", { ascending: true });
        return json({ order: data, events: events ?? [] });
      }

      case "update_order": {
        const parsed = UpdateSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
        const { order_id, order_number, event } = parsed.data;
        const { codigo_rastreio, erro_detalhe, ...patchInput } = parsed.data.patch;
        const patch = {
          ...patchInput,
          ...(codigo_rastreio !== undefined ? { tracking_code: codigo_rastreio } : {}),
          ...(erro_detalhe !== undefined ? { error_detail: erro_detalhe } : {}),
        };

        const find = admin.from("dropship_orders").select("id,status");
        const { data: current, error: findErr } = await (order_id
          ? find.eq("id", order_id)
          : find.eq("order_number", order_number!)
        ).maybeSingle();
        if (findErr) return json({ error: findErr.message }, 500);
        if (!current) return json({ error: "Pedido não encontrado" }, 404);

        const { data: updated, error: updErr } = await admin
          .from("dropship_orders")
          .update(patch)
          .eq("id", current.id)
          .select()
          .single();
        if (updErr) return json({ error: updErr.message }, 500);

        const statusChanged = !!patch.status && patch.status !== current.status;
        if (event || statusChanged) {
          await admin.from("dropship_order_events").insert({
            order_id: current.id,
            event_type: event?.event_type ?? "status_change",
            previous_status: current.status,
            new_status: patch.status ?? current.status,
            actor: "worker",
            message: event?.message ?? null,
            metadata: event?.metadata ?? {},
          });
        }

        const trackingCode = typeof updated.tracking_code === "string" && updated.tracking_code.trim()
          ? updated.tracking_code.trim()
          : null;
        const shouldMirrorTracking = !!trackingCode && (
          patch.tracking_code !== undefined ||
          patch.tracking_url !== undefined ||
          patch.status === "rastreio_disponivel"
        );

        if (shouldMirrorTracking) {
          const metadata = updated.metadata && typeof updated.metadata === "object" && !Array.isArray(updated.metadata)
            ? updated.metadata as Record<string, unknown>
            : {};
          const veloOrderId = typeof metadata.velo_order_id === "string" ? metadata.velo_order_id : null;
          const orderUpdate = admin
            .from("orders")
            .update({
              tracking_code: trackingCode,
              status: "shipped",
              updated_at: new Date().toISOString(),
            });

          const { error: mirrorError } = await (veloOrderId
            ? orderUpdate.eq("id", veloOrderId)
            : orderUpdate.eq("external_order_id", String(updated.ml_order_id ?? "")));

          if (mirrorError) {
            console.warn("[dropship-worker] falha ao espelhar rastreio em orders", mirrorError.message);
          } else if (updated.user_id) {
            await admin.from("notifications").insert({
              user_id: updated.user_id,
              type: "order_in_transit",
              title: "Rastreio disponível",
              message: `Pedido ${updated.order_number ?? updated.ml_order_id ?? current.id} recebeu rastreio ${trackingCode}.`,
              action_url: "/dashboard/pedidos",
              metadata: {
                order_id: veloOrderId,
                dropship_order_id: current.id,
                ml_order_id: updated.ml_order_id ?? null,
                tracking_code: trackingCode,
                event: "dropship_tracking_available",
              },
            });
          }
        }

        console.log("[dropship-worker] pedido atualizado", current.id, Object.keys(patch).filter((k) =>
          (ORDER_FIELDS as readonly string[]).includes(k)
        ));
        return json({ order: updated });
      }

      case "log_event": {
        const parsed = EventSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
        const { order_id, ...rest } = parsed.data;
        const { data: exists } = await admin
          .from("dropship_orders").select("id").eq("id", order_id).maybeSingle();
        if (!exists) return json({ error: "Pedido não encontrado" }, 404);

        const { data, error } = await admin.from("dropship_order_events").insert({
          order_id,
          event_type: rest.event_type,
          previous_status: rest.previous_status ?? null,
          new_status: rest.new_status ?? null,
          actor: "worker",
          message: rest.message ?? null,
          metadata: rest.metadata ?? {},
        }).select().single();
        if (error) return json({ error: error.message }, 500);
        return json({ event: data });
      }

      case "worker_heartbeat": {
        const parsed = HeartbeatSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
        const { worker_id, status, current_order_id, current_order_number, details } = parsed.data;

        const { data: order } = current_order_id
          ? await admin.from("dropship_orders").select("order_number").eq("id", current_order_id).maybeSingle()
          : { data: null };

        const { data, error } = await admin
          .from("dropship_worker_heartbeats")
          .upsert({
            worker_id,
            status,
            current_order_id: current_order_id ?? null,
            current_order_number: current_order_number ?? order?.order_number ?? null,
            details: details ?? {},
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "worker_id" })
          .select()
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ heartbeat: data });
      }

      case "create_alert": {
        const parsed = AlertSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
        const { data, error } = await admin
          .from("dropship_worker_alerts")
          .insert({
            worker_id: parsed.data.worker_id ?? null,
            order_id: parsed.data.order_id ?? null,
            order_number: parsed.data.order_number ?? null,
            severity: parsed.data.severity,
            code: parsed.data.code ?? null,
            message: parsed.data.message,
            details: parsed.data.details ?? {},
          })
          .select()
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ alert: data });
      }

      default:
        return json({ error: "Ação inválida" }, 400);
    }
  } catch (err) {
    console.error("[dropship-worker] erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
