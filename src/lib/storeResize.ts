// Matemática do redimensionamento por arrasto das alças do canvas.
//
// Fica separada do componente do editor para ser testável: o cálculo depende do
// zoom do canvas e dos mesmos limites dos inputs numéricos do painel, e um erro
// aqui produz caixas que não batem com o valor gravado no override.

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Limites compartilhados com applyElementWidth/applyMinHeight no editor. Se os
 *  dois caminhos divergirem, arrastar e digitar dariam resultados diferentes. */
export const RESIZE_LIMITS = {
  minWidth: 24,
  maxWidth: 1440,
  minHeight: 0,
  maxHeight: 600,
} as const;

export type ResizeOrigin = {
  startX: number;
  startY: number;
  /** Dimensões do elemento em px do documento (já divididas pelo zoom). */
  startWidth: number;
  startHeight: number;
  /** Deslocamento ja gravado no override, para manter o centro ao redimensionar. */
  baseX?: number;
  baseY?: number;
};

export type ResizeResult = {
  /** undefined quando a alça não mexe naquele eixo — o override não recebe a chave. */
  width?: number;
  minHeight?: number;
  offsetX?: number;
  offsetY?: number;
};

export const handleTouchesWidth = (handle: ResizeHandle) => /[ew]/.test(handle);
export const handleTouchesHeight = (handle: ResizeHandle) => /[ns]/.test(handle);

/**
 * Converte o movimento do mouse (px de tela) no novo tamanho do elemento
 * (px do documento). O canvas do editor é renderizado com `scale(zoom)`, então
 * um deslocamento de N px na tela equivale a N/zoom px no elemento — sem essa
 * divisão a caixa cresceria ~2x mais rápido que o cursor no zoom padrão (0.52).
 */
export const computeResize = (
  handle: ResizeHandle,
  origin: ResizeOrigin,
  pointerX: number,
  pointerY: number,
  zoom: number,
): ResizeResult => {
  const safeZoom = zoom > 0 ? zoom : 1;
  const deltaX = (pointerX - origin.startX) / safeZoom;
  const deltaY = (pointerY - origin.startY) / safeZoom;

  const result: ResizeResult = {};

  if (handleTouchesWidth(handle)) {
    // Alça oeste puxa a borda esquerda: arrastar para a direita encolhe.
    const raw = handle.includes("w") ? origin.startWidth - deltaX : origin.startWidth + deltaX;
    const width = clamp(Math.round(raw), RESIZE_LIMITS.minWidth, RESIZE_LIMITS.maxWidth);
    result.width = width;
    result.offsetX = handle.includes("w")
      ? Math.round((origin.baseX ?? 0) + origin.startWidth - width)
      : Math.round(origin.baseX ?? 0);
  }

  if (handleTouchesHeight(handle)) {
    const raw = handle.includes("n") ? origin.startHeight - deltaY : origin.startHeight + deltaY;
    const minHeight = clamp(Math.round(raw), RESIZE_LIMITS.minHeight, RESIZE_LIMITS.maxHeight);
    result.minHeight = minHeight;
    result.offsetY = handle.includes("n")
      ? Math.round((origin.baseY ?? 0) + origin.startHeight - minHeight)
      : Math.round(origin.baseY ?? 0);
  }

  return result;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// --- Mover -----------------------------------------------------------------

/** Distância em px de tela que o mouse precisa andar para o arrasto virar um
 *  "mover". Abaixo disso o gesto continua sendo um clique — é o que preserva
 *  clicar para selecionar um filho e o duplo-clique para editar texto. */
export const MOVE_THRESHOLD = 4;

export type MoveOrigin = {
  startX: number;
  startY: number;
  /** Deslocamento já gravado no override, para o arrasto continuar de onde parou. */
  baseX: number;
  baseY: number;
};

export const passedMoveThreshold = (origin: MoveOrigin, pointerX: number, pointerY: number) =>
  Math.hypot(pointerX - origin.startX, pointerY - origin.startY) > MOVE_THRESHOLD;

/**
 * Novo deslocamento do elemento a partir do movimento do mouse. Divide pelo
 * zoom pelo mesmo motivo do resize: o canvas é renderizado escalado, então px
 * de tela ≠ px do documento.
 */
export const computeMove = (
  origin: MoveOrigin,
  pointerX: number,
  pointerY: number,
  zoom: number,
): { offsetX: number; offsetY: number } => {
  const safeZoom = zoom > 0 ? zoom : 1;
  return {
    offsetX: Math.round(origin.baseX + (pointerX - origin.startX) / safeZoom),
    offsetY: Math.round(origin.baseY + (pointerY - origin.startY) / safeZoom),
  };
};
