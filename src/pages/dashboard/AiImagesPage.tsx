import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,

  Crop,
  Download,
  Expand,
  Loader2,
  Megaphone,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import AiImageProgress from "@/components/dashboard/AiImageProgress";
import { useCharacterLibrary } from "@/components/dashboard/AICharacterCreator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { proxyImageList } from "@/lib/imageProxy";
import { useAiImageQuota } from "@/hooks/useAiImageQuota";

/**
 * Criação de imagem de produto com IA.
 *
 * Substituiu a tela de Relatórios. Serve para o lojista gerar UMA foto — de um
 * produto dele (upload) ou de um produto do catálogo Velo —, opcionalmente com
 * um dos influencers criados na tela do TikTok segurando/usando o item.
 *
 * O prompt aceita duas fichas: `@produto` e `@avatar`. Elas aparecem coloridas
 * na caixa e são trocadas pelo produto e pelo personagem escolhidos na hora de
 * montar a instrução enviada para a IA.
 */

// --- Paleta desta tela ------------------------------------------------------
// Azul elétrico da identidade da Velo (ver CLAUDE.md §10), no lugar do roxo.
const BLUE = "#2563EB";
// As duas fichas do prompt precisam continuar distinguíveis entre si: @produto
// segue no rosa e @avatar acompanha o azul da marca.
const PRODUCT_TOKEN = "#E0367E";
const AVATAR_TOKEN = BLUE;

type Modo = "produto" | "anuncio";

type ProdutoEscolhido = {
  id: string;
  title: string;
  image: string;
  origem: "catalogo" | "upload";
};

const ESTILOS = [
  "Automático",
  "Estúdio branco",
  "Lifestyle em casa",
  "Externa com luz natural",
  "Fundo colorido",
  "Close no detalhe",
];

const IDIOMAS = [
  { id: "pt-BR", label: "Português", bandeira: "🇧🇷" },
  { id: "en-US", label: "Inglês", bandeira: "🇺🇸" },
  { id: "es", label: "Espanhol", bandeira: "🇪🇸" },
];

const PROPORCOES = [
  { id: "auto", label: "Automático" },
  { id: "1:1", label: "Quadrado 1:1" },
  { id: "4:5", label: "Feed 4:5" },
  { id: "9:16", label: "Story 9:16" },
];

const EXEMPLOS_DE_PROMPT = [
  "Uma imagem de @produto usada por @avatar nas mãos",
  "Foto profissional de @produto em fundo claro, com luz de estúdio",
  "@avatar segurando @produto em uma cena lifestyle realista",
  "Anúncio estático de @produto com composição premium e foco no benefício",
];

type Ficha = { texto: string; cor: string };

const escaparRegex = (valor: string) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Encurta o nome do item para virar uma ficha legível no prompt: nomes de
 * catálogo são enormes e o destaque tomava a linha inteira.
 */
const nomeCurto = (valor: string, limite = 22) => {
  const limpo = valor.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const palavras = limpo.split(" ");
  let saida = "";
  for (const palavra of palavras) {
    if (!saida) {
      saida = palavra.slice(0, limite);
      continue;
    }
    if (`${saida} ${palavra}`.length > limite) break;
    saida = `${saida} ${palavra}`;
  }
  return saida;
};

/**
 * Pinta as fichas dentro do texto. O destaque não usa padding nem margem: o
 * "respiro" vem de um box-shadow com spread, então as métricas do texto ficam
 * idênticas às do textarea transparente e o cursor continua alinhado.
 */
const renderPromptParts = (texto: string, fichas: Ficha[], subdued = false) => {
  const alvos = fichas.filter((f) => f.texto.trim().length > 1).sort((a, b) => b.texto.length - a.texto.length);
  const partes = alvos.length
    ? texto.split(new RegExp(`(${alvos.map((f) => escaparRegex(f.texto)).join("|")})`, "g"))
    : [texto];

  return partes.map((parte, indice) => {
    const ficha = alvos.find((f) => f.texto === parte);
    if (ficha) {
      return (
        <span
          key={indice}
          className="rounded-[5px]"
          style={{
            backgroundColor: `${ficha.cor}1A`,
            color: ficha.cor,
            boxShadow: `0 0 0 3px ${ficha.cor}1A`,
          }}
        >
          {parte}
        </span>
      );
    }
    return (
      <span key={indice} className={subdued ? "text-black/42" : undefined}>
        {parte}
      </span>
    );
  });
};


