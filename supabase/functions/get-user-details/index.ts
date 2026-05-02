import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const adminRoleChecks = (userId: string) => [
  { _role: "admin" },
  { role: "admin" },
  { _user_id: userId, _role: "admin" },
  { user_id: userId, role: "admin" },
];

async function isAdmin(adminClient: ReturnType<typeof createClient>, userId: string) {
  for (const params of adminRoleChecks(userId)) {
    const { data, error } = await adminClient.rpc("has_role", params);
    if (!error && data === true) return true;
  }

  const { data } = await adminClient
    .from("profiles")
    .select("role")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  return data?.role === "admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: "Variáveis do Supabase não configuradas" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: currentUserData, error: currentUserError } = await userClient.auth.getUser();
    const currentUser = currentUserData?.user;

    if (currentUserError || !currentUser) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    const currentUserIsAdmin = await isAdmin(adminClient, currentUser.id);
    if (!currentUserIsAdmin) {
      return jsonResponse({ error: "Acesso restrito a admins" }, 403);
    }

    const { user_id: userId } = await req.json().catch(() => ({ user_id: null }));
    if (typeof userId !== "string" || !userId.trim()) {
      return jsonResponse({ error: "user_id é obrigatório" }, 400);
    }

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(userId);
    if (authUserError) {
      return jsonResponse({ error: authUserError.message }, 500);
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("phone")
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();

    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from("subscriptions")
      .select("amount,created_at")
      .eq("user_id", userId)
      .in("status", ["active", "paid"]);

    if (subscriptionsError) {
      return jsonResponse({ error: subscriptionsError.message }, 500);
    }

    const totals = (subscriptions ?? []).reduce(
      (acc, subscription) => {
        acc.total_pago += Number(subscription.amount ?? 0);
        acc.total_transacoes += 1;

        if (
          subscription.created_at &&
          (!acc.ultima_transacao || new Date(subscription.created_at) > new Date(acc.ultima_transacao))
        ) {
          acc.ultima_transacao = subscription.created_at;
        }

        return acc;
      },
      { total_pago: 0, total_transacoes: 0, ultima_transacao: null as string | null }
    );

    return jsonResponse({
      email: authUserData.user?.email ?? null,
      phone: profile?.phone ?? null,
      total_pago: totals.total_pago,
      total_transacoes: totals.total_transacoes,
      ultima_transacao: totals.ultima_transacao,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
