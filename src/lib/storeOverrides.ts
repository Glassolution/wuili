// Lógica compartilhada de "element overrides" da vitrine.
//
// O editor (GeneratedStoreEditorPage) permite editar textos, cores, imagens,
// bordas e ícones de elementos individuais da vitrine. Cada edição é guardada
// em `elementOverrides`, um mapa keyed por um "path" estrutural do DOM
// (tagName:índice do filho, a partir do root da vitrine). A página publicada
// (PublicStorePage) reaplica exatamente os mesmos overrides sobre a mesma
// estrutura de template, tornando o site publicado idêntico ao que foi editado.
//
// IMPORTANTE: `applyOverrideToElement` deve permanecer idêntica à usada pelo
// editor — ambos importam desta função (fonte única de verdade).

export type EditableDomElement = HTMLElement | SVGElement;
export type ImageShape = "auto" | "wide" | "square" | "circle";
export type TextWeight = "400" | "500" | "600" | "700";

export type ElementOverride = {
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  color?: string;
  textContent?: string;
  buttonTextContent?: string;
  fontSize?: number;
  fontWeight?: TextWeight;
  textAlign?: "left" | "center" | "right";
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  paddingInline?: number;
  minHeight?: number;
  imageSrc?: string;
  imageShape?: ImageShape;
  iconName?: string;
  iconSize?: number;
  buttonIconName?: string;
  buttonIconSize?: number;
  buttonIconColor?: string;
  buttonIconHidden?: boolean;
};

/** Renderiza o markup SVG de um ícone (injetado pelo chamador para evitar
 *  acoplar este módulo ao registry de ícones do editor). */
export type RenderIcon = (name: string, size: number, color: string) => string;

/** Caminho estrutural (tagName:índice>...) de um elemento em relação ao root. */
export const getElementPath = (element: EditableDomElement, root: HTMLElement): string => {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent) break;
    const index = Array.from(parent.children).indexOf(current);
    parts.unshift(`${current.tagName.toLowerCase()}:${index}`);
    current = parent;
  }
  return parts.join(">");
};

/** Resolve o elemento a partir de um path estrutural relativo ao root. */
export const getElementByPath = (root: HTMLElement | null, path: string): EditableDomElement | null => {
  if (!root || !path) return null;
  let current: Element = root;
  for (const part of path.split(">")) {
    const [, indexValue] = part.split(":");
    const index = Number(indexValue);
    if (!Number.isInteger(index)) return null;
    const child = current.children.item(index);
    if (!(child instanceof HTMLElement) && !(child instanceof SVGElement)) return null;
    current = child;
  }
  return (current instanceof HTMLElement || current instanceof SVGElement) && current !== root ? current : null;
};

