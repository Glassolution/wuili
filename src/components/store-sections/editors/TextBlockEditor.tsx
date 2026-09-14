import type { TextBlockData } from "@/lib/storeSections/types";
import { Field, TextInput, TextArea } from "./fields";

export default function TextBlockEditor({
  data,
  onChange,
}: {
  data: TextBlockData;
  onChange: (patch: Partial<TextBlockData>) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Título">
        <TextInput value={data.title} onChange={(v) => onChange({ title: v })} />
      </Field>
      <Field label="Texto">
        <TextArea value={data.body} onChange={(v) => onChange({ body: v })} rows={6} />
      </Field>
      <Field label="Alinhamento">
        <select
          value={data.alignment}
          onChange={(e) => onChange({ alignment: e.target.value as "left" | "center" })}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="left">Esquerda</option>
          <option value="center">Centralizado</option>
        </select>
      </Field>
    </div>
  );
}
