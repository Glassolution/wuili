import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { VeloLogo } from "@/components/VeloLogo";
import type { ReactNode } from "react";

type Props = {
  title: string;
  updatedAt: string;
  children: ReactNode;
};

export const LegalLayout = ({ title, updatedAt, children }: Props) => (
  <div className="min-h-screen bg-[#0B0B0C] text-white">
    <header className="border-b border-white/8">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-white/80 transition hover:text-white">
          <VeloLogo />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white/60 transition hover:text-white"
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>
      </div>
    </header>

    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/45">
        Documentos legais — Velo
      </p>
      <h1 className="mt-3 text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-white sm:text-[38px]">
        {title}
      </h1>
      <p className="mt-3 text-[13px] text-white/45">Última atualização: {updatedAt}</p>

      <article className="prose-legal mt-10 space-y-8 text-[14.5px] leading-[1.75] text-white/78">
        {children}
      </article>

      <footer className="mt-16 border-t border-white/8 pt-6 text-[12.5px] text-white/40">
        Ao continuar utilizando a plataforma Velo, você declara ter lido e concordado com este
        documento.
      </footer>
    </main>
  </div>
);

export const LegalSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2 className="mb-3 text-[17px] font-semibold text-white">{title}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

export const LegalList = ({ items }: { items: ReactNode[] }) => (
  <ul className="ml-5 list-disc space-y-1.5 marker:text-white/30">
    {items.map((item, idx) => (
      <li key={idx}>{item}</li>
    ))}
  </ul>
);
