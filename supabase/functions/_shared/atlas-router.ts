/**
 * Roteamento de modelo por heurística.
 *
 * A maior parte do que chega aqui é dúvida curta de navegação ou uma pergunta
 * simples sobre a plataforma: um modelo leve resolve com a mesma qualidade
 * percebida e por uma fração do preço. Só escala para o modelo mais robusto o
 * que realmente é geração de conteúdo (título, descrição, anúncio, copy) ou
 * pergunta longa/estratégica.
 *
 * Sem classificador por LLM de propósito: um classificador custaria uma chamada
 * extra em toda mensagem, exatamente o que estamos tentando evitar. Se os logs
 * mostrarem erro visível de roteamento, revisitamos.
 */

export const ATLAS_MODELO_LEVE = "google/gemini-2.5-flash-lite";
export const ATLAS_MODELO_ROBUSTO = "google/gemini-2.5-flash";

const normalizar = (valor: string) =>
  valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Pede texto pronto para o anúncio, a loja ou a página: vale o modelo bom. */
const PEDE_CONTEUDO =
  /\b(escrev|redig|gere|gerar|criar?|cria|monta|montar|otimiz|melhor(a|ar)|reescrev)\b.*\b(titulo|descricao|anuncio|texto|copy|bullet|ficha|pagina|post|legenda|email)\b|\b(titulo|descricao|copy|anuncio) (para|do|da|de)\b/;

/** Pergunta de estratégia/diagnóstico costuma exigir raciocínio mais longo. */
const PEDE_RACIOCINIO =
  /\b(por que|porque|analis|estrategia|comparar|compare|vale a pena|qual (a )?melhor|precific|precific(ar|acao)|margem|calcul|erro|nao consigo|nao funciona|reclamacao|reputacao)\b/;

export type RoteamentoDoAtlas = {
  modelo: string;
  /** Etiqueta curta para o log, para dar para medir o acerto da heurística. */
  rota: "leve" | "robusto";
  motivo: string;
};

export const escolherModeloDoAtlas = (
  mensagem: string,
  opcoes: { temNavegacao: boolean; historicoLongo: boolean },
): RoteamentoDoAtlas => {
  const texto = normalizar(mensagem);

  if (PEDE_CONTEUDO.test(texto)) {
    return { modelo: ATLAS_MODELO_ROBUSTO, rota: "robusto", motivo: "geracao_de_conteudo" };
  }
  if (texto.length > 220 || PEDE_RACIOCINIO.test(texto)) {
    return { modelo: ATLAS_MODELO_ROBUSTO, rota: "robusto", motivo: "pergunta_complexa" };
  }
  if (opcoes.temNavegacao) {
    return { modelo: ATLAS_MODELO_LEVE, rota: "leve", motivo: "navegacao" };
  }
  if (opcoes.historicoLongo && texto.length > 140) {
    return { modelo: ATLAS_MODELO_ROBUSTO, rota: "robusto", motivo: "conversa_longa" };
  }
  return { modelo: ATLAS_MODELO_LEVE, rota: "leve", motivo: "duvida_simples" };
};
