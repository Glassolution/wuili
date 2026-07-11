// ml-sync-listings-status
// -----------------------
// Rede de segurança: percorre user_publications (exceto archived_duplicate),
// agrupa por user_id, usa multiget /items?ids=... (até 20 IDs por chamada) pra
// pegar o status atual no Mercado Livre e atualiza a linha quando o status
// divergir. Roda a cada 6h via pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Pub = { id: string; user_id: string; ml_item_id: string; status: string };

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

  const rr = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: (integ.refresh_token as string) ?? "",
    }),
  });
  const rd = await rr.json().catch(() => ({}));
  if (!rr.ok || !rd.access_token) return null;

  await supabase
    .from("user_integrations")
    .update({
      access_token: rd.access_token,
      refresh_token: rd.refresh_token ?? integ.refresh_token,
      expires_at: new Date(Date.now() + (rd.expires_in ?? 21600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "mercadolivre");

  return rd.access_token as string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: rows, error } = await supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id, status")
      .neq("status", "archived_duplicate")
      .not("ml_item_id", "is", null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pubs = (rows ?? []) as Pub[];
    const byUser = new Map<string, Pub[]>();
    for (const p of pubs) {
      if (!byUser.has(p.user_id)) byUser.set(p.user_id, []);
      byUser.get(p.user_id)!.push(p);
    }

    let checked = 0;
    let updated = 0;
    let userErrors = 0;
    const perUser: Record<string, { checked: number; updated: number; error?: string }> = {};

    for (const [userId, list] of byUser.entries()) {
      const token = await getFreshToken(supabase, userId);
      if (!token) {
        userErrors++;
        perUser[userId] = { checked: 0, updated: 0, error: "no_valid_token" };
        continue;
      }

      let uChecked = 0;
      let uUpdated = 0;
      const byId = new Map(list.map((p) => [p.ml_item_id, p]));

      for (const batch of chunk(list, 20)) {
        const ids = batch.map((p) => p.ml_item_id).join(",");
        try {
          const res = await fetch(
            `https://api.mercadolibre.com/items?ids=${ids}&attributes=id,status`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!res.ok) {
            perUser[userId] = {
              checked: uChecked,
              updated: uUpdated,
              error: `multiget_${res.status}`,
            };
            continue;
          }
          const arr = (await res.json()) as Array<{
            code: number;
            body: { id: string; status: string };
          }>;

          for (const entry of arr) {
            if (entry.code !== 200 || !entry.body?.id) continue;
            uChecked++;
            const remote = String(entry.body.status ?? "").trim();
            const local = byId.get(entry.body.id);
            if (!local || !remote) continue;
            if (remote !== local.status) {
              const { error: upErr } = await supabase
                .from("user_publications")
                .update({ status: remote, updated_at: new Date().toISOString() })
                .eq("id", local.id);
              if (!upErr) uUpdated++;
            }
          }
        } catch (e) {
          console.error("[ml-sync] batch error:", (e as Error).message);
        }
      }

      checked += uChecked;
      updated += uUpdated;
      perUser[userId] = { checked: uChecked, updated: uUpdated };
    }

    return new Response(
      JSON.stringify(
        {
          summary: {
            users: byUser.size,
            publications: pubs.length,
            checked,
            updated,
            userErrors,
          },
          perUser,
          ranAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ml-sync-listings-status] fatal:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
