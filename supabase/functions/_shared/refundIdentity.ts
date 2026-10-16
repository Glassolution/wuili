// Impede que a mesma pessoa reembolse de novo criando outra conta.
// Guarda só hashes SHA-256 (e-mail normalizado e chave Pix), nunca o dado puro.
// A normalização do e-mail espelha public.refund_normalize_email no banco.

// deno-lint-ignore no-explicit-any -- cliente supabase-js de versões variadas entre funções
type Admin = any;

export const normalizeEmail = (raw: string) => {
  const e = raw.trim().toLowerCase();
  const [local = "", domain = ""] = e.split("@");
  const base = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") return `${base.replace(/\./g, "")}@gmail.com`;
  return `${base}@${domain}`;
};

const normalizePix = (raw: string) => raw.replace(/\s/g, "").toLowerCase();

const sha256 = async (v: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const identityHashes = async (email?: string | null, pix?: string | null) => {
  const out: Array<{ kind: "email" | "pix"; identity_hash: string }> = [];
  if (email?.includes("@")) out.push({ kind: "email", identity_hash: await sha256(normalizeEmail(email)) });
  if (pix?.trim()) out.push({ kind: "pix", identity_hash: await sha256(normalizePix(pix)) });
  return out;
};

const loadIdentity = async (admin: Admin, userId: string, fallbackEmail?: string | null) => {
  const { data } = await admin.from("profiles").select("email, pix_key").eq("user_id", userId).maybeSingle();
  return identityHashes(data?.email ?? fallbackEmail, data?.pix_key);
};

/** true se e-mail ou Pix desta conta já recebeu reembolso em outra conta. */
export const identityAlreadyRefunded = async (admin: Admin, userId: string, authEmail?: string | null) => {
  const hashes = await loadIdentity(admin, userId, authEmail);
  for (const h of hashes) {
    const { data } = await admin
      .from("refund_identity_blocks")
      .select("source_user_id")
      .eq("kind", h.kind)
      .eq("identity_hash", h.identity_hash)
      .neq("source_user_id", userId)
      .limit(1);
    if (data?.length) return true;
  }
  return false;
};

/** Grava a identidade após um reembolso concluído. Sobrevive à exclusão da conta. */
export const recordRefundedIdentity = async (admin: Admin, userId: string) => {
  const hashes = await loadIdentity(admin, userId);
  if (!hashes.length) return;
  await admin
    .from("refund_identity_blocks")
    .upsert(hashes.map((h) => ({ ...h, source_user_id: userId })), { onConflict: "kind,identity_hash", ignoreDuplicates: true });
};
