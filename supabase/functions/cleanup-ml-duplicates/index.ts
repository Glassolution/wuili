// One-off cleanup: fecha no Mercado Livre os anúncios de linhas
// user_publications marcadas como 'archived_duplicate' que ainda não foram
// fechadas (ml_closed_at IS NULL). Segue o mesmo padrão paused -> closed
// já usado em process-refund e admin-refund-action.
//
// Segurança: exige header x-internal-secret == INTERNAL_SECRET.
// Sem input do usuário — a função descobre as linhas alvo por si só.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

type Row = {
  id: string;
  user_id: string;
  ml_item_id: string;
  status: string;
};

type ReportEntry = {
  publication_id: string;
  user_id: string;
  ml_item_id: string;
  outcome:
    | "closed"
    | "already_closed"
    | "failed_status_check"
    | "failed_pause"
    | "failed_close"
    | "no_token"
    | "token_refresh_failed";
  ml_current_status?: string;
  error?: string;
};

async function getFreshToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: integ } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "mercadolivre")
    .maybeSingle();

  if (!integ?.access_token) return null;

  const expiresAt = integ.expires_at ? new Date(integ.expires_at as string) : new Date(0);
  if (expiresAt > new Date(Date.now() + 60_000)) return integ.access_token as string;

  const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: (integ.refresh_token as string) ?? "",
    }),
  });
  const rd = await refreshRes.json().catch(() => ({}));
  if (!refreshRes.ok || !rd.access_token) return null;

  await supabase.from("user_integrations").update({
    access_token: rd.access_token,
    refresh_token: rd.refresh_token,
    expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("platform", "mercadolivre");

  return rd.access_token as string;
}

async function closeItem(
  token: string,
  itemId: string,
): Promise<{ outcome: ReportEntry["outcome"]; current?: string; error?: string }> {
  // 1) Status atual
  const getRes = await fetch(`https://api.mercadolibre.com/items/${itemId}?attributes=status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getRes.ok) {
    const t = await getRes.text().catch(() => "");
    return { outcome: "failed_status_check", error: `GET ${getRes.status}: ${t.slice(0, 300)}` };
  }
  const cur = await getRes.json();
  const currentStatus = String(cur?.status ?? "");
  if (currentStatus === "closed") return { outcome: "already_closed", current: currentStatus };

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 2) Se estiver ativo, pausar primeiro (mesmo padrão do process-refund)
  if (currentStatus === "active") {
    const pauseRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: "paused" }),
    });
    if (!pauseRes.ok) {
      const t = await pauseRes.text().catch(() => "");
      return {
        outcome: "failed_pause",
        current: currentStatus,
        error: `PUT paused ${pauseRes.status}: ${t.slice(0, 300)}`,
      };
    }
  }

  // 3) Fechar
  const closeRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ status: "closed" }),
  });
  if (!closeRes.ok) {
    const t = await closeRes.text().catch(() => "");
    return {
      outcome: "failed_close",
      current: currentStatus,
      error: `PUT closed ${closeRes.status}: ${t.slice(0, 300)}`,
    };
  }
  return { outcome: "closed", current: currentStatus };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expected = Deno.env.get("INTERNAL_SECRET");
    const provided = req.headers.get("x-internal-secret");
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Auth: exige usuário admin autenticado (via Authorization: Bearer <jwt>)
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userRes } = await supabase.auth.getUser(jwt);
    const caller = userRes?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const targets = (rows ?? []) as Row[];
    const report: ReportEntry[] = [];
    // Cache de tokens por usuário para não refazer refresh
    const tokenCache = new Map<string, string | null>();

    for (const row of targets) {
      let token = tokenCache.get(row.user_id);
      if (token === undefined) {
        token = await getFreshToken(supabase, row.user_id);
        tokenCache.set(row.user_id, token);
      }
      if (!token) {
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          ml_item_id: row.ml_item_id,
          outcome: "no_token",
          error: "Sem token válido para o usuário. Reconectar Mercado Livre.",
        });
        continue;
      }

      const result = await closeItem(token, row.ml_item_id);
      const entry: ReportEntry = {
        publication_id: row.id,
        user_id: row.user_id,
        ml_item_id: row.ml_item_id,
        outcome: result.outcome,
        ml_current_status: result.current,
        error: result.error,
      };
      report.push(entry);

      if (result.outcome === "closed" || result.outcome === "already_closed") {
        await supabase
          .from("user_publications")
          .update({ ml_closed_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }

    const summary = {
      total: report.length,
      closed: report.filter((r) => r.outcome === "closed").length,
      already_closed: report.filter((r) => r.outcome === "already_closed").length,
      failed: report.filter((r) =>
        r.outcome !== "closed" && r.outcome !== "already_closed"
      ).length,
    };

    return new Response(JSON.stringify({ summary, report }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cleanup-ml-duplicates error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
