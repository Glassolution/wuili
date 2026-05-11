import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StartModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StartModeModal = ({ isOpen, onClose }: StartModeModalProps) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleViewPlans = () => {
    onClose();
    navigate("/dashboard/planos");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      {/* Overlay com blur */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.35)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "520px",
          maxWidth: "calc(100vw - 32px)",
          backgroundColor: "#FFFFFF",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.18)",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #F3F4F6",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#111111",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Sair do Start Mode
          </h2>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
              color: "#6B7280",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#F3F4F6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <p
            style={{
              fontSize: "15px",
              lineHeight: "24px",
              color: "#374151",
              margin: 0,
            }}
          >
            Você está no modo inicial da Velo porque ainda não possui um plano
            ativo.
          </p>
          <p
            style={{
              fontSize: "15px",
              lineHeight: "24px",
              color: "#374151",
              margin: 0,
            }}
          >
            Com o Start Mode, você pode explorar o dashboard e conhecer os
            recursos da plataforma, mas algumas ações ficam limitadas até a
            ativação de um plano.
          </p>
          <p
            style={{
              fontSize: "15px",
              lineHeight: "24px",
              color: "#374151",
              margin: 0,
            }}
          >
            Para sair do Start Mode e liberar todos os recursos, escolha um
            plano e conclua o pagamento.
          </p>
          <p
            style={{
              fontSize: "15px",
              lineHeight: "24px",
              color: "#374151",
              margin: 0,
            }}
          >
            Assim que o pagamento for confirmado, sua conta será atualizada
            automaticamente.
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            padding: "20px 24px",
            borderTop: "1px solid #F3F4F6",
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: "40px",
              padding: "0 20px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#111111",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#F9FAFB";
              e.currentTarget.style.borderColor = "#D1D5DB";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#FFFFFF";
              e.currentTarget.style.borderColor = "#E5E7EB";
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleViewPlans}
            style={{
              height: "40px",
              padding: "0 20px",
              borderRadius: "10px",
              border: "none",
              background: "#111111",
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#000000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#111111";
            }}
          >
            Ver planos
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartModeModal;
