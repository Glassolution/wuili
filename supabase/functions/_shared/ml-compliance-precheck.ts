// Verificação determinística (sem IA) das diretrizes do Mercado Livre,
// aplicada no momento em que um produto CHEGA na Velo (scraping dos
// fornecedores) e reaproveitada na publicação.
//
// Aqui não há chamada de IA de propósito: o scraping processa milhares de
// produtos por rodada e uma checagem visual por item estouraria tempo e custo.
// A checagem visual continua onde importa de verdade — na `ml-publish`, antes
// de o anúncio ir ao ar.
import { isSuspiciousImageUrl, sanitizeTitle, stripMLHtml } from "./ml-content-sanitizer.ts";

/** Mínimo de fotos que o Mercado Livre exige por anúncio. */
export const MIN_REQUIRED_IMAGES = 3;

/** Trechos na descrição do fornecedor que o ML pune (FR_EVASION_PRICE_AUTO e afins). */
const FORBIDDEN_DESCRIPTION_PATTERNS: Array<{ re: RegExp; issue: string }> = [
  { re: /\bfrete\s+gr(a|á)tis\b/i, issue: "descricao_frete" },
  { re: /\b(valor|custo|taxa)\s+d[eo]\s+frete\b/i, issue: "descricao_frete" },
  { re: /\bfrete\s+(inclu(so|ído|ido)|(a\s+)?combinar|por\s+conta)\b/i, issue: "descricao_frete" },
  { re: /\bwhats\s*app\b|\bwpp\b|\btelegram\b|\binstagram\b/i, issue: "descricao_contato" },
  { re: /https?:\/\/\S+|www\.\S+/i, issue: "descricao_link" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/i, issue: "descricao_contato" },
  { re: /\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/, issue: "descricao_contato" },
  { re: /\br\$\s?\d/i, issue: "descricao_preco" },
  { re: /\b(pix|boleto|dep(o|ó)sito\s+banc(a|á)rio)\b/i, issue: "descricao_pagamento" },
  { re: /\b(mercado\s*(livre|pago|envios)|shopee|amazon|aliexpress|magalu|shein|c7\s*drop)\b/i, issue: "descricao_marketplace" },
  { re: /<[a-z][\s\S]*>/i, issue: "descricao_html" },
];

export type ComplianceStatus = "ok" | "needs_review" | "blocked";

export type ComplianceResult = {
  status: ComplianceStatus;
  issues: string[];
  cleanImages: string[];
  cleanImagesCount: number;
  suggestedTitle: string;
};

const toImageList = (images: unknown): string[] => {
  try {
    const raw = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(raw) ? raw.filter((i): i is string => typeof i === "string" && !!i) : [];
  } catch {
    return [];
  }
};

/**
 * Avalia um produto do catálogo contra as diretrizes do ML.
 *
 * - `blocked`: não dá pra publicar do jeito que está (fotos limpas < 3).
 * - `needs_review`: publica, mas título/descrição precisam ser reescritos
 *   antes de ir ao ar (a `ml-publish` já faz isso automaticamente).
 * - `ok`: nada irregular encontrado.
 */
export function precheckProduct(input: {
  title?: string | null;
  description?: string | null;
  images?: unknown;
}): ComplianceResult {
  const issues: string[] = [];
  const images = toImageList(input.images);
  const cleanImages = images.filter((url) => !isSuspiciousImageUrl(url));

  if (images.length === 0) issues.push("sem_imagens");
  if (cleanImages.length < images.length) issues.push("imagens_arte_fornecedor");
  if (cleanImages.length < MIN_REQUIRED_IMAGES) issues.push("imagens_insuficientes");

  const rawTitle = String(input.title ?? "");
  const { removedTerms } = sanitizeTitle(rawTitle, { maxLength: 60 });
  if (removedTerms.length > 0) issues.push("titulo_termos_proibidos");
  if (rawTitle.trim().length > 60) issues.push("titulo_longo");

  const description = String(input.description ?? "");
  if (description.trim()) {
    for (const { re, issue } of FORBIDDEN_DESCRIPTION_PATTERNS) {
      if (re.test(description) && !issues.includes(issue)) issues.push(issue);
    }
  }

  const status: ComplianceStatus = cleanImages.length < MIN_REQUIRED_IMAGES
    ? "blocked"
    : issues.length > 0
    ? "needs_review"
    : "ok";

  return {
    status,
    issues,
    cleanImages,
    cleanImagesCount: cleanImages.length,
    suggestedTitle: sanitizeTitle(rawTitle, { maxLength: 60 }).title,
  };
}

/** Campos prontos para gravar em `catalog_products`. */
export function complianceColumns(result: ComplianceResult, checkedAt = new Date().toISOString()) {
  return {
    ml_compliance_status: result.status,
    ml_compliance_issues: result.issues,
    ml_clean_images_count: result.cleanImagesCount,
    ml_compliance_checked_at: checkedAt,
  };
}

/**
 * Reescreve a descrição do fornecedor de forma determinística: tira HTML e
 * descarta as frases que o Mercado Livre pune (frete, contato, link, preço,
 * forma de pagamento, menção a outros marketplaces).
 */
export function sanitizeDescriptionForCatalog(raw?: string | null): string {
  const texto = stripMLHtml(String(raw ?? ""));
  if (!texto.trim()) return "";

  const blocos = texto
    .split(/\n+/)
    .flatMap((linha) => linha.split(/(?<=[.!?;])\s+/))
    .map((frase) => frase.trim())
    .filter(Boolean)
    .filter((frase) => !FORBIDDEN_DESCRIPTION_PATTERNS.some(({ re }) => re.test(frase)));

  return blocos.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}

/**
 * Aplica as correções na chegada do produto: título higienizado, descrição
 * reescrita e veredito recalculado sobre o conteúdo já corrigido. Nada disso
 * aparece como aviso para o lojista — o produto entra no catálogo já conforme.
 */
export function autoFixProduct(input: {
  title?: string | null;
  description?: string | null;
  images?: unknown;
}): { title: string; description: string | null; result: ComplianceResult } {
  const title = sanitizeTitle(String(input.title ?? ""), { maxLength: 60 }).title ||
    String(input.title ?? "").slice(0, 60);
  const limpa = sanitizeDescriptionForCatalog(input.description);
  const description = input.description == null ? null : limpa;
  return {
    title,
    description,
    result: precheckProduct({ title, description, images: input.images }),
  };
}
