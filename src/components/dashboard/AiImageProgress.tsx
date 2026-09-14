import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ImageIcon, Loader2, Sparkles, UserRound, Wand2, type LucideIcon } from "lucide-react";

/**
 * Painel de carregamento da tela "Imagens com IA".
 *
 * A Edge Function devolve a imagem de uma vez só — não existe progresso real
 * por etapa. Então simulamos o roteiro do que a IA está fazendo, com um ritmo
 * calibrado: cada etapa tem uma duração própria e a última fica "em andamento"
 * até a imagem chegar, para nunca dar a sensação de travado em 100%.
 */

type Etapa = { titulo: string; descricao: string; duracao: number; icone: LucideIcon };

const montarEtapas = (comAvatar: boolean, modo: "produto" | "anuncio"): Etapa[] => [
  {
    titulo: "Analisando o produto",
    descricao: "Lendo formato, cores e detalhes da foto enviada.",
    duracao: 4200,
    icone: ImageIcon,
  },
  ...(comAvatar
    ? [
        {
          titulo: "Aplicando o avatar",
          descricao: "Preservando rosto, tom de pele e proporções do personagem.",
          duracao: 6000,
          icone: UserRound,
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
    icone: Wand2,
  },
  {
    titulo: "Renderizando a imagem",
    descricao: "Gerando em alta resolução e refinando os detalhes finais.",
    duracao: 12000,
    icone: Sparkles,
  },
];

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
      className="w-full max-w-[560px] overflow-hidden rounded-[18px] border border-black/[0.07] bg-white"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-6 py-4">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#101114]">
          <Loader2 size={14} className="animate-spin text-white" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#101114]">
            Criando sua imagem{produtoTitulo ? ` de ${produtoTitulo}` : ""}
          </p>
          <p className="text-[12px] text-black/45">Isso leva menos de um minuto.</p>
        </div>
      </div>

      <ol className="px-6 py-5">
        {etapas.map((etapa, indice) => {
          const concluida = indice < atual;
          const ativa = indice === atual;
          const ultima = indice === etapas.length - 1;
          const Icone = concluida ? Check : etapa.icone;

          return (
            <li key={etapa.titulo} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!ultima ? (
                <span
                  aria-hidden
                  className={`absolute left-[15px] top-[34px] h-[calc(100%-30px)] w-px transition-colors duration-500 ${
                    concluida ? "bg-[#101114]/25" : "bg-black/[0.08]"
                  }`}
                />
              ) : null}

              <motion.span
                animate={
                  ativa && !reduceMotion ? { scale: [1, 1.06, 1] } : { scale: 1 }
                }
                transition={{ duration: 1.8, repeat: ativa ? Infinity : 0, ease: "easeInOut" }}
                className={`relative z-[1] grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[10px] border transition-colors duration-300 ${
                  concluida
                    ? "border-transparent bg-[#101114] text-white"
                    : ativa
                      ? "border-transparent bg-[#101114] text-white"
                      : "border-black/[0.08] bg-[#F7F7F9] text-black/25"
                }`}
              >
                <Icone size={15} strokeWidth={concluida ? 3 : 1.9} />
                {ativa ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-[1] animate-ping rounded-[10px] bg-[#101114]/15"
                  />
                ) : null}
              </motion.span>

              <div className="min-w-0 pt-[3px]">
                <p
                  className={`text-[14.5px] font-bold tracking-[-0.015em] transition-colors duration-300 ${
                    ativa ? "text-[#101114]" : concluida ? "text-black/55" : "text-black/25"
                  }`}
                >
                  {etapa.titulo}
                </p>
                {ativa || concluida ? (
                  <p
                    className={`mt-0.5 text-[12.5px] leading-snug transition-colors duration-300 ${
                      ativa ? "text-black/50" : "text-black/35"
                    }`}
                  >
                    {etapa.descricao}
                  </p>
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
