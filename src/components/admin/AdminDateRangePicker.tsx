import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";

/*
 * Seletor de período do painel: atalhos à esquerda e calendário de dois meses
 * à direita. Dá para escolher de um dia até outro, um único dia ou o mês
 * inteiro. As datas trafegam como "YYYY-MM-DD" (mesmo formato das chaves de
 * dia do painel, no fuso de Belém).
 */

export type DateRange = { startKey: string; endKey: string };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// a semana da Velo começa na segunda
const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

const pad = (value: number) => String(value).padStart(2, "0");
const keyOf = (year: number, monthIndex: number, day: number) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
const parts = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1, day: Number(key.slice(8, 10)) });
const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
const shiftMonth = (year: number, monthIndex: number, delta: number) => {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
};
const dayCount = (range: DateRange) =>
  Math.round((Date.parse(`${range.endKey}T12:00:00Z`) - Date.parse(`${range.startKey}T12:00:00Z`)) / 86_400_000) + 1;

const shortDay = (key: string, withYear: boolean) => {
  const { year, month, day } = parts(key);
  return `${pad(day)} ${MONTHS_SHORT[month]}${withYear ? ` ${year}` : ""}`;
};

/** Texto do intervalo: "03 out 2026", "03 out – 09 out", "28 dez 2025 – 05 jan 2026". */
const formatDateRange = (range: DateRange, todayKey: string) => {
  const sameYear = range.startKey.slice(0, 4) === range.endKey.slice(0, 4);
  const currentYear = range.endKey.slice(0, 4) === todayKey.slice(0, 4);
  if (range.startKey === range.endKey) return shortDay(range.startKey, true);
  if (sameYear) return `${shortDay(range.startKey, false)} – ${shortDay(range.endKey, !currentYear)}`;
  return `${shortDay(range.startKey, true)} – ${shortDay(range.endKey, true)}`;
};

