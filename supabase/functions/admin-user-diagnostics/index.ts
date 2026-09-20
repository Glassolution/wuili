// Consulta de diagnóstico: dado um e-mail, número de ticket ou id do usuário,
// devolve o estado real da conta (plano, Mercado Livre, publicações, erros, reembolsos)
// e um checklist dizendo o que está OK e o que está travando o usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";
import { mlFetch } from "../_shared/mlClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isUuidPrefix = (v: string) => /^[0-9a-f]{6,}$/i.test(v);

type CheckStatus = "ok" | "warn" | "fail";
type Check = { key: string; label: string; status: CheckStatus; detail: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Token inválido" }, 401);

    const [{ data: roleRow }, { data: adminProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle(),
      admin.from("profiles").select("is_admin").eq("user_id", userData.user.id).maybeSingle(),
    ]);
    if (!roleRow && !(adminProfile as { is_admin?: boolean } | null)?.is_admin) {
      return json({ error: "Acesso restrito a admins" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as { query?: string };
    const raw = (body.query ?? "").trim().replace(/^#/, "");
    if (!raw || raw.length > 120) return json({ error: "Informe um e-mail ou número de ticket" }, 400);

    // ── resolver usuário
    let targetId: string | null = null;
    let matchedBy = "";
    let ticket: Record<string, unknown> | null = null;

    if (raw.includes("@")) {
      const { data } = await admin.from("profiles").select("user_id").ilike("email", raw).maybeSingle();
      targetId = (data as { user_id?: string } | null)?.user_id ?? null;
      matchedBy = "e-mail";
    } else if (isUuid(raw)) {
      const { data: t } = await admin.from("support_tickets").select("*").eq("id", raw).maybeSingle();
      if (t) {
        ticket = t as Record<string, unknown>;
        targetId = String((t as { user_id: string }).user_id);
        matchedBy = "ticket";
      } else {
        targetId = raw;
        matchedBy = "id do usuário";
      }
    } else if (isUuidPrefix(raw)) {
      const { data: tickets } = await admin
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      const found = (tickets ?? []).find((t) => String((t as { id: string }).id).startsWith(raw.toLowerCase()));
      if (found) {
        ticket = found as Record<string, unknown>;
        targetId = String((found as { user_id: string }).user_id);
        matchedBy = "ticket";
      }
    }

    if (!targetId) return json({ found: false });

    const [
      authRes,
      profileRes,
      subsRes,
      integrationRes,
      pubsRes,
      errorsRes,
      refundsRes,
      ticketsRes,
    ] = await Promise.all([
      admin.auth.admin.getUserById(targetId),
      admin.from("profiles").select("user_id,display_name,email,whatsapp,plano,created_at,onboarding_completed,nicho").eq("user_id", targetId).maybeSingle(),
      admin.from("subscriptions").select("id,plan,status,amount,payment_method,provider,is_trial,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(5),
      admin.from("user_integrations").select("platform,ml_user_id,expires_at,created_at,updated_at").eq("user_id", targetId).eq("platform", "mercadolivre").maybeSingle(),
      admin.from("user_publications").select("id,title,status,ml_item_id,price,created_at,dimensions_ok,package_dimensions").eq("user_id", targetId).order("created_at", { ascending: false }).limit(50),
      admin.from("ml_publish_errors").select("id,mapped_code,mapped_message,product_title,category_id,http_status,cause,created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(15),
      admin.from("refund_requests").select("id,status,refund_amount,reason,created_at,processed_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(10),
      admin.from("support_tickets").select("id,subject,status,category,created_at,updated_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(10),
    ]);

    const authUser = authRes.data?.user ?? null;
    const profile = (profileRes.data ?? null) as Record<string, unknown> | null;
    const subs = (subsRes.data ?? []) as Array<Record<string, unknown>>;
    const integration = integrationRes.data as { ml_user_id?: number | string | null; expires_at?: string | null; created_at?: string; updated_at?: string } | null;
    const publications = (pubsRes.data ?? []) as Array<Record<string, unknown>>;
    const publishErrors = (errorsRes.data ?? []) as Array<Record<string, unknown>>;
    const refunds = (refundsRes.data ?? []) as Array<Record<string, unknown>>;
    const tickets = (ticketsRes.data ?? []) as Array<Record<string, unknown>>;

    const activeSub = subs.find((s) => ["active", "paid", "approved", "authorized"].includes(String(s.status))) ?? null;
    const planActive = Boolean(activeSub) && (!activeSub?.current_period_end || new Date(String(activeSub.current_period_end)) > new Date());

    // ── estado real da conta no Mercado Livre
    let ml: Record<string, unknown> = { connected: false };
    if (integration) {
      const token = await getSellerAccessToken(admin, targetId);
      if (!token.ok) {
        ml = { connected: true, token_ok: false, error: token.error, ml_user_id: integration.ml_user_id ?? null };
      } else {
        const res = await mlFetch("https://api.mercadolibre.com/users/me", {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        });
        const me = await res.json().catch(() => ({}));
        const status = (me?.status ?? {}) as Record<string, unknown>;
        const list = (status.list ?? {}) as Record<string, unknown>;
        ml = {
          connected: true,
          token_ok: true,
          ml_user_id: me?.id ?? integration.ml_user_id ?? null,
          nickname: me?.nickname ?? null,
          site_status: status.site_status ?? null,
          can_list: list.allow ?? null,
          list_codes: list.codes ?? [],
          immediate_payment: status.immediate_payment ?? null,
          mercadoenvios: status.mercadoenvios ?? null,
          seller_reputation_level: me?.seller_reputation?.level_id ?? null,
          address_city: me?.address?.city ?? null,
          address_state: me?.address?.state ?? null,
          registration_date: me?.registration_date ?? null,
          http_status: res.status,
        };
      }
    }

    const activePubs = publications.filter((p) => String(p.status) === "active").length;
    const lastError = publishErrors[0] ?? null;
    const recentErrors = publishErrors.filter(
      (e) => Date.now() - new Date(String(e.created_at)).getTime() < 7 * 24 * 3600 * 1000,
    );

    // causa real do último erro (a mensagem do ML costuma ser mais precisa que o código mapeado)
    let lastErrorRealCause: string | null = null;
    if (lastError?.cause) {
      const causes = Array.isArray(lastError.cause) ? (lastError.cause as Array<Record<string, unknown>>) : [];
      const fatal = causes.find((c) => String(c.type) === "error") ?? causes[0];
      if (fatal) lastErrorRealCause = String(fatal.message ?? "");
    }

    // ── checklist
    const checks: Check[] = [];

    checks.push({
      key: "conta",
      label: "Conta criada e e-mail confirmado",
      status: authUser?.email_confirmed_at ? "ok" : "warn",
      detail: authUser?.email_confirmed_at ? "E-mail confirmado" : "E-mail ainda não confirmado",
    });

    checks.push({
      key: "plano",
      label: "Plano ativo",
      status: planActive ? "ok" : "fail",
      detail: planActive
        ? `Plano ${String(activeSub?.plan ?? "—")} ativo até ${String(activeSub?.current_period_end ?? "—")}`
        : "Sem assinatura ativa — usuário gratuito não publica",
    });

    checks.push({
      key: "ml_conexao",
      label: "Conta do Mercado Livre conectada",
      status: ml.connected ? (ml.token_ok ? "ok" : "fail") : "fail",
      detail: !ml.connected
        ? "Nenhuma conta do Mercado Livre vinculada"
        : ml.token_ok
          ? `Conectado como ${String(ml.nickname ?? ml.ml_user_id ?? "—")}`
          : `Conexão expirada — precisa reconectar (${String(ml.error ?? "")})`,
    });

    if (ml.token_ok) {
      const canList = ml.can_list;
      checks.push({
        key: "ml_vendedor",
        label: "Conta habilitada para anunciar no Mercado Livre",
        status: canList === true ? "ok" : canList === false ? "fail" : "warn",
        detail:
          canList === true
            ? "O Mercado Livre permite publicar nesta conta"
            : canList === false
              ? `O Mercado Livre bloqueou anúncios nesta conta: ${JSON.stringify(ml.list_codes ?? [])}`
              : "Não foi possível confirmar a permissão de anúncio",
      });
      checks.push({
        key: "ml_status",
        label: "Situação da conta no Mercado Livre",
        status: ml.site_status === "active" ? "ok" : "warn",
        detail: `site_status: ${String(ml.site_status ?? "—")} · endereço: ${String(ml.address_city ?? "—")}/${String(ml.address_state ?? "—")}`,
      });
    }

    checks.push({
      key: "publicacoes",
      label: "Publicações na Velo",
      status: activePubs > 0 ? "ok" : publications.length > 0 ? "warn" : "warn",
      detail:
        publications.length === 0
          ? "Nenhum produto publicado ainda"
          : `${activePubs} anúncio(s) ativo(s) de ${publications.length} publicado(s)`,
    });

    checks.push({
      key: "erros",
      label: "Erros de publicação (7 dias)",
      status: recentErrors.length === 0 ? "ok" : recentErrors.length > 2 ? "fail" : "warn",
      detail:
        recentErrors.length === 0
          ? "Nenhuma falha recente"
          : `${recentErrors.length} falha(s). Última: ${String(lastError?.product_title ?? "")} — ${lastErrorRealCause ?? String(lastError?.mapped_message ?? "")}`,
    });

    const failing = checks.filter((c) => c.status === "fail");
    const overall: CheckStatus = failing.length ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "ok";

    const summary = failing.length
      ? failing.map((c) => c.detail).join(" · ")
      : overall === "warn"
        ? "Conta funcional, mas com pontos de atenção."
        : "Está tudo certo com esta conta.";

    return json({
      found: true,
      matched_by: matchedBy,
      generated_at: new Date().toISOString(),
      overall,
      summary,
      checks,
      user: {
        id: targetId,
        email: (profile?.email as string) ?? authUser?.email ?? null,
        name: (profile?.display_name as string) ?? null,
        whatsapp: (profile?.whatsapp as string) ?? null,
        plano: (profile?.plano as string) ?? null,
        nicho: (profile?.nicho as string) ?? null,
        created_at: (profile?.created_at as string) ?? authUser?.created_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        onboarding_completed: Boolean(profile?.onboarding_completed),
      },
      subscription: activeSub,
      subscriptions: subs,
      ml,
      publications,
      publish_errors: publishErrors.map((e) => ({
        ...e,
        real_cause:
          Array.isArray(e.cause)
            ? ((e.cause as Array<Record<string, unknown>>).find((c) => String(c.type) === "error")?.message ?? null)
            : null,
      })),
      refunds,
      tickets,
      ticket,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado" }, 500);
  }
});
