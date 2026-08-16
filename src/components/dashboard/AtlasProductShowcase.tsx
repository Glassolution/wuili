import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, PackageSearch, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import { supabase, withFreshSupabaseSession } from "@/integrations/supabase/client";
import { formatPrice } from "@/components/dashboard/ProductCard";
import {
  CATEGORIAS_EXCLUIDAS,
  categoriasDoPerfil,
  lerRespostasDoQuiz,
  motivoDaRecomendacao,
  pontuarProdutoParaPerfil,
  resumoDoPerfil,
} from "@/lib/perfilDoQuiz";

/**
 * Vitrine de produtos do guia.
 *
 * Durante o Guia de Iniciante, "Abrir Catálogo" abre esta tela em vez de jogar
 * a pessoa na grade inteira. A ideia é a mesma de um provador: poucos produtos,
 * um de cada vez, já filtrados pelo que ela respondeu no cadastro. A grade
 * completa continua a um clique, para quem quiser olhar tudo.
 */

const QUANTIDADE_DE_CARDS = 6;

type ProdutoDaVitrine = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  imagem: string;
  rating: number | null;
  ordersCount: number | null;
  motivo: string;
};

type LinhaDoCatalogo = {
  id: string;
  title: string | null;
  category: string | null;
  cost_price: number | null;
  images: unknown;
  rating: number | null;
  orders_count: number | null;
};

/** Mesmo tratamento de imagem do catálogo: o campo vem como json ou string. */
const primeiraImagem = (images: unknown): string | null => {
  const lista = Array.isArray(images)
    ? images
    : typeof images === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(images);
            return Array.isArray(parsed) ? parsed : [images];
          } catch {
            return [images];
          }
        })()
      : [];
  const primeira = lista.find((item) => typeof item === "string" && item.startsWith("http"));
  return typeof primeira === "string" ? primeira : null;
};

/** As frases mudam enquanto a busca acontece, para a espera ter progresso. */
const ETAPAS_DA_BUSCA = [
  "Lendo o que você respondeu no cadastro",
  "Cruzando com o catálogo da Velo",
  "Separando os que combinam com você",
];

/** Mesma silhueta do card real, para a troca não dar solavanco de altura. */
const CardEsqueleto = () => (
  <div className="w-full overflow-hidden rounded-[26px] bg-white p-3.5 shadow-[0_22px_52px_rgba(10,10,10,0.24)]">
    <div className="flex items-center gap-2.5">
      <div className="flex flex-1 items-center gap-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className="h-1 flex-1 animate-pulse rounded-full bg-[#E4E4DE]" />
        ))}
      </div>
      <span className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-[#EDEDE8]" />
    </div>
    <div className="mt-3 aspect-[5/4] w-full animate-pulse rounded-[18px] bg-[#F1F1EE]" />
    <div className="mt-3.5 h-4 w-3/4 animate-pulse rounded-full bg-[#EDEDEA]" />
    <div className="mt-2 h-3 w-2/5 animate-pulse rounded-full bg-[#F1F1EE]" />
    <div className="mt-3 h-2.5 w-full animate-pulse rounded-full bg-[#F1F1EE]" />
    <div className="mt-1.5 h-2.5 w-4/5 animate-pulse rounded-full bg-[#F1F1EE]" />
    <div className="mt-4 flex items-center justify-between">
      <div className="h-3 w-24 animate-pulse rounded-full bg-[#F1F1EE]" />
      <div className="h-9 w-28 animate-pulse rounded-full bg-[#EDEDEA]" />
    </div>
  </div>
);

