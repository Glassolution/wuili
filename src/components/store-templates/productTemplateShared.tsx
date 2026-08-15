import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Star } from "lucide-react";

import type { ProductVariantOption } from "@/lib/userProjects";
import {
  fetchStoreReviews,
  summarizeReviews,
  type StoreReviewSummary,
  EMPTY_REVIEW_SUMMARY,
} from "@/lib/storeReviews";

/**
 * Infraestrutura comum aos templates de página de produto.
 *
 * Aqui mora o que não muda de um template para o outro: o contrato de props, o
 * tratamento da galeria, o seletor de cor, a marcação leve da descrição, a
 * leitura das avaliações reais e as estrelas. O que muda — layout, paleta,
 * ordem das seções — fica no arquivo de cada template.
 *
 * Duas regras valem para todos:
 *
 * 1. Dado de produto é sempre dinâmico (título, preço, fotos, variações).
 * 2. Prova social só sai de avaliação real (store_reviews). Sem avaliação, o
 *    template mostra placeholder editável — fabricar número é publicidade
 *    enganosa (CDC art. 37), e quem publica responde por ele.
 */

// --- Tipos ------------------------------------------------------------------

/** Produto do carrossel de recomendados. */
export type RelatedProduct = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number | null;
  imageUrl?: string | null;
};

export type ProductTemplateProps = {
  brand: string;
  title: string;
  description: string;
  price: number;
  /** Preço "de" riscado. Só quando o fornecedor pratica desconto real. */
  originalPrice: number | null;
  image: string;
  /** Galeria completa do produto (a primeira é `image`). */
  images?: string[];
  productId?: string;
  /** Projeto dono da vitrine — alimenta as avaliações reais (store_reviews).
   *  Ausente = preview do editor: os blocos aparecem, mas sem dado gravado. */
  projectId?: string;
  accent: string;
  mobile?: boolean;
  /** Variações reais do fornecedor. [] = sem variação, seletor omitido. */
  variants?: ProductVariantOption[];
  /** Outros produtos do mesmo projeto. Vazio esconde a seção de recomendados. */
  relatedProducts?: RelatedProduct[];
};

// --- Cor de destaque --------------------------------------------------------

/** Cor padrão do editor: enquanto o lojista não escolhe uma, cada template usa
 *  a própria identidade em vez de ficar preto. */
export const DEFAULT_EDITOR_ACCENT = "#111111";

export const resolveTone = (accent: string | undefined, identidade: string) => {
  const value = (accent ?? "").trim().toLowerCase();
  return !value || value === DEFAULT_EDITOR_ACCENT ? identidade : (accent as string);
};

/** Converte hex em rgba, para fundos com leve tingimento da cor de destaque. */
export const tint = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};

// --- Galeria e imagens ------------------------------------------------------

/** Junta a foto principal com o resto da galeria, sem vazias nem repetidas. */
export const buildGallery = (images: string[] | undefined, primary: string): string[] => {
  const all = [primary, ...(images ?? [])]
    .map((src) => (typeof src === "string" ? src.trim() : ""))
    .filter((src) => src.length > 0);
  return Array.from(new Set(all));
};

/** Foto para os blocos de baixo: cicla pela galeria para a página não repetir a
 *  mesma imagem de cima a baixo. */
export const imageAt = (gallery: string[], index: number) =>
  gallery.length ? gallery[index % gallery.length] : "";

// --- Variações --------------------------------------------------------------

/** Cores comuns de catálogo em pt-BR — pinta a bolinha do seletor de cor.
 *  Nome fora da lista cai num cinza neutro (sem inventar a cor errada). */
const COLOR_HEX: Record<string, string> = {
  preto: "#111111", branco: "#FFFFFF", cinza: "#9CA3AF", prata: "#C9CDD2", dourado: "#D4AF37",
  vermelho: "#DC2626", vinho: "#7F1D1D", rosa: "#EC4899", laranja: "#F97316", amarelo: "#FACC15",
  verde: "#16A34A", azul: "#2563EB", "azul marinho": "#1E3A8A", roxo: "#7C3AED", lilas: "#C4B5FD",
  marrom: "#78350F", bege: "#E7DCC8", transparente: "#F3F4F6",
};

export const colorSwatch = (option: string) => {
  const key = option.trim().toLowerCase();
  return COLOR_HEX[key] ?? COLOR_HEX[key.split(" ")[0]] ?? "#D1D5DB";
};

export const isColorGroup = (name: string) => /cor|color/i.test(name);

// --- Texto ------------------------------------------------------------------

/**
 * Marcação leve na descrição: `**negrito**` e `__sublinhado__`.
 *
 * A descrição do fornecedor vem como HTML e injetar isso na página seria abrir
 * a porta para script de terceiro — então os templates aceitam só estes dois
 * marcadores e montam os elementos em React, sem `dangerouslySetInnerHTML`.
 */
export const renderRichText = (text: string, strongClassName = "font-bold"): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className={strongClassName}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("__") && part.endsWith("__")) {
      return (
        <u key={index} className={`${strongClassName} underline decoration-2 underline-offset-2`}>
          {part.slice(2, -2)}
        </u>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });

// --- Carrossel --------------------------------------------------------------

/** Rola um carrossel horizontal sem estado React (nada re-renderiza, e o editor
 *  aplica as edições do lojista direto no DOM montado). */
export const scrollCarousel = (node: HTMLElement | null, direction: -1 | 1) => {
  if (!node) return;
  node.scrollBy({ left: direction * Math.max(280, node.clientWidth * 0.8), behavior: "smooth" });
};

// --- Avaliações -------------------------------------------------------------

/** Avaliações reais da loja. Sem projeto (preview do editor) ou sem avaliação,
 *  devolve o resumo vazio e cada template decide o que mostrar no lugar. */
export const useStoreReviewSummary = (projectId?: string): StoreReviewSummary => {
  const [resumo, setResumo] = useState<StoreReviewSummary>(EMPTY_REVIEW_SUMMARY);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void fetchStoreReviews(projectId)
      .then((reviews) => {
        if (active) setResumo(summarizeReviews(reviews));
      })
      .catch(() => {
        /* loja sem avaliações ou tabela indisponível: segue no estado vazio */
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return resumo;
};

// --- Estrelas ---------------------------------------------------------------

export const Stars = ({
  value,
  size = 16,
  color = "#1F2937",
}: {
  value: number;
  size?: number;
  color?: string;
}) => (
  <span className="inline-flex items-center gap-0.5" style={{ color }} aria-label={`${value.toFixed(1)} de 5`}>
    {[1, 2, 3, 4, 5].map((index) => (
      <Star
        key={index}
        size={size}
        fill={index <= Math.round(value) ? "currentColor" : "none"}
        strokeWidth={index <= Math.round(value) ? 0 : 1.6}
        className={index <= Math.round(value) ? "" : "opacity-30"}
      />
    ))}
  </span>
);
