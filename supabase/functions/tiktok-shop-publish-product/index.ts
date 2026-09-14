import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callTikTokShop,
  corsHeaders,
  ensureFreshToken,
  recommendCategory,
  uploadProductImage,
} from "../_shared/tiktokShop.ts";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Token invalido" }, 401);
  const userId = userData.user.id;

  let payload: { product_id?: string; product_ids?: string[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo invalido" }, 400);
  }

  const productIds = (payload.product_ids ?? (payload.product_id ? [payload.product_id] : []))
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .slice(0, 20);

  if (productIds.length === 0) return json({ error: "Informe ao menos um produto" }, 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rawAccount } = await admin
    .from("tiktok_shop_accounts")
    .select("user_id,shop_id,shop_cipher,access_token,refresh_token,token_expires_at,status,currency")
    .eq("user_id", userId)
    .maybeSingle();

  if (!rawAccount?.access_token || rawAccount.status === "revoked") {
    return json({ error: "Conecte sua conta TikTok Shop antes de publicar" }, 400);
  }

  let account;
  try {
    account = await ensureFreshToken(admin, rawAccount);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const currency = account.currency || "USD";

  const { data: products, error: productsError } = await admin
    .from("catalog_products")
    .select("id,title,description,images,suggested_price,weight,variants,brand,stock_quantity")
    .in("id", productIds);

  if (productsError || !products?.length) {
    return json({ error: "Produtos nao encontrados" }, 404);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const product of products) {
    const title = String(product.title ?? "").slice(0, 255);
    const description = String(product.description ?? product.title ?? "").slice(0, 9000);
    const sourceImages = Array.isArray(product.images) ? (product.images as string[]).slice(0, 9) : [];
    const price = Number(product.suggested_price ?? 0).toFixed(2);
    // deno-lint-ignore no-explicit-any -- variacoes vem em jsonb sem forma fixa
    const variants = Array.isArray(product.variants) ? (product.variants as any[]) : [];

    const fail = async (message: string) => {
      console.error("[tiktok-shop-publish-product] falha:", product.id, message);
      await admin.from("tiktok_shop_publications").upsert(
        {
          user_id: userId,
          catalog_product_id: product.id,
          shop_id: account.shop_id,
          tiktok_product_id: null,
          status: "error",
          error_message: message.slice(0, 500),
          published_at: null,
        },
        { onConflict: "user_id,catalog_product_id" },
      );
      results.push({ product_id: product.id, status: "error", error: message.slice(0, 500) });
    };

    // 1) Upload das imagens — a Product API so aceita URIs do proprio TikTok.
    const imageUris: string[] = [];
    try {
      for (const imageUrl of sourceImages) {
        imageUris.push(await uploadProductImage(imageUrl, account.access_token, account.shop_cipher));
      }
    } catch (e) {
      await fail(`Falha no upload das imagens: ${(e as Error).message}`);
      continue;
    }
    if (imageUris.length === 0) {
      await fail("Produto sem imagens validas para publicar");
      continue;
    }

    // 2) Categoria obrigatoria — pedimos a recomendada pela propria TikTok.
    let categoryId: string;
    try {
      categoryId = await recommendCategory(title, description, account.access_token, account.shop_cipher);
    } catch (e) {
      await fail(`Nao foi possivel definir a categoria: ${(e as Error).message}`);
      continue;
    }

    const skus = variants.length
      ? variants.slice(0, 20).map((v, index) => ({
          sales_attributes: [
            {
              name: String(v?.attribute_name ?? "Variacao"),
              value_name: String(v?.name ?? v?.value ?? `Opcao ${index + 1}`),
            },
          ],
          inventory: [{ quantity: Number(product.stock_quantity ?? 10) }],
          price: { amount: price, currency },
        }))
      : [
          {
            inventory: [{ quantity: Number(product.stock_quantity ?? 10) }],
            price: { amount: price, currency },
          },
        ];

    const body = {
      title,
      description: `<p>${description}</p>`,
      category_id: categoryId,
      main_images: imageUris.map((uri) => ({ uri })),
      skus,
      package_weight: { value: String(product.weight ?? 0.5), unit: "KILOGRAM" },
    };

    const call = await callTikTokShop({
      path: "/product/202309/products",
      method: "POST",
      accessToken: account.access_token,
      shopCipher: account.shop_cipher,
      body,
    });

    // deno-lint-ignore no-explicit-any -- resposta dinamica da TikTok Open API
    const tiktokProductId = (call.json as any)?.data?.product_id ?? null;

    if (!call.ok) {
      // deno-lint-ignore no-explicit-any -- resposta dinamica da TikTok Open API
      await fail(`[${call.status}] ${(call.json as any)?.message ?? call.text}`);
      continue;
    }

    await admin.from("tiktok_shop_publications").upsert(
      {
        user_id: userId,
        catalog_product_id: product.id,
        shop_id: account.shop_id,
        tiktok_product_id: tiktokProductId,
        status: "published",
        error_message: null,
        published_at: new Date().toISOString(),
      },
      { onConflict: "user_id,catalog_product_id" },
    );

    results.push({
      product_id: product.id,
      status: "published",
      tiktok_product_id: tiktokProductId,
      error: null,
    });
  }

  return json({ results });
});
