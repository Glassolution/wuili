import type { CSSProperties } from "react";

type AtlasThinkingTextProps = {
  text?: string;
  className?: string;
};

const AtlasThinkingText = ({ text = "Pensando...", className = "" }: AtlasThinkingTextProps) => {
  const letters = Array.from(text);

  return (
    <p className={`velo-thinking-text ${className}`.trim()} role="status" aria-live="polite" aria-label={text}>
      <span className="sr-only">{text}</span>
      <span className="velo-thinking-wave" aria-hidden="true">
        {letters.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className="velo-thinking-letter"
            style={{ "--atlas-thinking-index": index } as CSSProperties}
          >
            {letter === " " ? "\u00A0" : letter}
          </span>
        ))}
      </span>
    </p>
  );
};

export default AtlasThinkingText;
