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
  "carrier",
  "tracking_code",
  "tracking_url",
  "notes",
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
    carrier: z.string().max(100).nullable().optional(),
    tracking_code: z.string().max(120).nullable().optional(),
    tracking_url: z.string().url().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
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
          q = q.eq("needs_shipping_label", false).eq("needs_manual_sku", false);
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
        const { order_id, order_number, patch, event } = parsed.data;

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

      default:
        return json({ error: "Ação inválida" }, 400);
    }
  } catch (err) {
    console.error("[dropship-worker] erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
