import type { HeroData } from "@/lib/storeSections/types";
import { Field, TextInput, TextArea } from "./fields";

export default function HeroEditor({
  data,
  onChange,
}: {
  data: HeroData;
  onChange: (patch: Partial<HeroData>) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Sobretítulo">
        <TextInput value={data.eyebrow} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Título">
        <TextInput value={data.title} onChange={(v) => onChange({ title: v })} />
      </Field>
      <Field label="Subtítulo">
        <TextArea value={data.subtitle} onChange={(v) => onChange({ subtitle: v })} rows={3} />
      </Field>
      <Field label="URL da imagem">
        <TextInput value={data.imageUrl} onChange={(v) => onChange({ imageUrl: v })} placeholder="https://..." />
      </Field>
      <Field label="Texto do botão">
        <TextInput value={data.ctaLabel} onChange={(v) => onChange({ ctaLabel: v })} />
      </Field>
      <Field label="Link do botão">
        <TextInput value={data.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} />
      </Field>
    </div>
  );
}
