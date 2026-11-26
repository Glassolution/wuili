import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Pipette } from "lucide-react";

import { nomeDaCor, normalizarHex } from "@/lib/nomeDaCor";

/**
 * "Escolher minha cor": na etapa das cores do roteiro de criar loja, a pessoa
 * escolhe a cor principal (e uma de apoio, opcional) num seletor, em vez de
 * ficar presa às combinações prontas. Envia uma mensagem legível para o Atlas:
 * "Minhas cores: azul-marinho (#1E3A8A) e creme (#F5F0E6)".
 */

const PRINCIPAIS = ["#111111", "#1E3A8A", "#2563EB", "#2F7D46", "#6B7A3A", "#B08D57", "#C0643C", "#DC2626", "#DB2777", "#7C3AED"];
const APOIOS = ["#FFFFFF", "#F5F0E6", "#F3F4F6", "#E8EEF9", "#EAF2E5", "#D9C6A5", "#111111"];

/** Contraste simples para o texto de cima da cor (preview). */
const textoSobre = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.62 ? "#111111" : "#FFFFFF";
};

const Amostra = ({ hex, escolhida, onClick }: { hex: string; escolhida: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    title={nomeDaCor(hex)}
    aria-label={`${nomeDaCor(hex)} (${hex})`}
    aria-pressed={escolhida}
    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 ${escolhida ? "ring-2 ring-[#0A0A0A] ring-offset-2" : ""}`}
    style={{ background: hex }}
  >
    {escolhida && <Check className="h-3.5 w-3.5" strokeWidth={2.6} style={{ color: textoSobre(hex) }} />}
  </button>
);

/** Bolinha com arco-íris: abre o seletor nativo do sistema para qualquer cor. */
const Personalizada = ({ valor, onEscolher, rotulo }: { valor: string; onEscolher: (hex: string) => void; rotulo: string }) => (
  <label
    title="Qualquer cor"
    className="relative grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full transition-transform hover:scale-110"
    style={{ background: "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)" }}
  >
    <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white">
      <Pipette className="h-2.5 w-2.5 text-[#3A3A3A]" strokeWidth={2.2} />
    </span>
    <input
      type="color"
      value={valor}
      onChange={(e) => onEscolher(e.target.value.toUpperCase())}
      aria-label={rotulo}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
    />
  </label>
);

const CampoHex = ({ valor, onTrocar }: { valor: string; onTrocar: (hex: string) => void }) => {
  const [texto, setTexto] = useState(valor);
  const [editando, setEditando] = useState(false);
  return (
    <input
      value={editando ? texto : valor}
      onFocus={() => {
        setTexto(valor);
        setEditando(true);
      }}
      onChange={(e) => {
        setTexto(e.target.value);
        const hex = normalizarHex(e.target.value);
        if (hex) onTrocar(hex);
      }}
      onBlur={() => setEditando(false)}
      maxLength={7}
      spellCheck={false}
      aria-label="Código da cor"
      className="h-7 w-[84px] rounded-[7px] border border-black/[0.1] bg-white px-2 font-mono text-[12px] uppercase text-[#1F1F1F] outline-none focus:border-black/30"
    />
  );
};

const AtlasEscolherCores = ({ onEscolher, desativado }: { onEscolher: (mensagem: string) => void; desativado?: boolean }) => {
  const reduzir = useReducedMotion();
  const [aberto, setAberto] = useState(false);
  const [principal, setPrincipal] = useState("#1E3A8A");
  const [apoio, setApoio] = useState<string | null>("#F5F0E6");

  const enviar = () => {
    const partes = [`${nomeDaCor(principal)} (${principal})`];
    if (apoio) partes.push(`${nomeDaCor(apoio)} (${apoio})`);
    onEscolher(`Minhas cores: ${partes.join(" e ")}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        disabled={desativado}
        className="inline-flex h-8 w-fit items-center gap-2 rounded-[8px] border !border-black/[0.1] bg-white pl-1.5 pr-3 text-[12.5px] font-medium text-[#1F1F1F] transition-colors hover:!border-black/[0.18] hover:bg-[#F7F7F5] disabled:opacity-45"
      >
        <span
          aria-hidden
          className="h-5 w-5 rounded-full ring-1 ring-black/10"
          style={{ background: "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)" }}
        />
        Escolher minha cor
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={reduzir ? false : { opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={reduzir ? { opacity: 0 } : { opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="w-full max-w-[440px] rounded-[12px] border border-black/[0.08] bg-white p-4 shadow-[0_8px_24px_-14px_rgba(16,24,40,0.18)]">
              <p className="text-[12.5px] font-medium text-[#1F1F1F]">Cor principal</p>
              <p className="text-[12px] text-[#8A8A8A]">Botões, destaques e links.</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {PRINCIPAIS.map((hex) => (
                  <Amostra key={hex} hex={hex} escolhida={principal === hex} onClick={() => setPrincipal(hex)} />
                ))}
                <Personalizada valor={principal} onEscolher={setPrincipal} rotulo="Escolher qualquer cor principal" />
                <CampoHex valor={principal} onTrocar={setPrincipal} />
              </div>

              <p className="mt-4 text-[12.5px] font-medium text-[#1F1F1F]">
                Cor de apoio <span className="font-normal text-[#9A9A9A]">opcional</span>
              </p>
              <p className="text-[12px] text-[#8A8A8A]">Fundo das seções.</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {APOIOS.map((hex) => (
                  <Amostra key={hex} hex={hex} escolhida={apoio === hex} onClick={() => setApoio(hex)} />
                ))}
                <Personalizada valor={apoio ?? "#FFFFFF"} onEscolher={setApoio} rotulo="Escolher qualquer cor de apoio" />
                <button
                  type="button"
                  onClick={() => setApoio(null)}
                  aria-pressed={apoio === null}
                  className={`h-7 rounded-[7px] px-2 text-[12px] transition-colors ${apoio === null ? "bg-[#0A0A0A] text-white" : "text-[#6B6B6B] hover:bg-black/[0.05]"}`}
                >
                  Nenhuma
                </button>
              </div>

              {/* Prévia: como as duas cores ficam juntas numa vitrine. */}
              <div
                className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-black/[0.06] px-3.5 py-3"
                style={{ background: apoio ?? "#FFFFFF" }}
              >
                <div className="min-w-0">
                  <span className="block h-2 w-20 rounded-full opacity-80" style={{ background: textoSobre(apoio ?? "#FFFFFF") }} />
                  <span className="mt-1.5 block h-1.5 w-28 rounded-full opacity-30" style={{ background: textoSobre(apoio ?? "#FFFFFF") }} />
                </div>
                <span
                  className="shrink-0 rounded-[7px] px-3 py-1.5 text-[11.5px] font-medium"
                  style={{ background: principal, color: textoSobre(principal) }}
                >
                  Comprar
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[12px] text-[#6B6B6B]">
                  {nomeDaCor(principal)}
                  {apoio ? ` e ${nomeDaCor(apoio)}` : ""}
                </span>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={desativado}
                  className="h-8 shrink-0 rounded-[8px] bg-[#0A0A0A] px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#262626] disabled:opacity-45"
                >
                  Usar estas cores
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AtlasEscolherCores;
