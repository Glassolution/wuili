// Gera UMA imagem de produto com IA para a tela "Imagens com IA".
//
// Diferente de generate-ai-character, esta função não persiste nada: devolve a
// imagem em base64 para o navegador exibir e o lojista baixar. Assim a tela
// funciona sem depender de bucket nem de tabela nova — quando fizer sentido
// guardar histórico, é só adicionar o upload aqui.
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
  /** Texto escrito pelo lojista, com as fichas @produto e @avatar. */
  prompt?: string;
  mode?: "produto" | "anuncio";
  style?: string;
  language?: string;
  aspectRatio?: string;
  productTitle?: string;
  /** Produto do catálogo Velo (URL pública) ou foto enviada (data URL). */
  productImageUrl?: string;
  productImageDataUrl?: string;
  avatarName?: string;
  avatarImageUrl?: string;
};

const IDIOMAS: Record<string, string> = {
  "pt-BR": "português do Brasil",
  "en-US": "inglês",
  es: "espanhol",
};

const PROPORCOES: Record<string, string> = {
  "1:1": "quadrado 1:1",
  "4:5": "vertical 4:5, formato de feed",
  "9:16": "vertical 9:16, formato de story",
};

function montarPrompt(p: Payload) {
  const pedido = (p.prompt || "").trim() || "Uma foto profissional do produto.";
  // As fichas viram os nomes reais antes de chegar no modelo.
  const descricao = pedido
    .replaceAll("@produto", p.productTitle ? `"${p.productTitle}"` : "o produto enviado")
    .replaceAll("@avatar", p.avatarName ? `${p.avatarName}` : "uma pessoa");

  const estilo = p.style && p.style !== "Automático" ? `Estilo visual: ${p.style}.` : "";
  const proporcao = p.aspectRatio && PROPORCOES[p.aspectRatio] ? `Enquadramento ${PROPORCOES[p.aspectRatio]}.` : "";
  const idioma = IDIOMAS[p.language ?? ""] ?? "português do Brasil";

  const papelDasImagens = p.avatarImageUrl
    ? `A PRIMEIRA imagem enviada é o PRODUTO: ele precisa aparecer exatamente igual — mesmo formato, mesma cor, mesmos detalhes e mesma marca. A SEGUNDA imagem é a PESSOA: mantenha o rosto, o tom de pele e o tipo físico reconhecíveis.`
    : `A imagem enviada é o PRODUTO: ele precisa aparecer exatamente igual — mesmo formato, mesma cor, mesmos detalhes e mesma marca. Não invente outro produto.`;

  const anuncio =
    p.mode === "anuncio"
      ? `Formato de anúncio estático para redes sociais: composição limpa, espaço livre para texto e destaque comercial do produto. Qualquer texto que apareça deve estar em ${idioma}.`
      : `Foto de produto para e-commerce: produto em destaque, sem elementos que disputem atenção.`;

  return `${descricao}

${papelDasImagens}

${anuncio}
${estilo}
${proporcao}
Iluminação natural e agradável, foco nítido no produto, aparência de fotografia real (não ilustração, não render 3D).
Sem marca d'água, sem logotipo inventado, sem texto embaralhado, sem colagem.`;
}

/** Baixa uma imagem por URL e devolve como data URL (o gateway só aceita assim). */
async function urlParaDataUrl(url: string): Promise<string | undefined> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return undefined;
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    let binario = "";
    bytes.forEach((b) => (binario += String.fromCharCode(b)));
    const tipo = resposta.headers.get("content-type") || "image/jpeg";
    return `data:${tipo};base64,${btoa(binario)}`;
  } catch (erro) {
    console.error("Falha ao baixar imagem:", (erro as Error).message);
    return undefined;
  }
}


/** Planos que não têm teto mensal de imagens. */
const PLANOS_PAGOS = new Set(["base", "pro", "plus", "business"]);
export const LIMITE_MENSAL_GRATUITO = 3;

const inicioDoMes = () => {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
};

/**
 * Cota do usuário no mês corrente. Roda com service role: o cliente não pode
 * inserir nem apagar linhas de consumo, então o número não é contornável pelo
 * navegador.
 */
async function lerCota(admin: ReturnType<typeof createClient>, userId: string) {
  const [assinatura, perfil] = await Promise.all([
    admin
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", userId)
      .in("status", ["active", "authorized", "trialing", "trial"])
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    admin.from("profiles").select("plano").eq("user_id", userId).maybeSingle(),
  ]);

  const plano = String(assinatura.data?.plan ?? perfil.data?.plano ?? "gratis").toLowerCase();
  const ilimitado = PLANOS_PAGOS.has(plano);

  const { count } = await admin
    .from("ai_image_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", inicioDoMes());

  const usadas = count ?? 0;
  return {
    plano,
    ilimitado,
    limite: ilimitado ? null : LIMITE_MENSAL_GRATUITO,
    usadas,
    restantes: ilimitado ? null : Math.max(0, LIMITE_MENSAL_GRATUITO - usadas),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

    const payload = (await req.json().catch(() => ({}))) as Payload;

    // Cota antes de qualquer chamada paga: sem isso o gratuito consome crédito
    // de IA mesmo depois de estourar o teto.
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cota = await lerCota(admin, userData.user.id);
    if (!cota.ilimitado && cota.restantes !== null && cota.restantes <= 0) {
      return json(
        {
          error: `Você já usou as ${LIMITE_MENSAL_GRATUITO} imagens do plano gratuito neste mês. Faça upgrade para continuar gerando.`,
          quota: cota,
        },
        429,
      );
    }

    const produtoDataUrl =
      payload.productImageDataUrl ??
      (payload.productImageUrl ? await urlParaDataUrl(payload.productImageUrl) : undefined);
    if (!produtoDataUrl) {
      return json({ error: "Escolha um produto — do catálogo Velo ou uma foto sua." }, 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- blocos multimodais heterogêneos
    const content: any[] = [{ type: "text", text: montarPrompt(payload) }];
    content.push({ type: "image_url", image_url: { url: produtoDataUrl } });

    if (payload.avatarImageUrl) {
      const avatarDataUrl = await urlParaDataUrl(payload.avatarImageUrl);
      if (avatarDataUrl) content.push({ type: "image_url", image_url: { url: avatarDataUrl } });
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
      const texto = await aiRes.text();
      console.error(`AI gateway error [${aiRes.status}]: ${texto}`);
      if (aiRes.status === 429) return json({ error: "Limite de uso atingido. Tente de novo em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: "Falha ao gerar a imagem." }, aiRes.status);
    }

    const aiData = await aiRes.json();
    const b64 = aiData?.data?.[0]?.b64_json as string | undefined;
    if (!b64) {
      console.error("Resposta sem imagem:", JSON.stringify(aiData).slice(0, 500));
      return json({ error: "A IA não devolveu nenhuma imagem." }, 502);
    }

    // Só conta imagem que realmente saiu. Falha no registro não invalida a
    // entrega — o usuário já tem a imagem; o contador se corrige na próxima.
    const { error: registroErr } = await admin
      .from("ai_image_generations")
      .insert({ user_id: userData.user.id, mode: payload.mode === "anuncio" ? "anuncio" : "produto" });
    if (registroErr) console.error("Falha ao registrar consumo de imagem:", registroErr.message);

    const cotaFinal = await lerCota(admin, userData.user.id);
    return json({ imageDataUrl: `data:image/png;base64,${b64}`, quota: cotaFinal });
  } catch (erro) {
    console.error("generate-product-image falhou:", (erro as Error).message);
    return json({ error: "Erro inesperado ao gerar a imagem." }, 500);
  }
});
