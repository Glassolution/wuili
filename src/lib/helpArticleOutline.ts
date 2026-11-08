/* Âncoras dos títulos dos artigos da Central de Ajuda e o sumário lateral. */

/** Âncora de um título: a mesma regra serve ao sumário lateral e ao texto. */
export function headingId(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Títulos ## e ### do Markdown, para o sumário (ignora blocos de código). */
export function articleOutline(markdown: string): { id: string; text: string; level: 2 | 3 }[] {
  const items: { id: string; text: string; level: 2 | 3 }[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = match[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    if (text) items.push({ id: headingId(text), text, level: match[1].length === 2 ? 2 : 3 });
  }
  return items;
}
