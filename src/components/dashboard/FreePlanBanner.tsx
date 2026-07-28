import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FreePlanBannerProps {
  isVisible: boolean;
}

const FreePlanBanner = ({ isVisible }: FreePlanBannerProps) => {
  const navigate = useNavigate();

  return (
    <div
      className="free-plan-banner"
      style={{
        position: "relative",
        flexShrink: 0,
        width: "100%",
        height: isVisible ? "48px" : "0",
        background: "linear-gradient(90deg, #4F7FFF 0%, #1D4ED8 100%)",
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        padding: "0 32px",
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
          fontSize: "14px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        Você está no Plano Gratuito. Faça upgrade agora para desbloquear todos os recursos
      </span>

      <button
        type="button"
        onClick={() => navigate("/dashboard/planos")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          height: "32px",
          padding: "0 4px",
          border: "none",
          background: "transparent",
          color: "#FFFFFF",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
          transition: "opacity 0.15s ease",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        Fazer Upgrade
        <ArrowRight size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
};

export default FreePlanBanner;
