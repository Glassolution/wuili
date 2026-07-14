import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "loja";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { catalog_product_id } = await req.json();
    if (!catalog_product_id) {
      return new Response(JSON.stringify({ error: "catalog_product_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: product, error: prodErr } = await admin
      .from("catalog_products")
      .select("id, title, description, price, image_url, images, category")
      .eq("id", catalog_product_id)
      .maybeSingle();
    if (prodErr || !product) {
      return new Response(JSON.stringify({ error: "product_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let headline = `${product.title} — Frete Rápido e Garantia`;
    let subheadline = "Aproveite hoje com envio para todo o Brasil.";
    let benefits: Array<{ title: string; description: string }> = [
      { title: "Entrega para todo Brasil", description: "Envio em até 7 dias úteis com código de rastreio." },
      { title: "Garantia de 7 dias", description: "Não gostou? Devolvemos 100% do valor." },
      { title: "Pagamento seguro", description: "Cartão, Pix e boleto com criptografia de ponta a ponta." },
    ];
    let testimonials: Array<{ name: string; text: string; rating: number }> = [
      { name: "Ana P.", text: "Chegou super rápido, produto exatamente como descrito.", rating: 5 },
      { name: "Rafael M.", text: "Já é minha segunda compra. Recomendo.", rating: 5 },
      { name: "Juliana S.", text: "Atendimento nota 10, produto de qualidade.", rating: 5 },
    ];
    let cta_text = "Comprar agora";

    if (LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é copywriter de e-commerce brasileiro. Responda SOMENTE JSON válido, sem markdown." },
              { role: "user", content: `Gere copy persuasiva em português brasileiro para uma landing page single-product deste produto:

Título: ${product.title}
Descrição: ${(product.description || "").slice(0, 500)}
Preço sugerido: R$ ${product.price ?? "—"}

Retorne JSON com essa estrutura exata:
{
  "headline": "chamada principal curta e impactante (max 12 palavras)",
  "subheadline": "frase de apoio (max 20 palavras)",
  "benefits": [
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."}
  ],
  "testimonials": [
    {"name": "Nome brasileiro", "text": "depoimento curto e crível", "rating": 5},
    {"name": "Nome brasileiro", "text": "depoimento curto e crível", "rating": 5},
    {"name": "Nome brasileiro", "text": "depoimento curto e crível", "rating": 5}
  ],
  "cta_text": "texto do botão de compra (max 4 palavras)"
}` },
            ],
            temperature: 0.8,
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const raw = aiData.choices?.[0]?.message?.content ?? "";
          const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.headline) headline = parsed.headline;
          if (parsed.subheadline) subheadline = parsed.subheadline;
          if (Array.isArray(parsed.benefits) && parsed.benefits.length >= 3) benefits = parsed.benefits.slice(0, 3);
          if (Array.isArray(parsed.testimonials) && parsed.testimonials.length >= 3) testimonials = parsed.testimonials.slice(0, 3);
          if (parsed.cta_text) cta_text = parsed.cta_text;
        } else {
          console.warn("AI gateway non-ok:", aiResp.status, await aiResp.text().catch(() => ""));
        }
      } catch (e) {
        console.warn("AI generation failed, using fallback:", e);
      }
    }

    // Slug único
    let baseSlug = slugify(product.title);
    let slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await admin.from("generated_sales_pages").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const heroImage = product.image_url || (Array.isArray(product.images) ? product.images[0] : null);

    const { data: inserted, error: insertErr } = await admin
      .from("generated_sales_pages")
      .insert({
        user_id: userId,
        catalog_product_id: product.id,
        slug,
        headline,
        subheadline,
        benefits,
        testimonials,
        cta_text,
        hero_image_url: heroImage,
        price_brl: product.price,
        product_title: product.title,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("insert error:", insertErr);
      return new Response(JSON.stringify({ error: "insert_failed", details: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ page: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sales-page error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
