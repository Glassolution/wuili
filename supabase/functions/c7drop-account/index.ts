import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Headers": "authorization, content-type, x-worker-token",
      "Content-Type": "application/json",
    },
  });

const AccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  phone: z.string().min(8).max(30),
  document: z.string().min(11).max(20),
});

const StatusSchema = z.object({ action: z.literal("get_status") });
const SaveSchema = AccountSchema.extend({ action: z.literal("save_credentials") });
const SignupSchema = AccountSchema.extend({ action: z.literal("request_signup") });
const WorkerCredentialsSchema = z.object({
  action: z.literal("get_credentials"),
  user_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") return json({ error: "JSON invalido" }, 400);
  const body = raw as Record<string, unknown>;

  const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Servico nao configurado" }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    if (body.action === "get_credentials") {
      const expected = Deno.env.get("DROPSHIP_WORKER_TOKEN");
      const provided = req.headers.get("x-worker-token") ?? "";
      if (!expected || !provided || !timingSafeEqual(provided, expected)) {
        return json({ error: "Nao autorizado" }, 401);
      }

      const parsed = WorkerCredentialsSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

      const { data, error } = await admin
        .from("c7drop_user_accounts")
        .select("user_id,status,email,password_ciphertext,password_iv,first_name,last_name,phone,document")
        .eq("user_id", parsed.data.user_id)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data || data.status !== "connected" || !data.password_ciphertext || !data.password_iv) {
        return json({ credentials: null });
      }

      const password = await decryptText(data.password_ciphertext, data.password_iv);
      return json({
        credentials: {
          userId: data.user_id,
          email: data.email,
          password,
          firstName: data.first_name,
          lastName: data.last_name,
          phone: data.phone,
          document: data.document,
        },
      });
    }

    const userId = await authenticatedUserId(req);

    if (body.action === "get_status") {
      const parsed = StatusSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

      const { data, error } = await admin
        .from("c7drop_user_accounts")
        .select("status,email,first_name,last_name,phone,document,signup_payload,last_tested_at,connected_at,updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      return json({ account: sanitizeAccount(data) });
    }

    if (body.action === "save_credentials" || body.action === "request_signup") {
      const parsed = body.action === "save_credentials"
        ? SaveSchema.safeParse(body)
        : SignupSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

      const encrypted = await encryptText(parsed.data.password);
      const now = new Date().toISOString();
      const mode = body.action === "save_credentials" ? "connect_existing" : "create_account";
      const status = "signup_requested";
      const { data, error } = await admin
        .from("c7drop_user_accounts")
        .upsert({
          user_id: userId,
          status,
          email: parsed.data.email.trim().toLowerCase(),
          password_ciphertext: encrypted.ciphertext,
          password_iv: encrypted.iv,
          password_tag: null,
          first_name: parsed.data.first_name.trim(),
          last_name: parsed.data.last_name.trim(),
          phone: parsed.data.phone.trim(),
          document: parsed.data.document.trim(),
          signup_payload: {
            mode,
            requested_at: now,
            email: parsed.data.email.trim().toLowerCase(),
            first_name: parsed.data.first_name.trim(),
            last_name: parsed.data.last_name.trim(),
            phone: parsed.data.phone.trim(),
            document: parsed.data.document.trim(),
          },
          connected_at: null,
          updated_at: now,
        }, { onConflict: "user_id" })
          .select("status,email,first_name,last_name,phone,document,last_tested_at,connected_at,updated_at")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ account: sanitizeAccount(data) });
    }

    return json({ error: "Acao invalida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[c7drop-account]", message);
    return json({ error: message === "unauthorized" ? "Nao autorizado" : "Falha ao processar conta C7Drop" }, message === "unauthorized" ? 401 : 500);
  }
});

async function authenticatedUserId(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("unauthorized");
  return data.user.id;
}

async function encryptionKey() {
  const secret = Deno.env.get("C7DROP_CREDENTIALS_ENCRYPTION_KEY");
  if (!secret) throw new Error("C7DROP_CREDENTIALS_ENCRYPTION_KEY nao configurado");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptText(value: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptText(ciphertext: string, ivText: string) {
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivText) },
    key,
    base64ToBytes(ciphertext),
  );
  return decoder.decode(decrypted);
}

function sanitizeAccount(row: Record<string, unknown> | null) {
  if (!row) return { status: "not_connected" };
  const signupPayload =
    row.signup_payload && typeof row.signup_payload === "object" && !Array.isArray(row.signup_payload)
      ? row.signup_payload as Record<string, unknown>
      : {};
  const workerResult =
    signupPayload.worker_result && typeof signupPayload.worker_result === "object" && !Array.isArray(signupPayload.worker_result)
      ? signupPayload.worker_result as Record<string, unknown>
      : {};
  const message = typeof workerResult.message === "string" ? workerResult.message : null;

  return {
    status: row.status,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    document: row.document,
    message,
    last_tested_at: row.last_tested_at,
    connected_at: row.connected_at,
    updated_at: row.updated_at,
  };
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
