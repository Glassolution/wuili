import { Plus, Trash2 } from "lucide-react";
import type { FaqData } from "@/lib/storeSections/types";
import { newId } from "@/lib/storeSections/types";
import { Field, TextInput, TextArea } from "./fields";

export default function FaqEditor({
  data,
  onChange,
}: {
  data: FaqData;
  onChange: (patch: Partial<FaqData>) => void;
}) {
  const updateItem = (id: string, patch: Partial<FaqData["items"][number]>) => {
    onChange({ items: data.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  };
  const removeItem = (id: string) => onChange({ items: data.items.filter((it) => it.id !== id) });
  const addItem = () =>
    onChange({ items: [...data.items, { id: newId("q"), question: "Nova pergunta", answer: "Resposta." }] });

  return (
    <div className="space-y-4">
      <Field label="Título da seção">
        <TextInput value={data.title} onChange={(v) => onChange({ title: v })} />
      </Field>
      <div className="space-y-3">
        {data.items.map((item, idx) => (
          <div key={item.id} className="space-y-2 rounded-md border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Pergunta {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="rounded p-1 text-neutral-400 hover:text-red-600"
                aria-label="Remover pergunta"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <TextInput value={item.question} onChange={(v) => updateItem(item.id, { question: v })} />
            <TextArea value={item.answer} onChange={(v) => updateItem(item.id, { answer: v })} rows={2} />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-500 hover:text-neutral-900"
      >
        <Plus size={14} /> Adicionar pergunta
      </button>
    </div>
  );
}
