/*
  Limpeza da imagem de capa gerada por IA (generate-store-banner).

  O modelo de imagem às vezes devolve a foto "dentro" de um quadro: faixas
  lisas em cima e embaixo (como um vídeo com tarja). Na capa, isso aparece como
  uma barra de outra cor cortando a foto. Aqui as faixas são achadas linha a
  linha e cortadas antes de a imagem ir para a loja.

  Depois do corte, a capa é reduzida e comprimida (`prepararCapa`) e salva no
  bucket `assets` (ver `capaParaALoja` em construcaoDaLoja.ts).

  Só corta quando tem certeza: faixa lisa, com borda nítida onde a foto começa,
  nas duas pontas (ou uma só, se for praticamente de uma cor só). Céu liso que
  vai mudando aos poucos não é faixa.
*/

export type LinhaDaImagem = { media: [number, number, number]; desvio: number };

const distancia = (a: [number, number, number], b: [number, number, number]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

/** Altura de uma faixa lisa a partir da ponta (0 = não há faixa) e se ela é quase de uma cor só. */
function faixaNaPonta(linhas: LinhaDaImagem[]): { altura: number; lisa: boolean } {
  const n = linhas.length;
  if (n < 20) return { altura: 0, lisa: false };
  const primeira = linhas[0];
  let k = 0;
  let somaDoDesvio = 0;
  while (k < n && linhas[k].desvio < 14 && distancia(linhas[k].media, primeira.media) < 10) {
    somaDoDesvio += linhas[k].desvio;
    k++;
  }
  const altura = k;
  if (altura < n * 0.04 || altura > n * 0.32 || altura >= n) return { altura: 0, lisa: false };
  // Borda nítida: logo depois da faixa a imagem muda de verdade.
  const depois = linhas.slice(altura, Math.min(n, altura + 3));
  const borda = depois.some((l) => distancia(l.media, primeira.media) > 16 || l.desvio > 22);
  if (!borda) return { altura: 0, lisa: false };
  return { altura, lisa: somaDoDesvio / altura < 6 };
}

/** Quantas linhas cortar em cima e embaixo. */
export function faixasParaCortar(linhas: LinhaDaImagem[]): { topo: number; base: number } {
  const topo = faixaNaPonta(linhas);
  const base = faixaNaPonta([...linhas].reverse());
  const ambas = topo.altura > 0 && base.altura > 0;
  return {
    topo: ambas || topo.lisa ? topo.altura : 0,
    base: ambas || base.lisa ? base.altura : 0,
  };
}

function linhasDaImagem(dados: ImageData): LinhaDaImagem[] {
  const { width: w, height: h, data } = dados;
  const passo = Math.max(1, Math.floor(w / 160));
  const linhas: LinhaDaImagem[] = [];
  for (let y = 0; y < h; y++) {
    let r = 0, g = 0, b = 0, q = 0, n = 0;
    for (let x = 0; x < w; x += passo) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      q += lum * lum;
      n++;
    }
    const media: [number, number, number] = [r / n, g / n, b / n];
    const lumMedia = 0.299 * media[0] + 0.587 * media[1] + 0.114 * media[2];
    linhas.push({ media, desvio: Math.sqrt(Math.max(0, q / n - lumMedia * lumMedia)) });
  }
  return linhas;
}

const carregar = (src: string) =>
  new Promise<HTMLImageElement>((ok, falha) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("imagem não carregou"));
    img.src = src;
  });

/** Largura máxima da capa na loja: nítida em tela de alta resolução sem pesar no 4G. */
export const LARGURA_DA_CAPA = 2560;

/** Tamanho da capa leve: reduz só quando passa da largura máxima, mantendo a proporção. */
export function medidaDaCapaLeve(largura: number, altura: number, maximo = LARGURA_DA_CAPA) {
  const k = Math.min(1, maximo / largura);
  return { largura: Math.round(largura * k), altura: Math.round(altura * k) };
}

const paraArquivo = (tela: HTMLCanvasElement, tipo: string, qualidade: number) =>
  new Promise<Blob | null>((ok) => tela.toBlob(ok, tipo, qualidade));

export type CapaLeve = { arquivo: Blob; extensao: "webp" | "jpg"; cortou: boolean };

/**
 * Capa pronta para a loja: sem as tarjas lisas, no máximo 2560px de largura e
 * comprimida em WebP (JPEG no navegador que não gera WebP). A IA devolve em 4K
 * (5504 × 3072, vários MB); na loja isso só pesaria. Devolve null se não der
 * para ler a imagem (aí quem chamou usa a original).
 */
export async function prepararCapa(src: string, larguraMaxima = LARGURA_DA_CAPA): Promise<CapaLeve | null> {
  try {
    const img = await carregar(src);
    const { largura: w, altura: h } = medidaDaCapaLeve(img.naturalWidth, img.naturalHeight, larguraMaxima);
    // Reduz primeiro: a procura das tarjas fica leve até para a imagem em 4K.
    const tela = document.createElement("canvas");
    tela.width = w;
    tela.height = h;
    const ctx = tela.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const { topo, base } = faixasParaCortar(linhasDaImagem(ctx.getImageData(0, 0, w, h)));
    // Corta um pouco além da borda para não sobrar fio da faixa.
    const y0 = topo > 0 ? topo + 2 : 0;
    const altura = h - y0 - (base > 0 ? base + 2 : 0);
    const final = document.createElement("canvas");
    final.width = w;
    final.height = altura;
    final.getContext("2d")?.drawImage(tela, 0, y0, w, altura, 0, 0, w, altura);
    const webp = await paraArquivo(final, "image/webp", 0.85);
    const cortou = topo > 0 || base > 0;
    if (webp && webp.type === "image/webp") return { arquivo: webp, extensao: "webp", cortou };
    const jpg = await paraArquivo(final, "image/jpeg", 0.86);
    return jpg ? { arquivo: jpg, extensao: "jpg", cortou } : null;
  } catch {
    return null;
  }
}

export const arquivoParaDataUrl = (arquivo: Blob) =>
  new Promise<string>((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => falha(new Error("não deu para ler a capa"));
    leitor.readAsDataURL(arquivo);
  });
