// Completa as fotos dos produtos que o Mercado Livre não aceitaria por falta
// de imagem limpa (arte de catálogo, banner, marca d'água).
//
// Para cada produto marcado como `blocked` no catálogo, gera com IA as fotos
// que faltam para chegar ao mínimo do ML, usando a melhor imagem existente
// como referência do produto real. As imagens geradas vão para o bucket
// público `product-images` e entram no início da lista do produto.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  complianceColumns,
  MIN_REQUIRED_IMAGES,
  precheckProduct,
} from "../_shared/ml-compliance-precheck.ts";
import { isSuspiciousImageUrl } from "../_shared/ml-content-sanitizer.ts";

const BUCKET = "product-images";
const PASTA = "catalogo-ia";
const GAP_MS = 1500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const listaDeImagens = (images: unknown): string[] => {
  try {
    const raw = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(raw) ? raw.filter((i): i is string => typeof i === "string" && !!i) : [];
  } catch {
    return [];
  }
};

/** Baixa a imagem de referência como data URL (o gateway só aceita assim). */
async function comoDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    const tipo = res.headers.get("content-type") || "image/jpeg";
    return `data:${tipo};base64,${btoa(bin)}`;
  } catch {
    return undefined;
  }
}

const ANGULOS = [
  "de frente, centralizado, fundo branco puro",
  "em leve perspectiva de três quartos, fundo branco puro",
  "de lado, mostrando o perfil do produto, fundo branco puro",
  "em close nos detalhes do produto, fundo branco puro",
];

function montarPrompt(titulo: string, indice: number) {
  return `Fotografia de produto para e-commerce do item "${titulo}", ${ANGULOS[indice % ANGULOS.length]}.
A imagem enviada é o produto real: mantenha exatamente o mesmo formato, cor, proporções e detalhes. Não invente outro produto.
Iluminação de estúdio, foco nítido, aparência de foto real.
Proibido: qualquer texto, preço, selo, moldura, colagem, banner, logotipo, marca d'água ou pessoa na imagem.`;
}

async function gerarImagem(apiKey: string, titulo: string, referencia: string, indice: number) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: montarPrompt(titulo, indice) },
          { type: "image_url", image_url: { url: referencia } },
        ],
      }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const texto = await res.text();
    return { erro: `gateway ${res.status}: ${texto.slice(0, 200)}`, status: res.status };
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json as string | undefined;
  if (!b64) return { erro: "IA não devolveu imagem", status: 502 };
  return { b64 };
}

async function subirImagem(supabase: SupabaseClient, productId: string, indice: number, b64: string) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const caminho = `${PASTA}/${productId}/${Date.now()}-${indice}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, bin, { contentType: "image/png", upsert: true });
  if (error) return { erro: error.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  return { url: data.publicUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = !!token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const hasRepairToken = req.headers.get("x-repair-token") === Deno.env.get("ML_REPAIR_TOKEN");
    if (!isServiceRole && !hasRepairToken) {
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ error: "não autenticado" }, 401);
      const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!isAdmin) return json({ error: "acesso restrito a administradores" }, 403);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit ?? 5), 1), 20);
    const ids: string[] | null = Array.isArray(body.ids) && body.ids.length ? body.ids.map(String) : null;

    let query = supabase
      .from("catalog_products")
      .select("id, title, description, images, ml_clean_images_count")
      .limit(limit);
    query = ids
      ? query.in("id", ids)
      : query
        .eq("ml_compliance_status", "blocked")
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("ml_compliance_checked_at", { ascending: true, nullsFirst: true });

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const resultados: Record<string, unknown>[] = [];
    let creditosAcabaram = false;

    for (const row of rows ?? []) {
      if (creditosAcabaram) break;
      const todas = listaDeImagens(row.images);
      const limpas = todas.filter((u) => !isSuspiciousImageUrl(u));
      const faltam = MIN_REQUIRED_IMAGES - limpas.length;
      if (faltam <= 0) {
        resultados.push({ id: row.id, status: "já_conforme" });
        continue;
      }
      const base = limpas[0] ?? todas[0];
      if (!base) {
        resultados.push({ id: row.id, status: "sem_referencia" });
        continue;
      }
      const referencia = await comoDataUrl(base);
      if (!referencia) {
        resultados.push({ id: row.id, status: "referencia_indisponivel" });
        continue;
      }

      const geradas: string[] = [];
      for (let i = 0; i < faltam; i++) {
        const g = await gerarImagem(apiKey, String(row.title ?? "produto"), referencia, i);
        if ("erro" in g && g.erro) {
          // 402/403 param a rotina inteira; os demais erros pulam o produto.
          if (g.status === 402 || g.status === 403) creditosAcabaram = true;
          resultados.push({ id: row.id, status: "falha_ia", motivo: g.erro });
          break;
        }
        const up = await subirImagem(supabase, String(row.id), i, g.b64!);
        if (up.erro) {
          resultados.push({ id: row.id, status: "falha_upload", motivo: up.erro });
          break;
        }
        geradas.push(up.url!);
        await sleep(GAP_MS);
      }

      if (geradas.length === 0) continue;

      // Fotos geradas primeiro (viram a capa), depois as originais limpas.
      const novas = [...geradas, ...limpas, ...todas.filter((u) => !limpas.includes(u))];
      const veredito = precheckProduct({ title: row.title, description: row.description, images: novas });
      const { error: upErr } = await supabase
        .from("catalog_products")
        .update({ images: novas, ...complianceColumns(veredito) })
        .eq("id", row.id);

      resultados.push({
        id: row.id,
        status: upErr ? "falha_ao_salvar" : "fotos_geradas",
        geradas: geradas.length,
        novo_status: veredito.status,
        motivo: upErr?.message,
      });
    }

    return json({
      ok: true,
      processados: resultados.length,
      creditos_esgotados: creditosAcabaram,
      resultados,
    });
  } catch (err) {
    console.error("[ml-catalog-image-filler]", err);
    return json({ error: String(err) }, 500);
  }
});
