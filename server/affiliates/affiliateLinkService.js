import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const AFFILIATE_LINK_BASE_URL = "https://velods.com.br/ref";
const COMMISSION_RATE = 0.2;
const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 8;

let adminClient;

function getEnv(nameList) {
  for (const name of nameList) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
}

function getBearerToken(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function createAffiliateSupabaseClient(req) {
  const supabaseUrl = getEnv(["DB_URL", "SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const serviceRoleKey = getEnv(["DB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  const anonKey = getEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);

  if (!supabaseUrl) {
    throw new Error("Supabase URL nao configurada no servidor.");
  }

  if (serviceRoleKey) {
    if (!adminClient) {
      adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return adminClient;
  }

  const token = getBearerToken(req);
  if (!anonKey || !token) {
    throw new Error("Supabase service role ou Bearer token nao configurado para operacoes de afiliado.");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function normalizeCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : null;
}

function buildAffiliateLink(code) {
  return `${AFFILIATE_LINK_BASE_URL}/${normalizeCode(code)}`;
}

function makeAffiliateResponse(row) {
  const code = normalizeCode(row?.code ?? row?.ref);
  if (!code) return { code: null, link: null };
  return {
    code,
    // Sempre gera o link a partir do domínio atual, mesmo se a coluna `link`
    // no banco tiver sido preenchida com um domínio antigo.
    link: buildAffiliateLink(code),
  };
}

function generateCode() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

function isUniqueViolation(error) {
  return error?.code === "23505" || /duplicate key|unique/i.test(error?.message ?? "");
}

async function getExistingAffiliate(supabase, userId) {
  const { data, error } = await supabase
    .from("affiliates")
    .select("id,user_id,code,ref,link,commission_rate,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getAffiliateByCode(supabase, code) {
  const normalized = normalizeCode(code);
  const { data, error } = await supabase
    .from("affiliates")
    .select("id,code,ref,link")
    .ilike("code", normalized)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureAffiliateSettings(supabase) {
  const payload = { id: true, commission_rate: COMMISSION_RATE, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("affiliate_settings").upsert(payload, { onConflict: "id" });
  if (error) {
    console.warn("[affiliates] nao foi possivel atualizar affiliate_settings:", error);
  }
}

async function syncProfileRef(supabase, userId, code) {
  const { error } = await supabase
    .from("profiles")
    .update({ ref: normalizeCode(code) })
    .eq("user_id", userId);

  if (error) {
    console.warn("[affiliates] nao foi possivel sincronizar profiles.ref:", error);
  }
}

export async function getAffiliateLinkForUser(req, userId) {
  const supabase = createAffiliateSupabaseClient(req);
  const existing = await getExistingAffiliate(supabase, userId);
  return makeAffiliateResponse(existing);
}

export async function generateAffiliateLinkForUser(req, user) {
  const supabase = createAffiliateSupabaseClient(req);

  await ensureAffiliateSettings(supabase);

  const existing = await getExistingAffiliate(supabase, user.id);
  if (existing) return makeAffiliateResponse(existing);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateCode();

    const codeOwner = await getAffiliateByCode(supabase, code);
    if (codeOwner) continue;

    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      code,
      ref: code,
      link: buildAffiliateLink(code),
      commission_rate: COMMISSION_RATE,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("affiliates")
      .insert(payload)
      .select("id,user_id,code,ref,link,commission_rate,created_at")
      .single();

    if (!error) {
      await syncProfileRef(supabase, user.id, code);
      return makeAffiliateResponse(data);
    }

    if (isUniqueViolation(error)) {
      const afterConflict = await getExistingAffiliate(supabase, user.id);
      if (afterConflict) return makeAffiliateResponse(afterConflict);
      continue;
    }

    throw error;
  }

  throw new Error("Nao foi possivel gerar um codigo unico de afiliado apos varias tentativas.");
}

