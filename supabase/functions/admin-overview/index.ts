import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProfileRow = {
  id: string;
  user_id?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  amount: number | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  mp_payment_id?: string | null;
};

type OnboardingProfileRow = {
  id?: string | null;
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  category?: string | null;
  marketplace?: string | null;
  referral_source?: string | null;
  onboarding_step?: number | null;
  onboarding_completed?: boolean | null;
  payment_status?: string | null;
  lead_origin?: string | null;
  user_status?: string | null;
  created_at: string;
  updated_at?: string | null;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getProfileUserId = (profile: ProfileRow) => profile.user_id ?? profile.id;

async function isAdmin(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    console.error("[admin-overview] isAdmin error:", error);
    return false;
  }
  return !!data;
}

async function loadProfiles(adminClient: ReturnType<typeof createClient>): Promise<ProfileRow[]> {
  const fullSelect = await adminClient
    .from("profiles")
    .select("id,user_id,full_name,display_name,email,avatar_url,created_at")
    .order("created_at", { ascending: false });

  if (!fullSelect.error) return (fullSelect.data ?? []) as ProfileRow[];

  const fallback = await adminClient
    .from("profiles")
    .select("id,user_id,display_name,avatar_url,created_at")
    .order("created_at", { ascending: false });

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []) as ProfileRow[];
}

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function buildMonthlyRevenue(subscriptions: SubscriptionRow[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: getMonthKey(date),
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
      value: 0,
    };
  });

  const revenueByMonth = new Map(months.map((month) => [month.key, month]));

  for (const subscription of subscriptions) {
    const sourceDate = subscription.updated_at ?? subscription.created_at;
    if (!sourceDate) continue;
    const month = revenueByMonth.get(getMonthKey(new Date(sourceDate)));
    if (!month) continue;
    month.value += Number(subscription.amount ?? 0);
  }

  return months;
}

function calculateGrowth(monthlyRevenue: Array<{ value: number }>) {
  const current = monthlyRevenue.at(-1)?.value ?? 0;
  const previous = monthlyRevenue.at(-2)?.value ?? 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const isToday = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const labelOrUnknown = (value?: string | null) => value?.trim() || "Não informado";

function groupRows(rows: OnboardingProfileRow[], key: keyof OnboardingProfileRow) {
  const grouped = new Map<string, number>();
  rows.forEach((row) => {
    const label = labelOrUnknown(row[key] as string | null | undefined);
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });
  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function groupLeadSources(rows: OnboardingProfileRow[]) {
  const grouped = new Map<string, number>();
  rows.forEach((row) => {
    const label = labelOrUnknown(row.referral_source ?? row.lead_origin);
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });
  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildUsersByDay(rows: OnboardingProfileRow[]) {
  const now = new Date();
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", ""),
      users: 0,
    };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));
  rows.forEach((row) => {
    const key = row.created_at?.slice(0, 10);
    const day = byKey.get(key);
    if (day) day.users += 1;
  });
  return days;
}

