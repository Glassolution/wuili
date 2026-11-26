/*
  Ideia escrita no campo do hero da landing ("Quero criar uma loja de...").

  Caminho: landing → login/cadastro → /dashboard (Início) → o AtlasChatProvider
  envia a ideia sozinho como primeira mensagem de uma conversa nova, no mesmo
  chat da caixa do Início (centralizado), e o Atlas já começa a montar ou a
  procurar produto. A página antiga /dashboard/atlas não é usada.

  Vive no sessionStorage da aba, NUNCA na URL: o Pixel da Meta envia a URL
  inteira, e o texto é livre (pode ter nome, telefone etc.). Também não usa o
  `?first=` do AtlasChatPage pelo mesmo motivo.

  O login (senha ou Google) sempre volta para /dashboard, que já está liberado
  como retorno do OAuth.
*/

const CHAVE = "velo_ideia_landing";

export type IdeiaDaLanding = { ideia: string; canal?: string };

// Rótulos dos canais do seletor do hero (Index.tsx, CANAIS).
const ROTULO_DO_CANAL: Record<string, string> = {
  loja: "Loja online",
  "mercado-livre": "Mercado Livre",
  pagina: "Página de vendas",
  imagens: "Imagens com IA",
  catalogo: "Produtos sem estoque",
};

export function guardarIdeiaDaLanding(ideia: string, canal?: string) {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify({ ideia, canal }));
  } catch {
    /* sessionStorage bloqueado (aba anônima): segue sem guardar */
  }
}

export function lerIdeiaDaLanding(): IdeiaDaLanding | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as IdeiaDaLanding;
    if (!dado || typeof dado.ideia !== "string" || !dado.ideia.trim()) return null;
    return { ideia: dado.ideia.trim().slice(0, 2000), canal: typeof dado.canal === "string" ? dado.canal : undefined };
  } catch {
    return null;
  }
}

export const temIdeiaDaLanding = () => lerIdeiaDaLanding() !== null;

/** Lê e apaga: a ideia vira mensagem uma vez só. */
export function consumirIdeiaDaLanding(): IdeiaDaLanding | null {
  const dado = lerIdeiaDaLanding();
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    /* nada a apagar */
  }
  return dado;
}

/** Texto enviado ao Atlas: a ideia como a pessoa escreveu + por onde quer começar. */
export function mensagemParaOAtlas({ ideia, canal }: IdeiaDaLanding) {
  const rotulo = canal ? ROTULO_DO_CANAL[canal] : undefined;
  // O seletor já escreve o começo da frase ("Quero vender no Mercado Livre..."):
  // só acrescenta o canal quando o texto ainda não fala dele.
  if (!rotulo || ideia.toLowerCase().includes(rotulo.toLowerCase())) return ideia;
  return `${ideia}\n\nQuero começar por: ${rotulo}.`;
}
