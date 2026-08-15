import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Peças do painel de customização do editor.
 *
 * Existem para o painel parar de ser uma pilha de campos soltos: cada grupo de
 * configuração tem rótulo próprio, cada linha de controle tem a mesma altura,
 * o mesmo raio e a mesma tipografia. Antes cada bloco trazia sua própria
 * medida, e o painel virava uma colcha de retalhos.
 *
 * Paleta: preto e branco com cinzas neutros, como no resto do produto. Verde é
 * reservado para indicador de lucro/ganho — não entra em cromo de interface.
 */

/** Rótulo que abre um grupo de configurações ("Estrutura", "Loja"). */
export const PanelGroupLabel = ({ children }: { children: ReactNode }) => (
  <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/38">{children}</p>
);

/** Linha de navegação do painel: ícone em placa, rótulo e seta. */
export const PanelRowButton = ({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** Segunda linha opcional — some quando não é necessária. */
  hint?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-3 rounded-[12px] border border-black/[0.07] bg-white px-2.5 py-2.5 text-left outline-none transition duration-150 hover:border-black/[0.14] hover:bg-[#FAFAF9] focus-visible:ring-2 focus-visible:ring-black/15"
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#F4F4F2] text-[#0A0A0A] transition group-hover:bg-[#0A0A0A] group-hover:text-white">
      <Icon size={15} strokeWidth={1.9} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[12.5px] font-semibold leading-tight tracking-[-0.01em] text-[#0A0A0A]">
        {label}
      </span>
      {hint ? <span className="mt-0.5 block truncate text-[11px] leading-tight text-black/45">{hint}</span> : null}
    </span>
    <ChevronGlyph />
  </button>
);

const ChevronGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black/55">
    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Aviso de estado do painel (ex.: modo simples). Neutro de propósito: cor aqui
 *  competiria com o conteúdo da página sendo editada. */
export const PanelNotice = ({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) => (
  <div className="flex items-start gap-2.5 rounded-[12px] border border-black/[0.07] bg-[#FAFAF9] px-3 py-2.5">
    <Icon size={14} strokeWidth={1.9} className="mt-[1px] shrink-0 text-black/45" />
    <p className="text-[11.5px] font-medium leading-[1.45] text-black/62">{children}</p>
  </div>
);

/** Estado vazio: nada selecionado no canvas ainda. */
export const PanelEmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) => (
  <div className="rounded-[14px] border border-dashed border-black/[0.14] bg-[#FCFCFB] px-4 py-7 text-center">
    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(10,10,10,0.08)]">
      <Icon size={17} strokeWidth={1.7} className="text-black/40" />
    </span>
    <p className="mt-3 text-[12.5px] font-semibold tracking-[-0.01em] text-[#0A0A0A]">{title}</p>
    <p className="mx-auto mt-1 max-w-[190px] text-[11.5px] leading-[1.5] text-black/45">{description}</p>
  </div>
);

/** Botão de ação discreto do cabeçalho do painel (quadrado, só ícone). */
export const PanelIconButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-black/[0.07] bg-white text-black/50 outline-none transition duration-150 hover:border-black/[0.14] hover:text-[#0A0A0A] focus-visible:ring-2 focus-visible:ring-black/15"
  >
    <Icon size={16} strokeWidth={1.8} />
  </button>
);

// ---------------------------------------------------------------------------
// Controles do bloco selecionado.
//
// Todos compartilham a mesma altura (36px), o mesmo raio e o mesmo trilho
// cinza, para o painel não virar uma coleção de widgets com acabamentos
// diferentes. Nenhum deles guarda estado: quem manda é o editor, que aplica a
// mudança direto no elemento do canvas.
// ---------------------------------------------------------------------------

/** Linha rótulo + controle. Rótulo com largura fixa alinha todos na vertical. */
export const PanelControlRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center gap-2.5">
    <span className="w-[62px] shrink-0 text-[11.5px] font-medium text-black/50">{label}</span>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

/** Menos / valor / mais. Usado em tamanho de texto, de ícone e raio. */
export const PanelStepper = ({
  value,
  suffix = "px",
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  suffix?: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}) => (
  <div className="flex h-9 items-center justify-between rounded-[10px] border border-black/[0.07] bg-[#FAFAF9] px-1">
    <button
      type="button"
      onClick={onDecrease}
      aria-label={decreaseLabel}
      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-black/55 transition hover:bg-black/[0.06] hover:text-[#0A0A0A]"
    >
      <MinusGlyph />
    </button>
    <span className="text-[12.5px] font-semibold tabular-nums text-[#0A0A0A]">
      {value}
      {suffix}
    </span>
    <button
      type="button"
      onClick={onIncrease}
      aria-label={increaseLabel}
      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-black/55 transition hover:bg-black/[0.06] hover:text-[#0A0A0A]"
    >
      <PlusGlyph />
    </button>
  </div>
);

const MinusGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const PlusGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/** Grupo de opções mutuamente exclusivas (alinhamento, forma da imagem…). */
export const PanelSegmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (value: T) => void;
}) => (
  <div className="flex h-9 items-center gap-1 rounded-[10px] border border-black/[0.07] bg-[#FAFAF9] p-1">
    {options.map((option) => {
      const Icon = option.icon;
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-label={option.label}
          title={option.label}
          aria-pressed={active}
          className={`flex h-7 flex-1 items-center justify-center rounded-[7px] text-[11.5px] font-semibold transition ${
            active
              ? "bg-[#0A0A0A] text-white shadow-[0_1px_3px_rgba(10,10,10,0.25)]"
              : "text-black/50 hover:bg-black/[0.05] hover:text-[#0A0A0A]"
          }`}
        >
          {Icon ? <Icon size={14} strokeWidth={2} /> : option.label}
        </button>
      );
    })}
  </div>
);

/** Amostra de cor + valor. O input nativo cobre a linha inteira. */
export const PanelColorControl = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) => (
  <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border border-black/[0.07] bg-[#FAFAF9] px-2.5 transition hover:border-black/[0.14]">
    <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: value }} />
    <span className="truncate text-[12px] font-semibold uppercase text-black/60">{value}</span>
    <input
      type="color"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="absolute inset-0 cursor-pointer opacity-0"
    />
  </label>
);

