// One-off: corrige o atributo MODEL dos anúncios ativos que foram publicados
// com MODEL = <recorte do título> (fallback antigo do ml-publish). Para cada
// item, checa se a categoria tem lista fechada de MODEL:
//   - texto livre  -> PUT /items/{id} com MODEL="Não especificado"
//   - lista fechada -> não corrige, marca como precisa_revisao_manual
//
// Segurança: exige caller autenticado com role 'admin' (mesmo padrão do
// cleanup-ml-duplicates). Erro num item não trava o batch.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Row = {
  id: string;
  user_id: string;
  ml_item_id: string;
};

type Outcome =
  | "fixed"
  | "already_ok"
  | "needs_manual_review"
  | "no_token"
  | "failed_get_item"
  | "failed_get_category"
  | "failed_put";

type ReportEntry = {
  publication_id: string;
  user_id: string;
  ml_item_id: string;
  outcome: Outcome;
  category_id?: string;
  current_model?: string;
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

// Cache de "categoria tem lista fechada em MODEL?" para não repetir chamadas.
const categoryModelHasList = new Map<string, boolean>();

async function categoryModelIsClosedList(
  token: string,
  categoryId: string,
): Promise<boolean | null> {
  if (categoryModelHasList.has(categoryId)) {
    return categoryModelHasList.get(categoryId)!;
  }
  const res = await fetch(
    `https://api.mercadolibre.com/categories/${categoryId}/attributes`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const attrs = await res.json().catch(() => []);
  if (!Array.isArray(attrs)) return null;
  const modelAttr = attrs.find((a: Record<string, unknown>) => a?.id === "MODEL");
  const values = (modelAttr?.values as Array<unknown> | undefined) ?? [];
  const hasList = values.length > 0;
  categoryModelHasList.set(categoryId, hasList);
  return hasList;
}

async function fixItem(
  token: string,
  itemId: string,
): Promise<{ outcome: Outcome; error?: string; categoryId?: string; currentModel?: string }> {
  // 1) Buscar item para descobrir categoria e MODEL atual
  const getRes = await fetch(
    `https://api.mercadolibre.com/items/${itemId}?attributes=id,category_id,attributes`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!getRes.ok) {
    const t = await getRes.text().catch(() => "");
    return { outcome: "failed_get_item", error: `GET ${getRes.status}: ${t.slice(0, 300)}` };
  }
  const item = await getRes.json();
  const categoryId = String(item?.category_id ?? "");
  const attrs = Array.isArray(item?.attributes) ? item.attributes : [];
  const modelAttr = attrs.find((a: Record<string, unknown>) => a?.id === "MODEL");
  const currentModel = String(modelAttr?.value_name ?? "").trim();

  if (currentModel === "Não especificado") {
    return { outcome: "already_ok", categoryId, currentModel };
  }

  // 2) Descobrir se categoria tem lista fechada para MODEL
  const isClosed = await categoryModelIsClosedList(token, categoryId);
  if (isClosed === null) {
    return {
      outcome: "failed_get_category",
      categoryId,
      currentModel,
      error: "Falha ao buscar attributes da categoria",
    };
  }
  if (isClosed) {
    return { outcome: "needs_manual_review", categoryId, currentModel };
  }

  // 3) Texto livre — atualizar MODEL para "Não especificado"
  const putRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attributes: [{ id: "MODEL", value_name: "Não especificado" }],
    }),
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => "");
    return {
      outcome: "failed_put",
      categoryId,
      currentModel,
      error: `PUT ${putRes.status}: ${t.slice(0, 400)}`,
    };
  }
  return { outcome: "fixed", categoryId, currentModel };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

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

    const { data: rows, error: fetchErr } = await supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id")
      .eq("status", "active")
      .not("ml_item_id", "is", null);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targets = (rows ?? []) as Row[];
    const report: ReportEntry[] = [];
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
          error: "Sem token válido — usuário precisa reconectar o Mercado Livre.",
        });
        continue;
      }

      try {
        const result = await fixItem(token, row.ml_item_id);
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          ml_item_id: row.ml_item_id,
          outcome: result.outcome,
          category_id: result.categoryId,
          current_model: result.currentModel,
          error: result.error,
        });
      } catch (err) {
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          ml_item_id: row.ml_item_id,
          outcome: "failed_put",
          error: String(err instanceof Error ? err.message : err),
        });
      }
    }

    const summary = {
      total: report.length,
      fixed: report.filter((r) => r.outcome === "fixed").length,
      already_ok: report.filter((r) => r.outcome === "already_ok").length,
      needs_manual_review: report.filter((r) => r.outcome === "needs_manual_review").length,
      no_token: report.filter((r) => r.outcome === "no_token").length,
      failed: report.filter((r) =>
        r.outcome === "failed_get_item" ||
        r.outcome === "failed_get_category" ||
        r.outcome === "failed_put"
      ).length,
    };

    return new Response(JSON.stringify({ summary, report }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ml-fix-model-attribute error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
