import { supabase } from "@/integrations/supabase/client";

type ProfileInput = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  category?: string | null;
  marketplace?: string | null;
  referralSource?: string | null;
  onboardingStep?: number | null;
  onboardingCompleted?: boolean | null;
  paymentStatus?: "not_started" | "reached_payment" | "paid" | string | null;
  leadOrigin?: string | null;
  userStatus?: string | null;
};

const clean = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const pickDefined = (input: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

export const getLeadOrigin = () => {
  if (typeof window === "undefined") return "Direto";

  const params = new URLSearchParams(window.location.search);
  const source =
    params.get("utm_source") ??
    params.get("source") ??
    params.get("ref") ??
    params.get("origem");

  if (source?.trim()) {
    const normalized = source.trim();
    window.localStorage.setItem("velo_lead_origin", normalized);
    return normalized;
  }

  const stored = window.localStorage.getItem("velo_lead_origin");
  if (stored) return stored;

  if (document.referrer) {
    try {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host) {
        window.localStorage.setItem("velo_lead_origin", host);
        return host;
      }
    } catch {
      // Ignore invalid referrers and fall back to direct.
    }
  }

  return "Direto";
};

export async function upsertOnboardingProfile(input: ProfileInput) {
  if (!input.userId) return { error: null };

  const row = pickDefined({
    user_id: input.userId,
    full_name: clean(input.fullName),
    email: clean(input.email)?.toLowerCase(),
    category: clean(input.category),
    marketplace: clean(input.marketplace),
    referral_source: clean(input.referralSource),
    onboarding_step: input.onboardingStep,
    onboarding_completed: input.onboardingCompleted,
    payment_status: clean(input.paymentStatus),
    lead_origin: clean(input.leadOrigin),
    user_status: clean(input.userStatus),
    updated_at: new Date().toISOString(),
  });

  const { error } = await (supabase as any)
    .from("user_profiles")
    .upsert(row, { onConflict: "user_id" });

  if (error) console.error("[onboarding] profile upsert error:", error);
  return { error };
}

export async function trackOnboardingEvent(
  userId: string | undefined,
  eventName: string,
  eventValue?: string | null,
  metadata: Record<string, unknown> = {},
) {
  if (!userId) return { error: null };

  const { error } = await (supabase as any).from("onboarding_events").insert({
    user_id: userId,
    event_name: eventName,
    event_value: clean(eventValue),
    metadata,
  });

  if (error) console.error("[onboarding] event error:", eventName, error);
  return { error };
}

export async function markReachedPayment(userId: string, metadata: Record<string, unknown> = {}) {
  await Promise.all([
    upsertOnboardingProfile({
      userId,
      onboardingStep: 4,
      paymentStatus: "reached_payment",
      userStatus: "reached_payment",
    }),
    trackOnboardingEvent(userId, "reached_payment", "checkout", metadata),
  ]);
}

export async function markCompletedPayment(userId: string, metadata: Record<string, unknown> = {}) {
  await Promise.all([
    upsertOnboardingProfile({
      userId,
      onboardingStep: 5,
      onboardingCompleted: true,
      paymentStatus: "paid",
      userStatus: "paid",
    }),
    trackOnboardingEvent(userId, "completed_payment", "paid", metadata),
  ]);
}