/** Lista curta de opções em texto (peso da fonte, presets de tamanho). */
export const PanelOptionGrid = <T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  columns?: number;
}) => (
  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={active}
          className={`h-9 rounded-[10px] border text-[11.5px] font-semibold transition ${
            active
              ? "border-[#0A0A0A] bg-[#0A0A0A] text-white"
              : "border-black/[0.07] bg-white text-black/60 hover:border-black/[0.16] hover:text-[#0A0A0A]"
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/** Botão de ação em largura cheia (substituir imagem, editar texto…). */
export const PanelActionButton = ({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  disabled,
}: {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "primary" | "danger";
  disabled?: boolean;
}) => {
  const styles =
    tone === "primary"
      ? "border-[#0A0A0A] bg-[#0A0A0A] text-white hover:bg-[#242424]"
      : tone === "danger"
        ? "border-[#F0D2D2] bg-white text-[#B42318] hover:bg-[#FEF3F2]"
        : "border-black/[0.07] bg-white text-[#0A0A0A] hover:border-black/[0.16] hover:bg-[#FAFAF9]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border text-[12px] font-semibold transition disabled:opacity-50 ${styles}`}
    >
      {Icon ? <Icon size={14} strokeWidth={2} /> : null}
      {label}
    </button>
  );
};

/** Cabeçalho do bloco selecionado: tipo do elemento + botão de fechar. */
export const PanelSelectionHeader = ({
  icon: Icon,
  title,
  onClear,
}: {
  icon: LucideIcon;
  title: string;
  onClear: () => void;
}) => (
  <div className="flex items-center gap-2.5 rounded-[12px] border border-black/[0.07] bg-[#FAFAF9] px-3 py-2.5">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#0A0A0A] text-white">
      <Icon size={14} strokeWidth={2} />
    </span>
    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold tracking-[-0.01em] text-[#0A0A0A]">
      {title}
    </span>
    <button
      type="button"
      onClick={onClear}
      aria-label="Limpar seleção"
      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-black/40 transition hover:bg-black/[0.06] hover:text-[#0A0A0A]"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  </div>
);
