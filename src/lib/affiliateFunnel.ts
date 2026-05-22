import { supabase } from "@/integrations/supabase/client";

const COOKIE_NAME = "velo_ref";
const STORAGE_KEY = "velo_referral_code";

const processedKey = (userId: string) => `velo_referral_processed:${userId}`;

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function normalizeReferralCode(code?: string | null) {
  const clean = (code ?? "").trim().toUpperCase();
  return clean ? clean : null;
}

export function setReferralCode(code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // ignore
  }
}

export function getReferralCode() {
  if (typeof window === "undefined") return null;
  const fromCookie = normalizeReferralCode(readCookie(COOKIE_NAME));
  const fromStorage = normalizeReferralCode(window.localStorage.getItem(STORAGE_KEY));
  return fromCookie ?? fromStorage;
}

export async function recordAffiliateVisit(code: string) {
  const affiliateCode = normalizeReferralCode(code);
  if (!affiliateCode) return;
  try {
    await supabase.rpc("rpc_record_affiliate_visit", {
      p_affiliate_code: affiliateCode,
      p_referrer: typeof document !== "undefined" ? document.referrer : null,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch (e) {
    console.warn("[affiliate] rpc_record_affiliate_visit failed", e);
  }
}

export async function attachReferralToCurrentUser(userId: string) {
  const code = getReferralCode();
  if (!code) return;
  if (typeof window === "undefined") return;

  const already = window.localStorage.getItem(processedKey(userId)) === "1";
  if (already) return;

  try {
    await supabase.rpc("rpc_affiliate_attach_signup", { p_affiliate_code: code });
    window.localStorage.setItem(processedKey(userId), "1");
  } catch (e) {
    console.warn("[affiliate] rpc_affiliate_attach_signup failed", e);
  }
}

export async function markAffiliateReachedPayment(userId: string, planValue: number) {
  const code = getReferralCode();
  if (!code) return;
  if (typeof window === "undefined") return;

  // Só tenta marcar reached_payment se ja processamos o cadastro desse usuario.
  const already = window.localStorage.getItem(processedKey(userId)) === "1";
  if (!already) return;

  try {
    await supabase.rpc("rpc_affiliate_mark_reached_payment", {
      p_affiliate_code: code,
      p_plan_value: planValue,
    });
  } catch (e) {
    console.warn("[affiliate] rpc_affiliate_mark_reached_payment failed", e);
  }
}

