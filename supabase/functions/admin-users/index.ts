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
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
};

const json = (body: Record<string, unknown> | unknown[], status = 200) =>
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
    console.error("[admin-users] isAdmin error:", error.message);
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

    const profiles = await loadProfiles(adminClient);
    const userIds = profiles.map(getProfileUserId).filter(Boolean);

    const [subsRes, integrationsRes, ordersRes] = await Promise.all([
      userIds.length
        ? adminClient
            .from("subscriptions")
            .select("id,user_id,plan,amount,status,created_at,updated_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? adminClient
            .from("user_integrations")
            .select("user_id,platform")
            .in("user_id", userIds)
            .eq("platform", "mercadolivre")
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? adminClient.from("orders").select("user_id").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const error = subsRes.error ?? integrationsRes.error ?? ordersRes.error;
    if (error) throw error;

    const latestSubByUser = new Map<string, SubscriptionRow>();
    for (const subscription of (subsRes.data ?? []) as SubscriptionRow[]) {
      if (!latestSubByUser.has(subscription.user_id)) {
        latestSubByUser.set(subscription.user_id, subscription);
      }
    }

    const mlConnectedUsers = new Set<string>(
      ((integrationsRes.data ?? []) as Array<{ user_id: string | null }>)
        .map((item) => item.user_id)
        .filter(Boolean) as string[]
    );

    const ordersByUser = new Map<string, number>();
    for (const order of (ordersRes.data ?? []) as Array<{ user_id: string | null }>) {
      if (!order.user_id) continue;
      ordersByUser.set(order.user_id, (ordersByUser.get(order.user_id) ?? 0) + 1);
    }

    return json(
      profiles.map((profile) => {
        const profileUserId = getProfileUserId(profile);
        const subscription = latestSubByUser.get(profileUserId);

        return {
          user_id: profileUserId,
          name: profile.full_name ?? profile.display_name ?? profile.email ?? null,
          email: profile.email ?? null,
          avatar_url: profile.avatar_url ?? null,
          plan: subscription?.plan ?? null,
          subscription_status: subscription?.status ?? null,
          created_at: profile.created_at,
          ml_connected: mlConnectedUsers.has(profileUserId),
          orders_count: ordersByUser.get(profileUserId) ?? 0,
        };
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-users] error:", message);
    return json({ error: "Erro interno" }, 500);
  }
});
