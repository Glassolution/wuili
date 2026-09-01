// Função temporária de diagnóstico: valida (sem publicar) combinações de
// payload no endpoint /items/validate do Mercado Livre, para descobrir qual
// variação de `title` / `family_name` / `variations` a conta aceita.
//
// Protegida pelo mesmo token do worker (header x-worker-token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("x-worker-token");
  if (!token || token !== Deno.env.get("ML_DEBUG_TOKEN")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "");
  const titleQuery = String(body.title ?? "");
  if (!email || !titleQuery) {
    return new Response(JSON.stringify({ error: "email e title são obrigatórios" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: profile } = await db.from("profiles").select("user_id").eq("email", email).maybeSingle();
  if (!profile) return json({ error: "perfil não encontrado" }, 404);

  const { data: integ } = await db
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", profile.user_id)
    .eq("platform", "mercadolivre")
    .maybeSingle();
  if (!integ?.access_token) return json({ error: "integração ML não encontrada" }, 404);
  const accessToken = integ.access_token as string;

  const { data: produto } = await db
    .from("catalog_products")
    .select("title, images, variants, suggested_price, brand")
    .ilike("title", `%${titleQuery}%`)
    .limit(1)
    .maybeSingle();
  if (!produto) return json({ error: "produto não encontrado" }, 404);

  const title = String(produto.title).slice(0, 60);
  const imgs = (Array.isArray(produto.images) ? produto.images : []).slice(0, 6) as string[];
  const pictures = imgs.map((u) => ({ source: u }));

  // categoria via predictor
  const predRes = await fetch(
    `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=${encodeURIComponent(title)}`,
  );
  const pred = await predRes.json();
  const categoryId = pred?.[0]?.category_id ?? "MLB1051";

  const variants = Array.isArray(produto.variants) ? produto.variants : [];
  const cores = [...new Set(variants.map((v: Record<string, unknown>) => String(v.value)))];
  const price = Number(produto.suggested_price) || 30;

  const base: Record<string, unknown> = {
    category_id: categoryId,
    price,
    currency_id: "BRL",
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "gold_special",
    pictures,
    attributes: [{ id: "BRAND", value_name: produto.brand ?? "Genérica" }],
    shipping: { mode: "me2", local_pick_up: false, free_shipping: true, free_methods: [], tags: ["self_service_in"] },
  };
  const variations = cores.map((c) => ({
    attribute_combinations: [{ id: "COLOR", value_name: c }],
    price,
    available_quantity: 10,
    picture_ids: imgs,
  }));

  const variationsNoPics = variations.map(({ picture_ids: _p, ...rest }) => rest);
  const tentativas: Array<{ label: string; payload: Record<string, unknown> }> = [
    { label: "family_name + variations + available_quantity", payload: { ...base, family_name: title, available_quantity: 10, variations } },
    { label: "title + variations + available_quantity (sem family_name)", payload: { ...base, title, available_quantity: 10, variations } },
    { label: "title + family_name + variations + available_quantity", payload: { ...base, title, family_name: title, available_quantity: 10, variations } },
    { label: "title + family_name + variations sem picture_ids", payload: { ...base, title, family_name: title, available_quantity: 10, variations: variationsNoPics } },
    { label: "title + family_name (sem variations)", payload: { ...base, title, family_name: title, available_quantity: 10 } },
  ];

  const resultados = [];
  for (const t of tentativas) {
    const res = await fetch("https://api.mercadolibre.com/items/validate", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(t.payload),
    });
    const raw = await res.text();
    resultados.push({ tentativa: t.label, status: res.status, ok: res.status === 204, resposta: raw.slice(0, 1200) });
  }

  return json({ title, categoryId, cores, resultados });

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
