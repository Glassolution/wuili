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

const onlyDigits = (v: string) => v.replace(/\D+/g, "");
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Dados sensíveis de OAuth nunca saem daqui — a tela é de evidência, não de token.
type IntegrationRow = { platform: string; created_at: string; updated_at?: string | null; expires_at?: string | null; ml_user_id?: number | string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Token invalido" }, 401);

    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle(),
      admin.from("profiles").select("is_admin").eq("user_id", userData.user.id).maybeSingle(),
    ]);
    if (!roleRow && !(profileRow as { is_admin?: boolean } | null)?.is_admin) {
      return json({ error: "Acesso restrito a admins" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as { query?: string };
    const rawQuery = (body.query ?? "").trim();
    if (!rawQuery) return json({ error: "Informe e-mail, CPF ou ID do usuário" }, 400);

    // ── Resolver o usuário: uuid → e-mail → CPF (taxId nos eventos ValidaPay)
    let targetId: string | null = null;
    let matchedBy = "";

    if (isUuid(rawQuery)) {
      targetId = rawQuery;
      matchedBy = "user_id";
    } else if (rawQuery.includes("@")) {
      const { data } = await admin.from("profiles").select("user_id").ilike("email", rawQuery).maybeSingle();
      targetId = (data as { user_id?: string } | null)?.user_id ?? null;
      matchedBy = "email";
    }

    const cpf = onlyDigits(rawQuery);
    let taxId: string | null = null;
    if (!targetId && cpf.length >= 11) {
      const { data } = await admin
        .from("validapay_webhook_events")
        .select("payload,created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      for (const row of (data ?? []) as Array<{ payload: Record<string, unknown> }>) {
        const p = row.payload ?? {};
        const customer = (p.customer ?? {}) as Record<string, unknown>;
        const rowTax = onlyDigits(String(p.taxId ?? customer.taxId ?? ""));
        if (rowTax && rowTax === cpf) {
          const meta = (p.metadata ?? {}) as Record<string, unknown>;
          if (meta.user_id) {
            targetId = String(meta.user_id);
            taxId = rowTax;
            matchedBy = "cpf";
            break;
          }
        }
      }
    }

    if (!targetId) return json({ found: false });

    const [
      authUserRes,
      profileRes,
      subsRes,
      integrationsRes,
      publicationsRes,
      projectsRes,
      ordersRes,
      sessionsRes,
      viewsRes,
      refundsRes,
      eventsRes,
      ownProductsRes,
    ] = await Promise.all([
      admin.auth.admin.getUserById(targetId),
      admin.from("profiles").select("user_id,display_name,email,whatsapp,plano,created_at,onboarding_completed").eq("user_id", targetId).maybeSingle(),
      admin.from("subscriptions").select("id,plan,status,amount,payment_method,provider,is_trial,current_period_start,current_period_end,validapay_charge_id,validapay_subscription_id,created_at,updated_at").eq("user_id", targetId).order("created_at", { ascending: false }),
      admin.from("user_integrations").select("platform,created_at,updated_at,expires_at,ml_user_id").eq("user_id", targetId),
      admin.from("user_publications").select("*").eq("user_id", targetId).order("created_at", { ascending: false }).limit(100),
      admin.from("user_projects").select("id,name,status,created_at,updated_at,last_edited_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(50),
      admin.from("orders").select("id,product_title,sale_price,platform,status,created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(50),
      admin.from("user_sessions").select("id,started_at,last_seen_at,user_agent").eq("user_id", targetId).order("started_at", { ascending: false }).limit(200),
      admin.from("user_page_views").select("id,path,title,product_title,viewed_at").eq("user_id", targetId).order("viewed_at", { ascending: false }).limit(200),
      admin.from("refund_requests").select("id,status,refund_amount,reason,requested_at,processed_at,created_at").eq("user_id", targetId).order("created_at", { ascending: false }),
      admin.from("validapay_webhook_events").select("id,event,status,amount,charge_id,subscription_id,payload,created_at").order("created_at", { ascending: false }).limit(1500),
      admin.from("user_products").select("id,title,created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(50),
    ]);

    const authUser = authUserRes.data?.user ?? null;

    const payments = ((eventsRes.data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => {
        const p = (row.payload ?? {}) as Record<string, unknown>;
        const meta = (p.metadata ?? {}) as Record<string, unknown>;
        return String(meta.user_id ?? "") === targetId;
      })
      .map((row) => {
        const p = (row.payload ?? {}) as Record<string, unknown>;
        const customer = (p.customer ?? {}) as Record<string, unknown>;
        if (!taxId) taxId = String(p.taxId ?? customer.taxId ?? "") || null;
        return {
          id: row.id,
          event: row.event,
          status: row.status,
          amount: row.amount,
          charge_id: row.charge_id,
          subscription_id: row.subscription_id,
          customer_name: (customer.name as string) ?? null,
          created_at: row.created_at,
        };
      });

    const sessions = (sessionsRes.data ?? []) as Array<{ started_at: string; last_seen_at: string; user_agent: string | null }>;
    const totalSeconds = sessions.reduce((sum, s) => {
      const a = new Date(s.started_at).getTime();
      const b = new Date(s.last_seen_at).getTime();
      return Number.isFinite(a) && Number.isFinite(b) && b >= a ? sum + Math.floor((b - a) / 1000) : sum;
    }, 0);

    const integrations = ((integrationsRes.data ?? []) as IntegrationRow[]).map((i) => ({
      platform: i.platform,
      connected_at: i.created_at,
      updated_at: i.updated_at ?? null,
      expires_at: i.expires_at ?? null,
      external_account_id: i.ml_user_id != null ? String(i.ml_user_id) : null,
    }));

    // ── Linha do tempo unificada (é o que vale como evidência na disputa)
    const timeline: Array<{ at: string; kind: string; label: string; detail?: string | null }> = [];
    if (authUser?.created_at) timeline.push({ at: authUser.created_at, kind: "account", label: "Conta criada", detail: authUser.app_metadata?.provider ? `Provedor: ${authUser.app_metadata.provider}` : null });
    if (authUser?.email_confirmed_at) timeline.push({ at: authUser.email_confirmed_at, kind: "account", label: "E-mail confirmado" });
    for (const s of sessions) timeline.push({ at: s.started_at, kind: "login", label: "Sessão iniciada", detail: s.user_agent });
    for (const s of (subsRes.data ?? []) as Array<Record<string, unknown>>) {
      timeline.push({ at: String(s.created_at), kind: "subscription", label: `Assinatura criada — plano ${String(s.plan).toUpperCase()}`, detail: `R$ ${Number(s.amount ?? 0).toFixed(2)} · ${String(s.payment_method ?? "-")}` });
    }
    for (const p of payments) timeline.push({ at: String(p.created_at), kind: "payment", label: `Pagamento: ${p.event}`, detail: `${p.status ?? ""} ${p.amount ? `· R$ ${Number(p.amount).toFixed(2)}` : ""}`.trim() });
    for (const i of integrations) timeline.push({ at: i.connected_at, kind: "integration", label: `Integração conectada: ${i.platform}`, detail: i.external_account_id ? `Conta ${i.external_account_id}` : null });
    for (const pub of (publicationsRes.data ?? []) as Array<Record<string, unknown>>) {
      timeline.push({ at: String(pub.created_at), kind: "publication", label: "Produto publicado", detail: String(pub.title ?? pub.product_title ?? pub.ml_item_id ?? "") || null });
    }
    for (const pr of (projectsRes.data ?? []) as Array<Record<string, unknown>>) {
      timeline.push({ at: String(pr.created_at), kind: "project", label: `Projeto criado: ${String(pr.name ?? "")}`, detail: String(pr.status ?? "") });
    }
    for (const op of (ownProductsRes.data ?? []) as Array<Record<string, unknown>>) {
      timeline.push({ at: String(op.created_at), kind: "product", label: "Produto próprio cadastrado", detail: String(op.title ?? "") });
    }
    for (const o of (ordersRes.data ?? []) as Array<Record<string, unknown>>) {
      timeline.push({ at: String(o.created_at), kind: "order", label: `Pedido: ${String(o.product_title ?? "")}`, detail: `R$ ${Number(o.sale_price ?? 0).toFixed(2)}` });
    }
    for (const r of (refundsRes.data ?? []) as Array<Record<string, unknown>>) {
      timeline.push({ at: String(r.created_at), kind: "refund", label: `Reembolso solicitado (${String(r.status)})`, detail: `R$ ${Number(r.refund_amount ?? 0).toFixed(2)} · ${String(r.reason ?? "")}` });
    }
    timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const subs = (subsRes.data ?? []) as Array<Record<string, unknown>>;
    const activeSub = subs.find((s) => ["active", "paid", "approved", "trialing"].includes(String(s.status))) ?? subs[0] ?? null;

    return json({
      found: true,
      matched_by: matchedBy,
      generated_at: new Date().toISOString(),
      user: {
        id: targetId,
        email: authUser?.email ?? (profileRes.data as { email?: string } | null)?.email ?? null,
        name: (profileRes.data as { display_name?: string } | null)?.display_name ?? authUser?.user_metadata?.full_name ?? null,
        phone: authUser?.phone ?? (profileRes.data as { whatsapp?: string } | null)?.whatsapp ?? null,
        tax_id: taxId,
        provider: authUser?.app_metadata?.provider ?? null,
        created_at: authUser?.created_at ?? null,
        email_confirmed_at: authUser?.email_confirmed_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        plano: (profileRes.data as { plano?: string } | null)?.plano ?? null,
      },
      subscription: activeSub,
      subscriptions: subs,
      payments,
      refunds: refundsRes.data ?? [],
      integrations,
      publications: publicationsRes.data ?? [],
      projects: projectsRes.data ?? [],
      own_products: ownProductsRes.data ?? [],
      orders: ordersRes.data ?? [],
      sessions: sessions.slice(0, 50),
      page_views: (viewsRes.data ?? []).slice(0, 60),
      usage: {
        sessions_count: sessions.length,
        total_online_seconds: totalSeconds,
        page_views_count: (viewsRes.data ?? []).length,
        publications_count: (publicationsRes.data ?? []).length,
        integrations_count: integrations.length,
      },
      timeline,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[admin-user-evidence] error:", detail);
    return json({ error: "Erro interno", detail }, 500);
  }
});