/** Caixa flutuante dos seletores da barra de ferramentas. */
const Popover = ({
  aberto,
  onFechar,
  children,
  largura = 280,
}: {
  aberto: boolean;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: number;
}) => (
  <AnimatePresence>
    {aberto ? (
      <>
        <div className="fixed inset-0 z-40" onClick={onFechar} aria-hidden />
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-[calc(100%+10px)] left-0 z-50 max-h-[320px] overflow-y-auto rounded-[14px] border border-black/[0.07] bg-white p-2 shadow-[0_20px_50px_rgba(10,10,10,0.16)]"
          style={{ width: largura }}
        >
          {children}
        </motion.div>
      </>
    ) : null}
  </AnimatePresence>
);

/** Botão da barra de ferramentas (Produto, Avatar, Estilo…). */
const ToolButton = ({
  icon: Icon,
  label,
  ativo,
  onClick,
  emoji,
}: {
  icon?: typeof Tag;
  label: string;
  ativo?: boolean;
  onClick: () => void;
  emoji?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-black/10 ${
      ativo
        ? "border-[#0A0A0A]/15 bg-[#0A0A0A]/[0.04] text-[#101114]"
        : "border-black/[0.08] bg-white text-[#101114] hover:-translate-y-[1px] hover:border-black/[0.16] hover:shadow-[0_4px_12px_rgba(10,10,10,0.06)]"
    }`}
  >
    {emoji ? <span className="text-[15px] leading-none">{emoji}</span> : null}
    {Icon ? <Icon size={15} strokeWidth={1.9} className="text-black/55" /> : null}
    <span className="max-w-[150px] truncate">{label}</span>
  </button>
);

const AiImagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { characters, urls } = useCharacterLibrary();
  const { quota, aplicarQuotaDoServidor } = useAiImageQuota();

  const [modo, setModo] = useState<Modo>("produto");
  const [prompt, setPrompt] = useState("");
  const [promptFocused, setPromptFocused] = useState(false);
  const [exemploIndex, setExemploIndex] = useState(0);
  const [exemploDigitado, setExemploDigitado] = useState("");
  const [faseExemplo, setFaseExemplo] = useState<"digitando" | "pausando" | "apagando">("digitando");
  const [produto, setProduto] = useState<ProdutoEscolhido | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [estilo, setEstilo] = useState(ESTILOS[0]);
  const [idioma, setIdioma] = useState(IDIOMAS[0]);
  const [proporcao, setProporcao] = useState(PROPORCOES[0]);

  const [menu, setMenu] = useState<null | "produto" | "avatar" | "estilo" | "idioma" | "proporcao">(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogo, setCatalogo] = useState<ProdutoEscolhido[]>([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [resumo, setResumo] = useState<{ prompt: string; produto?: string; avatar?: string } | null>(null);
  const [visualizando, setVisualizando] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const avatar = useMemo(() => characters.find((c) => c.id === avatarId) ?? null, [characters, avatarId]);
  const avatarSelecionadoUrl = avatar?.image_url ? urls[avatar.image_url] : undefined;

  useEffect(() => {
    // A animação de exemplo é só um convite: assim que o usuário escreve ou
    // escolhe produto/avatar, ela para de vez.
    if (prompt || produto || avatar) return;
    if (reduceMotion) {
      setExemploDigitado(EXEMPLOS_DE_PROMPT[exemploIndex]);
      return;
    }

    const exemploAtual = EXEMPLOS_DE_PROMPT[exemploIndex];
    const tempo =
      faseExemplo === "pausando"
        ? 1250
        : faseExemplo === "apagando"
          ? 22
          : 42;

    const timer = window.setTimeout(() => {
      if (faseExemplo === "digitando") {
        if (exemploDigitado.length < exemploAtual.length) {
          setExemploDigitado(exemploAtual.slice(0, exemploDigitado.length + 1));
        } else {
          setFaseExemplo("pausando");
        }
        return;
      }

      if (faseExemplo === "pausando") {
        setFaseExemplo("apagando");
        return;
      }

      if (exemploDigitado.length > 0) {
        setExemploDigitado(exemploAtual.slice(0, exemploDigitado.length - 1));
      } else {
        setExemploIndex((current) => (current + 1) % EXEMPLOS_DE_PROMPT.length);
        setFaseExemplo("digitando");
      }
    }, tempo);

    return () => window.clearTimeout(timer);
  }, [exemploDigitado, exemploIndex, faseExemplo, reduceMotion, prompt, produto, avatar]);

  // Catálogo Velo — carregado quando o seletor de produto abre pela primeira vez.
  useEffect(() => {
    if (menu !== "produto" || catalogo.length > 0) return;
    let ativo = true;
    setCarregandoCatalogo(true);
    void (async () => {
      const { data } = await supabase
        .from("catalog_products")
        .select("id,title,images")
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .limit(240);
      if (!ativo) return;
      const lista = (data ?? []).flatMap((item) => {
        const [imagem] = proxyImageList(
          Array.isArray(item.images)
            ? (item.images.filter((i) => typeof i === "string") as string[])
            : [],
        );
        if (!imagem) return [];
        return [{ id: item.id, title: item.title, image: imagem, origem: "catalogo" as const }];
      });
      setCatalogo(lista);
      setCarregandoCatalogo(false);
    })();
    return () => {
      ativo = false;
    };
  }, [menu, catalogo.length]);

  // A ficha carrega uma versão curta do nome escolhido ("@Depilador a Laser")
  // em vez do título inteiro do catálogo, que estourava a linha.
  const fichaProduto = produto ? `@${nomeCurto(produto.title)}` : "@produto";
  const fichaAvatar = avatar ? `@${nomeCurto(avatar.name)}` : "@avatar";


  /**
   * Coloca (ou atualiza) a ficha no prompt. Se já existia uma ficha do mesmo
   * tipo, ela é substituída pelo novo nome em vez de duplicar.
   */
  const aplicarFicha = (anterior: string, nova: string, tipo: "produto" | "avatar", fichaProdutoAtual = fichaProduto) =>
    setPrompt((atual) => {
      if (anterior !== nova && atual.includes(anterior)) return atual.split(anterior).join(nova);
      if (atual.includes(nova)) return atual;
      const base = atual.trim();
      if (base) return `${base} ${nova}`;
      if (tipo === "avatar") return `${nova} segurando ${fichaProdutoAtual}`;
      return `Foto profissional de ${nova} em fundo claro, com luz de estúdio`;
    });

  const removerFicha = (ficha: string) =>
    setPrompt((atual) => atual.split(ficha).join("").replace(/\s{2,}/g, " ").trim());

  const escolherUpload = (arquivo: File) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const titulo = arquivo.name.replace(/\.[^.]+$/, "");
      setProduto({
        id: "upload",
        title: titulo,
        image: String(leitor.result),
        origem: "upload",
      });
      aplicarFicha(fichaProduto, `@${nomeCurto(titulo)}`, "produto");
      setMenu(null);
    };
    leitor.readAsDataURL(arquivo);
  };

  /** Texto do prompt com as fichas do produto e do avatar destacadas. */
  const fichasAtivas = useMemo<Ficha[]>(
    () => [
      { texto: fichaProduto, cor: PRODUCT_TOKEN },
      { texto: "@produto", cor: PRODUCT_TOKEN },
      { texto: fichaAvatar, cor: AVATAR_TOKEN },
      { texto: "@avatar", cor: AVATAR_TOKEN },
    ],
    [fichaProduto, fichaAvatar],
  );
  const promptDestacado = useMemo(() => renderPromptParts(prompt, fichasAtivas), [prompt, fichasAtivas]);
  const exemploDestacado = useMemo(
    () =>
      renderPromptParts(
        exemploDigitado,
        [
          { texto: "@produto", cor: PRODUCT_TOKEN },
          { texto: "@avatar", cor: AVATAR_TOKEN },
        ],
        true,
      ),
    [exemploDigitado],
  );
  const catalogoFiltrado = useMemo(() => {
    const termo = catalogSearch.trim().toLowerCase();
    if (!termo) return catalogo;
    return catalogo.filter((item) => item.title.toLowerCase().includes(termo));
  }, [catalogSearch, catalogo]);

  const gerar = async () => {
    if (!produto) {
      veloToast.error("Escolha um produto — do catálogo Velo ou uma foto sua.");
      setMenu("produto");
      return;
    }
    if (!user?.id) {
      veloToast.error("Entre na sua conta para gerar imagens.");
      return;
    }

    setGerando(true);
    setResultado(null);
    const promptFinal = prompt.trim() || EXEMPLOS_DE_PROMPT[exemploIndex];
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-image", {
        body: {
          prompt: promptFinal,
          mode: modo,
          style: estilo,
          language: idioma.id,
          aspectRatio: proporcao.id,
          productTitle: produto.title,
          productImageUrl: produto.origem === "catalogo" ? produto.image : undefined,
          productImageDataUrl: produto.origem === "upload" ? produto.image : undefined,
          avatarName: avatar?.name,
          avatarImageUrl: avatar?.image_url ? urls[avatar.image_url] : undefined,
        },
      });
      if (error) throw error;
      const resposta = data as { imageDataUrl?: string; error?: string; quota?: unknown } | null;
      if (resposta?.quota) aplicarQuotaDoServidor(resposta.quota);
      const imagem = resposta?.imageDataUrl;
      if (!imagem) throw new Error(resposta?.error ?? "A IA não devolveu imagem.");
      setResultado(imagem);
      setResumo({
        prompt: promptFinal,
        produto: produto?.title ? nomeCurto(produto.title, 40) : undefined,
        avatar: avatar?.name ? nomeCurto(avatar.name, 28) : undefined,
      });
      veloToast.success("Imagem pronta.");
    } catch (erro) {
      console.error("Falha ao gerar a imagem:", erro);
      veloToast.error(
        erro instanceof Error && erro.message ? erro.message : "Não foi possível gerar a imagem agora.",
      );
    } finally {
      setGerando(false);
    }
  };

  // View dedicada de carregamento — substitui a tela de configuração
  if (gerando) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col text-[#101114]">
        <DashboardPageHeader title="Imagens com IA" titleClassName="!font-bold" />
        <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[20px] border border-black/[0.05] bg-gradient-to-b from-[#F7F7F9] via-[#FCFCFD] to-white px-5 py-14">
          <AiImageProgress
            comAvatar={Boolean(avatar)}
            modo={modo}
            produtoTitulo={produto ? nomeCurto(produto.title, 28) : undefined}
          />
        </div>
      </div>
    );
  }

  // View dedicada de resultado — toolbar no topo + duas colunas fixas
  if (resultado) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col text-[#101114]">
        <div className="flex items-center gap-2 border-b border-black/[0.07] px-1 pb-3">
          <button
            type="button"
            onClick={() => {
              setResultado(null);
              setResumo(null);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-black/60 transition hover:bg-black/[0.05] hover:text-[#101114]"
            aria-label="Voltar para a configuração"
          >
            <ArrowLeft size={18} />
          </button>
          <p className="text-[15px] font-bold tracking-[-0.02em]">Imagem gerada</p>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVisualizando(true)}
              className="flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 text-[13px] font-semibold transition hover:bg-black/[0.04]"
            >
              <Expand size={14} /> Visualizar
            </button>
            <a
              href={resultado}
              download={`${produto?.title ?? "produto"}.png`}
              className="flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 text-[13px] font-semibold transition hover:bg-black/[0.04]"
            >
              <Download size={14} /> Baixar
            </a>
            <button
              type="button"
              onClick={() => void gerar()}
              className="flex h-9 items-center gap-2 rounded-full bg-[#101114] px-3.5 text-[13px] font-semibold text-white transition hover:bg-black"
            >
              <RefreshCw size={14} /> Regenerar
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 pt-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Coluna esquerda: detalhes da imagem atual */}
          <div className="min-h-0 overflow-y-auto rounded-[16px] border border-black/[0.07] bg-white p-4">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-black/40">Detalhes</p>
            <dl className="mt-3 space-y-2.5">
              {resumo?.produto ? (
                <div className="flex items-start gap-2 text-[13px]">
                  <dt className="w-[62px] shrink-0 text-black/45">Produto</dt>
                  <dd className="min-w-0 flex-1 font-medium text-[#101114]">{resumo.produto}</dd>
                </div>
              ) : null}
              {resumo?.avatar ? (
                <div className="flex items-start gap-2 text-[13px]">
                  <dt className="w-[62px] shrink-0 text-black/45">Avatar</dt>
                  <dd className="min-w-0 flex-1 font-medium text-[#101114]">{resumo.avatar}</dd>
                </div>
              ) : null}
              <div className="flex items-start gap-2 text-[13px]">
                <dt className="w-[62px] shrink-0 text-black/45">Estilo</dt>
                <dd className="min-w-0 flex-1 font-medium text-[#101114]">{estilo}</dd>
              </div>
            </dl>

            {resumo?.prompt ? (
              <div className="mt-3 rounded-[12px] border border-black/[0.06] bg-[#F7F7F9] p-3">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-black/40">Prompt</p>
                <p className="mt-1 text-[13px] leading-[1.55] text-black/70">{resumo.prompt}</p>
              </div>
            ) : null}
          </div>

          {/* Coluna direita: imagem em destaque */}
          <button
            type="button"
            onClick={() => setVisualizando(true)}
            className="flex min-h-0 items-center justify-center overflow-hidden rounded-[16px] border border-black/[0.07] bg-white p-3 outline-none focus-visible:ring-2 focus-visible:ring-black/10"
            aria-label="Abrir imagem em tamanho maior"
          >
            <img
              src={resultado}
              alt="Imagem de produto gerada por IA"
              className="max-h-full w-auto max-w-full rounded-[12px] object-contain"
            />
          </button>
        </div>

        <AnimatePresence>
          {visualizando ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVisualizando(false)}
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6"
            >
              <img
                src={resultado}
                alt="Imagem gerada em tamanho maior"
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] max-w-[90vw] rounded-[16px] object-contain"
              />
              <button
                type="button"
                onClick={() => setVisualizando(false)}
                className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#101114] transition hover:bg-white"
                aria-label="Fechar visualização"
              >
                <X size={18} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col text-[#101114]">

      <DashboardPageHeader title="Imagens com IA" titleClassName="!font-bold" />

      {/* Moldura como na referência: contorno fino definindo a forma, painel um
          tom acima do fundo da página (#F4F4F6) e degradê até o branco. Cresce
          para ocupar a altura livre, então a base arredondada fica embaixo como
          na referência, em vez de terminar logo depois do último texto. */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-[20px] border border-black/[0.05] bg-gradient-to-b from-[#F7F7F9] via-[#FCFCFD] to-white">
        <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col items-center px-5 py-14 sm:py-20">
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Sparkles size={26} strokeWidth={1.6} style={{ color: AVATAR_TOKEN }} />
          </motion.span>

          <h2 className="mt-3.5 text-center text-[18px] font-bold tracking-[-0.03em] sm:text-[20px]">
            Crie imagens de produto com IA
          </h2>
          <p className="mt-1.5 text-center text-[13.5px] text-black/50">
            Fotos profissionais do seu produto, geradas por inteligência artificial.
          </p>

          {/* Modo: imagem de produto ou anúncio estático */}
          <div className="mt-7 grid w-full max-w-[820px] grid-cols-2 gap-1 rounded-[11px] border border-black/[0.06] bg-[#F4F4F6] p-1">
            {([
              { id: "produto" as const, label: "Imagens de produto", icon: Tag },
              { id: "anuncio" as const, label: "Anúncios estáticos", icon: Megaphone },
            ]).map(({ id, label, icon: Icon }) => {
              const ativo = modo === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModo(id)}
                  className={`relative flex h-9 items-center justify-center gap-2 rounded-[8px] text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black/10 ${
                    ativo ? "text-[#101114]" : "text-black/45 hover:text-[#101114]"
                  }`}
                >
                  {ativo ? (
                    <motion.span
                      layoutId="ai-images-mode"
                      className="absolute inset-0 rounded-[8px] border border-black/[0.06] bg-white shadow-[0_2px_6px_rgba(10,10,10,0.06)]"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <Icon size={15} className="relative z-10" />
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Caixa de prompt + barra de ferramentas */}
          <div className="mt-5 w-full max-w-[820px] rounded-[16px] border border-black/[0.08] bg-white shadow-[0_2px_10px_rgba(10,10,10,0.05)]">
            <div className="relative min-h-[76px] px-4 pt-3.5">
              {/* Camada de destaque atrás do textarea transparente: é o que pinta
                  @produto e @avatar sem precisar de editor rico. */}
              <div
                aria-hidden
                className="pointer-events-none whitespace-pre-wrap break-words text-[14px] leading-[1.6] text-[#101114]"
              >
                {prompt ? (
                  <>
                    {promptDestacado}
                    {prompt.endsWith("\n") ? " " : null}
                  </>
                ) : !promptFocused ? (
                  <span className="inline">
                    {exemploDestacado}
                    <span className="ml-0.5 inline-block h-[1.05em] w-px translate-y-[2px] animate-pulse bg-[#2563EB]" />
                  </span>
                ) : null}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setPromptFocused(true)}
                onBlur={() => setPromptFocused(false)}
                spellCheck={false}
                aria-label="Descreva a imagem"
                placeholder=""
                className="absolute inset-0 h-full w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] leading-[1.6] text-transparent caret-[#101114] outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-black/[0.06] px-3 py-2.5 lg:flex-nowrap">
              {/* Produto */}
              <div className="relative">
                {produto ? (
                  <div className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-white py-0.5 pl-2 pr-1.5 text-[#101114]">
                    <button
                      type="button"
                      onClick={() => setMenu(menu === "produto" ? null : "produto")}
                      className="flex min-w-0 items-center gap-1.5 rounded-full pr-1 outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                      aria-label={`Produto selecionado: ${produto.title}`}
                    >
                      <Tag size={15} strokeWidth={1.9} className="shrink-0 text-black/55" />
                      <span className="max-w-[150px] truncate text-[12.5px] font-semibold">
                        {nomeCurto(produto.title)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProduto(null);
                        removerFicha(fichaProduto);
                      }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/70 transition hover:bg-black/[0.06] hover:text-black"
                      aria-label="Remover produto"
                    >
                      <X size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                ) : (
                  <ToolButton
                    icon={Tag}
                    label="Produto"
                    onClick={() => setMenu(menu === "produto" ? null : "produto")}
                  />
                )}

                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (arquivo) escolherUpload(arquivo);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Avatar */}
              <div className="relative">
                {avatar ? (
                  <div className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-white py-0.5 pl-1.5 pr-1.5 text-[#101114]">
                    <button
                      type="button"
                      onClick={() => setMenu(menu === "avatar" ? null : "avatar")}
                      className="flex min-w-0 items-center gap-2 rounded-full pr-1 outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                      aria-label={`Avatar selecionado: ${avatar.name}`}
                    >
                      {avatarSelecionadoUrl ? (
                        <img
                          src={avatarSelecionadoUrl}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-black/[0.06]"
                        />
                      ) : (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F1F1EF]">
                          <UserRound size={14} className="text-black/50" />
                        </span>
                      )}
                      <span className="max-w-[130px] truncate text-[12.5px] font-semibold">
                        {nomeCurto(avatar.name)}
                      </span>

                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarId(null);
                        removerFicha(fichaAvatar);
                      }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/70 transition hover:bg-black/[0.06] hover:text-black"
                      aria-label="Remover avatar"
                    >
                      <X size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                ) : (
                  <ToolButton
                    icon={UserRound}
                    label="Avatar"
                    onClick={() => setMenu(menu === "avatar" ? null : "avatar")}
                  />
                )}
              </div>

              {/* Estilo */}
              <div className="relative">
                <ToolButton
                  icon={Palette}
                  label={estilo === ESTILOS[0] ? "Estilo" : estilo}
                  ativo={estilo !== ESTILOS[0]}
                  onClick={() => setMenu(menu === "estilo" ? null : "estilo")}
                />
                <Popover aberto={menu === "estilo"} onFechar={() => setMenu(null)} largura={240}>
                  {ESTILOS.map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => {
                        setEstilo(opcao);
                        setMenu(null);
                      }}
                      className="flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-medium transition hover:bg-black/[0.04]"
                    >
                      {opcao}
                      {estilo === opcao ? <Check size={15} style={{ color: BLUE }} /> : null}
                    </button>
                  ))}
                </Popover>
              </div>

              {/* Idioma */}
              <div className="relative">
                <ToolButton
                  emoji={idioma.bandeira}
                  label={idioma.label}
                  onClick={() => setMenu(menu === "idioma" ? null : "idioma")}
                />
                <Popover aberto={menu === "idioma"} onFechar={() => setMenu(null)} largura={200}>
                  {IDIOMAS.map((opcao) => (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => {
                        setIdioma(opcao);
                        setMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-medium transition hover:bg-black/[0.04]"
                    >
                      <span className="text-[15px]">{opcao.bandeira}</span>
                      {opcao.label}
                      {idioma.id === opcao.id ? <Check size={15} className="ml-auto" style={{ color: BLUE }} /> : null}
                    </button>
                  ))}
                </Popover>
              </div>

              {/* Proporção */}
              <div className="relative">
                <ToolButton
                  icon={Crop}
                  label={proporcao.label}
                  onClick={() => setMenu(menu === "proporcao" ? null : "proporcao")}
                />
                <Popover aberto={menu === "proporcao"} onFechar={() => setMenu(null)} largura={220}>
                  {PROPORCOES.map((opcao) => (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => {
                        setProporcao(opcao);
                        setMenu(null);
                      }}
                      className="flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-medium transition hover:bg-black/[0.04]"
                    >
                      {opcao.label}
                      {proporcao.id === opcao.id ? <Check size={15} style={{ color: BLUE }} /> : null}
                    </button>
                  ))}
                </Popover>
              </div>

              <button
                type="button"
                onClick={() => void gerar()}
                disabled={gerando}
                className="velo-prime-button velo-prime-button--blue ml-auto h-8 shrink-0 gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-black/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gerando ? <Loader2 size={15} className="animate-spin" /> : null}
                Criar
                {gerando ? null : <ArrowRight size={15} />}
              </button>
            </div>
          </div>




          {/* Contagem do plano, no lugar das duas descrições que ficavam aqui.
              O número vem do consumo real registrado a cada geração. */}
          {!quota.carregando && !quota.ilimitado ? (
            <p className="mt-3 flex w-full max-w-[820px] items-center justify-end gap-1 text-[12.5px] text-black/45">
              <span className="font-semibold text-[#101114]">{quota.restantes}</span>
              <span>{quota.restantes === 1 ? "imagem restante este mês" : "imagens restantes este mês"}</span>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={() => navigate("/dashboard/planos")}
                className="font-semibold text-[#2563EB] outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
              >
                Fazer upgrade
              </button>
            </p>
          ) : null}
        </div>
      </div>

      <ProductCatalogModal
        open={menu === "produto"}
        produtos={catalogoFiltrado}
        selectedId={produto?.id}
        loading={carregandoCatalogo}
        search={catalogSearch}
        onSearch={setCatalogSearch}
        onUpload={() => uploadRef.current?.click()}
        onClose={() => setMenu(null)}
        onSelect={(item) => {
          setProduto(item);
          aplicarFicha(fichaProduto, `@${nomeCurto(item.title)}`, "produto", `@${nomeCurto(item.title)}`);
          setMenu(null);
        }}
      />

      <AvatarLibraryModal
        open={menu === "avatar"}
        characters={characters}
        urls={urls}
        selectedId={avatarId}
        onClose={() => setMenu(null)}
        onClear={() => {
          setAvatarId(null);
          removerFicha(fichaAvatar);
          setMenu(null);
        }}
        onSelect={(id) => {
          setAvatarId(id);
          const nome = characters.find((c) => c.id === id)?.name;
          if (nome) aplicarFicha(fichaAvatar, `@${nomeCurto(nome)}`, "avatar");
          setMenu(null);
        }}
        onCreate={() => {
          setMenu(null);
          navigate("/dashboard/tiktok");
        }}
      />
    </div>
  );
};

const ProductCatalogModal = ({
  open,
  produtos,
  selectedId,
  loading,
  search,
  onSearch,
  onUpload,
  onClose,
  onSelect,
}: {
  open: boolean;
  produtos: ProdutoEscolhido[];
  selectedId?: string;
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  onUpload: () => void;
  onClose: () => void;
  onSelect: (item: ProdutoEscolhido) => void;
}) => (
  <AnimatePresence>
    {open ? (
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={onClose}
      >
        <motion.div
          className="flex h-[min(760px,calc(100svh-32px))] w-full max-w-[980px] flex-col overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.985 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-black/[0.07] px-5 py-4">
            <div>
              <h3 className="text-[18px] font-bold text-[#101114]">Escolha um produto do catálogo</h3>
              <p className="mt-0.5 text-[12.5px] text-black/45">A imagem será criada usando o produto selecionado.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-b border-black/[0.06] bg-[#FAFAFB] px-5 py-4 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/35" />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Buscar produto no catálogo..."
                className="h-11 w-full rounded-full border border-black/[0.08] bg-white pl-10 pr-4 text-[14px] outline-none transition focus:border-[#2563EB]"
              />
            </label>
            <button
              type="button"
              onClick={onUpload}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold transition hover:border-[#2563EB]/40 hover:text-[#2563EB]"
            >
              <Upload size={16} />
              Enviar foto
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex h-full min-h-[260px] items-center justify-center gap-2 text-[14px] text-black/50">
                <Loader2 size={18} className="animate-spin" />
                Carregando catálogo...
              </div>
            ) : produtos.length === 0 ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-[16px] border border-dashed border-black/[0.12] text-center text-[14px] text-black/45">
                Nenhum produto encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {produtos.map((item) => {
                  const active = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item)}
                      className={`group overflow-hidden rounded-[16px] border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.10)] ${
                        active ? "border-[#2563EB] ring-2 ring-[#2563EB]/15" : "border-black/[0.08]"
                      }`}
                    >
                      <div className="aspect-square bg-[#F5F6F8] p-3">
                        <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain transition group-hover:scale-[1.03]" />
                      </div>
                      <div className="flex min-h-[74px] items-start gap-2 p-3">
                        <p className="line-clamp-2 flex-1 text-[13px] font-semibold leading-5 text-[#101114]">{item.title}</p>
                        {active ? <Check size={17} className="mt-0.5 shrink-0 text-[#2563EB]" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

type CharacterLibrary = ReturnType<typeof useCharacterLibrary>;
type CharacterItem = CharacterLibrary["characters"][number];

const AvatarLibraryModal = ({
  open,
  characters,
  urls,
  selectedId,
  onClose,
  onClear,
  onSelect,
  onCreate,
}: {
  open: boolean;
  characters: CharacterItem[];
  urls: CharacterLibrary["urls"];
  selectedId: string | null;
  onClose: () => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) => (
  <AnimatePresence>
    {open ? (
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={onClose}
      >
        <motion.div
          className="flex h-[min(700px,calc(100svh-32px))] w-full max-w-[900px] flex-col overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.985 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-black/[0.07] px-5 py-4">
            <div>
              <h3 className="text-[18px] font-bold text-[#101114]">Escolha um avatar da biblioteca</h3>
              <p className="mt-0.5 text-[12.5px] text-black/45">Mostrando os avatares criados na página do TikTok.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <button
              type="button"
              onClick={onClear}
              className={`mb-4 flex h-12 w-full items-center justify-center rounded-[14px] border text-[14px] font-semibold transition ${
                selectedId === null ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-black/[0.08] bg-[#FAFAFB] text-[#101114] hover:bg-black/[0.04]"
              }`}
            >
              Sem avatar, usar somente o produto
            </button>

            {characters.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[18px] border border-dashed border-black/[0.12] text-center">
                <UserRound size={34} className="text-black/30" />
                <p className="mt-3 text-[15px] font-semibold text-[#101114]">Nenhum avatar criado ainda.</p>
                <p className="mt-1 max-w-[360px] text-[13px] leading-5 text-black/45">
                  Crie um avatar na página do TikTok para usar em imagens segurando ou usando seus produtos.
                </p>
                <button type="button" onClick={onCreate} className="mt-5 rounded-full bg-[#2563EB] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#1D4ED8]">
                  Criar avatar no TikTok
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {characters.map((character) => {
                  const src = character.image_url ? urls[character.image_url] : undefined;
                  const active = selectedId === character.id;
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => onSelect(character.id)}
                      className={`group overflow-hidden rounded-[16px] border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.10)] ${
                        active ? "border-[#2563EB] ring-2 ring-[#2563EB]/15" : "border-black/[0.08]"
                      }`}
                    >
                      <div className="aspect-[3/4] bg-[#F5F6F8]">
                        {src ? (
                          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <UserRound size={34} className="text-black/25" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 p-3">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#101114]">{character.name}</p>
                        {active ? <Check size={17} className="shrink-0 text-[#2563EB]" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

export default AiImagesPage;