export const AdminDateRangePicker = ({
  presets,
  value,
  range,
  todayKey,
  onPreset,
  onCustom,
}: {
  presets: Array<{ value: string; label: string }>;
  /** Atalho ativo ou "custom". */
  value: string;
  range: DateRange;
  todayKey: string;
  onPreset: (value: string) => void;
  onCustom: (range: DateRange) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(range.startKey);
  const [end, setEnd] = useState<string | null>(range.endKey);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<{ year: number; month: number }>(() => parts(range.endKey));
  const ref = useRef<HTMLDivElement>(null);

  const presetLabel = presets.find((preset) => preset.value === value)?.label;
  const buttonLabel = value !== "custom" && presetLabel ? presetLabel : formatDateRange(range, todayKey);

  // reabre sempre a partir do período em uso
  useEffect(() => {
    if (!open) return;
    setStart(range.startKey);
    setEnd(range.endKey);
    setHover(null);
    setView(parts(range.endKey));
  }, [open, range.startKey, range.endKey]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pickDay = (key: string) => {
    if (!start || end) {
      setStart(key);
      setEnd(null);
      return;
    }
    if (key < start) {
      setEnd(start);
      setStart(key);
    } else {
      setEnd(key);
    }
  };

  const pickMonth = (year: number, monthIndex: number) => {
    const first = keyOf(year, monthIndex, 1);
    const last = keyOf(year, monthIndex, daysInMonth(year, monthIndex));
    setStart(first);
    setEnd(last > todayKey ? todayKey : last);
  };

  // intervalo mostrado: o escolhido, ou a prévia enquanto o mouse passa
  const shown = useMemo<DateRange | null>(() => {
    if (!start) return null;
    const other = end ?? hover ?? start;
    return other < start ? { startKey: other, endKey: start } : { startKey: start, endKey: other };
  }, [start, end, hover]);

  const draft: DateRange | null = start ? { startKey: start, endKey: end ?? start } : null;
  const months = [shiftMonth(view.year, view.month, -1), view];
  const canGoForward = keyOf(view.year, view.month, 1) < keyOf(parts(todayKey).year, parts(todayKey).month, 1);

  const apply = () => {
    if (!draft) return;
    onCustom(draft);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Período: ${buttonLabel}`}
        onClick={() => setOpen((v) => !v)}
        className="ov-chip-filled"
      >
        <CalendarIcon aria-hidden="true" />
        {buttonLabel}
        <ChevronDownIcon aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Escolher período"
            className="ov-range"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex">
              {/* atalhos */}
              <div className="ov-range-presets">
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={preset.value === value}
                    className="ov-menu-item"
                    onClick={() => {
                      onPreset(preset.value);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 text-left">{preset.label}</span>
                    {preset.value === value ? <CheckIcon aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>

              {/* calendário */}
              <div className="min-w-0 px-4 pb-2 pt-3">
                <div className="flex gap-6">
                  {months.map(({ year, month }, index) => {
                    const total = daysInMonth(year, month);
                    const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
                    const monthStartsInFuture = keyOf(year, month, 1) > todayKey;
                    return (
                      <div key={`${year}-${month}`} className={index === 0 ? "hidden lg:block" : ""}>
                        <div className="mb-2 flex h-8 items-center justify-between gap-2">
                          {/* com um mês só (telas menores), a seta de voltar fica no mês da direita */}
                          <button
                            type="button"
                            aria-label="Mês anterior"
                            className={`ov-range-nav ${index === 1 ? "lg:invisible" : ""}`}
                            onClick={() => setView(shiftMonth(view.year, view.month, -1))}
                          >
                            <ChevronLeftIcon aria-hidden="true" />
                          </button>
                          <span className="whitespace-nowrap text-[13.5px] font-medium capitalize text-[color:var(--ov-text)]">
                            {MONTHS[month]} {year}
                          </span>
                          {index === months.length - 1 ? (
                            <button
                              type="button"
                              aria-label="Próximo mês"
                              disabled={!canGoForward}
                              className="ov-range-nav"
                              onClick={() => setView(shiftMonth(view.year, view.month, 1))}
                            >
                              <ChevronRightIcon aria-hidden="true" />
                            </button>
                          ) : (
                            <span className="h-7 w-7" />
                          )}
                        </div>

                        <div className="ov-range-grid text-center text-[11.5px] font-medium text-[color:var(--ov-text-4)]">
                          {WEEKDAYS.map((weekday, i) => (
                            <span key={i} className="pb-1.5">{weekday}</span>
                          ))}
                        </div>
                        <div className="ov-range-grid gap-y-0.5">
                          {Array.from({ length: offset }, (_, i) => (
                            <span key={`vazio-${i}`} />
                          ))}
                          {Array.from({ length: total }, (_, i) => {
                            const key = keyOf(year, month, i + 1);
                            const disabled = key > todayKey;
                            const isStart = shown?.startKey === key;
                            const isEnd = shown?.endKey === key;
                            const inRange = !!shown && key > shown.startKey && key < shown.endKey;
                            return (
                              <span
                                key={key}
                                className="ov-range-cell"
                                data-in-range={inRange || undefined}
                                data-start={(isStart && shown && shown.startKey !== shown.endKey) || undefined}
                                data-end={(isEnd && shown && shown.startKey !== shown.endKey) || undefined}
                              >
                                <button
                                  type="button"
                                  disabled={disabled}
                                  aria-label={shortDay(key, true)}
                                  aria-pressed={isStart || isEnd}
                                  data-selected={isStart || isEnd || undefined}
                                  data-today={key === todayKey || undefined}
                                  onClick={() => pickDay(key)}
                                  onMouseEnter={() => setHover(key)}
                                  onMouseLeave={() => setHover(null)}
                                  className="ov-range-day"
                                >
                                  {i + 1}
                                </button>
                              </span>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          disabled={monthStartsInFuture}
                          onClick={() => pickMonth(year, month)}
                          className="ov-range-month"
                        >
                          Mês inteiro
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--ov-divider)] px-4 py-3">
              <p className="text-[13px] text-[color:var(--ov-text-3)]">
                {draft ? (
                  <>
                    <span className="text-[color:var(--ov-text)]">{formatDateRange(draft, todayKey)}</span>
                    <span className="mx-1.5 text-[color:var(--ov-text-5)]">•</span>
                    {dayCount(draft)} {dayCount(draft) === 1 ? "dia" : "dias"}
                    {start && !end ? <span className="ml-1.5 text-[color:var(--ov-text-4)]">(escolha o dia final)</span> : null}
                  </>
                ) : (
                  "Escolha o primeiro dia"
                )}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen(false)} className="ov-range-cancel">
                  Cancelar
                </button>
                <button type="button" onClick={apply} disabled={!draft} className="ov-range-apply">
                  Aplicar
                </button>
              </div>
            </footer>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default AdminDateRangePicker;
