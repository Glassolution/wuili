// Purchase pela API de Conversões da Meta, do servidor.
// Token: secret META_CAPI_ACCESS_TOKEN. Envio real só com META_CAPI_ENABLED=true;
// sem isso grava status=disabled. Cada evento fica em public.meta_capi_events
// com event_id único (purchase_<subscription_id>), o mesmo do pixel do navegador.
// deno-lint-ignore-file no-explicit-any
// `any` aceito só para o client do Supabase (sem tipagem gerada no Deno).

export const META_PIXEL_ID = "1471185231740534";
const GRAPH = "https://graph.facebook.com/v21.0";
export const META_EVENT_SOURCE_URL = "https://www.velods.com.br/assinatura/confirmada";

export function purchaseEventId(subscriptionId: string) { return `purchase_${subscriptionId}`; }

export async function sha256(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Meta: só dígitos, com DDI, sem "+". */
export function normalizeMetaPhone(raw?: string | null): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export type MetaUser = { userId: string; email?: string | null; phone?: string | null; fbc?: string | null; fbp?: string | null; fbclid?: string | null; capturedAt?: string | null };

export async function loadMetaUser(admin: any, userId: string): Promise<MetaUser> {
  const { data } = await admin.from("profiles")
    .select("email,whatsapp,meta_fbc,meta_fbp,meta_fbclid,meta_click_captured_at")
    .eq("user_id", userId).maybeSingle();
  let email = data?.email ?? null;
  if (!email) { const { data: au } = await admin.auth.admin.getUserById(userId); email = au?.user?.email ?? null; }
  return { userId, email, phone: data?.whatsapp ?? null, fbc: data?.meta_fbc ?? null, fbp: data?.meta_fbp ?? null, fbclid: data?.meta_fbclid ?? null, capturedAt: data?.meta_click_captured_at ?? null };
}

export async function buildPurchaseBody(i: { eventId: string; value: number; plan: string; user: MetaUser; eventTime?: number; testEventCode?: string | null }) {
  const u = i.user;
  const user_data: Record<string, unknown> = { external_id: [await sha256(u.userId)] };
  if (u.email) user_data.em = [await sha256(u.email.trim().toLowerCase())];
  const ph = normalizeMetaPhone(u.phone);
  if (ph) user_data.ph = [await sha256(ph)];
  const fbc = u.fbc ?? (u.fbclid ? `fb.1.${u.capturedAt ? Date.parse(u.capturedAt) : Date.now()}.${u.fbclid}` : null);
  if (fbc) user_data.fbc = fbc;
  if (u.fbp) user_data.fbp = u.fbp;
  const body: Record<string, unknown> = {
    data: [{
      event_name: "Purchase",
      event_time: i.eventTime ?? Math.floor(Date.now() / 1000),
      event_id: i.eventId,
      action_source: "website",
      event_source_url: META_EVENT_SOURCE_URL,
      user_data,
      custom_data: { value: Number(i.value), currency: "BRL", content_type: "product", content_ids: [`plano_${i.plan}`] },
    }],
  };
  if (i.testEventCode) body.test_event_code = i.testEventCode;
  return body;
}

export async function trackMetaPurchase(admin: any, i: { subscriptionId: string; userId: string; value: number; plan: string; eventTime?: number; testEventCode?: string | null; eventIdOverride?: string }) {
  const eventId = i.eventIdOverride ?? purchaseEventId(i.subscriptionId);
  const isTest = Boolean(i.testEventCode);
  const enabled = Deno.env.get("META_CAPI_ENABLED") === "true";
  const { data: existing } = await admin.from("meta_capi_events").select("id,status,attempts").eq("event_id", eventId).maybeSingle();
  if (existing && (existing.status === "sent" || existing.status === "test")) return { skipped: "duplicate", eventId };
  const row = { event_name: "Purchase", event_id: eventId, user_id: i.userId, subscription_id: i.subscriptionId, value: i.value, currency: "BRL", test_event_code: i.testEventCode ?? null };
  if (!existing) {
    const { error } = await admin.from("meta_capi_events").insert({ ...row, status: "disabled" });
    if (error) return { skipped: "insert_conflict", eventId };
  }
  if (!enabled && !isTest) return { skipped: "disabled", eventId };
  const token = Deno.env.get("META_CAPI_ACCESS_TOKEN");
  if (!token) {
    await admin.from("meta_capi_events").update({ status: "failed", response_body: "missing_token" }).eq("event_id", eventId);
    return { error: "missing_token", eventId };
  }
  const user = await loadMetaUser(admin, i.userId);
  const body = await buildPurchaseBody({ eventId, value: i.value, plan: i.plan, user, eventTime: i.eventTime, testEventCode: i.testEventCode });
  const res = await fetch(`${GRAPH}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const text = (await res.text()).slice(0, 2000);
  await admin.from("meta_capi_events").update({
    status: res.ok ? (isTest ? "test" : "sent") : "failed",
    response_status: res.status, response_body: text,
    attempts: (existing?.attempts ?? 0) + 1, sent_at: res.ok ? new Date().toISOString() : null,
  }).eq("event_id", eventId);
  return { ok: res.ok, status: res.status, eventId, body: text };
}
