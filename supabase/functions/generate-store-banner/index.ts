import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { GatewayError, generateChatCompletion } from "npm:@lovable.dev/ai-gateway@0.1.11";
import type {} from "../_shared/gateway-models.d.ts";
import { z } from "npm:zod@3";
import { bannerDimensions, bearerToken, decodeBanner } from "./banner-image.ts";

const BodySchema = z.object({
  brandName: z.string().max(255).optional(),
  persona: z.string().max(1000).optional(),
  salesAngle: z.string().max(2000).optional(),
  palette: z.string().max(200).optional(),
  layout: z.string().max(80).optional(),
  scene: z.string().max(600).optional(),
  people: z.string().max(80).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const started = performance.now();
    const token = bearerToken(req.headers.get("Authorization"));
    const unauthorized = () => new Response(JSON.stringify({ error: "Entre na sua conta para gerar a imagem." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    if (!token) return unauthorized();
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Serviço de imagens indisponível");
    const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await storage.auth.getUser(token);
    if (authError || !auth.user) return unauthorized();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(JSON.stringify({ error: "Dados da capa inválidos." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const { brandName, persona, salesAngle, palette, layout, scene, people } = parsed.data;

    // Capa da Vitrine editorial (montagem do Atlas): foto de ponta a ponta, sem
    // painel/moldura, pessoa à direita e as cores escolhidas pela pessoa, suaves.
    const telaCheia = layout === "tela-cheia";
    const paleta = typeof palette === "string" && palette.trim() ? palette.trim().slice(0, 200) : "";
    // Cena e modelos escolhidos pela variação da capa da loja (Vitrine moda).
    const cena = typeof scene === "string" && scene.trim() ? scene.trim().slice(0, 600) : "";
    const pessoas = typeof people === "string" && people.trim() ? people.trim().slice(0, 80) : "";
    const promptTelaCheia = `Full-bleed horizontal 16:9 fashion campaign photograph for an online store hero. The photo fills the ENTIRE frame edge to edge.

Scene:
- Store: ${salesAngle || "modern clothing store"}. Audience: ${persona || "confident young adults"}.
- ONE continuous background across the whole image (open sky, a seamless studio backdrop or a single plain wall). The left side is simply more of that same background.
${cena
  ? `- Composition: ${cena}\n- People: ${pessoas || "models"} wearing the store's kind of clothing.\n- Keep calm negative space where the headline will go (the left side, or around the center when the model is centered).`
  : `- One or two ${pessoas || "models"} wearing the store's kind of clothing, standing in the RIGHT half of the frame, cropped naturally from about the knees or thighs up, slight low camera angle, confident editorial pose, looking toward or past the camera.\n- The LEFT 45% is calm negative space of the same background (no objects), where the store's headline will be placed later.`}

Color:
- Palette built around: ${paleta || "soft neutral tones"}. Use these colors gently in the background and the clothing — soft, slightly desaturated, natural daylight. Tasteful and subtle, never neon, never an all-over color filter.

Strict constraints:
- NO borders, NO frames, NO margins, NO letterboxing, NO split screen, NO panels, NO collage, NO inset photo, NO poster-inside-a-photo.
- NO text, NO letters, NO typography, NO logos, NO brand marks, NO watermarks, NO UI anywhere (including on clothes and bags).
- Ultra sharp, magazine-quality, feels like a premium fashion campaign. (Do not write any brand name in the image.)`;

    const promptPadrao = `Wide cinematic e-commerce hero banner, horizontal 16:9 composition, high-end editorial fashion/lifestyle photography.

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
    const prompt = telaCheia ? promptTelaCheia : promptPadrao;

    // Capa em tela cheia: tenta o modelo de imagem mais forte (mais resolução,
    // segue melhor as cores e a proporção) e cai para o atual se o gateway não
    // tiver o modelo ou recusar a configuração de proporção/tamanho.
    const pedir = async (model: string, config: Record<string, string> | null) => {
      try {
        const messages = [{ role: "user" as const, content: prompt }];
        const options = { maxRetries: 0 };
        const data = model === "google/gemini-3-pro-image"
          ? await generateChatCompletion({ model: "google/gemini-3-pro-image", messages, modalities: ["image", "text"],
              ...(config ? { image_config: { aspect_ratio: "16:9", image_size: "4K" } as const } : {}) }, options)
          : await generateChatCompletion({ model: "google/gemini-2.5-flash-image", messages, modalities: ["image", "text"],
              ...(config ? { image_config: { aspect_ratio: "16:9" } as const } : {}) }, options);
        return { ok: true as const, status: 200, data };
      } catch (error) {
        if (!(error instanceof GatewayError)) throw error;
        console.warn("generate-store-banner: gateway", JSON.stringify({ model, image_config: Boolean(config),
          code: error.code, status: error.httpStatus, request_id: error.ids?.requestId }));
        // Never replay an ambiguous generation, credit/rate failure or provider denial.
        if (error.outcome === "unknown" || ["permission_denied", "authentication_error", "configuration_error"].includes(error.code)) throw error;
        return { ok: false as const, status: error.httpStatus ?? 500, error: error.code };
      }
    };
    const tentativas: [string, Record<string, string> | null][] = telaCheia
      ? [
          ["google/gemini-3-pro-image", { aspect_ratio: "16:9", image_size: "4K" }],
          ["google/gemini-3-pro-image", null],
          ["google/gemini-2.5-flash-image", { aspect_ratio: "16:9" }],
          ["google/gemini-2.5-flash-image", null],
        ]
      : [["google/gemini-2.5-flash-image", null]];
    let response: Awaited<ReturnType<typeof pedir>> | undefined;
    let usedModel = "";
    let usedConfig = false;
    for (const [model, config] of tentativas) {
      response = await pedir(model, config);
      usedModel = model;
      usedConfig = Boolean(config);
      // Limite e créditos valem para todos os modelos: não adianta tentar outro.
      if (response.ok || response.status === 429 || response.status === 402) break;
      console.warn(`generate-store-banner: ${model} ${config ? "com" : "sem"} image_config → ${response.status}`);
    }
    if (!response) throw new Error("Nenhuma tentativa de geração disponível");
    if (!response.ok) {
      const text = response.error;
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao seu workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gateway error: ${response.status} ${text}`);
    }

    const data = response.data;
    let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("Nenhuma imagem retornada pela IA");

    let dimensions: { width: number; height: number } | null = null;
    let stored = false;
    try {
      const image = decodeBanner(imageUrl);
      dimensions = bannerDimensions(image.bytes);
      const path = `${auth.user.id}/capas/${crypto.randomUUID()}.${image.extension}`;
      const { error: uploadError } = await storage.storage.from("assets").upload(path, image.bytes, {
        contentType: image.mime, cacheControl: "31536000", upsert: false,
      });
      if (uploadError) {
        console.warn("generate-store-banner: upload_failed", JSON.stringify({ code: uploadError.name }));
      } else {
        imageUrl = storage.storage.from("assets").getPublicUrl(path).data.publicUrl;
        stored = true;
      }
    } catch {
      // Keep the original data URL so storage failure cannot break store creation.
      console.warn("generate-store-banner: storage_fallback");
    }
    console.log("generate-store-banner: generated", JSON.stringify({ model: usedModel, image_config: usedConfig,
      width: dimensions?.width ?? null, height: dimensions?.height ?? null, elapsed_ms: Math.round(performance.now() - started), stored }));

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
