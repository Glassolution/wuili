/** Version evidence without changing the legacy cache schema or its rows. */
export const IMAGE_CRITERION_VERSION = 'physical-labels-v2-2026-11-08';
export const IMAGE_EVIDENCE_PREFIX = `[${IMAGE_CRITERION_VERSION}] `;
export const IMAGE_REJECTION_CODES = ['overlay_text', 'overlay_logo', 'watermark', 'photo_collage', 'no_product'] as const;

export const IMAGE_VISION_PROMPT = `Avalie a fotografia distinguindo o objeto fotografado de elementos adicionados sobre a imagem.
Texto, marca, especificações, etiquetas e rótulos fisicamente impressos ou fixados no produto ou na embalagem original NÃO reprovam.
Fotografia da embalagem original não é automaticamente imagem sem produto. Ilustrações e quadros impressos nela não são colagem digital da fotografia.
Reprove somente por evidência visual clara de texto/selo/logo SOBREPOSTO à fotografia (promoção, preço, telefone, marca-d'água, logo de loja, anotações), colagem digital de fotografias ou imagem sem produto nem embalagem original.
Linhas e números de medidas digitais sobrepostos reprovam; medidas impressas no produto/embalagem não. Marca física do fabricante não reprova.
Se não conseguir ver, analisar ou distinguir com segurança, retorne inconclusiva. Falha técnica nunca é reprovação. Nunca invente evidência.
Responda APENAS JSON com {"clean":true|false|null,"code":"approved|overlay_text|overlay_logo|watermark|photo_collage|no_product|inconclusive","location":"physical_product|physical_packaging|photo_overlay|whole_image|unknown","reason":"justificativa visual breve"}.
Para clean=false use overlay_text/overlay_logo/watermark com location=photo_overlay; photo_collage/no_product com location=whole_image. Para clean=true use code=approved; para dúvida use clean=null, code=inconclusive, location=unknown.`;