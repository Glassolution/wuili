import { supabase } from "@/integrations/supabase/client";

/**
 * Apoio à conexão do Mercado Livre: detecção de navegador interno (Instagram,
 * TikTok…), tradução de erros do callback e leitura do status de vendedor.
 *
 * Nada aqui toca em token: a gravação continua exclusivamente no `ml-callback`.
 */

export type StatusVendedorMl = {
  /** true = conta conectada e apta a anunciar; false = conectada e bloqueada; null = não deu pra saber. */
  apta: boolean | null;
  conectada: boolean;
  codigos: string[];
};

/**
 * Navegadores internos de apps (Instagram, TikTok, Facebook, Messenger).
 * Neles o retorno do OAuth costuma abrir fora do contexto original e a sessão
 * se perde, então avisamos antes de mandar a pessoa para o Mercado Livre.
 */
export const ehNavegadorInternoDeApp = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /instagram|fbav|fb_iab|fban|tiktok|musical_ly|bytedance|line\/|kakaotalk/i.test(ua);
};

const ERROS_DA_CONEXAO: Record<string, string> = {
  missing_params:
    "O Mercado Livre não devolveu os dados da autorização. Tente conectar de novo.",
  invalid_state:
    "A autorização demorou demais ou foi aberta em outra janela. Toque em conectar e conclua sem fechar o navegador.",
  token_failed:
    "O Mercado Livre não confirmou a autorização. Tente de novo em alguns instantes.",
  db_failed: "Não conseguimos salvar a conexão. Tente conectar novamente.",
  access_denied:
    "A autorização foi cancelada no Mercado Livre. Para publicar, é preciso tocar em “Permitir”.",
};

export const mensagemDeErroDaConexaoMl = (codigo: string | null | undefined) =>
  (codigo && ERROS_DA_CONEXAO[codigo]) ||
  "Não foi possível concluir a conexão com o Mercado Livre. Tente novamente.";

/**
 * Pergunta ao Mercado Livre (via edge function `ml-seller-status`) se a conta
 * consegue anunciar. Nunca derruba o fluxo: em caso de falha devolve `apta: null`.
 */
export const lerStatusVendedorMl = async (): Promise<StatusVendedorMl> => {
  try {
    const { data, error } = await supabase.functions.invoke("ml-seller-status");
    if (error || !data) return { apta: null, conectada: false, codigos: [] };
    const conectada = data.connected === true;
    const canList = data.canList;
    return {
      conectada,
      apta: typeof canList === "boolean" ? canList : null,
      codigos: Array.isArray(data.codes) ? data.codes.map(String) : [],
    };
  } catch {
    return { apta: null, conectada: false, codigos: [] };
  }
};

export const URL_VENDER_ML = "https://www.mercadolivre.com.br/vender";
