/**
 * Progresso do tutorial de verificação da conta de vendedor do Mercado Livre.
 *
 * O passo 2 do tutorial manda a pessoa para o Mercado Livre. No celular isso
 * joga a aba da Velo para segundo plano, e Android Chrome / iOS Safari
 * descartam abas em segundo plano sem avisar — quando ela volta, o estado em
 * memória do React já não existe. Sem uma marca em disco o tutorial recomeça
 * do passo 1 e a pessoa fica presa num laço.
 *
 * Mesma ideia do `mlOauthRetorno`, que resolve isso para o OAuth: guardamos o
 * ponto em que a pessoa parou para reconstruí-lo depois.
 */
export type ProgressoTutorialMl = {
  /** Passo mais avançado que a pessoa já alcançou (1, 2 ou 3). */
  etapa: 1 | 2 | 3;
  /** Ela já foi para a página do Mercado Livre (passo 2 → 3). */
  visitouMercadoLivre: boolean;
  /** Ela já clicou em "Entendi" no passo 3. */
  concluido: boolean;
  criadoEm: number;
};

const CHAVE = "velo:ml-tutorial-verificacao";

/*
  Verificar a conta no ML (modo vendedor, CPF, endereço de retirada, Mercado
  Envios) leva tempo e costuma ficar para depois. 20 minutos — a validade do
  retorno do OAuth — expirariam no meio do caminho e devolveriam a pessoa ao
  passo 1, que é justamente o problema. 24h cobre "termino amanhã de manhã".
*/
const VALIDADE_MS = 24 * 60 * 60 * 1000;

const VAZIO: ProgressoTutorialMl = {
  etapa: 1,
  visitouMercadoLivre: false,
  concluido: false,
  criadoEm: 0,
};

export const lerProgressoTutorialMl = (): ProgressoTutorialMl => {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return VAZIO;
    const dados = JSON.parse(bruto) as ProgressoTutorialMl;
    if (Date.now() - (dados?.criadoEm ?? 0) > VALIDADE_MS) {
      localStorage.removeItem(CHAVE);
      return VAZIO;
    }
    const etapa = dados?.etapa;
    return {
      etapa: etapa === 2 || etapa === 3 ? etapa : 1,
      visitouMercadoLivre: dados?.visitouMercadoLivre === true,
      concluido: dados?.concluido === true,
      criadoEm: dados?.criadoEm ?? 0,
    };
  } catch {
    /* modo privado / storage cheio: o fluxo continua, só sem restauração */
    return VAZIO;
  }
};

/**
 * Só avança: o passo gravado é sempre o mais adiantado que a pessoa alcançou.
 * Clicar em "Voltar" no tutorial não pode apagar o caminho já andado, senão a
 * próxima tentativa de publicar a devolveria para o começo.
 */
export const salvarProgressoTutorialMl = (parcial: Partial<Omit<ProgressoTutorialMl, "criadoEm">>) => {
  try {
    const atual = lerProgressoTutorialMl();
    const proximo: ProgressoTutorialMl = {
      etapa: (Math.max(parcial.etapa ?? atual.etapa, atual.etapa) as 1 | 2 | 3),
      visitouMercadoLivre: parcial.visitouMercadoLivre ?? atual.visitouMercadoLivre,
      concluido: parcial.concluido ?? atual.concluido,
      criadoEm: Date.now(),
    };
    localStorage.setItem(CHAVE, JSON.stringify(proximo));
  } catch {
    /* idem: sem storage o tutorial só perde a memória, não quebra */
  }
};

/** Chamado quando a publicação enfim acontece: o tutorial cumpriu o papel. */
export const limparProgressoTutorialMl = () => {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
};
