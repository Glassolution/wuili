// Renderiza uma lista ordenada de seções aplicando o tema da loja via CSS
// vars. Usado tanto no editor (preview ao vivo) quanto na página pública.

import { SECTION_REGISTRY } from "@/lib/storeSections/registry";
import { themeToCssVars } from "@/lib/storeSections/theme";
import type { StoreSection, ThemeTokens } from "@/lib/storeSections/types";

type Props = {
  sections: StoreSection[];
  theme: ThemeTokens;
  /** Se true, mostra seções mesmo com enabled=false (só no editor). */
  showDisabled?: boolean;
};

export default function SectionRenderer({ sections, theme, showDisabled = false }: Props) {
  return (
    <div style={themeToCssVars(theme)}>
      {sections.map((section) => {
        if (!section.enabled && !showDisabled) return null;
        const entry = SECTION_REGISTRY[section.type];
        if (!entry) return null;
        const Component = entry.component;
        return (
          <div
            key={section.id}
            data-section-id={section.id}
            data-section-type={section.type}
            style={{ opacity: section.enabled ? 1 : 0.4, position: "relative" }}
          >
            <Component data={section.data} />
          </div>
        );
      })}
    </div>
  );
}
