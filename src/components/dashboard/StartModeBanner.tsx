import { useNavigate } from "react-router-dom";

interface StartModeBannerProps {
  isStartMode: boolean;
}

const StartModeBanner = ({ isStartMode }: StartModeBannerProps) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: isStartMode ? "48px" : "0",
        background: "#FFA640",
        color: "#FFFFFF",
        zIndex: 9999,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "0 32px",
        boxSizing: "border-box",
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
        opacity: isStartMode ? 1 : 0,
        transform: isStartMode ? "translateY(0)" : "translateY(-100%)",
        transition: "height 280ms ease, opacity 220ms ease, transform 280ms ease",
        overflow: "hidden",
        pointerEvents: isStartMode ? "auto" : "none",
      }}
    >
      {/* Left: Text */}
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          justifySelf: "start",
        }}
      >
        Start Mode
      </div>

      {/* Center: Message */}
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          textAlign: "center",
          justifySelf: "center",
        }}
      >
        Você está no modo inicial da Velo
      </div>

      {/* Right: Button */}
      <button
        onClick={() => navigate("/dashboard/planos")}
        style={{
          justifySelf: "end",
          height: "34px",
          padding: "0 18px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.85)",
          background: "transparent",
          color: "#FFFFFF",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.15)";
          e.currentTarget.style.borderColor = "#FFFFFF";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.85)";
        }}
      >
        Liberar recursos
      </button>
    </div>
  );
};

export default StartModeBanner;
