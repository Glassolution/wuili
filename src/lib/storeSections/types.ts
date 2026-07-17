// Fase 1 do novo template — schema de seções modulares.
//
// Cada loja guarda em `user_projects.metadata.sections` uma lista ordenada de
// blocos. O SectionRenderer usa o `type` para escolher o componente. A ordem
// do array é a ordem de renderização. `enabled: false` esconde o bloco na
// página pública sem removê-lo.
//
// Compat: quando `metadata.sections` está ausente/vazio, o PublicStorePage e o
// editor antigo continuam renderizando o template monolítico. Nada quebra.

import { z } from "zod";

/** Tokens de tema por loja. As seções NUNCA usam cor fixa — sempre consomem
 *  estes tokens via CSS variables aplicadas pelo SectionRenderer. */
export const themeTokensSchema = z.object({
  primary: z.string().default("#111111"),
  primaryText: z.string().default("#ffffff"),
  accent: z.string().default("#f59e0b"),
  background: z.string().default("#ffffff"),
  surface: z.string().default("#f5f5f5"),
  text: z.string().default("#0f172a"),
  mutedText: z.string().default("#64748b"),
  border: z.string().default("#e5e7eb"),
  radius: z.number().default(12),
  fontHeading: z.string().default("Inter"),
  fontBody: z.string().default("Inter"),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export const defaultThemeTokens = themeTokensSchema.parse({});

// ---------- Schemas de dados por tipo de bloco ----------

export const heroDataSchema = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default("Título do produto"),
  subtitle: z.string().default("Descrição curta que vende o produto."),
  imageUrl: z.string().default(""),
  ctaLabel: z.string().default("Comprar agora"),
  ctaUrl: z.string().default("#comprar"),
});
export type HeroData = z.infer<typeof heroDataSchema>;

export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string().default("Pergunta?"),
  answer: z.string().default("Resposta."),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

export const faqDataSchema = z.object({
  title: z.string().default("Perguntas frequentes"),
  items: z.array(faqItemSchema).default([]),
});
export type FaqData = z.infer<typeof faqDataSchema>;

export const textBlockDataSchema = z.object({
  title: z.string().default("Sobre"),
  body: z.string().default("Escreva aqui o texto do bloco."),
  alignment: z.enum(["left", "center"]).default("left"),
});
export type TextBlockData = z.infer<typeof textBlockDataSchema>;

// ---------- União discriminada ----------

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("hero"),
    enabled: z.boolean().default(true),
    data: heroDataSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("faq"),
    enabled: z.boolean().default(true),
    data: faqDataSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("textBlock"),
    enabled: z.boolean().default(true),
    data: textBlockDataSchema,
  }),
]);
export type StoreSection = z.infer<typeof sectionSchema>;
export type SectionType = StoreSection["type"];

export const sectionsArraySchema = z.array(sectionSchema);

/** Lê e valida `metadata.sections`. Retorna [] em qualquer inconsistência
 *  (compat layer trata isso caindo pro template antigo). */
export function parseSections(value: unknown): StoreSection[] {
  const result = sectionsArraySchema.safeParse(value);
  return result.success ? result.data : [];
}

export function parseTheme(value: unknown): ThemeTokens {
  const result = themeTokensSchema.safeParse(value ?? {});
  return result.success ? result.data : defaultThemeTokens;
}

/** Gera um id estável curto para novas seções/itens. */
export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
