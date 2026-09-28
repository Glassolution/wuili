/**
 * Guarda o anúncio que a pessoa preparou antes de ir para a página de planos.
 *
 * Serve para dois momentos: montar o resumo do anúncio na página de planos e
 * levar a pessoa de volta ao mesmo produto depois do pagamento.
 */
export type PlanosCheckoutContexto = {
  productId: string;
  title: string;
  image: string | null;
  sellPrice: number;
  profit: number;
  savedAt: number;
};

const KEY = "velo:planos-contexto";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export const salvarContextoDePlanos = (contexto: Omit<PlanosCheckoutContexto, "savedAt">) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...contexto, savedAt: Date.now() }));
  } catch {
    // Em modo privado o fluxo continua, só sem o resumo do anúncio.
  }
};

export const lerContextoDePlanos = (): PlanosCheckoutContexto | null => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const contexto = JSON.parse(raw) as PlanosCheckoutContexto;
    if (!contexto?.productId || Date.now() - contexto.savedAt > VALIDADE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return contexto;
  } catch {
    return null;
  }
};

export const limparContextoDePlanos = () => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada a limpar.
  }
};
