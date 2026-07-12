import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { brandName, persona, salesAngle } = await req.json();

    const prompt = `Wide cinematic e-commerce hero banner, horizontal 16:9 composition, high-end editorial fashion/lifestyle photography.

STYLE & MOOD (most important — drive the entire aesthetic from this):
- Brand vibe: ${salesAngle || "modern, timeless, aspirational"}
- Target audience feel: ${persona || "confident young adults with refined taste"}

Composition rules:
- Left third of the image MUST be visually calm and uncluttered (soft neutral background, empty space or minimal props) so overlaid text remains legible.
- Right two thirds contain the main visual subject that expresses the style/mood above (models, styled scene, atmospheric setting).
- Warm neutral palette: creams, beiges (#eeece7), soft whites, muted earthy tones. No saturated colors unless the vibe strictly demands it.
- Natural soft daylight, shallow depth of field, magazine-quality retouching.

Strict constraints:
- NO text, NO typography, NO logos, NO watermarks, NO UI elements anywhere in the image.
- NO product-focused catalog shots. This is a mood/style banner, not a product photo.
- Ultra sharp, cohesive, aspirational — feels like a luxury brand campaign for ${brandName || "the brand"}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao seu workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gateway error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("Nenhuma imagem retornada pela IA");

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