/** Aplica um override a um elemento do DOM (mutação imperativa). */
export const applyOverrideToElement = (
  element: EditableDomElement,
  override: ElementOverride,
  renderIcon: RenderIcon,
) => {
  if (element.dataset.editorOriginalBackgroundColor === undefined) {
    element.dataset.editorOriginalBackgroundColor = element.style.backgroundColor;
  }
  if (override.backgroundColor) {
    element.style.backgroundColor = override.backgroundColor;
    element.dataset.editorFillOverride = "true";
  }
  if (override.hoverBackgroundColor) {
    element.style.setProperty("--editor-hover-bg", override.hoverBackgroundColor);
    element.dataset.editorHoverBg = "true";
  }
  if (override.color) {
    if (element.dataset.editorOriginalColor === undefined) element.dataset.editorOriginalColor = element.style.color;
    element.style.color = override.color;
    if (element.tagName.toLowerCase() === "svg") {
      element.setAttribute("color", override.color);
      element.style.color = override.color;
    }
  }
  if (override.textContent !== undefined && !element.querySelector("svg")) {
    element.textContent = override.textContent;
  }
  if (override.buttonTextContent !== undefined) {
    const inlineText = element.querySelector("[data-editor-inline-text]");
    if (inlineText instanceof HTMLElement) {
      inlineText.textContent = override.buttonTextContent;
    } else {
      const textNode = Array.from(element.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
      );
      if (textNode) textNode.textContent = ` ${override.buttonTextContent} `;
    }
  }
  if (override.fontSize) {
    if (element.dataset.editorOriginalFontSize === undefined) element.dataset.editorOriginalFontSize = element.style.fontSize;
    element.style.fontSize = `${override.fontSize}px`;
  }
  if (override.fontWeight) {
    if (element.dataset.editorOriginalFontWeight === undefined) element.dataset.editorOriginalFontWeight = element.style.fontWeight;
    element.style.fontWeight = override.fontWeight;
  }
  if (override.textAlign) {
    if (element.dataset.editorOriginalTextAlign === undefined) element.dataset.editorOriginalTextAlign = element.style.textAlign;
    element.style.textAlign = override.textAlign;
  }
  if (override.borderRadius !== undefined) {
    if (element.dataset.editorOriginalBorderRadius === undefined) element.dataset.editorOriginalBorderRadius = element.style.borderRadius;
    element.style.borderRadius = `${override.borderRadius}px`;
  }
  if (override.borderColor !== undefined) {
    if (element.dataset.editorOriginalBorderColor === undefined) element.dataset.editorOriginalBorderColor = element.style.borderColor;
    element.style.borderColor = override.borderColor;
    element.style.borderStyle = "solid";
  }
  if (override.borderWidth !== undefined) {
    if (element.dataset.editorOriginalBorderWidth === undefined) element.dataset.editorOriginalBorderWidth = element.style.borderWidth;
    element.style.borderWidth = `${override.borderWidth}px`;
    element.style.borderStyle = "solid";
  }
  if (override.paddingInline !== undefined) {
    if (element.dataset.editorOriginalPaddingInline === undefined) element.dataset.editorOriginalPaddingInline = element.style.paddingInline;
    element.style.paddingInline = `${override.paddingInline}px`;
  }
  if (override.minHeight !== undefined) {
    if (element.dataset.editorOriginalMinHeight === undefined) element.dataset.editorOriginalMinHeight = element.style.minHeight;
    element.style.minHeight = `${override.minHeight}px`;
    element.style.height = "auto";
  }
  if (override.imageSrc && element instanceof HTMLImageElement) {
    element.src = override.imageSrc;
  }
  if (override.imageShape && element instanceof HTMLImageElement) {
    if (element.dataset.editorOriginalBorderRadius === undefined) element.dataset.editorOriginalBorderRadius = element.style.borderRadius;
    if (element.dataset.editorOriginalAspectRatio === undefined) element.dataset.editorOriginalAspectRatio = element.style.aspectRatio;
    if (element.dataset.editorOriginalObjectFit === undefined) element.dataset.editorOriginalObjectFit = element.style.objectFit;
    if (override.imageShape === "auto") {
      element.style.borderRadius = element.dataset.editorOriginalBorderRadius || "";
      element.style.aspectRatio = element.dataset.editorOriginalAspectRatio || "";
      element.style.objectFit = element.dataset.editorOriginalObjectFit || "";
    } else {
      element.style.aspectRatio = override.imageShape === "wide" ? "16 / 9" : "1 / 1";
      element.style.objectFit = "cover";
      element.style.borderRadius = override.imageShape === "circle" ? "9999px" : "12px";
    }
  }
  if (element.tagName.toLowerCase() === "svg" && (override.iconName || override.iconSize || override.color)) {
    const iconName = override.iconName ?? element.dataset.editorIcon ?? "Sparkles";
    const iconSize = override.iconSize ?? (Number(element.getAttribute("width")) || 24);
    const iconColor = override.color ?? (element.style.color || "currentColor");
    const template = document.createElement("template");
    template.innerHTML = renderIcon(iconName, iconSize, iconColor);
    const svg = template.content.firstElementChild;
    if (svg instanceof SVGElement) {
      element.innerHTML = svg.innerHTML;
      element.setAttribute("viewBox", svg.getAttribute("viewBox") || "0 0 24 24");
      element.setAttribute("width", String(iconSize));
      element.setAttribute("height", String(iconSize));
      element.style.width = `${iconSize}px`;
      element.style.height = `${iconSize}px`;
      element.style.color = iconColor;
      element.dataset.editorIcon = iconName;
    }
  }
  if (
    (element.tagName.toLowerCase() === "button" || element.getAttribute("data-editor-role") === "button") &&
    (override.buttonIconName || override.buttonIconSize || override.buttonIconColor || override.buttonIconHidden !== undefined)
  ) {
    let icon = element.querySelector("svg");
    if (!icon && override.buttonIconName && !override.buttonIconHidden) {
      const template = document.createElement("template");
      template.innerHTML = renderIcon(
        override.buttonIconName,
        override.buttonIconSize ?? 16,
        override.buttonIconColor ?? "currentColor",
      );
      const createdIcon = template.content.firstElementChild;
      if (createdIcon instanceof SVGSVGElement) {
        element.append(createdIcon);
        icon = createdIcon;
      }
    }
    if (icon instanceof SVGElement) {
      if (override.buttonIconName) {
        const template = document.createElement("template");
        template.innerHTML = renderIcon(
          override.buttonIconName,
          override.buttonIconSize ?? (Number(icon.getAttribute("width")) || 16),
          override.buttonIconColor ?? "currentColor",
        );
        const replacement = template.content.firstElementChild;
        if (replacement instanceof SVGSVGElement) {
          icon.replaceWith(replacement);
          icon = replacement;
        }
      }
      if (override.buttonIconSize) {
        icon.setAttribute("width", String(override.buttonIconSize));
        icon.setAttribute("height", String(override.buttonIconSize));
        icon.style.width = `${override.buttonIconSize}px`;
        icon.style.height = `${override.buttonIconSize}px`;
      }
      if (override.buttonIconColor) {
        icon.setAttribute("color", override.buttonIconColor);
        icon.style.color = override.buttonIconColor;
      }
      icon.style.display = override.buttonIconHidden ? "none" : "";
    }
  }
};

/** Reaplica todos os overrides salvos sobre um root de vitrine já renderizado. */
export const applyOverridesToRoot = (
  root: HTMLElement | null,
  overrides: Record<string, ElementOverride>,
  renderIcon: RenderIcon,
) => {
  if (!root) return;
  Object.entries(overrides).forEach(([path, override]) => {
    const element = getElementByPath(root, path);
    if (element) applyOverrideToElement(element, override, renderIcon);
  });
};
