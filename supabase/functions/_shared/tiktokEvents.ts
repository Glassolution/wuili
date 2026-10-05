// Envio de eventos para a TikTok Events API (v1.3 event/track), do servidor.
// O token fica no secret TIKTOK_EVENTS_API_TOKEN. Cada evento é registrado em
// public.tiktok_events com event_id único: impede envio duplicado do nosso lado
// e serve de fila para consultar/reenviar falhas.
// deno-lint-ignore-file no-explicit-any
// `any` aceito só para o client do Supabase (tipagem gerada não existe no Deno).

export const TIKTOK_PIXEL_ID = Deno.env.get("TIKTOK_PIXEL_ID") ?? "DB1U9MRC77U5HCCK5HA0";
const ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(raw?: string | null): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") && digits.length >= 12 ? `+${digits}` : `+55${digits}`;
}

export type TikTokUserData = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  ttclid?: string | null;
  ttp?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type TikTokEventInput = {
  eventName: "Purchase" | "CompleteRegistration";
  eventId: string;
  user: TikTokUserData;
  value?: number;
  currency?: string;
  contentId?: string;
  contentName?: string;
  subscriptionId?: string | null;
  pageUrl?: string;
};

async function buildBody(input: TikTokEventInput) {
  const u = input.user;
  const user: Record<string, unknown> = { external_id: await sha256(u.userId) };
  if (u.email) user.email = await sha256(u.email.trim().toLowerCase());
  const phone = normalizePhone(u.phone);
  if (phone) user.phone = await sha256(phone);
  if (u.ttclid) user.ttclid = u.ttclid;
  if (u.ttp) user.ttp = u.ttp;
  if (u.ip) user.ip = u.ip;
  if (u.userAgent) user.user_agent = u.userAgent;

  const properties: Record<string, unknown> = {};
  if (input.value != null) {
    properties.value = Number(input.value);
    properties.currency = input.currency ?? "BRL";
  }
  if (input.contentId) {
    properties.content_type = "product";
    properties.contents = [{ content_id: input.contentId, content_name: input.contentName, quantity: 1, price: input.value }];
  }

  const body: Record<string, unknown> = {
    event_source: "web",
    event_source_id: TIKTOK_PIXEL_ID,
    data: [{
      event: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      user,
      properties,
      page: { url: input.pageUrl ?? "https://velods.com.br/" },
    }],
  };
  const testCode = Deno.env.get("TIKTOK_TEST_EVENT_CODE");
  if (testCode) body.test_event_code = testCode;
  return body;
}

/** Envia um corpo já montado e atualiza a linha do registro. Nunca lança erro. */
export async function deliverTikTokEvent(admin: any, rowId: string, body: unknown, attempts: number) {
  const token = Deno.env.get("TIKTOK_EVENTS_API_TOKEN");
  let status = "failed";
  let lastError: string | null = null;
  try {
    if (!token) throw new Error("TIKTOK_EVENTS_API_TOKEN não configurado");
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let code: number | null = null;
    try { code = JSON.parse(text).code; } catch { /* resposta não-JSON */ }
    if (res.ok && code === 0) status = "sent";
    else lastError = `[${res.status}] ${text.slice(0, 500)}`;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }
  if (lastError) console.error("tiktok-events: falha", rowId, lastError);
  await admin.from("tiktok_events").update({
    status,
    attempts: attempts + 1,
    last_error: lastError,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", rowId);
  return { status, error: lastError };
}

/**
 * Registra e envia. Se o event_id já existe (webhook repetido), não envia de novo.
 * Nunca lança erro — falhas ficam registradas em tiktok_events.
 */
export async function trackTikTokEvent(admin: any, input: TikTokEventInput) {
  try {
    const body = await buildBody(input);
    const { data: row, error } = await admin.from("tiktok_events").insert({
      event_name: input.eventName,
      event_id: input.eventId,
      user_id: input.user.userId,
      subscription_id: input.subscriptionId ?? null,
      value: input.value ?? null,
      currency: input.value != null ? (input.currency ?? "BRL") : null,
      payload: body,
      test_mode: !!Deno.env.get("TIKTOK_TEST_EVENT_CODE"),
    }).select("id").maybeSingle();
    if (error || !row) return { status: "duplicate" };
    return await deliverTikTokEvent(admin, row.id, body, 0);
  } catch (err) {
    console.error("tiktok-events: erro inesperado", String(err));
    return { status: "failed", error: String(err) };
  }
}

/** Busca dados do comprador no perfil para ligar o evento ao anúncio. */
export async function loadTikTokUser(admin: any, userId: string): Promise<TikTokUserData> {
  const { data } = await admin.from("profiles")
    .select("email,whatsapp,ttclid,tiktok_ttp")
    .eq("user_id", userId).maybeSingle();
  let email = data?.email ?? null;
  if (!email) {
    const { data: au } = await admin.auth.admin.getUserById(userId);
    email = au?.user?.email ?? null;
  }
  return { userId, email, phone: data?.whatsapp ?? null, ttclid: data?.ttclid ?? null, ttp: data?.tiktok_ttp ?? null };
}
