import { useState, type CSSProperties } from "react";

/*
  Imagem da landing em WebP, com várias larguras.

  Existe porque os PNGs originais têm 1,5 a 2 MB cada. Num celular simples com
  4G, baixar um PNG desses é a diferença entre a página aparecer e a pessoa
  desistir antes de ver qualquer coisa. As versões são geradas por
  `scripts/otimizar-imagens-landing.sh` e vivem em public/landing/.

  Por que não usa <picture> com <source type="image/webp">:

  o React cria o <img> já com o src do PNG e só depois o prende ao <picture>.
  Nesse intervalo o navegador pode começar a baixar o PNG — foi o que aconteceu
  com o logo, onde os 146 KB saíam da rede mesmo com o WebP declarado. Com o
  srcSet direto no <img> isso não existe: só o WebP é pedido.

  O PNG original fica como rede de segurança no onError, para navegador sem
  suporte a WebP. Na prática é raro: WebP funciona em Android desde o 4.2 e no
  iPhone desde o iOS 14.
*/

type Props = {
  /** Base dos arquivos gerados, sem largura nem extensão: "pessoa-01". */
  base: string;
  /** Larguras geradas pelo script, em px. */
  larguras: number[];
  /** Caminho do PNG original, usado só se o WebP falhar. */
  original: string;
  alt: string;
  /** Regra de escolha da largura. Ex.: "100vw" ou "(min-width: 640px) 50vw, 100vw". */
  sizes: string;
  className?: string;
  style?: CSSProperties;
  /**
   * A foto do topo é o maior elemento da primeira tela: ela carrega na hora e
   * com prioridade. Todo o resto espera a pessoa rolar até lá.
   */
  prioritaria?: boolean;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
  "aria-hidden"?: boolean;
};

export function ImagemResponsiva({
  base,
  larguras,
  original,
  alt,
  sizes,
  className,
  style,
  prioritaria = false,
  width,
  height,
  onLoad,
  onError,
  ...resto
}: Props) {
  const [usarOriginal, setUsarOriginal] = useState(false);

  const menorLargura = Math.min(...larguras);
  const srcSet = larguras.map((largura) => `/landing/${base}-${largura}.webp ${largura}w`).join(", ");

  return (
    <img
      src={usarOriginal ? original : `/landing/${base}-${menorLargura}.webp`}
      srcSet={usarOriginal ? undefined : srcSet}
      sizes={usarOriginal ? undefined : sizes}
      alt={alt}
      width={width}
      height={height}
      loading={prioritaria ? "eager" : "lazy"}
      // fetchPriority só entrou na tipagem do React 19; aqui ainda é React 18.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ fetchpriority: prioritaria ? "high" : "auto" } as any)}
      decoding={prioritaria ? "sync" : "async"}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={() => {
        // Primeira falha: tenta o PNG. Se ele também falhar, avisa quem chamou
        // (o carrossel do topo usa isso para pular a foto quebrada).
        if (!usarOriginal) {
          setUsarOriginal(true);
          return;
        }
        onError?.();
      }}
      {...resto}
    />
  );
}
