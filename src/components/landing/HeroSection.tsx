import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(1247);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 3) + 1);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // PROBLEMA 3 — Efeito de tinta fluida (aquarela)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let T = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const inks = [
      { r: 255, g: 140, b: 45,  baseX: 0.88, flowY: 0.0,  width: 0.18, height: 0.55, sp: 0.008, ph: 0   },
      { r: 240, g: 60,  b: 160, baseX: 0.95, flowY: 0.1,  width: 0.14, height: 0.60, sp: 0.010, ph: 1.4 },
      { r: 110, g: 65,  b: 255, baseX: 1.02, flowY: 0.05, width: 0.12, height: 0.70, sp: 0.007, ph: 2.8 },
      { r: 60,  g: 180, b: 255, baseX: 0.82, flowY: 0.15, width: 0.10, height: 0.50, sp: 0.012, ph: 4.2 },
      { r: 40,  g: 210, b: 190, baseX: 1.05, flowY: 0.2,  width: 0.09, height: 0.45, sp: 0.009, ph: 5.6 },
      { r: 255, g: 200, b: 80,  baseX: 0.78, flowY: 0.0,  width: 0.08, height: 0.40, sp: 0.011, ph: 3.5 },
    ];

    function drawInk(ink: typeof inks[0], W: number, H: number) {
      const t = T * ink.sp + ink.ph;
      const x  = W * ink.baseX + Math.sin(t * 0.8) * W * 0.025;
      const y  = H * ink.flowY;
      const hw = W * ink.width * 0.5;
      const h  = H * ink.height;
      const bulge = 1 + Math.sin(t * 1.2) * 0.08;
      const lean  = Math.cos(t * 0.6) * W * 0.02;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y - H * 0.12);
      ctx.bezierCurveTo(
        x + hw * 0.6 + lean,  y + h * 0.2,
        x + hw * bulge + lean, y + h * 0.65,
        x + lean * 0.5,        y + h * 1.05
      );
      ctx.bezierCurveTo(
        x - hw * bulge + lean, y + h * 0.65,
        x - hw * 0.6 + lean,   y + h * 0.2,
        x,                      y - H * 0.12
      );
      ctx.closePath();

      const cx2    = x + lean * 0.3;
      const cy2    = y + h * 0.35;
      const radius = Math.max(hw * 1.8, h * 0.6);
      const grad   = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, radius);
      grad.addColorStop(0,    `rgba(${ink.r},${ink.g},${ink.b},0.92)`);
      grad.addColorStop(0.35, `rgba(${ink.r},${ink.g},${ink.b},0.75)`);
      grad.addColorStop(0.65, `rgba(${ink.r},${ink.g},${ink.b},0.45)`);
      grad.addColorStop(0.85, `rgba(${ink.r},${ink.g},${ink.b},0.18)`);
      grad.addColorStop(1,    `rgba(${ink.r},${ink.g},${ink.b},0)`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      T += 1;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "multiply";
      inks.forEach((ink) => drawInk(ink, W, H));
      ctx.globalCompositeOperation = "source-over";

      // Véu branco orgânico — protege a legibilidade do texto
      const veil = ctx.createRadialGradient(W * 0.28, H * 0.45, 0, W * 0.28, H * 0.45, W * 0.52);
      veil.addColorStop(0,    "rgba(255,255,255,1.0)");
      veil.addColorStop(0.40, "rgba(255,255,255,0.98)");
      veil.addColorStop(0.60, "rgba(255,255,255,0.82)");
      veil.addColorStop(0.78, "rgba(255,255,255,0.45)");
      veil.addColorStop(1,    "rgba(255,255,255,0.0)");
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, W, H);

      // Brilho central suave — profundidade dentro da tinta
      const shine = ctx.createRadialGradient(W * 0.82, H * 0.25, 0, W * 0.82, H * 0.25, W * 0.28);
      shine.addColorStop(0, "rgba(255,255,255,0.55)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      ctx.fillRect(0, 0, W, H);

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    // PROBLEMA 1 — sem min-height, altura definida pelo conteúdo
    <section
      className="relative overflow-hidden bg-white"
      style={{ paddingTop: "60px", paddingBottom: "0" }}
    >
      {/* Canvas — cobre 60% da largura, toda a altura */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "60%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Conteúdo — z-index 2, acima do canvas */}
      {/* PROBLEMA 1 — padding ajustado, padding esquerdo 260px */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "80px 80px 72px 260px",
        }}
      >
        {/* Linha do counter */}
        <p
          style={{
            fontSize: "14px",
            fontWeight: 400,
            color: "#697386",
            marginBottom: "28px",
            letterSpacing: 0,
            lineHeight: 1.5,
          }}
        >
          Vendas hoje na plataforma:{" "}
          <span style={{ color: "#0a2540", fontWeight: 600 }}>
            {count.toLocaleString("pt-BR")}
          </span>
        </p>

        <h1
          style={{
            fontSize: "36px",
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            color: "#0a2540",
            maxWidth: "600px",
            margin: 0,
          }}
        >
          Infraestrutura de vendas para aumentar as suas receitas.{" "}
          <span style={{ color: "#425466", fontWeight: 500 }}>
            Crie sua loja, automatize publicações no Mercado Livre, Shopee e
            mais. Sem estoque, desde a primeira venda até a milionésima.
          </span>
        </h1>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginTop: "32px",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#635bff",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 700,
              padding: "13px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(99,91,255,0.40)",
              transition: "background .15s, transform .1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#4f46e5";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#635bff";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
            }}
          >
            Comece já &nbsp;›
          </Link>

          <a
            href="#"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#fff",
              color: "#0a2540",
              fontSize: "15px",
              fontWeight: 500,
              padding: "12px 20px",
              borderRadius: "8px",
              textDecoration: "none",
              border: "1px solid rgba(0,0,0,0.13)",
              transition: "border-color .15s, box-shadow .15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.22)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.13)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <g>
                <path d="M15.5 8.19c0-.57-.05-1.11-.14-1.64H8v3.1h4.18a3.57 3.57 0 0 1-1.55 2.35v1.95h2.51C15.61 12.7 15.5 10.6 15.5 8.19z" fill="#4285F4"/>
                <path d="M8 16c2.16 0 3.97-.72 5.3-1.95l-2.51-1.95c-.72.48-1.64.76-2.79.76-2.14 0-3.96-1.45-4.61-3.4H.8v2.02A7.999 7.999 0 0 0 8 16z" fill="#34A853"/>
                <path d="M3.39 9.46A4.8 4.8 0 0 1 3.14 8c0-.51.09-1.01.25-1.46V4.52H.8A7.999 7.999 0 0 0 0 8c0 1.29.31 2.51.8 3.62l2.59-2.16z" fill="#FBBC05"/>
                <path d="M8 3.18c1.21 0 2.3.42 3.15 1.23l2.36-2.36C12.07.79 10.16 0 8 0A8 8 0 0 0 .8 4.52L3.39 6.54C4.04 4.59 5.86 3.18 8 3.18z" fill="#EA4335"/>
              </g>
            </svg>
            Registre-se com o Google
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
