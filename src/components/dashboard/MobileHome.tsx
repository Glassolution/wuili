// Home mobile da Velo (busca, categorias, banner, atalhos e grade de produtos).
//
// Este bloco vivia dentro de DashboardHomePage.tsx e foi apagado por engano no
// commit f054ec18 ("fix: ajusta camada e desce indicador para baixo da linha"),
// que removeu 3674 linhas do arquivo. Aqui ele volta como componente próprio:
// o DashboardHomePage segue cuidando só do desktop, e os 22 commits que
// mexeram naquele arquivo depois da deleção ficam preservados.
//
// O componente é autossuficiente — busca produtos, coleções e favoritos por
// conta própria — para não acoplar de novo o mobile ao estado do desktop.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, BadgePercent, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Folder, Package, Plus, Search, ShieldCheck, Star, Truck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { listCollectionsWithSummaries, type CollectionSummary } from "@/lib/collectionsApi";
import { veloToast } from "@/components/ui/velo-toast";
import { proxyImageList } from "@/lib/imageProxy";
import { displayOrdersCountFor, displayRatingFor } from "@/lib/catalogFilters";
import {
  ProductFavoriteButton,
  formatReviewCount,
  getProductCatalogMetrics,
} from "@/components/dashboard/ProductCard";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

type ProductPreview = {
  id: string;
  title: string;
  category: string;
  image: string;
  images: string[];
  price: number;
  ordersCount: number;
  rating: number | null;
  source: string | null;
};

const HOME_PRODUCTS_LIMIT = 1000;
const HOME_PRODUCTS_PER_PAGE = 20;
const HOME_FAVORITES_STORAGE_PREFIX = "velo:home-favorite-products";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatInteger = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];
  const collect = (input: Json | null): string[] => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap((entry) => {
        if (typeof entry === "string" && entry.trim()) return [entry.trim()];
        if (entry && typeof entry === "object" && "url" in entry) {
          const url = (entry as { url?: unknown }).url;
          return typeof url === "string" && url.trim() ? [url.trim()] : [];
        }
        return [];
      });
    }
    if (typeof input === "string") {
      try {
        return collect(JSON.parse(input) as Json);
      } catch {
        return input.trim() ? [input.trim()] : [];
      }
    }
    return [];
  };
  return proxyImageList(collect(images));
};

const MIN_PRODUCT_IMAGES = 3;

const mapProductPreview = (product: CatalogProductRow): ProductPreview | null => {
  const images = getProductImages(product.images);
  // Regra: só mostra na home mobile produtos com pelo menos 3 fotos disponíveis,
  // pra evitar cards com uma única imagem antiga do fornecedor.
  if (images.length < MIN_PRODUCT_IMAGES) return null;
  return {
    id: product.id,
    title: product.title ?? "Produto",
    category: product.category?.trim() || "Outros",
    image: images[0],
    images,
    price: Number(product.cost_price) || 0,
    /*
      Mesmas funções do catálogo e da ficha do produto (src/lib/catalogFilters.ts). Elas
      NÃO leem o banco: derivam nota e vendas de um hash do id, porque
      `catalog_products.rating` é 0 em quase todo o catálogo (a C7 Drop não devolve
      avgRating). Antes a home mobile lia os campos reais e, como eram zero, o bloco de
      avaliação nunca aparecia — era a única tela sem a linha. A paridade com o desktop
      foi decisão do produto, ciente de que o número é derivado e não medido.
    */
    ordersCount: Math.max(Number(product.orders_count) || 0, displayOrdersCountFor(product.id)),
    rating: displayRatingFor(product.id),
    source: product.source ?? null,
  };
};

