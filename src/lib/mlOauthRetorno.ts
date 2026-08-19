/**
 * Marcador de "de onde a pessoa saiu" para conectar o Mercado Livre.
 *
 * O OAuth tira o usuário do app (mesma aba, quando ele veio do chat do Atlas),
 * então o estado em memória do chat se perde. Guardamos aqui a rota, a conversa
 * e a origem para reconstruir exatamente o ponto em que ele estava.
 */
export type OrigemDaConexaoMl = "atlas" | "config";

export type RetornoMl = {
  origem: OrigemDaConexaoMl;
  rota?: string;
  threadId?: string | null;
  criadoEm: number;
};

const CHAVE = "velo:ml-retorno";
const VALIDADE_MS = 20 * 60 * 1000;

export const salvarRetornoMl = (dados: Omit<RetornoMl, "criadoEm">) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...dados, criadoEm: Date.now() }));
  } catch {
    /* modo privado / storage cheio: o fluxo continua, só sem restauração */
  }
};

export const lerRetornoMl = (): RetornoMl | null => {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as RetornoMl;
    if (!dados?.origem || Date.now() - (dados.criadoEm ?? 0) > VALIDADE_MS) {
      localStorage.removeItem(CHAVE);
      return null;
    }
    return dados;
  } catch {
    return null;
  }
};

export const limparRetornoMl = () => {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
};
