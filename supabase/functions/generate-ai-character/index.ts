// Gera a imagem de um personagem/influencer de IA e salva na biblioteca do
// usuário (tabela ai_characters + bucket privado ai-characters).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Payload = {
  name?: string;
  mode?: "full" | "photo" | "preset";
  // rota A
  gender?: string;
  age?: number;
  ethnicity?: string;
  body?: string;
  face?: string;
  hairStyle?: string;
  hairColor?: string;
  eyeColor?: string;
  presetLabel?: string;
  style?: string;
  // rota B (modelo pronto)
  photoDataUrl?: string;
  presetId?: string;
  outfitMode?: "auto" | "library" | "upload";
  outfitLibraryItem?: string;
  outfitImageDataUrl?: string;
  outfitInstructions?: string;
  extraDetails?: string;
  // produto associado ao personagem
  productUse?: "apresentar" | "vestir";
  productTitle?: string;
  productImageUrl?: string;
  productImageDataUrl?: string;
  productNotes?: string;
};

function buildFullPrompt(p: Payload) {
  return `Retrato fotorrealista de corpo inteiro de um influencer digital para redes sociais (TikTok/Instagram).
Nome do personagem: ${p.name}.
Gênero: ${p.gender || "não especificado"}.
Idade aparente: ${p.age ?? 25} anos.
Etnia/origem: ${p.ethnicity || "não especificada"}.
Tipo físico: ${p.body || "médio"}.
Rosto: ${p.face || "traços harmônicos e naturais"}.
Cabelo: ${p.hairStyle || "natural"}, cor ${p.hairColor || "castanho"}.
Estética/estilo: ${p.style || "casual moderno"}.
${p.extraDetails ? `Detalhes extras: ${p.extraDetails}.` : ""}
Enquadramento vertical 9:16, pessoa em pé, fundo de estúdio limpo e claro, iluminação suave natural, pele com textura real, qualidade editorial.
Sem texto, sem logos, sem marcas d'água, sem colagens.`;
}

function buildProductBlock(p: Payload) {
  const hasImage = Boolean(p.productImageDataUrl || p.productImageUrl);
  if (!hasImage && !p.productTitle) return "";
  const label = p.productTitle ? `Produto: ${p.productTitle}.` : "";
  const ref = hasImage
    ? "A ÚLTIMA imagem enviada é a referência do produto — reproduza-o fielmente (formato, cor, textura e detalhes)."
    : "";
  const action =
    p.productUse === "vestir"
      ? "O personagem deve ESTAR VESTINDO essa peça de roupa, com caimento natural e realista no corpo."
      : "O personagem deve SEGURAR e APRESENTAR esse produto para a câmera, de forma natural, com o produto bem visível.";
  return `${label}
${ref}
${action}
${p.productNotes ? `Observações sobre o produto: ${p.productNotes}.` : ""}`;
}

function buildPresetPrompt(p: Payload) {
  const changes: string[] = [];
  if (p.hairStyle) changes.push(`Estilo/corte de cabelo: ${p.hairStyle}.`);
  if (p.hairColor) changes.push(`Cor do cabelo: ${p.hairColor}.`);
  if (p.eyeColor) changes.push(`Cor dos olhos: ${p.eyeColor}.`);
  if (p.body) changes.push(`Tipo físico / corpo: ${p.body}.`);
  if (p.style) changes.push(`Estética geral e roupa: ${p.style}.`);
  if (p.outfitInstructions) changes.push(`Ajustes na roupa: ${p.outfitInstructions}.`);
  if (p.extraDetails) changes.push(`Detalhes extras (tatuagens, piercings, joias, acessórios): ${p.extraDetails}.`);

  const hasChanges = changes.length > 0;
  const productBlock = buildProductBlock(p);

  return `FOTO UGC AUTÊNTICA COM ROSTO TRAVADO.
A PRIMEIRA imagem enviada é a MODELO OFICIAL${p.presetLabel ? ` (${p.presetLabel})` : ""}. Dela você deve aproveitar APENAS o rosto e a fisionomia: mesmo formato de rosto, mesmos olhos, nariz, boca, sobrancelhas, mesmo tom e textura de pele, mesma etnia, mesma idade aparente e mesmo tipo físico. Alguém que conhece a modelo precisa reconhecê-la imediatamente. Não gere outra pessoa, não "embeleze", não mude as proporções do rosto.
Tudo o mais é livre e DEVE ser diferente da foto original: cenário, ambiente, pose, enquadramento, ângulo e roupa (exceto o que for especificado abaixo).
Nome do personagem: ${p.name}.
${
  hasChanges
    ? `Aplique estas alterações de forma clara e visível:
${changes.map((c) => `- ${c}`).join("\n")}`
    : "Mantenha a fisionomia e crie uma cena nova e natural."
}
${productBlock ? `${productBlock}\nAo inserir o produto/roupa, o rosto e a fisionomia continuam intocados.` : ""}
ESTILO OBRIGATÓRIO — UGC / conteúdo de creator real (estilo TikTok/Instagram): foto amadora feita com celular, selfie ou foto casual do dia a dia, em ambiente real e cotidiano (quarto, sala, cozinha, banheiro, dentro do carro, espelho, área externa), luz natural do ambiente, sem estúdio, sem fundo branco, sem fundo infinito, sem look de campanha publicitária. Composição espontânea, leve imperfeição natural, pele com textura real e poros visíveis, grão sutil de câmera de celular. Enquadramento vertical 9:16.
Sem texto, sem logos sobrepostos, sem marcas d'água, sem colagens, sem múltiplas pessoas.`;
}


