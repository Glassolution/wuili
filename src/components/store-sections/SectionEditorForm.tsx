// Roteia a edição estruturada por tipo de seção. Cada tipo pode ter seu
// próprio formulário. Fase 1: hero, faq, textBlock.

import type { StoreSection } from "@/lib/storeSections/types";
import HeroEditor from "./editors/HeroEditor";
import FaqEditor from "./editors/FaqEditor";
import TextBlockEditor from "./editors/TextBlockEditor";

type Props = {
  section: StoreSection;
  onChange: (next: StoreSection) => void;
};

export default function SectionEditorForm({ section, onChange }: Props) {
  if (section.type === "hero") {
    return (
      <HeroEditor
        data={section.data}
        onChange={(patch) => onChange({ ...section, data: { ...section.data, ...patch } })}
      />
    );
  }
  if (section.type === "faq") {
    return (
      <FaqEditor
        data={section.data}
        onChange={(patch) => onChange({ ...section, data: { ...section.data, ...patch } })}
      />
    );
  }
  if (section.type === "textBlock") {
    return (
      <TextBlockEditor
        data={section.data}
        onChange={(patch) => onChange({ ...section, data: { ...section.data, ...patch } })}
      />
    );
  }
  return null;
}
