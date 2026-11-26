/*
  Fonte da marca da pessoa (Google Fonts), usada nos títulos da loja montada
  pelo Atlas. O nome já chega limpo de `nomeDaFonte` (só letras, números e
  espaço), mas é limpo de novo aqui porque vai numa URL.
*/

const limpar = (nome: string) => nome.replace(/[^a-z0-9à-ÿ ]/gi, "").replace(/\s+/g, " ").trim().slice(0, 40);

/** Endereço do CSS da fonte no Google Fonts (pesos 400 a 700). */
export function urlDaFonteDoGoogle(nome: string): string | null {
  const limpo = limpar(nome);
  if (!limpo) return null;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(limpo).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
}

/** Pilha CSS: a fonte da marca primeiro; se ela não existir no Google, fica a do modelo. */
export function pilhaDaFonte(nome: string, reserva: string): string {
  const limpo = limpar(nome);
  return limpo ? `"${limpo}", ${reserva}` : reserva;
}

/** Carrega a fonte uma vez na página (sem efeito fora do navegador). */
export function carregarFonteDoGoogle(nome: string): void {
  if (typeof document === "undefined") return;
  const url = urlDaFonteDoGoogle(nome);
  if (!url) return;
  const id = `velo-fonte-${limpar(nome).toLowerCase().replace(/ /g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}
