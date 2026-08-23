import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, PackageSearch, Star } from "lucide-react";

import { useAtlasChat, type NichoDaVitrine } from "@/contexts/AtlasChatContext";
import { useProdutosRecomendados, type ProdutoRecomendado } from "@/hooks/useProdutosRecomendados";
import { formatPrice } from "@/components/dashboard/ProductCard";

/**
 * Vitrine do guia, dentro da conversa.
 *
 * Antes era um modal por cima do chat: a pessoa escolhia produto numa tela que
 * tapava justamente a explicação do passo, e fechar sem escolher deixava a
 * conversa parecendo travada. Agora os produtos são parte da mensagem — rolam
 * na horizontal como qualquer carrossel, e o resto do chat continua acessível.
 *
 * A seleção vem do `useProdutosRecomendados`, que cruza o nicho confirmado na
 * conversa com o que a pessoa respondeu no quiz de cadastro.
 */

type Props = {
  /** Nicho fechado no guia; sem ele a seleção usa só o perfil do cadastro. */
  nicho?: NichoDaVitrine | null;
  /** Painel lateral tem ~400px: os cards encolhem para caber dois na dobra. */
  compacto?: boolean;
};

const CardEsqueleto = ({ largura }: { largura: number }) => (
  <div className="shrink-0" style={{ width: largura }}>
    <div className="aspect-square w-full animate-pulse rounded-[14px] bg-[#F1F1EE]" />
    <div className="mt-2.5 h-3 w-4/5 animate-pulse rounded-full bg-[#EDEDEA]" />
    <div className="mt-1.5 h-2.5 w-full animate-pulse rounded-full bg-[#F1F1EE]" />
    <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded-full bg-[#F1F1EE]" />
  </div>
);

const AtlasProductCarousel = ({ nicho = null, compacto = false }: Props) => {
  const navigate = useNavigate();
  const { selecionarProduto, enviando } = useAtlasChat();
  const { produtos, carregando, erro, resumo } = useProdutosRecomendados(nicho ?? null);

  const trilhoRef = useRef<HTMLDivElement>(null);
  const escolhendoRef = useRef(false);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  const largura = compacto ? 148 : 186;

  // As setas só existem quando há o que rolar: num catálogo com três produtos
  // elas ficariam apagadas sem explicar o porquê.
  const medir = useCallback(() => {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const folga = 4;
    setPodeVoltar(trilho.scrollLeft > folga);
    setPodeAvancar(trilho.scrollLeft + trilho.clientWidth < trilho.scrollWidth - folga);
  }, []);

  useEffect(() => {
    medir();
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const observador = new ResizeObserver(medir);
    observador.observe(trilho);
    return () => observador.disconnect();
  }, [medir, produtos.length, carregando]);

  const rolar = (direcao: 1 | -1) => {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    // Dois cards por clique: um só passo dá a impressão de que nada andou.
    trilho.scrollBy({ left: direcao * (largura + 12) * 2, behavior: "smooth" });
  };

  const escolher = async (produto: ProdutoRecomendado) => {
    if (escolhendoRef.current || enviando) return;
    escolhendoRef.current = true;
    try {
      await selecionarProduto({
        id: produto.id,
        nome: produto.nome,
        categoria: produto.categoria,
        preco: produto.preco,
        imagem: produto.imagem,
      });
    } finally {
      escolhendoRef.current = false;
    }
  };

  if (erro && !carregando) {
    return (
      <div className="mt-3 rounded-2xl border border-black/[0.07] bg-white p-4 text-center">
        <PackageSearch className="mx-auto h-6 w-6 text-[#8E8E87]" strokeWidth={1.7} />
        <p className="mt-2 text-[12.5px] font-semibold text-[#111111]">Não consegui carregar os produtos agora</p>
        <p className="mt-1 text-[11.5px] text-[#77776F]">{erro}</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard/catalogo")}
          className="mt-3 text-[12px] font-semibold text-[#2563EB] hover:underline"
        >
          Abrir o catálogo completo
        </button>
      </div>
    );
  }

  if (!carregando && produtos.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-black/[0.07] bg-white p-4 text-center">
        <PackageSearch className="mx-auto h-6 w-6 text-[#8E8E87]" strokeWidth={1.7} />
        <p className="mt-2 text-[12.5px] font-semibold text-[#111111]">Nenhum produto disponível no momento</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard/catalogo")}
          className="mt-2 text-[12px] font-semibold text-[#2563EB] hover:underline"
        >
          Abrir o catálogo completo
        </button>
      </div>
    );
  }

  return (
    <section className="mt-3" aria-label="Produtos recomendados para você">
      <p className="mb-2 text-[11.5px] leading-[16px] text-[#8A8A8A]">
        {carregando ? "Separando o que combina com o seu perfil…" : nicho ? `${nicho.label} • ${resumo}` : resumo}
      </p>

      <div className="relative">
        <div
          ref={trilhoRef}
          onScroll={medir}
          className="velo-scroll-oculto flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1"
        >
          {carregando
            ? Array.from({ length: 4 }).map((_, indice) => <CardEsqueleto key={indice} largura={largura} />)
            : produtos.map((produto) => (
                <article key={produto.id} className="shrink-0 snap-start" style={{ width: largura }}>
                  {/* O card inteiro é o botão: no formato de vitrine, clicar na
                      foto é o gesto natural — um botão "escolher" embaixo de
                      cada card repetiria a mesma ação oito vezes. */}
                  <button
                    type="button"
                    onClick={() => void escolher(produto)}
                    disabled={enviando}
                    title={produto.nome}
                    className="group w-full text-left disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-[14px] bg-[#F5F5F2] transition-shadow group-hover:shadow-[0_8px_24px_rgba(10,10,10,0.10)]">
                      <img
                        src={produto.imagem}
                        alt={produto.nome}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="h-full w-full select-none object-contain p-3 mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    </div>
                    <h4 className="mt-2.5 line-clamp-2 text-[12.5px] font-bold leading-[16px] tracking-[-0.01em] text-[#111111]">
                      {produto.nome}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-[15px] text-[#6B6B66]">
                      <span className="font-semibold text-[#111111]">{formatPrice(produto.preco)}</span>
                      {" • "}
                      {produto.motivo}.
                    </p>
                    {typeof produto.rating === "number" && produto.rating > 0 && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#4B4B46]">
                        <Star className="h-3 w-3 fill-[#111111] text-[#111111]" strokeWidth={0} aria-hidden />
                        {produto.rating.toFixed(1).replace(".", ",")}
                      </p>
                    )}
                  </button>
                </article>
              ))}
        </div>

        {/* Setas por cima do trilho, na altura da foto — o mesmo lugar em que a
            pessoa já está olhando quando quer ver o próximo. */}
        {!carregando && podeVoltar && (
          <button
            type="button"
            onClick={() => rolar(-1)}
            aria-label="Ver produtos anteriores"
            className="absolute left-0 top-[26%] grid h-8 w-8 -translate-x-1/3 place-items-center rounded-full border border-black/[0.06] bg-white text-[#3A3A36] shadow-[0_4px_14px_rgba(10,10,10,0.14)] transition-colors hover:bg-[#F7F7F5]"
          >
            <ChevronLeft size={17} strokeWidth={2.1} />
          </button>
        )}
        {!carregando && podeAvancar && (
          <button
            type="button"
            onClick={() => rolar(1)}
            aria-label="Ver mais produtos"
            className="absolute right-0 top-[26%] grid h-8 w-8 translate-x-1/3 place-items-center rounded-full border border-black/[0.06] bg-white text-[#3A3A36] shadow-[0_4px_14px_rgba(10,10,10,0.14)] transition-colors hover:bg-[#F7F7F5]"
          >
            <ChevronRight size={17} strokeWidth={2.1} />
          </button>
        )}
      </div>

      {!carregando && (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[11px] text-[#9A9A94]">Toque no produto para seguir com ele</span>
          <button
            type="button"
            onClick={() => navigate("/dashboard/catalogo")}
            className="text-[11.5px] font-semibold text-[#2563EB] hover:underline"
          >
            Ver catálogo completo
          </button>
        </div>
      )}
    </section>
  );
};

export default AtlasProductCarousel;