const AtlasProductShowcase = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { vitrineAberta, fecharVitrine, selecionarProduto, enviando, nichoDaVitrine } = useAtlasChat();
  const reduzirMovimento = useReducedMotion();

  const [produtos, setProdutos] = useState<ProdutoDaVitrine[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [etapa, setEtapa] = useState(0);
  // -1 volta, 1 avança: decide de que lado o card entra e sai.
  const [direcao, setDirecao] = useState(1);
  const escolhendoRef = useRef(false);

  const respostas = useMemo(() => lerRespostasDoQuiz(user), [user]);
  const resumo = useMemo(() => resumoDoPerfil(respostas), [respostas]);

  useEffect(() => {
    if (!vitrineAberta) return;
    setIndice(0);
    setEtapa(0);
    setDirecao(1);
    setErro(null);
    setCarregando(true);
    escolhendoRef.current = false;
  }, [vitrineAberta]);

  // Avança as frases da busca enquanto a consulta acontece.
  useEffect(() => {
    if (!vitrineAberta || !carregando) return;
    const id = window.setInterval(() => {
      setEtapa((atual) => Math.min(atual + 1, ETAPAS_DA_BUSCA.length - 1));
    }, 900);
    return () => window.clearInterval(id);
  }, [vitrineAberta, carregando]);

  useEffect(() => {
    if (!vitrineAberta) return;
    let ativo = true;

    const buscar = async () => {
      const abertoEm = Date.now();
      try {
        const categorias = categoriasDoPerfil(respostas);
        // Termos do nicho confirmado na conversa com o Atlas. Eles têm prioridade
        // sobre o perfil do cadastro: o nicho é a escolha mais recente e mais
        // explícita que o usuário fez.
        const termosDoNicho = nichoDaVitrine?.catalogTerms ?? [];

        // Duas consultas: a do nicho declarado e a geral. A geral entra como
        // complemento porque o nicho pode ter poucos produtos com estoque, e a
        // vitrine ficaria com dois cards.
        const base = () =>
          supabase
            .from("catalog_products")
            .select("id,title,category,cost_price,images,rating,orders_count")
            .eq("is_blocked", false)
            .gt("stock_quantity", 0)
            .not("category", "in", `(${CATEGORIAS_EXCLUIDAS.map((c) => `"${c}"`).join(",")})`);

        const [doNichoDaConversa, doNicho, gerais] = await Promise.all([
          termosDoNicho.length > 0
            ? withFreshSupabaseSession(() =>
                base()
                  .or(termosDoNicho.map((termo) => `category.ilike.%${termo}%,title.ilike.%${termo}%`).join(","))
                  .order("orders_count", { ascending: false, nullsFirst: false })
                  .limit(60),
              )
            : Promise.resolve({ data: [], error: null }),
          categorias.length > 0
            ? withFreshSupabaseSession(() => base().in("category", categorias).limit(60))
            : Promise.resolve({ data: [], error: null }),
          withFreshSupabaseSession(() =>
            base().order("orders_count", { ascending: false, nullsFirst: false }).limit(60),
          ),
        ]);

        if (doNichoDaConversa.error) throw doNichoDaConversa.error;
        if (doNicho.error) throw doNicho.error;
        if (gerais.error) throw gerais.error;

        const idsDoNichoDaConversa = new Set(
          ((doNichoDaConversa.data as LinhaDoCatalogo[]) ?? []).map((linha) => linha.id),
        );

        const porId = new Map<string, LinhaDoCatalogo>();
        for (const linha of [
          ...((doNichoDaConversa.data as LinhaDoCatalogo[]) ?? []),
          ...((doNicho.data as LinhaDoCatalogo[]) ?? []),
          ...((gerais.data as LinhaDoCatalogo[]) ?? []),
        ]) {
          if (!porId.has(linha.id)) porId.set(linha.id, linha);
        }

        const selecionados = [...porId.values()]
          .map((linha) => {
            const imagem = primeiraImagem(linha.images);
            if (!imagem) return null;
            const produto = {
              id: linha.id,
              nome: linha.title || "Produto do catálogo Velo",
              categoria: linha.category || "Produto",
              preco: linha.cost_price || 0,
              imagem,
              rating: linha.rating,
              ordersCount: linha.orders_count,
            };
            // O bônus mantém o nicho confirmado no topo sem descartar o perfil:
            // a ordem final é nicho primeiro, e dentro dele o que combina com
            // as respostas do cadastro.
            const bonusDoNicho = idsDoNichoDaConversa.has(linha.id) ? 100 : 0;
            return { produto, pontos: pontuarProdutoParaPerfil(produto, respostas) + bonusDoNicho };
          })
          .filter((item): item is { produto: Omit<ProdutoDaVitrine, "motivo">; pontos: number } => Boolean(item))
          .sort((a, b) => b.pontos - a.pontos)
          .slice(0, QUANTIDADE_DE_CARDS)
          .map(({ produto }) => ({ ...produto, motivo: motivoDaRecomendacao(produto, respostas) }));

        // Piso de tempo: a busca costuma voltar em menos de 300ms e o esqueleto
        // sumiria antes de comunicar qualquer coisa.
        const restante = 1900 - (Date.now() - abertoEm);
        if (restante > 0) await new Promise((resolve) => setTimeout(resolve, restante));

        if (!ativo) return;
        setProdutos(selecionados);
        setCarregando(false);
      } catch (e) {
        if (!ativo) return;
        setErro(e instanceof Error ? e.message : "Não consegui carregar os produtos agora");
        setCarregando(false);
      }
    };

    void buscar();
    return () => {
      ativo = false;
    };
  }, [vitrineAberta, respostas, nichoDaVitrine]);

  const irPara = useCallback(
    (proximo: number) => {
      if (produtos.length === 0) return;
      setDirecao(proximo > indice ? 1 : -1);
      setIndice(((proximo % produtos.length) + produtos.length) % produtos.length);
    },
    [indice, produtos.length],
  );

  const escolher = useCallback(
    async (produto: ProdutoDaVitrine) => {
      if (escolhendoRef.current) return;
      escolhendoRef.current = true;
      fecharVitrine();
      await selecionarProduto({
        id: produto.id,
        nome: produto.nome,
        categoria: produto.categoria,
        preco: produto.preco,
        imagem: produto.imagem,
      });
    },
    [fecharVitrine, selecionarProduto],
  );

  useEffect(() => {
    if (!vitrineAberta) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fecharVitrine();
      if (evento.key === "ArrowRight") irPara(indice + 1);
      if (evento.key === "ArrowLeft") irPara(indice - 1);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [vitrineAberta, fecharVitrine, irPara, indice]);

  const produtoAtual = produtos[indice];

  return (
    <AnimatePresence>
      {vitrineAberta && (
        <motion.div
          key="vitrine-do-atlas"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0A0A0A]/45 px-4 py-8 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Produtos recomendados para você"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) fecharVitrine();
          }}
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative flex w-full max-w-[304px] flex-col"
          >
            <header className="text-white">
              <h2 className="text-[16px] font-semibold leading-[21px] tracking-[-0.03em]">
                Encontrei esses produtos para você
              </h2>
              <p className="mt-0.5 text-[11.5px] leading-[16px] text-white/65">
                {carregando ? ETAPAS_DA_BUSCA[etapa] : nichoDaVitrine ? `${nichoDaVitrine.label} • ${resumo}` : resumo}
              </p>
            </header>

            {/* Espaço extra: as folhas da pilha escapam para fora do card e
                encostariam no subtítulo com a margem padrão. */}
            <div className="relative mt-7">
              {/* Halo difuso atrás do conjunto inteiro, não só do card da
                  frente: é ele que costura a pilha numa massa só e dá o
                  descolamento do fundo. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[#050505]/22 blur-3xl"
              />

              {/* As folhas de trás não são produtos: são a pilha do que ainda
                  vem. Cada uma cai para um lado, em diagonais opostas, para o
                  conjunto parecer um baralho jogado na mesa e não uma pilha
                  alinhada. Elas balançam junto com a troca de card. */}
              {!carregando && produtos.length > 1 && (
                <>
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[26px] bg-[#E4E4DE] shadow-[0_18px_44px_rgba(10,10,10,0.20)]"
                    animate={{ rotate: -7 - direcao * 1.2, x: -20, y: -14, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 210, damping: 26 }}
                  />
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[26px] bg-[#F4F4F0] shadow-[0_18px_44px_rgba(10,10,10,0.20)]"
                    animate={{ rotate: 5.5 - direcao * 1.2, x: 19, y: 11, scale: 0.982 }}
                    transition={{ type: "spring", stiffness: 210, damping: 26 }}
                  />
                </>
              )}

              {/* Sem overflow-hidden: o card é arrastável, e recortar a caixa
                  travava o movimento na borda. O que sai já está transparente
                  antes de alcançar o resto da tela. */}
              <div className="relative">
                {/* popLayout e não "wait": com "wait" o card só entra depois do
                    anterior sair por completo, e a troca piscava vazia. */}
                <AnimatePresence initial={false} mode="popLayout" custom={direcao}>
                  {carregando ? (
                    <motion.div
                      key="esqueleto"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <CardEsqueleto />
                    </motion.div>
                  ) : erro ? (
                    <motion.div
                      key="erro"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-[26px] bg-white p-6 text-center"
                    >
                      <PackageSearch className="mx-auto h-7 w-7 text-[#8E8E87]" strokeWidth={1.7} />
                      <p className="mt-3 text-[13px] font-semibold text-[#111111]">
                        Não consegui carregar os produtos agora
                      </p>
                      <p className="mt-1 text-[12px] text-[#77776F]">{erro}</p>
                    </motion.div>
                  ) : !produtoAtual ? (
                    <motion.div
                      key="vazio"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-[26px] bg-white p-6 text-center"
                    >
                      <PackageSearch className="mx-auto h-7 w-7 text-[#8E8E87]" strokeWidth={1.7} />
                      <p className="mt-3 text-[13px] font-semibold text-[#111111]">
                        Nenhum produto disponível no momento
                      </p>
                      <p className="mt-1 text-[12px] text-[#77776F]">
                        Abra o catálogo completo para procurar do seu jeito.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.article
                      key={produtoAtual.id}
                      custom={direcao}
                      initial={
                        reduzirMovimento
                          ? { opacity: 0 }
                          : { opacity: 0, x: direcao * 108, rotate: direcao * 4, scale: 0.93 }
                      }
                      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                      exit={
                        reduzirMovimento
                          ? { opacity: 0 }
                          : { opacity: 0, x: direcao * -108, rotate: direcao * -4, scale: 0.93 }
                      }
                      // Mola mais macia e com um pouco de massa: o card chega
                      // desacelerando em vez de estalar no lugar.
                      transition={{ type: "spring", stiffness: 240, damping: 28, mass: 0.9 }}
                      // Arrastar de lado troca de produto, como num álbum de
                      // fotos. Os botões continuam para quem prefere clicar.
                      drag={reduzirMovimento || produtos.length < 2 ? false : "x"}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.16}
                      onDragEnd={(_, info) => {
                        const forca = info.offset.x + info.velocity.x * 0.12;
                        if (forca < -70) irPara(indice + 1);
                        else if (forca > 70) irPara(indice - 1);
                      }}
                      className="cursor-grab rounded-[26px] bg-white p-3.5 shadow-[0_22px_52px_rgba(10,10,10,0.24)] active:cursor-grabbing"
                    >
                      {/* Traços de progresso e o fechar dividem a primeira
                          linha: um diz onde você está na sequência, o outro é a
                          saída. */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex flex-1 items-center gap-1">
                          {produtos.map((item, posicao) => (
                            <button
                              key={item.id}
                              type="button"
                              aria-label={`Ver produto ${posicao + 1} de ${produtos.length}`}
                              aria-current={posicao === indice}
                              onClick={() => irPara(posicao)}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                posicao === indice ? "bg-[#111111]" : "bg-[#E4E4DE] hover:bg-[#C9C9C2]"
                              }`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={fecharVitrine}
                          aria-label="Fechar"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDEDE8] text-[#77776F] transition-colors hover:bg-[#E0E0DA] hover:text-[#111111]"
                        >
                          <X size={13} strokeWidth={2.4} />
                        </button>
                      </div>

                      <div className="relative mt-3 aspect-[5/4] w-full overflow-hidden rounded-[18px] bg-[#F5F5F2]">
                        <img
                          src={produtoAtual.imagem}
                          alt={produtoAtual.nome}
                          referrerPolicy="no-referrer"
                          draggable={false}
                          className="h-full w-full select-none object-contain p-4 mix-blend-multiply"
                        />
                      </div>

                      <h3 className="mt-3 line-clamp-2 text-[14px] font-semibold leading-[18px] tracking-[-0.035em] text-[#111111]">
                        {produtoAtual.nome}
                      </h3>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[15px] font-semibold tracking-[-0.03em] text-[#111111]">
                          {formatPrice(produtoAtual.preco)}
                        </span>
                        <span className="truncate text-[10px] font-medium text-[#8E8E87]">
                          {produtoAtual.categoria}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] leading-[15px] text-[#5F5F58]">
                        {produtoAtual.motivo}.
                      </p>

                      {/* Rodapé no formato da referência: navegação como link de
                          texto à esquerda, ação em pílula à direita. */}
                      <div className="mt-3.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => irPara(indice - 1)}
                            disabled={produtos.length < 2}
                            aria-label="Produto anterior"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#77776F] transition-colors hover:bg-[#F1F1EE] hover:text-[#111111] disabled:opacity-35"
                          >
                            <ChevronLeft size={17} strokeWidth={2.1} />
                          </button>
                          <button
                            type="button"
                            onClick={() => irPara(indice + 1)}
                            disabled={produtos.length < 2}
                            aria-label="Próximo produto"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#77776F] transition-colors hover:bg-[#F1F1EE] hover:text-[#111111] disabled:opacity-35"
                          >
                            <ChevronRight size={17} strokeWidth={2.1} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void escolher(produtoAtual)}
                          disabled={enviando}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0A0A0A] pl-3.5 pr-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#2B2B2B] disabled:cursor-wait disabled:opacity-60"
                        >
                          {enviando ? "Enviando…" : "Escolher este"}
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                            <ArrowUpRight size={13} strokeWidth={2.4} />
                          </span>
                        </button>
                      </div>
                    </motion.article>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Navegar e fechar passaram para dentro do card; aqui fica só a
                saída para o catálogo inteiro. Margem maior porque a folha de
                baixo da pilha escapa para este lado. */}
            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  fecharVitrine();
                  navigate("/dashboard/catalogo");
                }}
                className="text-[12.5px] font-semibold text-white/70 underline underline-offset-4 transition-colors hover:text-white"
              >
                Ver catálogo completo
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AtlasProductShowcase;
