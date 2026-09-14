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
  const { data } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

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

    // Quando o cliente pede apenas alguns usuários (ex.: fallback do suporte),
    // evitamos varrer os milhares de usuários do projeto.
    let requestedIds: string[] = [];
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body?.user_ids)) {
          requestedIds = body.user_ids.filter((id: unknown) => typeof id === "string");
        }
      } catch {
        /* corpo vazio */
      }
    }

    // deno-lint-ignore no-explicit-any -- usuários do auth têm shape heterogêneo
    const authUsers: any[] = [];
    if (requestedIds.length > 0) {
      const found = await Promise.all(
        requestedIds.map(async (id) => {
          const { data } = await adminClient.auth.admin.getUserById(id);
          return data?.user ?? null;
        })
      );
      authUsers.push(...found.filter(Boolean));
    } else {
      const perPage = 1000;
      for (let page = 1; ; page += 1) {
        const { data, error: authError } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (authError) throw authError;
        authUsers.push(...data.users);
        if (data.users.length < perPage) break;
      }
    }

    const userIds = authUsers.map((u) => u.id).filter(Boolean);

    // A URL do PostgREST estoura (Invalid URL) com milhares de ids em .in().
    // Buscamos em lotes paralelos e concatenamos os resultados.
    const CHUNK = 150;
    // deno-lint-ignore no-explicit-any -- retornos heterogêneos das tabelas
    const fetchChunked = async (build: (ids: string[]) => any): Promise<any[]> => {
      const slices: string[][] = [];
      for (let i = 0; i < userIds.length; i += CHUNK) slices.push(userIds.slice(i, i + CHUNK));
      const results = await Promise.all(slices.map((ids) => build(ids)));
      const rows: any[] = [];
      for (const { data, error } of results) {
        if (error) throw error;
        rows.push(...(data ?? []));
      }
      return rows;
    };


    const [profilesRows, subsRows, integrationsRows, ordersRows] = await Promise.all([
      fetchChunked((ids) =>
        adminClient.from("profiles").select("id,user_id,display_name,avatar_url,created_at").in("user_id", ids)
      ),
      fetchChunked((ids) =>
        adminClient
          .from("subscriptions")
          .select("id,user_id,plan,amount,status,created_at,updated_at")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
      ),
      fetchChunked((ids) =>
        adminClient.from("user_integrations").select("user_id,platform").in("user_id", ids).eq("platform", "mercadolivre")
      ),
      fetchChunked((ids) => adminClient.from("orders").select("user_id").in("user_id", ids)),
    ]);

    const profilesRes = { data: profilesRows };
    const subsRes = { data: subsRows };
    const integrationsRes = { data: integrationsRows };
    const ordersRes = { data: ordersRows };

    const profileByUserId = new Map<string, any>();
    for (const profile of (profilesRes.data ?? [])) {
      const pId = profile.user_id ?? profile.id;
      if (pId) profileByUserId.set(pId, profile);
    }

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
      authUsers.map((authUser) => {
        const userId = authUser.id;
        const profile = profileByUserId.get(userId);
        const subscription = latestSubByUser.get(userId);

        const name = profile?.full_name ?? profile?.display_name ?? authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email ?? null;
        const email = authUser.email ?? profile?.email ?? null;
        const avatarUrl = profile?.avatar_url ?? authUser.user_metadata?.avatar_url ?? null;

        return {
          user_id: userId,
          name,
          email,
          avatar_url: avatarUrl,
          plan: subscription?.plan ?? null,
          subscription_status: subscription?.status ?? null,
          created_at: authUser.created_at || profile?.created_at || new Date().toISOString(),
          ml_connected: mlConnectedUsers.has(userId),
          orders_count: ordersByUser.get(userId) ?? 0,
        };
      })
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : (typeof error === "object" ? JSON.stringify(error) : String(error));
    console.error("[admin-users] error:", message, error);
    return json({ error: "Erro interno", detail: message }, 500);
  }
});
