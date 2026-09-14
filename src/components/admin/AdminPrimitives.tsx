import { useEffect, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Check, ChevronsUpDown, Globe, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type AdminTone = "rose" | "violet" | "teal" | "amber" | "blue" | "emerald";

export const AdminCard = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("admin-card", className)} {...props} />
);

type AdminPillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "primary";
};

export const AdminPill = ({ variant = "secondary", className, type = "button", ...props }: AdminPillProps) => (
  <button
    type={type}
    className={cn(variant === "primary" ? "admin-btn-primary" : "admin-pill", className)}
    {...props}
  />
);

export const AdminBadge = ({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "success" | "danger" | "warning" | "neutral" }) => (
  <span className={cn("admin-badge", className)} data-tone={tone} {...props} />
);

/** Ladrilho colorido usado nos itens de ferramenta da sidebar. */
export const AdminToolTile = ({ icon: Icon, tone }: { icon: LucideIcon; tone: AdminTone }) => (
  <span className="admin-tool-tile" data-tone={tone} aria-hidden="true">
    <Icon />
  </span>
);

export const AdminSidebarItem = ({
  to,
  label,
  icon: Icon,
  tone,
  active,
  collapsed,
  count,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  tone?: AdminTone;
  active: boolean;
  collapsed: boolean;
  count?: number;
}) => (
  <Link
    to={to}
    title={collapsed ? label : undefined}
    aria-current={active ? "page" : undefined}
    className={cn(
      "admin-sidebar-item group relative flex items-center",
      collapsed ? "justify-center px-0" : "px-2",
    )}
  >
    {tone ? <AdminToolTile icon={Icon} tone={tone} /> : <Icon aria-hidden="true" />}
    {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
    {count && count > 0 ? (
      collapsed ? (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
      ) : (
        <span className="admin-sidebar-count">{count > 99 ? "99+" : count}</span>
      )
    ) : null}
  </Link>
);

export const AdminSidebarSubItem = ({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active: boolean;
}) => (
  <Link to={to} aria-current={active ? "page" : undefined} className="admin-sidebar-subitem">
    <span className="min-w-0 truncate">{label}</span>
  </Link>
);

/** Mini gráfico de barras exibido ao lado do valor da métrica. */
export const AdminSparkBars = ({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) => {
  if (!values.length) return null;
  const series = values.slice(-8);
  const max = Math.max(...series, 1);
  return (
    <div className={cn("admin-spark-bars", className)} aria-hidden="true">
      {series.map((value, index) => (
        <span
          key={index}
          data-active={index === series.length - 1}
          style={{ height: `${Math.max((value / max) * 100, 8)}%` }}
        />
      ))}
    </div>
  );
};

export const AdminKPIStat = ({
  label,
  subtitle,
  value,
  delta,
  deltaTone = "success",
  icon: Icon = Globe,
  series,
  compact = false,
  className,
}: {
  label: string;
  subtitle?: string;
  value: ReactNode;
  delta?: string | null;
  deltaTone?: "success" | "danger" | "neutral";
  icon?: LucideIcon;
  series?: number[];
  compact?: boolean;
  className?: string;
}) => (
  <article className={cn("admin-card admin-kpi-stat", compact && "py-3", className)}>
    {/* o detalhe do rótulo vai no tooltip: a referência não tem linha de apoio */}
    <p className="admin-kpi-label">
      <span className="admin-metric-icon"><Icon aria-hidden="true" /></span>
      <span className="admin-kpi-label-text" title={subtitle}>{label}</span>
    </p>
    <div className={cn("flex items-end justify-between gap-4", compact ? "mt-2" : "mt-3")}>
      <div className="flex shrink-0 items-baseline gap-2">
        {value}
        {delta ? <span className="admin-kpi-delta whitespace-nowrap" data-tone={deltaTone}>{delta}</span> : null}
      </div>
      {series && series.length > 1 ? <AdminSparkBars values={series} /> : null}
    </div>
  </article>
);

/**
 * Pílula de seleção da régua de filtros: ícone + rótulo do valor + chevrons.
 * O menu é próprio (o nativo do sistema abre escuro e desalinhado da pílula).
 */
export const AdminSelectPill = ({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value)?.label ?? label;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(containerRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <div ref={containerRef} className={cn("admin-select", className)}>
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="admin-select-pill"
        data-open={open}
      >
        <Icon aria-hidden="true" />
        <span className="admin-select-pill-value">{current}</span>
        <ChevronsUpDown aria-hidden="true" className="admin-select-pill-caret" />
      </button>
      {open ? (
        <div className="admin-select-menu" role="listbox" aria-label={label} onKeyDown={moveFocus}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-selected={selected}
                className="admin-select-option"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Check aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export const AdminChartCard = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <article className={cn("admin-chart-card", className)} {...props} />
);

export const AdminTableHeader = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("admin-table-header", className)} {...props} />
);

/** Barra horizontal usada em listas ranqueadas. */
export const AdminProgressBar = ({ ratio }: { ratio: number }) => (
  <span className="admin-progress-track" aria-hidden="true">
    <span className="admin-progress-fill" style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }} />
  </span>
);