/*
  Ícones da marca, em public/icones/. São derivados dos originais soltos em public/
  ("icone comunidades.png" e companhia, 1254x1254 e ~800KB cada), com dois tratamentos:

  1. Fundo branqueado. Os PNGs não têm alpha e vêm com fundo off-white (~#F9F8F6). Sem
     moldura em volta, esse tom apareceria como um quadradinho acinzentado sobre a seção
     branca. Os pixels com min(R,G,B) >= 240 viraram branco puro — o mínimo por canal
     separa fundo de glifo sem tocar em pixel colorido, já que o azul da marca tem R=37.
  2. Glifos normalizados. Cada arte vinha com uma margem diferente dentro do canvas de
     1254px — o de Comunidade media 950px de largura e o de Coleções 663px, uma diferença
     de 43% que fazia um parecer maior que o outro na mesma fileira. Os quatro foram
     recortados pelo bounding box do conteúdo e recentrados num quadrado com a mesma
     margem, então agora ocupam a mesma altura óptica.
  3. Reduzidos para 168px (3x do tamanho de tela). Os originais somavam 3,2MB para quatro
     ícones na primeira tela do app, em celular.

  O `mix-blend-multiply` no <img> é rede de segurança: com o fundo branco puro ele é
  no-op sobre a seção branca de hoje, e continua sumindo se a seção ganhar um tom claro.
*/
const mobileVeloActionItems = [
  { label: "Comunidade", icon: "/icones/comunidade.png", to: "/dashboard/comunidade" },
  { label: "Coleções", icon: "/icones/colecoes.png", to: "/colecoes" },
  { label: "Publicações", icon: "/icones/publicacoes.png", to: "/dashboard/publicacoes" },
  { label: "Imagens com IA", icon: "/icones/imagens-ia.png", to: "/dashboard/imagens-ia" },
] as const;

/*
  Rótulo do estado "sem filtro". Antes existia uma lista fixa de categorias ("Casa",
  "Eletrônicos", "Moda"…) tanto nas abas quanto no seletor, e o filtro comparava
  `product.category === valorDaAba` com igualdade estrita. Só que as categorias reais do
  catálogo são outras (o próprio catálogo mostra coisas como "Salão & Barbearia"), então
  nenhuma aba casava com nada e todas devolviam "Nenhum produto encontrado".

  A lista agora sai dos produtos carregados: só aparece aba de categoria que existe de
  fato, e a comparação é normalizada (sem acento, sem caixa) para não depender de como o
  fornecedor escreveu.
*/
const TODAS_AS_CATEGORIAS = "Todos os produtos";
const MOBILE_HOME_PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const MOBILE_HOME_RATING_OPTIONS = ["Todas", "4+ estrelas", "4.5+ estrelas"];

