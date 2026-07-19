import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface FreePlanBannerProps {
  isVisible: boolean;
}

const FreePlanBanner = ({ isVisible }: FreePlanBannerProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div
      className="free-plan-banner"
      style={{
        position: "relative",
        flexShrink: 0,
        width: "100%",
        height: isVisible ? "48px" : "0",
        background: "#171714",
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: isMobile ? "10px" : "14px",
        // No mobile o padding de 32px + texto longo estouravam a largura, e o
        // conteúdo saía cortado nas duas pontas.
        padding: isMobile ? "0 12px" : "0 32px",
        boxSizing: "border-box",
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
        opacity: isVisible ? 1 : 0,
        transition: "height 280ms ease, opacity 220ms ease",
        overflow: "hidden",
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      <span
        style={{
          fontSize: isMobile ? "12.5px" : "14px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          textAlign: "center",
          // `nowrap` só no desktop: no mobile ele impedia o texto de encolher e
          // era a causa do corte. Aqui a frase é curta e cabe numa linha.
          whiteSpace: isMobile ? "normal" : "nowrap",
          minWidth: 0,
        }}
      >
        {isMobile
          ? "Você está no Plano Gratuito"
          : "Você está no Plano Gratuito. Faça upgrade agora para desbloquear todos os recursos"}
      </span>

      <button
        type="button"
        onClick={() => navigate("/dashboard/planos")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          height: isMobile ? "28px" : "32px",
          padding: isMobile ? "0 12px" : "0 16px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.85)",
          background: "transparent",
          color: "#FFFFFF",
          fontSize: isMobile ? "12px" : "13px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)";
          e.currentTarget.style.borderColor = "#FFFFFF";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.85)";
        }}
      >
        Fazer Upgrade
        <ArrowRight size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
};

export default FreePlanBanner;
