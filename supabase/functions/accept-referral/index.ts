import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verifica se um usuário JÁ teve alguma assinatura paga (ativa, cancelada, etc.)
async function hasEverSubscribed(admin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await admin
    .from("subscriptions")
    .select("id,status,plan")
    .eq("user_id", userId)
    .not("status", "eq", "pending")
    .limit(1);
  if (data && data.length > 0) {
    const s = data[0] as { plan?: string };
    const plan = String(s.plan ?? "").toLowerCase();
    if (plan && plan !== "gratis" && plan !== "free") return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const token = String(body?.token ?? url.searchParams.get("token") ?? "").trim();
    const action = String(body?.action ?? "lookup"); // "lookup" | "link"

    if (!token) return json({ error: "Token ausente" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, service);

    const { data: ref } = await admin
      .from("referrals")
      .select("id,inviter_id,invited_email,invited_user_id,status,expires_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (!ref) return json({ error: "Convite inválido", code: "not_found" }, 404);

    if (new Date(ref.expires_at) < new Date()) {
      if (ref.status === "pending" || ref.status === "linked") {
        await admin.from("referrals").update({ status: "expired" }).eq("id", ref.id);
      }
      return json({ error: "Convite expirado", code: "expired" }, 410);
    }
    if (ref.status === "invalid" || ref.status === "expired") {
      return json({ error: "Convite inválido", code: ref.status }, 410);
    }
    if (ref.status === "subscribed") {
      return json({ error: "Convite já utilizado", code: "used" }, 410);
    }

    const { data: inviterProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", ref.inviter_id)
      .maybeSingle();
    const inviterName = inviterProfile?.display_name || "Um amigo";

    if (action === "lookup") {
      return json({
        ok: true,
        invited_email: ref.invited_email,
        inviter_name: inviterName,
        status: ref.status,
      });
    }

    // action === "link" — precisa de auth do convidado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Token inválido" }, 401);
    const userId = claims.claims.sub as string;
    const userEmail = String(claims.claims.email ?? "").toLowerCase();

    if (userId === ref.inviter_id) {
      return json({ error: "Você não pode aceitar seu próprio convite" }, 400);
    }

    // O email logado precisa bater com o convidado (ou o convite ainda não estar vinculado)
    if (ref.invited_user_id && ref.invited_user_id !== userId) {
      return json({ error: "Este convite pertence a outro usuário" }, 403);
    }
    if (userEmail !== String(ref.invited_email).toLowerCase()) {
      return json({ error: "Faça login com o email que recebeu o convite" }, 403);
    }

    // Elegibilidade: convidado não pode já ter assinado antes
    const alreadySubscribed = await hasEverSubscribed(admin, userId);
    if (alreadySubscribed) {
      await admin.from("referrals").update({
        status: "invalid",
        invited_user_id: userId,
      }).eq("id", ref.id);
      return json({ ok: false, code: "not_eligible", error: "Você já teve uma assinatura paga anteriormente" }, 200);
    }

    await admin
      .from("referrals")
      .update({
        invited_user_id: userId,
        status: "linked",
        linked_at: new Date().toISOString(),
      })
      .eq("id", ref.id);

    return json({ ok: true, code: "linked", inviter_name: inviterName });
  } catch (e) {
    console.error("accept-referral error:", e);
    return json({ error: "Erro interno" }, 500);
  }
});
