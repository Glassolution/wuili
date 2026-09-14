import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Token invalido" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Acesso restrito a admins" }, 403);

    const { user_id: targetId } = (await req.json().catch(() => ({}))) as { user_id?: string };
    if (!targetId) return json({ error: "user_id obrigatorio" }, 400);

    const [
      authUserRes,
      profileRes,
      subsRes,
      integrationsRes,
      ordersRes,
      sessionsRes,
      viewsRes,
    ] = await Promise.all([
      admin.auth.admin.getUserById(targetId),
      admin.from("profiles").select("*").eq("user_id", targetId).maybeSingle(),
      admin
        .from("subscriptions")
        .select("id,plan,status,amount,is_trial,created_at,updated_at")
        .eq("user_id", targetId)
        .order("updated_at", { ascending: false }),
      admin
        .from("user_integrations")
        .select("platform,created_at,updated_at,expires_at,ml_user_id")
        .eq("user_id", targetId),
      admin
        .from("orders")
        .select("id,sale_price,product_title,platform,created_at,status")
        .eq("user_id", targetId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("user_sessions")
        .select("id,started_at,last_seen_at,user_agent")
        .eq("user_id", targetId)
        .order("started_at", { ascending: false })
        .limit(200),
      admin
        .from("user_page_views")
        .select("id,path,title,product_id,product_title,viewed_at")
        .eq("user_id", targetId)
        .order("viewed_at", { ascending: false })
        .limit(200),
    ]);

    const authUser = authUserRes.data?.user ?? null;
    const sessions = sessionsRes.data ?? [];
    let totalSeconds = 0;
    let lastSeenAt: string | null = null;
    for (const s of sessions) {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.last_seen_at).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        totalSeconds += Math.floor((end - start) / 1000);
      }
      if (!lastSeenAt || new Date(s.last_seen_at) > new Date(lastSeenAt)) lastSeenAt = s.last_seen_at;
    }
    const isOnline = lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() < 60_000 : false;

    const views = viewsRes.data ?? [];
    const productCounts = new Map<string, { product_id: string; product_title: string | null; count: number; last_at: string }>();
    for (const v of views) {
      if (!v.product_id) continue;
      const cur = productCounts.get(v.product_id);
      if (cur) {
        cur.count += 1;
        if (new Date(v.viewed_at) > new Date(cur.last_at)) cur.last_at = v.viewed_at;
      } else {
        productCounts.set(v.product_id, {
          product_id: v.product_id,
          product_title: v.product_title ?? null,
          count: 1,
          last_at: v.viewed_at,
        });
      }
    }
    const productClicks = Array.from(productCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const orders = ordersRes.data ?? [];
    const totalRevenue = orders.reduce((s, o: any) => s + Number(o.sale_price ?? 0), 0);

    return json({
      user: {
        id: targetId,
        email: authUser?.email ?? null,
        phone: authUser?.phone ?? (profileRes.data as any)?.whatsapp ?? null,
        created_at: authUser?.created_at ?? (profileRes.data as any)?.created_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        name:
          (profileRes.data as any)?.display_name ??
          authUser?.user_metadata?.full_name ??
          authUser?.user_metadata?.name ??
          null,
        avatar_url: (profileRes.data as any)?.avatar_url ?? authUser?.user_metadata?.avatar_url ?? null,
      },
      profile: profileRes.data ?? null,
      subscriptions: subsRes.data ?? [],
      integrations: integrationsRes.data ?? [],
      orders,
      orders_summary: { count: orders.length, revenue: totalRevenue },
      activity: {
        total_online_seconds: totalSeconds,
        sessions_count: sessions.length,
        last_seen_at: lastSeenAt,
        is_online: isOnline,
        sessions: sessions.slice(0, 10),
      },
      page_views: views.slice(0, 30),
      last_page: views[0] ?? null,
      product_clicks: productClicks,
      product_clicks_total: Array.from(productCounts.values()).reduce((s, p) => s + p.count, 0),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("[admin-user-profile] error:", detail);
    return json({ error: "Erro interno", detail }, 500);
  }
});
