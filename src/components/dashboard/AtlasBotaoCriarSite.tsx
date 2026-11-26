import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * Botão "Criar meu site" do resumo do Atlas.
 *
 * Preto, com um ícone de página (janela com cabeçalho e blocos). No hover um
 * brilho atravessa o botão e a seta anda. No clique: o botão afunda, o brilho
 * passa inteiro, a janela "monta" (os blocos acendem um a um) e só então o
 * modal abre — ~0,5 s, para a pessoa sentir que algo começou.
 */

const SUAVE = [0.22, 1, 0.36, 1] as const;

/** Janela de site; com `montando`, os blocos acendem em sequência. */
const IconeDeSite = ({ montando, reduzir }: { montando: boolean; reduzir: boolean }) => {
  const bloco = (atraso: number) =>
    montando && !reduzir
      ? { opacity: [0.35, 1], transition: { duration: 0.18, delay: atraso, ease: "easeOut" as const } }
      : { opacity: 1 };
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="h-[17px] w-[17px] shrink-0" fill="none">
      <rect x="1.75" y="2.25" width="14.5" height="13.5" rx="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.75 5.9h14.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4.1" cy="4.1" r="0.65" fill="currentColor" />
      <circle cx="6.1" cy="4.1" r="0.65" fill="currentColor" />
      <motion.rect x="4" y="8.2" width="4.4" height="5.2" rx="0.9" fill="currentColor" animate={bloco(0.02)} />
      <motion.rect x="9.7" y="8.2" width="4.3" height="2.1" rx="0.7" fill="currentColor" animate={bloco(0.12)} />
      <motion.rect x="9.7" y="11.3" width="4.3" height="2.1" rx="0.7" fill="currentColor" animate={bloco(0.22)} />
    </svg>
  );
};

const AtlasBotaoCriarSite = ({ rotulo, onClick }: { rotulo: string; onClick: () => void }) => {
  const reduzir = useReducedMotion() ?? false;
  const [abrindo, setAbrindo] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const clicar = () => {
    if (abrindo) return;
    if (reduzir) {
      onClick();
      return;
    }
    setAbrindo(true);
    timer.current = window.setTimeout(() => {
      onClick();
      setAbrindo(false);
    }, 520);
  };

  return (
    <motion.button
      type="button"
      onClick={clicar}
      whileTap={reduzir ? undefined : { scale: 0.965 }}
      animate={abrindo && !reduzir ? { scale: [1, 0.97, 1.015, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: SUAVE }}
      aria-busy={abrindo}
      className="group relative isolate inline-flex h-10 w-fit items-center gap-2.5 overflow-hidden rounded-[10px] bg-[#0A0A0A] pl-3.5 pr-3 text-[13.5px] font-medium tracking-[-0.005em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2"
    >
      {/* Brilho: passa de leve no hover e inteiro no clique. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 -z-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.14] to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[320%] group-hover:opacity-100"
      />
      <AnimatePresence>
        {abrindo && !reduzir && (
          <motion.span
            aria-hidden
            initial={{ x: "-60%", opacity: 0 }}
            animate={{ x: "260%", opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
        )}
      </AnimatePresence>

      <span className="relative z-[1] flex items-center gap-2.5">
        <IconeDeSite montando={abrindo} reduzir={reduzir} />
        {rotulo}
        <span className="relative grid h-4 w-4 place-items-center overflow-hidden">
          <motion.span
            animate={abrindo && !reduzir ? { x: 18, opacity: 0 } : { x: 0, opacity: 1 }}
            transition={{ duration: 0.28, ease: SUAVE }}
            className="grid place-items-center"
          >
            <ArrowRight
              className="h-3.5 w-3.5 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white"
              strokeWidth={2}
            />
          </motion.span>
          {abrindo && !reduzir && (
            <motion.svg
              aria-hidden
              viewBox="0 0 16 16"
              className="absolute h-3.5 w-3.5"
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              transition={{ opacity: { duration: 0.15, delay: 0.12 }, rotate: { duration: 0.7, ease: "linear", repeat: Infinity } }}
            >
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </motion.svg>
          )}
        </span>
      </span>
    </motion.button>
  );
};

export default AtlasBotaoCriarSite;