function buildPhotoPrompt(p: Payload) {
  const outfit =
    p.outfitMode === "library"
      ? `Vista o personagem com este outfit do catálogo: ${p.outfitLibraryItem || "casual moderno"}.`
      : p.outfitMode === "upload"
        ? "Vista o personagem com a roupa da segunda imagem enviada, mantendo o rosto da primeira imagem."
        : "Mantenha exatamente a mesma roupa que aparece na foto enviada.";
  return `Gere um influencer digital fotorrealista de corpo inteiro com o MESMO rosto e a mesma aparência da pessoa da foto enviada.
Nome do personagem: ${p.name}.
${outfit}
${p.outfitInstructions ? `Ajustes na roupa: ${p.outfitInstructions}.` : ""}
${p.extraDetails ? `Detalhes extras (tatuagens, piercings, joias, acessórios): ${p.extraDetails}.` : ""}
Enquadramento vertical 9:16, pessoa em pé, fundo de estúdio limpo e claro, iluminação suave, pele com textura real.
Sem texto, sem logos, sem marcas d'água.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    // Limite de influencers por plano
    // Limites vindos da matriz única de planos (inclusive teto no Business:
    // cada personagem custa geração de imagem).
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .in("status", ["active", "authorized", "paused", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let planKey = String(sub?.plan ?? "").toLowerCase();
    if (!planKey) {
      const { data: profile } = await admin
        .from("profiles")
        .select("plano")
        .eq("user_id", userId)
        .maybeSingle();
      planKey = String(profile?.plano ?? "gratis").toLowerCase();
    }
    const characterLimit = planKey in PLAN_CHARACTER_LIMITS ? PLAN_CHARACTER_LIMITS[planKey] : 1;
    if (characterLimit !== null) {
      const { count } = await admin
        .from("ai_characters")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= characterLimit) {
        return json(
          {
            error: `Seu plano permite criar até ${characterLimit} influencer(s) de IA. Faça upgrade para criar mais.`,
            code: "plan_limit_reached",
          },
          403,
        );
      }
    }

    const payload = (await req.json().catch(() => ({}))) as Payload;
    const name = (payload.name || "").trim();
    if (!name) return json({ error: "Informe o nome do personagem." }, 400);
    const mode =
      payload.mode === "photo" ? "photo" : payload.mode === "preset" ? "preset" : "full";
    if ((mode === "photo" || mode === "preset") && !payload.photoDataUrl) {
      return json({ error: "Selecione um modelo para gerar o personagem." }, 400);
    }

    const prompt =
      mode === "preset"
        ? buildPresetPrompt(payload)
        : mode === "photo"
          ? buildPhotoPrompt(payload)
          : buildFullPrompt(payload);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- blocos multimodais heterogêneos
    const content: any[] = [{ type: "text", text: prompt }];
    if (mode === "photo" || mode === "preset") {
      content.push({ type: "image_url", image_url: { url: payload.photoDataUrl } });
      if (payload.outfitMode === "upload" && payload.outfitImageDataUrl) {
        content.push({ type: "image_url", image_url: { url: payload.outfitImageDataUrl } });
      }
      // imagem do produto (upload direto ou URL do catálogo Velo)
      let productDataUrl = payload.productImageDataUrl;
      if (!productDataUrl && payload.productImageUrl) {
        try {
          const imgRes = await fetch(payload.productImageUrl);
          if (imgRes.ok) {
            const buf = new Uint8Array(await imgRes.arrayBuffer());
            let bin = "";
            buf.forEach((b) => (bin += String.fromCharCode(b)));
            const type = imgRes.headers.get("content-type") || "image/jpeg";
            productDataUrl = `data:${type};base64,${btoa(bin)}`;
          }
        } catch (e) {
          console.error("Falha ao baixar imagem do produto:", (e as Error).message);
        }
      }
      if (productDataUrl) {
        content.push({ type: "image_url", image_url: { url: productDataUrl } });
      }
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error(`AI gateway error [${aiRes.status}]: ${text}`);
      if (aiRes.status === 429) return json({ error: "Limite de uso atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: "Falha ao gerar o personagem.", details: text }, aiRes.status);
    }

    const aiData = await aiRes.json();
    const b64 = aiData?.data?.[0]?.b64_json as string | undefined;
    if (!b64) {
      console.error("Resposta sem imagem:", JSON.stringify(aiData).slice(0, 500));
      return json({ error: "A IA não retornou nenhuma imagem." }, 502);
    }

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${userId}/${crypto.randomUUID()}.png`;
    const { error: upErr } = await admin.storage
      .from("ai-characters")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) {
      console.error("Erro no upload:", upErr.message);
      return json({ error: "Falha ao salvar a imagem do personagem." }, 500);
    }

    const attributes = { ...payload };
    delete attributes.photoDataUrl;
    delete attributes.outfitImageDataUrl;
    delete attributes.productImageDataUrl;

    const { data: character, error: insErr } = await admin
      .from("ai_characters")
      .insert({ user_id: userId, name, mode, image_url: path, attributes })
      .select("id, name, mode, image_url, attributes, created_at")
      .single();
    if (insErr) {
      console.error("Erro ao salvar personagem:", insErr.message);
      return json({ error: "Falha ao salvar o personagem." }, 500);
    }

    const { data: signed } = await admin.storage
      .from("ai-characters")
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    return json({ character, signedUrl: signed?.signedUrl ?? null });
  } catch (error) {
    console.error("generate-ai-character:", (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});
