// ml-update-listing
// -----------------
// Sincroniza as edições da tela /dashboard/publicacoes/:id com o anúncio real
// no Mercado Livre. Só campos que o ML aceita são enviados (preço e, quando
// permitido, título e descrição). O custo interno (cost_price) NUNCA vai para o
// ML — é dado do fornecedor e fica apenas na Velo.

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

// O ML devolve erros em formatos variados; extrai algo legível para o lojista.
function mlErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  const cause = Array.isArray(obj.cause) ? obj.cause : [];
  const causeMsg = cause
    .map((c) => (c && typeof c === "object" ? String((c as Record<string, unknown>).message ?? "") : ""))
    .filter(Boolean)
    .join(" ");
  return [String(obj.message ?? ""), causeMsg].filter(Boolean).join(" — ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userRes } = await supabase.auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json().catch(() => ({}));
    const publicationId = typeof body?.publication_id === "string" ? body.publication_id : null;
    if (!publicationId) return json({ error: "publication_id é obrigatório." }, 400);

    const rawTitle = typeof body?.title === "string" ? body.title.trim() : null;
    const rawPrice = body?.price === undefined || body?.price === null ? null : Number(body.price);
    const rawDescription = typeof body?.description === "string" ? body.description.trim() : null;
    // O custo do fornecedor NUNCA é aceito do cliente: ele vem sempre do
    // catálogo (C7Drop) e é regravado aqui para manter o lucro atualizado.

    if (rawPrice !== null && (!Number.isFinite(rawPrice) || rawPrice <= 0)) {
      return json({ error: "Informe um preço de venda válido." }, 400);
    }
    if (rawTitle !== null && (rawTitle.length < 3 || rawTitle.length > 60)) {
      return json({ error: "O título precisa ter entre 3 e 60 caracteres." }, 400);
    }
    const { data: pub } = await supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id, title, price, cost_price, catalog_product_id")
      .eq("id", publicationId)
      .maybeSingle();

    if (!pub || pub.user_id !== user.id) {
      return json({ error: "Publicação não encontrada." }, 404);
    }

    // Só o que realmente mudou vai para o ML.
    const changedTitle = rawTitle !== null && rawTitle !== pub.title ? rawTitle : null;
    const changedPrice = rawPrice !== null && Number(pub.price ?? 0) !== rawPrice ? rawPrice : null;

    const warnings: string[] = [];
    const synced: Record<string, unknown> = {};

    if ((changedTitle || changedPrice || rawDescription) && !pub.ml_item_id) {
      return json({ error: "Este produto ainda não tem anúncio no Mercado Livre." }, 400);
    }

    if (changedTitle || changedPrice || rawDescription) {
      const tokenRes = await getSellerAccessToken(supabase, user.id);
      if (!tokenRes.ok) {
        return json(
          { error: "Conecte sua conta do Mercado Livre para atualizar o anúncio." },
          400,
        );
      }
      const headers = {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        "Content-Type": "application/json",
      };
      const itemUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(pub.ml_item_id!)}`;

      // 1) Preço (sempre aceito) — enviado sozinho para não ser derrubado por
      //    uma eventual recusa do título.
      if (changedPrice !== null) {
        const res = await mlFetch(itemUrl, {
          method: "PUT",
          headers,
          body: JSON.stringify({ price: changedPrice }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          return json(
            {
              error: `O Mercado Livre recusou o novo preço. ${mlErrorMessage(payload)}`.trim(),
            },
            400,
          );
        }
        synced.price = changedPrice;
      }

      // 2) Título — o ML bloqueia a alteração quando o anúncio já teve vendas.
      if (changedTitle) {
        const res = await mlFetch(itemUrl, {
          method: "PUT",
          headers,
          body: JSON.stringify({ title: changedTitle }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
          synced.title = changedTitle;
        } else {
          warnings.push(
            "O Mercado Livre não permite alterar o título deste anúncio (normalmente porque ele já teve vendas).",
          );
        }
      }

      // 3) Descrição — endpoint próprio, erro tratado à parte.
      if (rawDescription && rawDescription.length > 20) {
        const res = await mlFetch(`${itemUrl}/description`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ plain_text: rawDescription }),
        });
        if (res.ok) {
          synced.description = true;
        } else {
          warnings.push("Não foi possível atualizar a descrição no Mercado Livre.");
        }
      }
    }

    // Estado vivo do anúncio depois da alteração (status/permalink).
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (synced.price !== undefined) updates.price = synced.price;
    if (synced.title !== undefined) updates.title = synced.title;
    // Sincroniza o custo com o preço atual do produto no catálogo (C7Drop).
    if (pub.catalog_product_id) {
      const { data: cat } = await supabase
        .from("catalog_products")
        .select("cost_price")
        .eq("id", pub.catalog_product_id)
        .maybeSingle();
      const catCost = cat?.cost_price !== null && cat?.cost_price !== undefined ? Number(cat.cost_price) : null;
      if (catCost !== null && Number.isFinite(catCost) && catCost !== Number(pub.cost_price ?? 0)) {
        updates.cost_price = catCost;
      }
    }

    if (pub.ml_item_id && (synced.price !== undefined || synced.title !== undefined)) {
      const tokenRes = await getSellerAccessToken(supabase, user.id);
      if (tokenRes.ok) {
        const res = await mlFetch(
          `https://api.mercadolibre.com/items/${encodeURIComponent(pub.ml_item_id)}`,
          { headers: { Authorization: `Bearer ${tokenRes.accessToken}` } },
        );
        if (res.ok) {
          const item = await res.json().catch(() => ({}));
          if (item?.status) updates.status = item.status;
          if (item?.permalink) updates.permalink = item.permalink;
        }
      }
    }

    const { error: updateError } = await supabase
      .from("user_publications")
      .update(updates)
      .eq("id", pub.id)
      .eq("user_id", user.id);

    if (updateError) {
      return json(
        { error: "O anúncio foi atualizado no Mercado Livre, mas falhou ao salvar na Velo." },
        500,
      );
    }

    return json({ ok: true, synced, warnings });
  } catch (err) {
    console.error("[ml-update-listing] erro:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
