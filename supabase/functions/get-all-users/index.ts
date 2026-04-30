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

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const currentUser = userData?.user;
    if (userErr || !currentUser) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    // Verifica admin via user_roles
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return jsonResponse({ error: "Acesso restrito a admins" }, 403);
    }

    // Busca todos os profiles (service role bypass RLS)
    const { data: profiles, error: profilesErr } = await adminClient
      .from("profiles")
      .select("id, user_id, display_name, plano, nicho, whatsapp, avatar_url, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (profilesErr) {
      console.error("profiles error:", profilesErr);
      return jsonResponse({ error: "Falha ao buscar perfis" }, 500);
    }

    // LEFT JOIN manual com subscriptions: pegar a última de cada user
    const userIds = (profiles ?? []).map((p) => p.user_id).filter(Boolean);
    const { data: subs } = await adminClient
      .from("subscriptions")
      .select("user_id, plan, status, amount, current_period_end, updated_at")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const subsByUser = new Map<string, any>();
    for (const s of subs ?? []) {
      const prev = subsByUser.get(s.user_id);
      if (!prev || new Date(s.updated_at) > new Date(prev.updated_at)) {
        subsByUser.set(s.user_id, s);
      }
    }

    // Busca emails via auth admin (paginado). perPage máx ~200.
    const emailByUser = new Map<string, string | null>();
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (listErr) {
        console.error("[get-all-users] listUsers error:", listErr);
        break;
      }
      if (!list?.users || list.users.length === 0) break;
      for (const u of list.users) emailByUser.set(u.id, u.email ?? null);
      if (list.users.length < perPage) break;
      page += 1;
      if (page > 50) break; // safety
    }
    console.log("[get-all-users] emails carregados:", emailByUser.size);

    const users = (profiles ?? []).map((p) => {
      const sub = subsByUser.get(p.user_id) ?? null;
      return {
        id: p.id,
        user_id: p.user_id,
        display_name: p.display_name,
        email: emailByUser.get(p.user_id) ?? emailByUser.get(p.id) ?? null,
        whatsapp: p.whatsapp,
        plano: p.plano,
        nicho: p.nicho,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        subscription: sub
          ? {
              plan: sub.plan,
              status: sub.status,
              amount: Number(sub.amount ?? 0),
              current_period_end: sub.current_period_end,
            }
          : null,
      };
    });

    return jsonResponse({ users, total: users.length });
  } catch (error) {
    console.error("get-all-users error:", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
