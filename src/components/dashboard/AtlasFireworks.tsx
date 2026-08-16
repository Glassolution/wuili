import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Fogos de artifício em canvas, subindo da parte de baixo da tela.
 *
 * Overlay puramente decorativo (pointer-events: none) usado no easter egg do
 * Atlas. Fica montado só enquanto `ativo` for verdadeiro.
 */
type Particula = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  vidaMax: number;
  cor: string;
  raio: number;
};

type Foguete = {
  x: number;
  y: number;
  vy: number;
  alvo: number;
  cor: string;
};

const CORES = ["#00C2A8", "#5EEAD4", "#FFD166", "#FF6B9A", "#8B5CF6", "#FFFFFF"];

export const AtlasFireworks = ({ ativo }: { ativo: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ativo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ajustar = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    window.addEventListener("resize", ajustar);

    const foguetes: Foguete[] = [];
    const particulas: Particula[] = [];
    let frame = 0;
    let raf = 0;

    const lancar = () => {
      const largura = window.innerWidth;
      const altura = window.innerHeight;
      foguetes.push({
        x: largura * (0.1 + Math.random() * 0.8),
        y: altura,
        vy: -(altura / 90) * (0.8 + Math.random() * 0.5),
        alvo: altura * (0.12 + Math.random() * 0.35),
        cor: CORES[Math.floor(Math.random() * CORES.length)],
      });
    };

    const explodir = (x: number, y: number, cor: string) => {
      const total = 60 + Math.floor(Math.random() * 40);
      for (let i = 0; i < total; i += 1) {
        const angulo = (Math.PI * 2 * i) / total + Math.random() * 0.2;
        const velocidade = 1.5 + Math.random() * 4;
        const vida = 45 + Math.random() * 35;
        particulas.push({
          x,
          y,
          vx: Math.cos(angulo) * velocidade,
          vy: Math.sin(angulo) * velocidade,
          vida,
          vidaMax: vida,
          cor: Math.random() < 0.25 ? CORES[Math.floor(Math.random() * CORES.length)] : cor,
          raio: 1.5 + Math.random() * 1.8,
        });
      }
    };

    const loop = () => {
      frame += 1;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (frame % 16 === 0) lancar();
      if (frame === 1) {
        lancar();
        lancar();
      }

      for (let i = foguetes.length - 1; i >= 0; i -= 1) {
        const f = foguetes[i];
        f.y += f.vy;
        f.vy += 0.06;
        ctx.beginPath();
        ctx.fillStyle = f.cor;
        ctx.globalAlpha = 1;
        ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (f.y <= f.alvo || f.vy >= 0) {
          explodir(f.x, f.y, f.cor);
          foguetes.splice(i, 1);
        }
      }

      for (let i = particulas.length - 1; i >= 0; i -= 1) {
        const p = particulas[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.vida -= 1;
        if (p.vida <= 0) {
          particulas.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(p.vida / p.vidaMax, 0);
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", ajustar);
    };
  }, [ativo]);

  if (!ativo) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999]"
    />,
    document.body,
  );
};

export default AtlasFireworks;
