import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string | null> = {};
    (authList?.users ?? []).forEach((u: any) => {
      emailMap[u.id] = u.email ?? null;
    });

    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, display_name, plano, nicho, whatsapp, created_at, avatar_url")
      .order("created_at", { ascending: false });

    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const roleMap: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      roleMap[r.user_id] = roleMap[r.user_id] ?? [];
      roleMap[r.user_id].push(r.role);
    });

    const users = (profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      email: emailMap[p.user_id] ?? null,
      display_name: p.display_name,
      plano: p.plano,
      nicho: p.nicho,
      whatsapp: p.whatsapp,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      roles: roleMap[p.user_id] ?? [],
    }));

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-users error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
