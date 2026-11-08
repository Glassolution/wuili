/** Version evidence without changing the legacy cache schema or its rows. */
export const IMAGE_CRITERION_VERSION = 'structured-pt-v3-2026-11-08';
export const IMAGE_EVIDENCE_PREFIX = `[${IMAGE_CRITERION_VERSION}] `;
export const IMAGE_REJECTION_CODES = ['SOBREPOSICAO_TEXTO', 'MARCA_DAGUA', 'LOGO_LOJA', 'COLAGEM', 'INSERCAO_CIRCULAR', 'MEDIDA_SOBREPOSTA', 'SEM_PRODUTO'] as const;
export type ImageVerdict = {
  veredito: 'aprovada' | 'reprovada' | 'inconclusiva';
  codigo: typeof IMAGE_REJECTION_CODES[number] | 'FALHA_TECNICA' | 'OK';
  localizacao: 'SOBRE_FOTO' | 'PRODUTO' | 'EMBALAGEM' | 'IMAGEM_INTEIRA' | 'FUNDO_LIMPO' | 'DESCONHECIDA';
  justificativa: string;
};
export function imageEvidencePrefix(primary = false): string {
  return `${IMAGE_EVIDENCE_PREFIX}${primary ? 'principal' : 'galeria'}: `;
}

export const IMAGE_VISION_PROMPT = `Avalie a fotografia distinguindo o objeto fotografado de elementos adicionados sobre a imagem.
Texto, marca, especificações, etiquetas e rótulos fisicamente impressos ou fixados no produto ou na embalagem original NÃO reprovam.
Fotografia da embalagem original não é automaticamente imagem sem produto. Ilustrações e quadros impressos nela não são colagem digital da fotografia.
Reprove somente por evidência visual clara de texto/selo/logo SOBREPOSTO à fotografia (promoção, preço, telefone, marca-d'água, logo de loja, anotações), banner ou arte promocional do fornecedor (texto/arte de divulgação ocupando a imagem), colagem digital de fotografias ou imagem sem produto nem embalagem original.
Inserção circular ou quadro de uso adicionado sobre a foto, e montagem de vários quadros/ângulos, reprovam como INSERCAO_CIRCULAR ou COLAGEM. Quadros fisicamente impressos na embalagem não são montagens da fotografia.
Linhas e números de medidas digitais sobrepostos reprovam; medidas impressas no produto/embalagem não. Marca física do fabricante não reprova.
Se não conseguir ver, analisar ou distinguir com segurança, retorne inconclusiva. Falha técnica nunca é reprovação. Nunca invente evidência.
Responda APENAS um objeto JSON com exatamente os campos veredito, codigo, localizacao, justificativa.
veredito: aprovada/reprovada/inconclusiva.
codigo: SOBREPOSICAO_TEXTO/MARCA_DAGUA/LOGO_LOJA/COLAGEM/INSERCAO_CIRCULAR/MEDIDA_SOBREPOSTA/SEM_PRODUTO/FALHA_TECNICA/OK.
localizacao: SOBRE_FOTO/PRODUTO/EMBALAGEM/IMAGEM_INTEIRA/FUNDO_LIMPO/DESCONHECIDA. justificativa: frase curta não vazia (máximo 400 caracteres).
Reprovada: código visual, localização SOBRE_FOTO (texto/marca/logo/inserção/medida) ou IMAGEM_INTEIRA (COLAGEM/SEM_PRODUTO). Banner com texto usa SOBREPOSICAO_TEXTO; arte com montagem usa COLAGEM.
Aprovada: código OK, localização PRODUTO/EMBALAGEM/FUNDO_LIMPO/IMAGEM_INTEIRA. Inconclusiva: FALHA_TECNICA e DESCONHECIDA. Resposta fora do esquema não será aceita.`;

export function imageVisionPrompt(primary = false): string {
  return IMAGE_VISION_PROMPT + (primary
    ? '\nEsta é a FOTO PRINCIPAL: exija produto ou embalagem original em FUNDO LIMPO, sem texto ou logo sobreposto, sem banner/colagem/inserção. Para aprovar use localizacao=FUNDO_LIMPO, mesmo com impressão física no produto/embalagem. Se não puder certificar fundo limpo e não houver infração visual codificada, retorne inconclusiva; não invente código de reprovação.'
    : '\nEsta é uma FOTO DA GALERIA: aplique as regras acima; não trate impressão física como sobreposição.');
}