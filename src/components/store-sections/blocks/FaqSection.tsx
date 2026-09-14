import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqData } from "@/lib/storeSections/types";

export default function FaqSection({ data }: { data: FaqData }) {
  const [openId, setOpenId] = useState<string | null>(data.items[0]?.id ?? null);
  return (
    <section
      className="w-full px-6 py-16"
      style={{ background: "var(--st-surface)", color: "var(--st-text)", fontFamily: "var(--st-font-body)" }}
    >
      <div className="mx-auto max-w-3xl">
        <h2
          className="mb-8 text-center text-3xl font-bold"
          style={{ fontFamily: "var(--st-font-heading)" }}
        >
          {data.title}
        </h2>
        <div className="space-y-3">
          {data.items.length === 0 && (
            <p className="text-center text-sm" style={{ color: "var(--st-muted)" }}>
              Adicione perguntas no editor.
            </p>
          )}
          {data.items.map((item) => {
            const open = openId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--st-bg)",
                  border: "1px solid var(--st-border)",
                  borderRadius: "var(--st-radius)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-semibold">{item.question}</span>
                  <ChevronDown
                    size={18}
                    style={{
                      color: "var(--st-muted)",
                      transform: open ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 150ms",
                    }}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-4 text-[15px] leading-relaxed" style={{ color: "var(--st-muted)" }}>
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
