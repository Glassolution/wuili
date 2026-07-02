import { Waves } from "lucide-react";

type AquasIconProps = {
  size?: number;
  inverted?: boolean;
  className?: string;
};

/**
 * Ícone do Aquas — quadrado com cantos arredondados contendo o glifo Waves (Lucide, stroke 1.5).
 * `inverted` = fundo escuro / traço branco. Padrão = fundo branco / traço preto.
 */
const AquasIcon = ({ size = 28, inverted = false, className }: AquasIconProps) => {
  const background = inverted ? "#111111" : "#FFFFFF";
  const foreground = inverted ? "#FFFFFF" : "#111111";

  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-[30%] ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background,
        boxShadow: inverted
          ? "inset 0 1px 0 rgba(255,255,255,0.10)"
          : "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(17,24,39,0.06)",
      }}
      aria-hidden="true"
    >
      <Waves size={Math.round(size * 0.6)} strokeWidth={1.5} color={foreground} />
    </span>
  );
};

export default AquasIcon;
