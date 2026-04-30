import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dropvelo.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function isAdmin(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { data: authUserData } = await adminClient.auth.admin.getUserById(userId);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("whatsapp")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: subscriptions } = await adminClient
      .from("subscriptions")
      .select("amount,created_at")
      .eq("user_id", userId)
      .in("status", ["active", "paid"]);

    const totals = (subscriptions ?? []).reduce(
      (acc, s) => {
        acc.total_pago += Number(s.amount ?? 0);
        acc.total_transacoes += 1;
        if (s.created_at && (!acc.ultima_transacao || new Date(s.created_at) > new Date(acc.ultima_transacao))) {
          acc.ultima_transacao = s.created_at;
        }
        return acc;
      },
      { total_pago: 0, total_transacoes: 0, ultima_transacao: null as string | null }
    );

    return jsonResponse({
      email: authUserData?.user?.email ?? null,
      whatsapp: profile?.whatsapp ?? null,
      total_pago: totals.total_pago,
      total_transacoes: totals.total_transacoes,
      ultima_transacao: totals.ultima_transacao,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
