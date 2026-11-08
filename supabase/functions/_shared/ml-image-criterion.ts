/**
 * Vision pipelines: every model listed must approve for a photo to pass; any failure is inconclusive.
 * Rollback (kept until 2026-11-18): set ACTIVE_IMAGE_PIPELINE to 'legacy' and redeploy
 * ml-publish + ml-catalog-vision-audit. The version (cache key) carries the pipeline models.
 */
export const IMAGE_VISION_PIPELINES = {
  dual: { version: 'two-level-v5-2026-11-08+gemini-3.8-flash+gpt-6.1-terra', models: ['google/gemini-3.8-flash', 'openai/gpt-6.1-terra'] },
  legacy: { version: 'two-level-v4-2026-11-08', models: ['google/gemini-3.6-flash'] },
} as const;
export const ACTIVE_IMAGE_PIPELINE: keyof typeof IMAGE_VISION_PIPELINES = 'dual';
/** Version evidence without changing the legacy cache schema or its rows. */
export const IMAGE_CRITERION_VERSION: string = IMAGE_VISION_PIPELINES[ACTIVE_IMAGE_PIPELINE].version;
/** Supplier/store names already confirmed as overlaid watermarks in catalog photos. */
export const KNOWN_WATERMARK_NAMES = ['Infer', 'Oásis Market', 'Picosmos', 'Dalonso', 'ORAN', 'katelu', 'The Quality Co'];
export const IMAGE_EVIDENCE_PREFIX = `[${IMAGE_CRITERION_VERSION}] `;
export const IMAGE_REJECTION_CODES = ['SOBREPOSICAO_TEXTO', 'MARCA_DAGUA', 'LOGO_LOJA', 'COLAGEM', 'INSERCAO_CIRCULAR', 'MEDIDA_SOBREPOSTA', 'SEM_PRODUTO', 'CONTATO_QR', 'BANNER_PROMOCIONAL', 'PRECO_FRETE', 'SELO_ML', 'VARIOS_PRODUTOS', 'EMBALAGEM_PRINCIPAL', 'FUNDO_INADEQUADO', 'BORDA', 'RESOLUCAO_INSUFICIENTE'] as const;
export type ImageVerdict = {
  veredito: 'aprovada' | 'reprovada' | 'inconclusiva';
  codigo: typeof IMAGE_REJECTION_CODES[number] | 'FALHA_TECNICA' | 'OK';
  /** Descriptive evidence only; any model value is accepted and never decides the verdict. */
  localizacao: string;
  justificativa: string;
};
export function imageEvidencePrefix(primary = false): string {
  return `${IMAGE_EVIDENCE_PREFIX}${primary ? 'principal' : 'galeria'}: `;
}

export const IMAGE_VISION_PROMPT = `Avalie a foto conforme sua função, sem confundir rótulo físico com marca d'água digital.
FOTOS SECUNDÁRIAS: reprove SOMENTE marca d'água (MARCA_DAGUA), logo de loja (LOGO_LOJA), contato/QR (CONTATO_QR), banner ou arte promocional do fornecedor (BANNER_PROMOCIONAL), preço/frete (PRECO_FRETE), selo do Mercado Livre (SELO_ML), vários produtos distintos juntos (VARIOS_PRODUTOS). Um kit vendido como um único produto não é vários produtos distintos.
Medidas e linhas de dimensão (MEDIDA_SOBREPOSTA), especificações do produto (SOBREPOSICAO_TEXTO), detalhe ampliado/inserção circular (INSERCAO_CIRCULAR) e embalagem NÃO reprovam secundárias; preserve esse código mesmo quando aprovada. Montagem de detalhes do MESMO produto não é vários produtos. Impressão física na embalagem não é banner.
EXEMPLOS QUE SEMPRE REPROVAM, em qualquer foto: (1) marca d'água semitransparente ou discreta, mesmo clara, pequena ou parcial — no canto, no fundo, em diagonal, nome/site de loja ou texto de banco de imagens — usa MARCA_DAGUA; (2) banner promocional — frase de venda ou slogan (ex.: "Compre já", "Qualidade garantida", "Transforme sua rotina"), selo de vantagem ou arte de divulgação — usa BANNER_PROMOCIONAL, mesmo que a foto também traga especificações. Especificação objetiva (medida, potência, voltagem, material, nome de função) não é frase de venda.
Nome solto sobreposto à foto que não descreve o produto (nome de loja, fornecedor ou site), mesmo pequeno e claro, é MARCA_DAGUA, não especificação. Nomes já confirmados como marca d'água quando aparecem sobrepostos: ${KNOWN_WATERMARK_NAMES.join(', ')}.
Se não conseguir analisar com segurança, retorne inconclusiva/FALHA_TECNICA/DESCONHECIDA. Falha técnica nunca reprova. Nunca invente evidência.
Responda APENAS JSON com exatamente veredito, codigo, localizacao, justificativa.
veredito: aprovada/reprovada/inconclusiva.
codigo: ${[...IMAGE_REJECTION_CODES, 'FALHA_TECNICA', 'OK'].join('/')}.
localizacao: SOBRE_FOTO/PRODUTO/EMBALAGEM/IMAGEM_INTEIRA/FUNDO_LIMPO/DESCONHECIDA.
justificativa: frase curta não vazia, máximo 400 caracteres. Localize a evidência real. Aprovada sem característica especial: OK. Nunca devolva prosa fora do JSON.`;

export function imageVisionPrompt(primary = false): string {
  return IMAGE_VISION_PROMPT + (primary
    ? '\nEsta é a FOTO PRINCIPAL, com regras MAIS ESTRITAS que substituem as permissões das secundárias: só o produto em fundo branco ou limpo; sem texto/logo sobreposto, borda, colagem, inserção/detalhe adicionado nem embalagem. Embalagem usa EMBALAGEM_PRINCIPAL; fundo inadequado usa FUNDO_INADEQUADO; borda usa BORDA. Medida/texto/inserção usam seu código próprio e reprovam. Para aprovar exija OK/FUNDO_LIMPO. O tamanho mínimo 500x500 é verificado por leitura dos bytes, não estime pixels visualmente.'
    : '\nEsta é FOTO SECUNDÁRIA. Especificações, medidas, detalhe ampliado e embalagem são permitidos. SOBREPOSICAO_TEXTO só pode significar especificação permitida; promoção deve usar BANNER_PROMOCIONAL, preço/frete PRECO_FRETE, contato CONTATO_QR.');
}