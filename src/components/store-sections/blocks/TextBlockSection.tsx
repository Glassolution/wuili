import type { TextBlockData } from "@/lib/storeSections/types";

export default function TextBlockSection({ data }: { data: TextBlockData }) {
  return (
    <section
      className="w-full px-6 py-14"
      style={{ background: "var(--st-bg)", color: "var(--st-text)", fontFamily: "var(--st-font-body)" }}
    >
      <div
        className="mx-auto max-w-3xl"
        style={{ textAlign: data.alignment }}
      >
        <h2
          className="mb-4 text-2xl font-bold md:text-3xl"
          style={{ fontFamily: "var(--st-font-heading)" }}
        >
          {data.title}
        </h2>
        <p className="whitespace-pre-line text-[16px] leading-relaxed" style={{ color: "var(--st-muted)" }}>
          {data.body}
        </p>
      </div>
    </section>
  );
}
