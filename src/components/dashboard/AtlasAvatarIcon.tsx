import type { CSSProperties } from "react";
import atlasCompassIcon from "@/assets/atlas-compass-icon.png";

type AtlasAvatarIconProps = {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  animated?: boolean;
};

const AtlasAvatarIcon = ({ size, className = "", style, animated = true }: AtlasAvatarIconProps) => {
  const dimensionStyle: CSSProperties =
    size === undefined
      ? {}
      : {
          width: typeof size === "number" ? `${size}px` : size,
          height: typeof size === "number" ? `${size}px` : size,
        };

  return (
    <span
      aria-hidden="true"
      className={`atlas-avatar-icon ${animated ? "atlas-avatar-icon--animated" : ""} ${className}`}
      style={{ ...dimensionStyle, ...style }}
    >
      {/* Olhos inteiramente brancos, sem pupila: com pupila o Atlas ganhava
          direção de olhar e passava a parecer um personagem humanoide. */}
      <span className="atlas-avatar-eye atlas-avatar-eye--left" />
      <span className="atlas-avatar-eye atlas-avatar-eye--right" />
      <img
        src={atlasCompassIcon}
        alt=""
        draggable={false}
        className="atlas-avatar-icon__image"
      />
      <span className="atlas-avatar-lid atlas-avatar-lid--left" />
      <span className="atlas-avatar-lid atlas-avatar-lid--right" />
    </span>
  );
};

export default AtlasAvatarIcon;
