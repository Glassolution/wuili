import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import acenando from "@/assets/mascote/acenando.webp";
import andando from "@/assets/mascote/andando.webp";
import deitado from "@/assets/mascote/deitado.webp";
import pulando from "@/assets/mascote/pulando.webp";
import sentado from "@/assets/mascote/sentado.webp";
import timido from "@/assets/mascote/timido.webp";

/*
  Mascote da Velo em pose inteira (25/11/2026), recortado da folha de poses do dono
  (`src/assets/mascote/*.webp`, fundo transparente, 320px de altura).

  Cada pose tem um movimento próprio, curto e discreto, em CSS (barato e sem
  re-render): respirar, balançar, flutuar ou acenar. A sombra é desenhada aqui e
  acompanha o movimento. Entra com um leve "surgir de baixo" e dá um pulinho no
  hover. Com "reduzir movimento" fica parado.
*/

export type PoseDoMascote = "acenando" | "andando" | "deitado" | "pulando" | "sentado" | "timido";

const POSES: Record<PoseDoMascote, { src: string; proporcao: number; movimento: string; sombra: number }> = {
  // proporcao = largura / altura do recorte; sombra = largura da sombra em relação à imagem.
  acenando: { src: acenando, proporcao: 327 / 439, movimento: "velo-mascote-acena", sombra: 0.62 },
  andando: { src: andando, proporcao: 343 / 441, movimento: "velo-mascote-passo", sombra: 0.7 },
  deitado: { src: deitado, proporcao: 399 / 332, movimento: "velo-mascote-respira-lento", sombra: 0.86 },
  pulando: { src: pulando, proporcao: 325 / 388, movimento: "velo-mascote-flutua", sombra: 0.56 },
  sentado: { src: sentado, proporcao: 280 / 391, movimento: "velo-mascote-respira", sombra: 0.86 },
  timido: { src: timido, proporcao: 355 / 426, movimento: "velo-mascote-balanca", sombra: 0.6 },
};

const CSS = `
@keyframes velo-mascote-respira { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.015, 0.975); } }
@keyframes velo-mascote-respira-lento { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.012, 0.968); } }
@keyframes velo-mascote-balanca { 0%, 100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
@keyframes velo-mascote-acena { 0%, 58%, 100% { transform: rotate(0deg); } 66% { transform: rotate(-4deg); } 74% { transform: rotate(3deg); } 82% { transform: rotate(-3deg); } 90% { transform: rotate(1.5deg); } }
@keyframes velo-mascote-passo { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-5%) rotate(1.5deg); } }
@keyframes velo-mascote-flutua { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9%); } }
@keyframes velo-mascote-sombra-flutua { 0%, 100% { transform: scaleX(1); opacity: 1; } 50% { transform: scaleX(0.78); opacity: 0.6; } }
@keyframes velo-mascote-sombra-passo { 0%, 100% { transform: scaleX(1); opacity: 1; } 50% { transform: scaleX(0.9); opacity: 0.8; } }
.velo-mascote-corpo { transform-origin: 50% 100%; will-change: transform; }
.velo-mascote-respira { animation: velo-mascote-respira 3.6s ease-in-out infinite; }
.velo-mascote-respira-lento { animation: velo-mascote-respira-lento 4.8s ease-in-out infinite; }
.velo-mascote-balanca { animation: velo-mascote-balanca 4.2s ease-in-out infinite; }
.velo-mascote-acena { animation: velo-mascote-acena 3.4s ease-in-out infinite; }
.velo-mascote-passo { animation: velo-mascote-passo 1.3s ease-in-out infinite; }
.velo-mascote-flutua { animation: velo-mascote-flutua 2.8s ease-in-out infinite; }
.velo-mascote-sombra-flutua { animation: velo-mascote-sombra-flutua 2.8s ease-in-out infinite; }
.velo-mascote-sombra-passo { animation: velo-mascote-sombra-passo 1.3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .velo-mascote-corpo, .velo-mascote-sombra { animation: none !important; }
}
`;

type Props = {
  pose: PoseDoMascote;
  /** Altura da imagem em px. */
  altura: number;
  className?: string;
  style?: CSSProperties;
  /** Atraso da entrada, em segundos. */
  atraso?: number;
};

const MascoteVelo = ({ pose, altura, className, style, atraso = 0 }: Props) => {
  const reduzir = !!useReducedMotion();
  const { src, proporcao, movimento, sombra } = POSES[pose];
  const largura = Math.round(altura * proporcao);
  const sombraAnimada = pose === "pulando" ? "velo-mascote-sombra-flutua" : pose === "andando" ? "velo-mascote-sombra-passo" : "";

  return (
    <motion.span
      aria-hidden="true"
      className={`relative inline-block shrink-0 select-none ${className ?? ""}`}
      style={{ width: largura, height: altura + Math.round(altura * 0.06), ...style }}
      initial={reduzir ? false : { opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20, delay: atraso }}
      whileHover={reduzir ? undefined : { y: -4, transition: { type: "spring", stiffness: 420, damping: 14 } }}
    >
      <style>{CSS}</style>
      {/* Sombra no chão, desenhada aqui para acompanhar o movimento. */}
      <span
        className={`velo-mascote-sombra absolute bottom-0 left-1/2 ${sombraAnimada}`}
        style={{
          width: largura * sombra,
          marginLeft: -(largura * sombra) / 2,
          height: Math.max(6, Math.round(altura * 0.07)),
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(30,58,138,0.22), rgba(30,58,138,0.08) 60%, transparent)",
          transformOrigin: "50% 50%",
        }}
      />
      <img
        src={src}
        alt=""
        draggable={false}
        width={largura}
        height={altura}
        className={`velo-mascote-corpo absolute left-0 top-0 block ${movimento}`}
        style={{ width: largura, height: altura }}
      />
    </motion.span>
  );
};

export default MascoteVelo;
