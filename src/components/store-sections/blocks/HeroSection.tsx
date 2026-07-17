import type { HeroData } from "@/lib/storeSections/types";

export default function HeroSection({ data }: { data: HeroData }) {
  return (
    <section
      className="w-full px-6 py-16 md:py-24"
      style={{ background: "var(--st-bg)", color: "var(--st-text)", fontFamily: "var(--st-font-body)" }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        <div>
          {data.eyebrow && (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--st-accent)" }}>
              {data.eyebrow}
            </p>
          )}
          <h1
            className="text-4xl font-bold leading-tight md:text-5xl"
            style={{ fontFamily: "var(--st-font-heading)" }}
          >
            {data.title}
          </h1>
          <p className="mt-4 text-lg" style={{ color: "var(--st-muted)" }}>{data.subtitle}</p>
          {data.ctaLabel && (
            <a
              href={data.ctaUrl || "#"}
              className="mt-6 inline-flex items-center justify-center px-6 py-3 text-base font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "var(--st-primary)",
                color: "var(--st-primary-text)",
                borderRadius: "var(--st-radius)",
              }}
            >
              {data.ctaLabel}
            </a>
          )}
        </div>
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            className="w-full object-cover"
            style={{ borderRadius: "var(--st-radius)", aspectRatio: "4/3" }}
          />
        ) : (
          <div
            className="grid w-full place-items-center text-sm"
            style={{
              background: "var(--st-surface)",
              color: "var(--st-muted)",
              borderRadius: "var(--st-radius)",
              aspectRatio: "4/3",
            }}
          >
            Adicione uma imagem no editor
          </div>
        )}
      </div>
    </section>
  );
}
