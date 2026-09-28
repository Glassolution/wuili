// Consulta somente-leitura (admin): dado um ml_item_id publicado pela Velo,
// devolve como o frete do anúncio está configurado no Mercado Livre
// (modo de envio, frete grátis, dimensões) e as opções de frete cotadas
// para um CEP de destino, usando o token do próprio vendedor.
// Nenhuma escrita é feita — apenas GETs na API oficial do ML.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
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

    const body = (await req.json().catch(() => ({}))) as { ml_item_id?: string; zip_code?: string };
    const itemId = String(body.ml_item_id ?? "").trim().toUpperCase();
    const zip = String(body.zip_code ?? "01310100").replace(/\D/g, ""); // CEP padrão: Av. Paulista, SP
    if (!/^MLB\d+$/.test(itemId)) return json({ error: "ml_item_id inválido" }, 400);

    // Descobre qual vendedor Velo publicou esse anúncio para usar o token dele.
    const { data: pub } = await admin
      .from("user_publications")
      .select("user_id")
      .eq("ml_item_id", itemId)
      .limit(1)
      .maybeSingle();
    if (!pub) return json({ error: "Anúncio não pertence a nenhum usuário Velo" }, 404);

    const tokenRes = await getSellerAccessToken(admin, String(pub.user_id));
    if (!tokenRes.ok) return json({ error: tokenRes.error }, 502);
    const headers = { Authorization: `Bearer ${tokenRes.accessToken}` };

    const itemRes = await mlFetch(`https://api.mercadolibre.com/items/${itemId}`, { headers });
    const item = await itemRes.json().catch(() => ({}));
    if (!itemRes.ok) return json({ error: "Falha ao consultar item", ml_status: itemRes.status, detail: item }, 502);

    const shipping = (item as { shipping?: Record<string, unknown> }).shipping ?? {};
    const dimsAttr = Array.isArray((item as { attributes?: unknown[] }).attributes)
      ? ((item as { attributes: { id: string; value_name?: string }[] }).attributes.find((a) => a.id === "SHIPPING") ?? null)
      : null;

    let shippingOptions: unknown = null;
    const optRes = await mlFetch(
      `https://api.mercadolibre.com/items/${itemId}/shipping_options?zip_code=${zip}`,
      { headers },
    );
    shippingOptions = await optRes.json().catch(() => null);

    return json({
      item_id: itemId,
      title: (item as { title?: string }).title ?? null,
      price: (item as { price?: number }).price ?? null,
      status: (item as { status?: string }).status ?? null,
      seller_user_id: String(pub.user_id),
      shipping: {
        mode: shipping.mode ?? null,
        free_shipping: shipping.free_shipping ?? null,
        local_pick_up: shipping.local_pick_up ?? null,
        logistic_type: shipping.logistic_type ?? null,
        store_pick_up: shipping.store_pick_up ?? null,
        dimensions: shipping.dimensions ?? null,
        free_methods: shipping.free_methods ?? null,
        tags: shipping.tags ?? null,
      },
      dimensions_attribute: dimsAttr,
      zip_code: zip,
      shipping_options_status: optRes.status,
      shipping_options: shippingOptions,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
