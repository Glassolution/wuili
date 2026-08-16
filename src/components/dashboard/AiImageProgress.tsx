import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

/**
 * Painel de carregamento da tela "Imagens com IA".
 *
 * A Edge Function devolve a imagem de uma vez só — não existe progresso real
 * por etapa. Então simulamos o roteiro do que a IA está fazendo, com um ritmo
 * calibrado: cada etapa tem uma duração própria e a última fica "em andamento"
 * até a imagem chegar, para nunca dar a sensação de travado em 100%.
 */

type Etapa = { titulo: string; descricao: string; duracao: number };

const montarEtapas = (comAvatar: boolean, modo: "produto" | "anuncio"): Etapa[] => [
  {
    titulo: "Analisando o produto",
    descricao: "Lendo formato, cores e detalhes da foto enviada.",
    duracao: 4200,
  },
  ...(comAvatar
    ? [
        {
          titulo: "Aplicando o avatar",
          descricao: "Preservando rosto, tom de pele e proporções do personagem.",
          duracao: 6000,
        },
      ]
    : []),
  {
    titulo: "Montando a cena",
    descricao:
      modo === "anuncio"
        ? "Compondo o anúncio com espaço livre para o texto."
        : "Definindo enquadramento, fundo e iluminação.",
    duracao: 5200,
  },
  {
    titulo: "Renderizando a imagem",
    descricao: "Gerando em alta resolução e refinando os detalhes finais.",
    duracao: 12000,
  },
];

const formatarTempo = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const minutos = String(Math.floor(total / 60)).padStart(2, "0");
  const segundos = String(total % 60).padStart(2, "0");
  return `${minutos}:${segundos}`;
};

const AiImageProgress = ({
  comAvatar,
  modo,
  produtoTitulo,
}: {
  comAvatar: boolean;
  modo: "produto" | "anuncio";
  produtoTitulo?: string;
}) => {
  const reduceMotion = useReducedMotion();
  const etapas = useMemo(() => montarEtapas(comAvatar, modo), [comAvatar, modo]);
  const [atual, setAtual] = useState(0);
  const [decorrido, setDecorrido] = useState(0);

  useEffect(() => {
    const inicio = Date.now();
    const cronometro = window.setInterval(() => setDecorrido(Date.now() - inicio), 1000);
    return () => window.clearInterval(cronometro);
  }, []);

  useEffect(() => {
    // A última etapa não avança sozinha: ela segura até a imagem chegar.
    if (atual >= etapas.length - 1) return;
    const timer = window.setTimeout(() => setAtual((i) => i + 1), etapas[atual].duracao);
    return () => window.clearTimeout(timer);
  }, [atual, etapas]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 w-full max-w-[820px] overflow-hidden rounded-[16px] border border-black/[0.07] bg-white"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-5 py-3.5">
        <Loader2 size={15} className="animate-spin text-[#101114]" />
        <span className="font-mono text-[13px] font-semibold tabular-nums text-[#101114]">
          {formatarTempo(decorrido)}
        </span>
        <span className="text-[13.5px] text-black/55">
          Criando sua imagem{produtoTitulo ? ` de ${produtoTitulo}` : ""}
        </span>
      </div>

      <ol className="px-5 py-5">
        {etapas.map((etapa, indice) => {
          const concluida = indice < atual;
          const ativa = indice === atual;
          const ultima = indice === etapas.length - 1;

          return (
            <li key={etapa.titulo} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!ultima ? (
                <span
                  aria-hidden
                  className="absolute left-[7px] top-[18px] h-[calc(100%-10px)] w-px bg-black/[0.09]"
                />
              ) : null}

              <span className="relative z-[1] mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {concluida ? (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#101114]">
                    <Check size={9} strokeWidth={3.4} className="text-white" />
                  </span>
                ) : ativa ? (
                  <>
                    <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-[#101114]/25" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#101114]" />
                  </>
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full border border-black/15 bg-white" />
                )}
              </span>

              <div className="min-w-0">
                <p
                  className={`text-[14px] font-semibold transition-colors duration-300 ${
                    ativa ? "text-[#101114]" : concluida ? "text-black/60" : "text-black/28"
                  }`}
                >
                  {etapa.titulo}
                </p>
                {ativa || concluida ? (
                  <p className="mt-0.5 text-[12.5px] leading-snug text-black/45">{etapa.descricao}</p>
                ) : null}

                {ativa ? (
                  <div className="mt-2.5 h-[3px] w-[190px] max-w-full overflow-hidden rounded-full bg-black/[0.07]">
                    <motion.span
                      className="block h-full w-1/3 rounded-full bg-[#101114]"
                      animate={reduceMotion ? undefined : { x: ["-100%", "300%"] }}
                      transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
};

export default AiImageProgress;
