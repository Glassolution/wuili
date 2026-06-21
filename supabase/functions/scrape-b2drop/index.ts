// Scraper do catálogo público da B2Drop.
// Roda agendado a cada 12h via pg_cron, mas pode ser disparado manualmente:
//   curl -X POST https://<project>.supabase.co/functions/v1/scrape-b2drop \
//        -H "apikey: <anon-key>"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "b2drop";
const CATALOG_URL = "https://app.sistemab2drop.com.br/public-catalog";

// ⚠️ Filtro de conteúdo — palavras bloqueadas (case-insensitive, sem acento).
// Produtos cujo título contiver QUALQUER um destes termos serão salvos com
// is_blocked=true e nunca aparecerão para o usuário final.
// Para ampliar, basta adicionar novas entradas (sempre minúsculas, sem acento).
const BLOCKLIST: string[] = [
  "vibrador",
  "erotico",
  "sexual",
  "libido",
  "afrodisiaco",
  "penis",
  "vagina",
  "bdsm",
  "lingerie sensual",
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isBlocked(title: string): boolean {
  const haystack = stripAccents(title).toLowerCase();
  return BLOCKLIST.some((w) => haystack.includes(w));
}

// Dicionário de categorias — ORDEM IMPORTA (primeira correspondência vence).
// Palavras-chave já em minúsculas e sem acento (comparadas via stripAccents+toLowerCase).
const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "Eletrônicos", keywords: ["fone", "bluetooth", "carregador", "cabo", "lanterna", "camera", "drone", "projetor", "caixa de som", "microfone", "ventilador eletrico", "ventilador", "umidificador", "gimbal", "mouse", "teclado", "controle", "joystick", "power bank"] },
  { category: "Casa", keywords: ["organizador", "cesto", "sapateira", "suporte", "dispenser", "panela", "frigideira", "talher", "chaleira", "moedor", "aspirador", "esfregao", "mangueira", "porta-temperos", "porta temperos", "tabua", "descascador"] },
  { category: "Moda", keywords: ["bolsa", "mochila", "short", "calca", "capa de chuva", "luva", "meia-calca", "meia calca", "necessaire"] },
  { category: "Bijuterias", keywords: ["colar", "pulseira", "anel", "brinco", "porta-joias", "porta joias", "kit colares"] },
  { category: "Decoração", keywords: ["luminaria", "cortina de led", "vela", "quadro", "enfeite", "astronauta"] },
  { category: "Beleza", keywords: ["serum", "mousse facial", "esfoliante", "mascara facial", "creme", "body splash", "gloss", "locao", "protetor termico", "escova alisadora", "massageador facial"] },
  { category: "Bebê e Infantil", keywords: ["infantil", "bebe", "mictorio", "mamadeira", "dosador de leite", "brinquedo", "beyblade", "boneco", "mini blocos de montar"] },
  { category: "Saúde e Bem-estar", keywords: ["ortopedica", "joelheira", "cotoveleira", "tornozeleira", "monitor de pressao", "oximetro", "monitor fetal", "raspador de pe"] },
  { category: "Esporte e Fitness", keywords: ["yoga", "elastico de exercicio", "hand grip", "faixa elastica", "hip resistance"] },
  { category: "Pet", keywords: ["pet", "escova para pets", "racao", "capa banco pet"] },
];

function inferCategory(title: string): string {
  const haystack = stripAccents(title).toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) return category;
  }
  return "Outros";
}

function parsePriceBRL(raw: string): number {
  // "R$ 1.234,56" -> 1234.56
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

type ScrapedProduct = {
  external_id: string;
  title: string;
  image_url: string;
  price: number;
  product_url: string;
};

function extractProducts(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  // Cada card começa com <div class="card product-box"> e termina antes do próximo.
  const cardRegex = /<div class="card product-box">([\s\S]*?)(?=<div class="card product-box">|<\/body>)/g;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null) {
    const block = m[1];
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*alt="product-pic"/);
    const titleMatch = block.match(/<h5[^>]*class="[^"]*qline[^"]*"[^>]*>([\s\S]*?)<\/h5>/);
    const priceMatch = block.match(/product-price-tagx[^>]*>([\s\S]*?)<\/div>/);
    const linkMatch = block.match(/href="(https:\/\/app\.sistemab2drop\.com\.br\/public-catalog\/(\d+)[^"]*)"/);

    if (!titleMatch || !linkMatch) continue;

    const title = titleMatch[1].replace(/\s+/g, " ").trim();
    const product_url = linkMatch[1];
    const external_id = linkMatch[2];
    const image_url = imgMatch?.[1] ?? "";
    const price = priceMatch ? parsePriceBRL(priceMatch[1]) : 0;

    if (!title || !external_id) continue;

    products.push({ external_id, title, image_url, price, product_url });
  }
  return products;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[scrape-b2drop] Iniciando scraping de ${CATALOG_URL}`);
    const res = await fetch(CATALOG_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VeloBot/1.0; +https://wuili.lovable.app)",
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      throw new Error(`Falha ao buscar B2Drop: HTTP ${res.status}`);
    }
    const html = await res.text();
    const scraped = extractProducts(html);
    console.log(`[scrape-b2drop] ${scraped.length} produtos extraídos do HTML`);

    let inserted = 0;
    let updated = 0;
    let blocked = 0;
    const now = new Date().toISOString();

    // Pré-carrega external_ids existentes para classificar insert vs update no log.
    const { data: existing } = await supabase
      .from("catalog_products")
      .select("external_id")
      .eq("source", SOURCE);
    const existingIds = new Set((existing ?? []).map((r) => r.external_id));

    // Upsert em lotes
    const rows = scraped.map((p) => {
      const blockedFlag = isBlocked(p.title);
      if (blockedFlag) blocked++;
      return {
        source: SOURCE,
        external_id: p.external_id,
        title: p.title,
        description: null,
        images: [p.image_url].filter(Boolean),
        cost_price: p.price,
        suggested_price: Math.round(p.price * 2 * 100) / 100,
        margin_percent: 100,
        category: inferCategory(p.title),
        supplier_name: "B2Drop",
        stock_quantity: 100, // catálogo público não expõe estoque real
        is_active: true,
        product_url: p.product_url,
        is_blocked: blockedFlag,
        scraped_at: now,
        updated_at: now,
      };
    });

    // upsert em lotes de 200
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("catalog_products")
        .upsert(slice, { onConflict: "source,external_id" });
      if (error) {
        console.error(`[scrape-b2drop] Erro no upsert lote ${i}:`, error.message);
        throw error;
      }
      for (const r of slice) {
        if (existingIds.has(r.external_id)) updated++;
        else inserted++;
      }
    }

    const summary = {
      ok: true,
      source: SOURCE,
      total_scraped: scraped.length,
      inserted,
      updated,
      blocked,
      ran_at: now,
    };
    console.log("[scrape-b2drop] Concluído:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[scrape-b2drop] Erro fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
