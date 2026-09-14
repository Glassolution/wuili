// Catálogo central de blocos disponíveis. Adicionar um novo tipo aqui é o
// suficiente para: (a) o SectionRenderer saber renderizar, (b) o editor
// oferecer no menu "Adicionar bloco", (c) o formulário estruturado aparecer.
//
// Fase 1 traz Hero, FAQ e TextBlock. Fase 2 adicionará os 10 blocos ricos.

import type { ComponentType } from "react";
import {
  heroDataSchema,
  faqDataSchema,
  textBlockDataSchema,
  newId,
  type HeroData,
  type FaqData,
  type TextBlockData,
  type SectionType,
  type StoreSection,
} from "./types";
import HeroSection from "@/components/store-sections/blocks/HeroSection";
import FaqSection from "@/components/store-sections/blocks/FaqSection";
import TextBlockSection from "@/components/store-sections/blocks/TextBlockSection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry heterogêneo por design; cada entrada é tipada individualmente
type Entry = {
  type: SectionType;
  label: string;
  description: string;
  component: ComponentType<{ data: any }>;
  createDefault: () => StoreSection;
};

export const SECTION_REGISTRY: Record<SectionType, Entry> = {
  hero: {
    type: "hero",
    label: "Hero",
    description: "Título grande, subtítulo, imagem e botão de compra.",
    component: HeroSection as ComponentType<{ data: HeroData }>,
    createDefault: () => ({
      id: newId("hero"),
      type: "hero",
      enabled: true,
      data: heroDataSchema.parse({}),
    }),
  },
  faq: {
    type: "faq",
    label: "FAQ",
    description: "Perguntas frequentes em acordeão. Adicione/remova itens.",
    component: FaqSection as ComponentType<{ data: FaqData }>,
    createDefault: () => ({
      id: newId("faq"),
      type: "faq",
      enabled: true,
      data: faqDataSchema.parse({
        title: "Perguntas frequentes",
        items: [
          { id: newId("q"), question: "Qual o prazo de entrega?", answer: "De 5 a 12 dias úteis." },
          { id: newId("q"), question: "Posso trocar o produto?", answer: "Sim, em até 7 dias." },
        ],
      }),
    }),
  },
  textBlock: {
    type: "textBlock",
    label: "Texto",
    description: "Um bloco simples de texto com título.",
    component: TextBlockSection as ComponentType<{ data: TextBlockData }>,
    createDefault: () => ({
      id: newId("txt"),
      type: "textBlock",
      enabled: true,
      data: textBlockDataSchema.parse({}),
    }),
  },
};

export const SECTION_TYPES = Object.values(SECTION_REGISTRY);
