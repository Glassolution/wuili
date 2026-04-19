import { useState } from "react";
import { Package, Sparkles, Copy, RefreshCw } from "lucide-react";

export default function CriarAnuncio() {
  const [produto, setProduto] = useState(null);
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState("");
  const [loading, setLoading] = useState(false);

  const sugestoes = [
    "📦 Destacar benefícios",
    "🔥 Foco no preço",
    "⭐ Prova social",
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 60,
      paddingBottom: 60,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 640, padding: "0 24px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, background: "#000",
            borderRadius: 12, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
          }}>
            <span style={{ color: "#fff", fontSize: 20 }}>✦</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0A0A0A", margin: "0 0 8px" }}>
            Criar anúncio com IA
          </h1>
          <p style={{ fontSize: 14, color: "#737373", margin: 0 }}>
            Selecione um produto e descreva o que você quer destacar
          </p>
        </div>

        {/* Seletor de produto */}
        <div style={{
          border: "1.5px dashed #D4D4D4",
          borderRadius: 16,
          padding: 20,
          background: "#FAFAFA",
          cursor: "pointer",
          marginBottom: 12,
          transition: "all 150ms",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "#000";
            e.currentTarget.style.background = "#F5F5F5";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "#D4D4D4";
            e.currentTarget.style.background = "#FAFAFA";
          }}
        >
          <div style={{
            width: 48, height: 48, background: "#E5E5E5",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Package size={20} color="#A3A3A3" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#0A0A0A" }}>
              Selecionar produto do catálogo
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#A3A3A3" }}>
              Escolha um produto da Velo para gerar o anúncio
            </p>
          </div>
        </div>

        {/* Chips de sugestão */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {sugestoes.map(s => (
            <button key={s} onClick={() => setDescricao(s.replace(/^.{2}/, "").trim())}
              style={{
                border: "1px solid #E5E5E5", borderRadius: 100,
                padding: "8px 16px", fontSize: 13, background: "#fff",
                cursor: "pointer", color: "#0A0A0A", transition: "all 120ms",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#000";
                e.currentTarget.style.background = "#F5F5F5";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "#E5E5E5";
                e.currentTarget.style.background = "#fff";
              }}
            >{s}</button>
          ))}
        </div>

        {/* Textarea */}
        <div style={{
          border: "1.5px solid #E5E5E5", borderRadius: 16,
          background: "#fff", marginBottom: 16, overflow: "hidden",
          transition: "border-color 150ms, box-shadow 150ms",
        }}
          onFocusCapture={e => {
            e.currentTarget.style.borderColor = "#000";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.06)";
          }}
          onBlurCapture={e => {
            e.currentTarget.style.borderColor = "#E5E5E5";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descreva o que você quer destacar no anúncio... Ex: foco no conforto, ideal para treinos, entrega rápida"
            maxLength={500}
            style={{
              width: "100%", minHeight: 140, border: "none", outline: "none",
              resize: "none", padding: "16px 20px", fontSize: 15,
              lineHeight: 1.6, color: "#0A0A0A", background: "transparent",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          <div style={{
            borderTop: "1px solid #F0F0F0", padding: "10px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 12, color: "#A3A3A3" }}>{descricao.length} / 500</span>
            <span style={{ fontSize: 12, color: "#A3A3A3", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: "#22C55E",
                display: "inline-block", animation: "pulse 2s infinite",
              }} />
              IA Pronta
            </span>
          </div>
        </div>

        {/* Botão */}
        <button
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
              setResultado("🛍️ Camiseta Fitness Masculina Premium\n\nIdeal para quem treina e quer conforto sem abrir mão do estilo. Tecido leve e respirável, perfeito para academia, corrida ou dia a dia.\n\n✅ Entrega rápida\n✅ Qualidade premium\n✅ Tamanhos P ao GG\n\n🏷️ De R$71,96 por apenas R$59,90 hoje!");
              setLoading(false);
            }, 1800);
          }}
          style={{
            width: "100%", background: "#000", color: "#fff",
            border: "none", borderRadius: 100, padding: "14px 32px",
            fontSize: 15, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "opacity 150ms, transform 150ms",
            marginBottom: 8,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {loading ? "Gerando..." : <><Sparkles size={16} /> Gerar anúncio com IA</>}
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: "#A3A3A3", margin: "0 0 32px" }}>
          Powered by Velo IA · Resultado em segundos
        </p>

        {/* Resultado */}
        {resultado && (
          <div style={{
            border: "1.5px solid #000", borderRadius: 16, padding: 24,
            animation: "slideUp 300ms ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Anúncio gerado</span>
                <span style={{ background: "#FFF7ED", color: "#C2410C", fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 500 }}>Mercado Livre</span>
                <span style={{ background: "#FFF7ED", color: "#C2410C", fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 500 }}>Shopee</span>
              </div>
              <button onClick={() => navigator.clipboard.writeText(resultado)}
                style={{ border: "1px solid #E5E5E5", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
                <Copy size={14} color="#737373" />
              </button>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#0A0A0A", margin: "0 0 20px", whiteSpace: "pre-wrap" }}>
              {resultado}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{
                flex: 1, background: "#000", color: "#fff", border: "none",
                borderRadius: 100, padding: "12px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>
                Publicar agora →
              </button>
              <button onClick={() => setResultado("")}
                style={{
                  border: "1.5px solid #000", background: "#fff", color: "#000",
                  borderRadius: 100, padding: "12px 20px", fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <RefreshCw size={14} /> Regenerar
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
