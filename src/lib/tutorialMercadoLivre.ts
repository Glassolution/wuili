/**
 * Tutorial gravado da ativação da conta de vendedor no Mercado Livre.
 *
 * Fica num módulo próprio porque o mesmo vídeo é aberto em dois lugares: no
 * passo 2 do `MLAccountVerificationModal` e na mensagem do Atlas que explica a
 * recusa da publicação. Duplicar a URL do player faria uma das duas apontar
 * para um vídeo velho no dia em que ele for regravado.
 */
export const TUTORIAL_CONTA_VENDEDOR = {
  src: "https://player.vimeo.com/video/1220476544?badge=0&autopause=0&player_id=0&app_id=58479",
  /** Proporção que o embed do Vimeo entrega junto com o código. */
  aspectPadding: "67.75%",
  title: "Como ativar sua conta de vendedor",
  description:
    "Passo a passo em vídeo para verificar a conta e ativar o modo vendedor no Mercado Livre.",
} as const;
