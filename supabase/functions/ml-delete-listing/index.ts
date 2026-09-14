// ml-delete-listing
// -----------------
// Encerra (closed) e exclui (deleted) o anúncio no Mercado Livre e remove a
// publicação da lista do usuário no Velo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mlFetch } from "../_shared/mlClient.ts";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes } = await supabase.auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json().catch(() => ({}));
    const publicationId = typeof body?.publicationId === "string" ? body.publicationId : null;
    if (!publicationId) return json({ error: "publicationId é obrigatório." }, 400);

    const { data: pub } = await supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id")
      .eq("id", publicationId)
      .maybeSingle();

    if (!pub || pub.user_id !== user.id) {
      return json({ error: "Publicação não encontrada." }, 404);
    }

    let mlResult: string = "sem_item_ml";

    if (pub.ml_item_id) {
      const tokenRes = await getSellerAccessToken(supabase, user.id);
      if (!tokenRes.ok) {
        return json(
          { error: "Conecte sua conta do Mercado Livre para excluir o anúncio." },
          400,
        );
      }
      const headers = {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        "Content-Type": "application/json",
      };
      const url = `https://api.mercadolibre.com/items/${pub.ml_item_id}`;

      const closeRes = await mlFetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "closed" }),
      });
      const closeBody = await closeRes.text();
      console.log("[ml-delete-listing] close", pub.ml_item_id, closeRes.status, closeBody.slice(0, 300));

      const delRes = await mlFetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ deleted: true }),
      });
      const delBody = await delRes.text();
      console.log("[ml-delete-listing] delete", pub.ml_item_id, delRes.status, delBody.slice(0, 300));

      if (!closeRes.ok && !delRes.ok) {
        return json(
          { error: "O Mercado Livre não permitiu excluir este anúncio agora. Tente novamente em alguns minutos." },
          400,
        );
      }
      mlResult = delRes.ok ? "deleted" : "closed";
    }

    await supabase.from("user_publications").delete().eq("id", pub.id);

    return json({ success: true, ml: mlResult });
  } catch (err) {
    console.error("[ml-delete-listing] erro:", err);
    return json({ error: "Erro inesperado ao excluir a publicação." }, 500);
  }
});