function buildOnboardingOverview(rows: OnboardingProfileRow[]) {
  const total = rows.length;
  const completedOnboarding = rows.filter((row) => row.onboarding_completed).length;
  const reachedPayment = rows.filter((row) => ["reached_payment", "paid"].includes(row.payment_status ?? "")).length;
  const paid = rows.filter((row) => row.payment_status === "paid").length;

  return {
    metrics: {
      total_users: total,
      new_users_today: rows.filter((row) => isToday(row.created_at)).length,
      onboarding_completed: completedOnboarding,
      reached_payment: reachedPayment,
      paying_users: paid,
      conversion_rate: total > 0 ? (paid / total) * 100 : 0,
    },
    usersByDay: buildUsersByDay(rows),
    sourceBreakdown: groupLeadSources(rows),
    categoryBreakdown: groupRows(rows, "category"),
    marketplaceBreakdown: groupRows(rows, "marketplace"),
    funnel: [
      { name: "Cadastro", value: total },
      { name: "Setup", value: completedOnboarding },
      { name: "Pagamento", value: reachedPayment },
      { name: "Pagou", value: paid },
    ],
    users: rows.map((row) => ({
      id: row.id ?? row.user_id,
      user_id: row.user_id,
      full_name: row.full_name ?? null,
      email: row.email ?? null,
      category: row.category ?? null,
      marketplace: row.marketplace ?? null,
      referral_source: row.referral_source ?? row.lead_origin ?? null,
      onboarding_step: row.onboarding_step ?? 0,
      onboarding_completed: row.onboarding_completed ?? false,
      payment_status: row.payment_status ?? "not_started",
      user_status: row.user_status ?? "lead",
      created_at: row.created_at,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;

    if (!supabaseUrl || !anonKey || !serviceKey || !dbUrl) {
      return json({ error: "Configuracao do servidor incompleta" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(dbUrl, serviceKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData.user) return json({ error: "Token invalido" }, 401);
    if (!(await isAdmin(adminClient, userData.user.id))) {
      return json({ error: "Acesso restrito a admins" }, 403);
    }

    const [
      totalUsersRes,
      paidUsersRes,
      activeSubsRes,
      paidGrossSubsRes,
      totalOrdersRes,
      transactionsRes,
      onboardingProfilesRes,
    ] = await Promise.all([
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      adminClient.from("subscriptions").select("amount").eq("status", "active"),
      adminClient
        .from("subscriptions")
        .select("id,user_id,plan,amount,status,created_at,updated_at,mp_payment_id")
        .in("status", ["active", "paid"])
        .order("updated_at", { ascending: true }),
      adminClient.from("orders").select("id", { count: "exact", head: true }),
      adminClient
        .from("subscriptions")
        .select("id,user_id,plan,amount,status,created_at,updated_at,mp_payment_id")
        .order("updated_at", { ascending: false })
        .limit(20),
      adminClient
        .from("user_profiles")
        .select(
          "id,user_id,full_name,email,category,marketplace,referral_source,onboarding_step,onboarding_completed,payment_status,lead_origin,user_status,created_at,updated_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    const error =
      totalUsersRes.error ??
      paidUsersRes.error ??
      activeSubsRes.error ??
      paidGrossSubsRes.error ??
      totalOrdersRes.error ??
      transactionsRes.error;

    if (error) throw error;
    if (onboardingProfilesRes.error) {
      console.error("[admin-overview] onboarding profiles error:", onboardingProfilesRes.error);
    }

    const profiles = await loadProfiles(adminClient);
    const profilesByUser = new Map<string, ProfileRow>();
    for (const profile of profiles) profilesByUser.set(getProfileUserId(profile), profile);

    const paidSubscriptions = (paidGrossSubsRes.data ?? []) as SubscriptionRow[];
    const monthlyRevenue = buildMonthlyRevenue(paidSubscriptions);
    const grossRevenue = paidSubscriptions.reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0);
    const mrr = ((activeSubsRes.data ?? []) as Array<{ amount: number | null }>).reduce(
      (sum, subscription) => sum + Number(subscription.amount ?? 0),
      0
    );

    const transactions = ((transactionsRes.data ?? []) as SubscriptionRow[]).map((subscription) => {
      const profile = profilesByUser.get(subscription.user_id);
      return {
        id: subscription.id,
        user_id: subscription.user_id,
        user_name: profile?.full_name ?? profile?.display_name ?? profile?.email ?? null,
        email: profile?.email ?? null,
        avatar_url: profile?.avatar_url ?? null,
        plan: subscription.plan,
        amount: Number(subscription.amount ?? 0),
        status: subscription.status,
        created_at: subscription.updated_at ?? subscription.created_at,
        mp_payment_id: subscription.mp_payment_id ?? null,
      };
    });

    return json({
      metrics: {
        total_users: totalUsersRes.count ?? 0,
        paid_users: paidUsersRes.count ?? 0,
        mrr,
        total_orders: totalOrdersRes.count ?? 0,
        gross_revenue: grossRevenue,
        growth_rate: calculateGrowth(monthlyRevenue),
      },
      monthlyRevenue,
      transactions,
      onboarding: buildOnboardingOverview((onboardingProfilesRes.data ?? []) as OnboardingProfileRow[]),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-overview] error:", message);
    return json({ error: "Erro interno" }, 500);
  }
});
