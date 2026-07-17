// Fase 1: escreve o copy gerado por IA em user_projects.metadata.copy.
// Fluxo antigo (insert em generated_sales_pages) foi descontinuado — a tabela
// legada é somente-leitura a partir de agora (ver migration de deprecação).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

    const body = (await req.json().catch(() => ({}))) as {
      project_id?: string;
      catalog_product_id?: string;
      store_name?: string | null;
      store_logo_url?: string | null;
      store_description?: string | null;
    };

    if (!body?.project_id) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Autoriza pelo dono do projeto (RLS extra: só quem criou pode gerar copy).
    const { data: project, error: projErr } = await admin
      .from("user_projects")
      .select("id, user_id, metadata")
      .eq("id", body.project_id)
      .maybeSingle();
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "project_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (project.user_id !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Descobre o produto: preferência para o passado no body; senão, primeiro
    // productId salvo em metadata pela persistência do wizard.
    const metadata =
      project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
        ? (project.metadata as Record<string, unknown>)
        : {};
    const productIds = Array.isArray(metadata.productIds)
      ? (metadata.productIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    const catalogProductId =
      body.catalog_product_id || (typeof metadata.catalog_product_id === "string" ? metadata.catalog_product_id : "") || productIds[0];

    if (!catalogProductId) {
      return new Response(JSON.stringify({ error: "catalog_product_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: product, error: prodErr } = await admin
      .from("catalog_products")
      .select("id, title, description, suggested_price, images, category")
      .eq("id", catalogProductId)
      .maybeSingle();
    if (prodErr || !product) {
      return new Response(JSON.stringify({ error: "product_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback de copy (idêntico ao antigo — preserva a mesma forma quando a IA falha).
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
Preço sugerido: R$ ${product.suggested_price ?? "—"}

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

    const heroImage = Array.isArray(product.images) ? (product.images[0] as string | null) : null;

    // Merge shallow no metadata do projeto: sobrescreve apenas a chave `copy`.
    const nextMetadata = {
      ...metadata,
      copy: {
        headline,
        subheadline,
        benefits,
        testimonials,
        cta_text,
        hero_image_url: heroImage,
        price_brl: product.suggested_price,
        product_title: product.title,
        store_name: body.store_name ?? (typeof metadata.storeName === "string" ? metadata.storeName : null),
        store_logo_url: body.store_logo_url ?? (typeof metadata.logoImage === "string" ? metadata.logoImage : null),
        store_description: body.store_description ?? null,
      },
      // Guarda o catalog_product_id para consultas rápidas (redundante com productIds
      // mas evita ter que remontar o array no lado do cliente).
      catalog_product_id: catalogProductId,
    };

    const { data: updated, error: updErr } = await admin
      .from("user_projects")
      .update({
        metadata: nextMetadata,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", project.id)
      .select("id, metadata")
      .single();

    if (updErr) {
      console.error("user_projects update error:", updErr);
      return new Response(JSON.stringify({ error: "update_failed", details: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ project: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sales-page error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