const toCatalogMetricNumber = (value: unknown) => {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : Number.NaN;

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const matchesMobileHomePriceFilter = (price: number, filter: string) => {
  if (filter === "Até R$ 50") return price <= 50;
  if (filter === "R$ 50-150") return price > 50 && price <= 150;
  if (filter === "Acima de R$ 150") return price > 150;
  return true;
};

const matchesMobileHomeRatingFilter = (rating: number | null, filter: string) => {
  if (filter === "4+ estrelas") return rating !== null && rating >= 4;
  if (filter === "4.5+ estrelas") return rating !== null && rating >= 4.5;
  return true;
};


const MobileHomeFilterDropdown = ({
  label,
  value,
  isOpen,
  options,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  isOpen: boolean;
  options: string[];
  onToggle: () => void;
  onSelect: (value: string) => void;
}) => (
  <div className="relative min-w-[148px]">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-full border border-[#D1D5DB] bg-white px-3 text-[11px] font-semibold text-[#111111] shadow-sm transition-colors hover:border-[#9CA3AF]"
    >
      <span className="truncate">{label}: {value}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
    </button>

    {isOpen && (
      <div className="absolute left-0 top-[calc(100%+8px)] z-40 min-w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-[0_16px_32px_rgba(17,24,39,0.10)]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
              value === option ? "bg-[#F3F4F6] font-semibold text-[#111111]" : "text-[#4B5563] hover:bg-[#F9FAFB]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    )}
  </div>
);

const MobileProductCard = ({
  product,
  isFavorite,
  onToggleFavorite,
}: {
  product: ProductPreview;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) => {
  const navigate = useNavigate();
  const { rating, ordersCount, hasMetrics } = getProductCatalogMetrics(product);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article className="relative min-w-0 overflow-hidden rounded-[8px] border border-black/[0.08] bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={() => navigate(`/dashboard/catalogo/${product.id}`)}
        className="block w-full text-left"
      >
        <div className="aspect-square overflow-hidden bg-[#F3F3F3] flex items-center justify-center">
          {!imgFailed && product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              loading="eager"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <Package size={32} strokeWidth={1.4} className="text-black/20" />
          )}
        </div>
        <div className="p-2.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <span className="max-w-full truncate rounded-[4px] bg-[#F1F1F1] px-1.5 py-0.5 text-[9px] font-bold text-black/55">
              {product.category}
            </span>
          </div>
          <p className="line-clamp-2 min-h-[36px] text-[12px] font-bold leading-[1.45] text-[#222222]">{product.title}</p>
          {/*
            Nota e preço na mesma linha, com a estrela âmbar e "(N vendas)" — o mesmo
            desenho do card de desktop (ProductCard.tsx). A contagem trunca em vez de
            quebrar: no celular a coluna tem ~145px úteis e o preço não pode ser empurrado
            para baixo.
          */}
          <div className="mt-2 flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1 text-[10px]">
              {hasMetrics && rating !== null && (
                <>
                  <Star size={11} strokeWidth={0} className="shrink-0 fill-[#F5A623]" />
                  <span className="font-medium text-[#111111]">{rating.toFixed(1)}</span>
                </>
              )}
              {hasMetrics && ordersCount !== null && (
                <span className="truncate text-[#9A9A94]">({formatReviewCount(ordersCount)} vendas)</span>
              )}
            </div>
            <span className="shrink-0 text-[13px] font-semibold tracking-[-0.025em] text-[#111111]">
              {formatCurrency(product.price)}
            </span>
          </div>
        </div>
      </button>
      <ProductFavoriteButton
        isFavorited={isFavorite}
        onToggleFavorite={onToggleFavorite}
        className="z-10"
      />
    </article>
  );
};

const MobileAliVeloHome = ({
  products,
  collections,
  favoriteProductIds,
  onToggleFavoriteProduct,
  onCreateCollection,
}: {
  products: ProductPreview[];
  collections: CollectionSummary[];
  favoriteProductIds: string[];
  onToggleFavoriteProduct: (productId: string) => void;
  onCreateCollection: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState(TODAS_AS_CATEGORIAS);
  const [mobilePriceFilter, setMobilePriceFilter] = useState(MOBILE_HOME_PRICE_OPTIONS[0]);
  const [mobileRatingFilter, setMobileRatingFilter] = useState(MOBILE_HOME_RATING_OPTIONS[0]);
  const [openMobileFilter, setOpenMobileFilter] = useState<"category" | "price" | "rating" | null>(null);
  const mobileFilterBarRef = useRef<HTMLDivElement | null>(null);
  const mobileCategoryTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  /*
    Ordenadas por quantidade de produtos: a primeira aba depois de "Tudo" é sempre a que
    tem mais o que mostrar, e nenhuma aba leva a uma lista vazia.
  */
  const categoriasDoCatalogo = useMemo(() => {
    /*
      Agrupadas pela chave normalizada, e não pelo texto cru: o mesmo fornecedor grava
      "Salão & Barbearia" e "salao & barbearia" para a mesma coisa, e sem o agrupamento
      as duas viravam abas separadas que filtravam exatamente o mesmo conjunto. Fica a
      grafia mais frequente como rótulo.
    */
    const grupos = new Map<string, { rotulo: string; total: number; grafias: Map<string, number> }>();

    for (const product of products) {
      const categoria = product.category.trim();
      if (!categoria) continue;

      const chave = normalizeSearchText(categoria);
      const grupo = grupos.get(chave) ?? { rotulo: categoria, total: 0, grafias: new Map() };
      grupo.total += 1;
      grupo.grafias.set(categoria, (grupo.grafias.get(categoria) ?? 0) + 1);
      grupo.rotulo = [...grupo.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0];
      grupos.set(chave, grupo);
    }

    return [
      TODAS_AS_CATEGORIAS,
      ...[...grupos.values()]
        .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
        .map((grupo) => grupo.rotulo),
    ];
  }, [products]);

  /*
    Se o catálogo recarregar sem a categoria escolhida, o filtro apontaria para um valor
    que não existe mais e a grade ficaria vazia sem aba ativa para explicar por quê.
  */
  useEffect(() => {
    if (!categoriasDoCatalogo.includes(mobileCategoryFilter)) setMobileCategoryFilter(TODAS_AS_CATEGORIAS);
  }, [categoriasDoCatalogo, mobileCategoryFilter]);

  const featuredProducts = useMemo(() => {
    const query = normalizeSearchText(mobileSearchQuery.trim());

    return products.filter((product) => {
      const { rating } = getProductCatalogMetrics(product);
      const matchesSearch =
        !query ||
        normalizeSearchText(product.title).includes(query) ||
        normalizeSearchText(product.category).includes(query);
      const matchesCategory =
        mobileCategoryFilter === TODAS_AS_CATEGORIAS ||
        normalizeSearchText(product.category) === normalizeSearchText(mobileCategoryFilter);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesMobileHomePriceFilter(product.price, mobilePriceFilter) &&
        matchesMobileHomeRatingFilter(rating, mobileRatingFilter)
      );
    });
  }, [mobileCategoryFilter, mobilePriceFilter, mobileRatingFilter, mobileSearchQuery, products]);
  const firstProduct = featuredProducts[0];
  const secondProduct = featuredProducts[1] ?? firstProduct;

  const [productsPage, setProductsPage] = useState(1);
  const totalProductPages = Math.max(1, Math.ceil(featuredProducts.length / HOME_PRODUCTS_PER_PAGE));

  // Volta para a primeira página sempre que o filtro/busca muda o conjunto.
  useEffect(() => {
    setProductsPage(1);
  }, [mobileCategoryFilter, mobilePriceFilter, mobileRatingFilter, mobileSearchQuery]);

  // Corrige a página caso o total encolha (ex.: filtro reduziu a lista).
  useEffect(() => {
    setProductsPage((current) => Math.min(current, totalProductPages));
  }, [totalProductPages]);

  const pagedProducts = useMemo(() => {
    const start = (productsPage - 1) * HOME_PRODUCTS_PER_PAGE;
    return featuredProducts.slice(start, start + HOME_PRODUCTS_PER_PAGE);
  }, [featuredProducts, productsPage]);

  const productPageNumbers = useMemo(() => {
    const maxButtons = 5;
    let start = Math.max(1, productsPage - 2);
    const end = Math.min(totalProductPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [productsPage, totalProductPages]);

  const productsSectionRef = useRef<HTMLElement | null>(null);
  const goToProductsPage = (nextPage: number) => {
    setProductsPage(nextPage);
    productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!openMobileFilter) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileFilterBarRef.current?.contains(event.target as Node)) {
        setOpenMobileFilter(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMobileFilter]);

  useEffect(() => {
    mobileCategoryTabRefs.current[mobileCategoryFilter]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [mobileCategoryFilter]);

  if (location.pathname === "/colecoes") {
    return (
      <section className="min-h-screen bg-[#F4F4F2] px-4 pb-24 pt-5 md:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase text-black/40">Organização</p>
            <h1 className="mt-1 text-[30px] font-black tracking-[-0.06em] text-[#111111]">Coleções</h1>
            <p className="mt-1 text-[13px] font-medium text-black/50">
              {collections.length} coleção{collections.length === 1 ? "" : "ões"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateCollection}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-4 text-[12px] font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Nova
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {collections.length > 0 ? (
            collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => navigate(`/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`)}
                className="flex min-h-[112px] items-center gap-4 rounded-[18px] bg-white p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.06)]"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#F1F1F1] text-[#111111]">
                  <Folder className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-black tracking-[-0.04em] text-[#111111]">{collection.name}</span>
                  <span className="mt-1 block text-[12px] font-semibold text-black/45">{collection.productCount} produtos</span>
                </span>
                <span className="text-[22px] text-black/35">›</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={onCreateCollection}
              className="rounded-[18px] border-2 border-dashed border-black/10 bg-white px-6 py-12 text-center"
            >
              <Folder className="mx-auto h-8 w-8 text-black/30" />
              <span className="mt-3 block text-[15px] font-bold text-[#111111]">Crie sua primeira coleção</span>
              <span className="mt-1 block text-[12px] text-black/45">Organize produtos para importar depois.</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="md:hidden animate-fade-in">
      <div className="min-h-screen w-full overflow-x-hidden bg-white pb-6 text-[#111111]">
        <div className="bg-[linear-gradient(180deg,#1E3A8A_0%,#1D4ED8_60%,#2563EB_100%)] px-4 pt-4 text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex h-9 w-9 shrink-0 items-center justify-center transition-transform active:scale-95"
              aria-label="Velo"
            >
              {/*
                Cesta em branco direto sobre o degradê, sem o disco branco atrás: a marca
                sobre fundo azul é a versão invertida, a mesma da barra do dashboard.
              */}
              <img src="/icones/velo-cesta-branca.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
            </button>
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-3.5 text-left text-[#1F2933] shadow-[0_8px_18px_rgba(30,58,138,0.25)]">
              <Search className="h-[18px] w-[18px] shrink-0 text-[#2563EB]" strokeWidth={2.2} />
              <input
                type="search"
                value={mobileSearchQuery}
                onChange={(event) => setMobileSearchQuery(event.target.value)}
                placeholder="Buscar na Velo"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold tracking-[-0.02em] text-[#1F2933] outline-none placeholder:text-[#6B7280]"
              />
              <button
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="shrink-0 text-[#2563EB] transition-transform active:scale-90"
                aria-label="Buscar por imagem"
              >
                <Camera className="h-[19px] w-[19px]" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-7 overflow-x-auto text-[16px] font-semibold tracking-[-0.03em] text-white/65 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categoriasDoCatalogo.map((categoria) => {
              const isActive = mobileCategoryFilter === categoria;

              return (
                <button
                  key={categoria}
                  ref={(node) => {
                    mobileCategoryTabRefs.current[categoria] = node;
                  }}
                  type="button"
                  onClick={() => {
                    setMobileCategoryFilter(categoria);
                    setOpenMobileFilter(null);
                  }}
                  className={`relative shrink-0 pb-2 transition-colors duration-200 ${isActive ? "text-white" : "text-white/65"}`}
                >
                  {categoria === TODAS_AS_CATEGORIAS ? "Tudo" : categoria}
                  {isActive && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-white animate-fade-in" />}
                </button>
              );
            })}
          </nav>
        </div>

        <section className="bg-[linear-gradient(180deg,#2563EB_0%,#3B82F6_55%,#EFF4FF_100%)] px-4 pb-4 pt-3">
          {/*
            O banner inteiro era um <button> que levava ao catálogo, e as miniaturas dos
            produtos eram <div> dentro dele — tocar um produto subia o clique para o botão
            de fora e caía no catálogo, nunca no produto. Agora o container é uma <div> e
            cada alvo tem o seu próprio botão: o cabeçalho e o "Explorar" vão para o
            catálogo, cada miniatura vai para a sua ficha. Aninhar <button> em <button>
            não resolveria — é marcação inválida e o navegador desfaz o aninhamento.
          */}
          <div className="block w-full overflow-hidden rounded-[16px] bg-[linear-gradient(135deg,#1E3A8A_0%,#1D4ED8_55%,#3B82F6_100%)] p-3 text-left shadow-[0_12px_28px_rgba(30,58,138,0.35)]">
            <button
              type="button"
              onClick={() => navigate("/dashboard/catalogo")}
              className="block w-full text-left transition-transform active:scale-[0.99]"
            >
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[-0.01em] text-white/90">
                <ShieldCheck className="h-[14px] w-[14px]" strokeWidth={2.4} />
                Curadoria Velo • estoque nacional
              </p>
              <span className="rounded-[6px] bg-[#FACC15] px-2 py-0.5 text-[10px] font-black text-[#1E3A8A]">
                Margem até 3x
              </span>
            </div>

            <p className="mt-1.5 text-[22px] font-black uppercase leading-[0.95] tracking-[-0.05em] text-white">
              Produtos prontos
              <br />
              <span className="text-[#FACC15]">para vender hoje</span>
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-white/85">
              <span className="flex items-center gap-1">
                <Truck className="h-[13px] w-[13px]" strokeWidth={2.4} /> Envio nacional
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-[13px] w-[13px]" strokeWidth={2.4} /> Publica em 1 clique
              </span>
            </div>
            </button>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="flex flex-col justify-between rounded-[10px] bg-white px-2 py-2 text-center transition-transform active:scale-95"
              >
                <div>
                  <p className="text-[15px] font-black leading-none tracking-[-0.04em] text-[#1D4ED8]">
                    {products.length > 0 ? `${products.length}+` : "Novos"}
                  </p>
                  <p className="mt-1 text-[9px] font-bold text-[#6B7280]">produtos no catálogo</p>
                </div>
                <span className="mt-1.5 inline-flex h-6 w-full items-center justify-center rounded-full bg-[#2563EB] text-[9px] font-black text-white">
                  Explorar
                </span>
              </button>
              {[firstProduct, secondProduct].map((item, index) =>
                item?.image ? (
                  <button
                    /*
                      Chave pelo índice, não pelo id: com um único produto no catálogo,
                      `secondProduct` cai de volta no `firstProduct` e as duas miniaturas
                      teriam o mesmo id — chave duplicada no mesmo array.
                    */
                    key={index}
                    type="button"
                    onClick={() => navigate(`/dashboard/catalogo/${item.id}`)}
                    aria-label={item.title}
                    className="relative overflow-hidden rounded-[10px] bg-white/15 transition-transform active:scale-95"
                  >
                    <img
                      src={item.image}
                      alt=""
                      className="h-full min-h-[68px] w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#1E3A8A]/85 px-2 py-0.5 text-[9px] font-black text-white">
                      {formatCurrency(item.price)}
                    </span>
                  </button>
                ) : (
                  <div key={index} className="min-h-[68px] rounded-[10px] bg-white/15" />
                ),
              )}
            </div>
          </div>
        </section>



        <section className="hidden">
          <div className="relative min-h-[112px] overflow-hidden">
            <div className="relative z-10 max-w-[228px]">
              <div className="flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 72 72"
                  className="h-[72px] w-[72px] shrink-0 text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.28)]"
                  fill="none"
                >
                  <path
                    d="M49.5 24 A18 18 0 1 0 49.5 48"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M46 42 L52 48 L58 42"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="h-14 w-px bg-white/25" />
                <span className="text-[18px] font-semibold uppercase tracking-[0.45em] text-white/85">Velo</span>
              </div>
              <p className="-mt-1 max-w-[220px] text-[31px] font-black uppercase leading-[0.92] tracking-[-0.06em] text-white">
                Dê um upgrade
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/catalogo")}
              className="absolute left-[168px] top-[58px] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#050505] shadow-[0_10px_30px_rgba(255,255,255,0.18)]"
              aria-label="Ver promoções"
            >
              <ArrowUpRight className="h-5 w-5" strokeWidth={2.6} />
            </button>

            <div className="absolute -right-6 top-0 h-full w-[178px]">
              <div className="absolute inset-y-0 right-4 w-px bg-white/25" />
              {firstProduct && (
                <img
                  src={firstProduct.image}
                  alt=""
                  className="absolute right-8 top-1 h-[82px] w-[82px] rotate-6 rounded-[18px] object-cover shadow-[0_18px_42px_rgba(0,0,0,0.6)]"
                  referrerPolicy="no-referrer"
                />
              )}
              {secondProduct && (
                <img
                  src={secondProduct.image}
                  alt=""
                  className="absolute bottom-1 left-5 h-[58px] w-[86px] -rotate-6 rounded-[15px] object-cover shadow-[0_16px_34px_rgba(0,0,0,0.55)]"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </div>

          <div className="hidden">
            {[
              { value: "Produtos BR", label: "estoque nacional" },
              { value: "Margem alta", label: "curadoria Velo" },
              { value: "Publicar fácil", label: "ML e Shopee" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="min-h-[62px] rounded-[14px] bg-white/10 px-2 py-2 text-center"
              >
                <p className="text-[13px] font-black leading-tight tracking-[-0.04em] text-white">{item.value}</p>
                <p className="mt-0.5 text-[9px] font-bold text-white/55">{item.label}</p>
                <span className="mt-1.5 inline-flex h-6 w-full items-center justify-center rounded-full bg-white text-[9px] font-black text-[#050505]">
                  Importar
                </span>
              </button>
            ))}
          </div>
        </section>


        <div className="hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#8CDD82] text-white">
              <Check className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="text-[17px] font-black tracking-[-0.05em] text-[#6F806F]">Fornecedores brasileiros</p>
              <p className="text-[13px] font-semibold text-[#9CA89C]">Produtos com estoque e curadoria Velo</p>
            </div>
          </div>
        </div>

        {products.length > 0 && (
          <section ref={productsSectionRef} className="scroll-mt-4 bg-white px-4 pt-5">
            <div className="mb-4 grid grid-cols-4 gap-1 pb-1">
              {mobileVeloActionItems.map((item, indice) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.to)}
                  /*
                    `backwards` é obrigatório aqui: `animate-fade-in` não tem fill, então
                    durante o atraso o item ficaria no estado normal (visível) e só então
                    pularia para opacidade 0 para começar a animar — um pisca-pisca em
                    cascata. Com backwards ele já nasce no quadro inicial e espera a vez.
                  */
                  style={{ animationDelay: `${indice * 55}ms` }}
                  className="group flex min-w-0 animate-fade-in flex-col items-center gap-2 text-center [animation-fill-mode:backwards]"
                >
                  {/*
                    Só o ícone reage ao toque — escalar o rótulo junto é o que dava o
                    aspecto de app barato, porque texto pequeno em transform fica borrado.
                    Os tempos são assimétricos de propósito: 100ms para afundar (o dedo
                    precisa de resposta imediata) e 300ms para voltar, que é o que faz o
                    movimento parecer que assenta em vez de dar um estalo.

                    alt vazio: o rótulo logo abaixo já nomeia o atalho, e repetir viraria
                    eco no leitor de tela.
                  */}
                  <img
                    src={item.icon}
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-10 mix-blend-multiply transition-transform duration-300 ease-out group-active:scale-[0.88] group-active:duration-100"
                  />
                  {/*
                    Em 375px a coluna tem ~83px e "Imagens com IA" ocupa a largura inteira;
                    o px-0.5 é só para o rótulo não encostar na borda da coluna vizinha. Ele
                    continua quebrando em duas linhas, como na referência — cabe em duas
                    pelo line-clamp e não empurra a fileira.
                  */}
                  <span className="line-clamp-2 max-w-full px-0.5 text-[11px] font-semibold leading-tight tracking-[-0.01em] text-[#475569]">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#2563EB] text-white">
                <Truck className="h-[17px] w-[17px]" strokeWidth={2.3} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-black tracking-[-0.03em] text-[#1E3A8A]">Envio nacional</p>
                <p className="text-[11px] font-semibold leading-tight text-[#475569]">
                  Fornecedores no Brasil, entrega mais rápida para o seu cliente
                </p>
              </div>
              <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[#FACC15] px-2 py-1 text-[10px] font-black text-[#1E3A8A]">
                <BadgePercent className="h-[12px] w-[12px]" strokeWidth={2.6} />
                Margem
              </span>
            </div>

            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-[22px] font-black tracking-[-0.05em] text-[#111111]">Produtos para vender</h2>
              <span className="shrink-0 text-[11px] font-bold text-black/40">
                {formatInteger(featuredProducts.length)} itens
              </span>
            </div>

            <div
              ref={mobileFilterBarRef}
              className="hidden"
            >
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                  strokeWidth={1.8}
                />
                <input
                  type="text"
                  value={mobileSearchQuery}
                  onChange={(event) => setMobileSearchQuery(event.target.value)}
                  placeholder="Buscar produto"
                  className="h-9 w-full rounded-full border border-[#D1D5DB] bg-white pl-10 pr-3 text-[12px] font-medium text-[#111111] shadow-sm outline-none transition-colors placeholder:text-[#9CA3AF] hover:border-[#9CA3AF]"
                />
              </div>

              <MobileHomeFilterDropdown
                label="Categoria"
                value={mobileCategoryFilter}
                isOpen={openMobileFilter === "category"}
                onToggle={() => setOpenMobileFilter((current) => (current === "category" ? null : "category"))}
                options={categoriasDoCatalogo}
                onSelect={(value) => {
                  setMobileCategoryFilter(value);
                  setOpenMobileFilter(null);
                }}
              />

              <MobileHomeFilterDropdown
                label="Faixa de preço"
                value={mobilePriceFilter}
                isOpen={openMobileFilter === "price"}
                onToggle={() => setOpenMobileFilter((current) => (current === "price" ? null : "price"))}
                options={MOBILE_HOME_PRICE_OPTIONS}
                onSelect={(value) => {
                  setMobilePriceFilter(value);
                  setOpenMobileFilter(null);
                }}
              />

              <MobileHomeFilterDropdown
                label="Avaliação"
                value={mobileRatingFilter}
                isOpen={openMobileFilter === "rating"}
                onToggle={() => setOpenMobileFilter((current) => (current === "rating" ? null : "rating"))}
                options={MOBILE_HOME_RATING_OPTIONS}
                onSelect={(value) => {
                  setMobileRatingFilter(value);
                  setOpenMobileFilter(null);
                }}
              />
            </div>

            {featuredProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 pb-2">
                  {pagedProducts.map((product) => (
                    <MobileProductCard
                      key={`home-feature-${product.id}`}
                      product={product}
                      isFavorite={favoriteProductIds.includes(product.id)}
                      onToggleFavorite={() => onToggleFavoriteProduct(product.id)}
                    />
                  ))}
                </div>

                {totalProductPages > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 pb-2">
                    <button
                      type="button"
                      onClick={() => goToProductsPage(Math.max(1, productsPage - 1))}
                      disabled={productsPage === 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors active:bg-[#F1F1F3] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={16} strokeWidth={2} />
                    </button>

                    {productPageNumbers.map((pageNumber) => (
                      <button
                        key={`home-page-${pageNumber}`}
                        type="button"
                        onClick={() => goToProductsPage(pageNumber)}
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-[13px] font-bold transition-colors ${
                          productsPage === pageNumber
                            ? "border-[#111111] bg-[#111111] text-white"
                            : "border-[#E5E7EB] bg-white text-[#6B7280] active:bg-[#F1F1F3]"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => goToProductsPage(Math.min(totalProductPages, productsPage + 1))}
                      disabled={productsPage === totalProductPages}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors active:bg-[#F1F1F3] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Próxima página"
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[16px] border border-black/[0.08] bg-[#F7F7F8] px-4 py-8 text-center">
                <p className="text-[14px] font-black tracking-[-0.03em] text-[#111111]">Nenhum produto encontrado</p>
                <p className="mt-1 text-[12px] font-semibold text-black/45">Tente mudar a busca ou os filtros.</p>
              </div>
            )}
          </section>
        )}

      </div>
    </section>
  );
};

/**
 * Casca que alimenta a home mobile. Busca o catálogo e as coleções por conta
 * própria (antes esses dados vinham do DashboardHomePage, que hoje só monta o
 * desktop) e guarda os favoritos no localStorage por usuário.
 */
const MobileHome = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);

  const favoritesStorageKey = user?.id
    ? `${HOME_FAVORITES_STORAGE_PREFIX}:${user.id}`
    : HOME_FAVORITES_STORAGE_PREFIX;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(favoritesStorageKey);
      setFavoriteProductIds(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      setFavoriteProductIds([]);
    }
  }, [favoritesStorageKey]);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      const columns = "id,title,category,images,cost_price,rating,is_active,is_blocked,stock_quantity,orders_count,source";

      // Busca produtos de todas as fontes disponíveis (c7drop, aliexpress, etc.)
      const result = await supabase
        .from("catalog_products")
        .select(columns)
        .eq("is_active", true)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .range(0, HOME_PRODUCTS_LIMIT - 1);

      if (!isMounted) return;

      let rows = result.data;

      // Fallback: se não veio nada, tenta sem filtro de estoque
      if (result.error || !rows?.length) {
        const fallbackResult = await supabase
          .from("catalog_products")
          .select(columns)
          .eq("is_active", true)
          .eq("is_blocked", false)
          .order("orders_count", { ascending: false, nullsFirst: false })
          .range(0, HOME_PRODUCTS_LIMIT - 1);

        if (!isMounted || fallbackResult.error) return;
        rows = fallbackResult.data;
      }

      const previews = ((rows ?? []) as CatalogProductRow[])
        .map(mapProductPreview)
        .filter((product): product is ProductPreview => Boolean(product));

      if (isMounted) setProducts(previews);
    };

    void fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    void (async () => {
      try {
        const rows = await listCollectionsWithSummaries(user.id);
        if (isMounted) setCollections(rows);
      } catch {
        if (isMounted) setCollections([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleToggleFavoriteProduct = (productId: string) => {
    setFavoriteProductIds((current) => {
      const isFavorite = current.includes(productId);
      const next = isFavorite ? current.filter((id) => id !== productId) : [...current, productId];

      try {
        window.localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
      } catch {
        // Mantem a interação funcionando mesmo se o navegador bloquear armazenamento local.
      }

      veloToast.success(isFavorite ? "Produto removido dos favoritos." : "Produto salvo nos favoritos.");
      return next;
    });
  };

  return (
    <MobileAliVeloHome
      products={products}
      collections={collections}
      favoriteProductIds={favoriteProductIds}
      onToggleFavoriteProduct={handleToggleFavoriteProduct}
      onCreateCollection={() => veloToast.info("Crie coleções pelo computador por enquanto.")}
    />
  );
};

export default MobileHome;
