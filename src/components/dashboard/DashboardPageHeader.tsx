import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Cabeçalho padrão das telas do dashboard: seta de voltar + nome da página +
 * ações à direita.
 *
 * O desenho é o de "Páginas com IA", adotado como padrão do design system:
 * seta sem moldura (só hover), título 28px em peso máximo e tracking fechado.
 * Use sempre junto de `DashboardPanel` (a moldura branca do conteúdo) — o par
 * está montado em `DashboardPageShell`.
 *
 * A única tela fora do padrão é o Catálogo, que tem layout próprio.
 */
const DashboardPageHeader = ({
  title,
  actions,
  className = "",
  titleClassName = "",
}: {
  title: string;
  /** Botões alinhados à direita (opcional). */
  actions?: ReactNode;
  className?: string;
  /**
   * Ajustes pontuais no título. Atenção: `.dashboard-inter h1…h6` em index.css
   * fixa `font-weight: 600` com especificidade maior que as utilitárias do
   * Tailwind, então mudar o peso aqui exige o prefixo `!` (ex.: `!font-bold`).
   */
  titleClassName?: string;
}) => {
  const navigate = useNavigate();

  return (
    <header className={`mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-6 ${className}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#0F1117] transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
          aria-label="Voltar"
        >
          <ArrowLeft size={22} strokeWidth={2.35} aria-hidden="true" />
        </button>
        <h1
          className={`min-w-0 text-[28px] !font-black leading-[1.25] tracking-[-0.05em] text-[#090B10] ${titleClassName}`}
        >
          {title}
        </h1>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
};

export default DashboardPageHeader;
