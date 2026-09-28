// Lista de pedidos no celular, no desenho de painel de loja (Shopify):
// título, abas de status com contagem, busca e linhas com foto + status colorido.
// Canal (Mercado Livre / Minha Loja) e fornecedor ficam aqui porque a Velo tem
// e a referência não.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, MoreHorizontal, Package, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

type MlOrderRow = Database["public"]["Views"]["ml_orders_view"]["Row"];

type StatusAba = "todos" | "pago" | "enviado" | "entregue" | "pendente" | "cancelado";
type Canal = "ml" | "loja";
type Ordem = "recentes" | "antigos" | "valor";

type PedidoMobile = {
  id: string;
  titulo: string;
  imagens: string[];
  status: string;
  grupo: StatusAba;
  valor: number;
  quantidade: number;
  codigo: string;
  comprador: string;
  rastreio: string | null;
  data: string | null;
  canal: Canal;
  fornecedorUrl: string | null;
  routeId: string | null;
};

type StoreOrderRow = {
  id: string;
  product_title: string;
  product_image_url: string | null;
  buyer_name: string;
  quantity: number;
  total: number;
  payment_status: string;
  created_at: string;
  catalog_product_id: string | null;
  variant_label: string | null;
  variant_sku: string | null;
  supplier_url: string | null;
};

const ABAS: { id: StatusAba; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "pago", rotulo: "Pagos" },
  { id: "enviado", rotulo: "Enviados" },
  { id: "entregue", rotulo: "Entregues" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "cancelado", rotulo: "Cancelados" },
];

const STATUS_COR: Record<string, string> = {
  pago: "text-[#248A3D]",
  enviado: "text-[#007AFF]",
  entregue: "text-[#248A3D]",
  pendente: "text-[#8E8E93]",
  cancelado: "text-[#FF3B30]",
};

const STATUS_ROTULO: Record<string, string> = {
  paid: "Pago",
  approved: "Pago",
  in_process: "Em processamento",
  processing: "Em processamento",
  completed: "Entregue",
  delivered: "Entregue",
  shipped: "Enviado",
  in_transit: "Em trânsito",
  pending: "Pendente",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  failed: "Falhou",
  refunded: "Cancelado",
  charged_back: "Estornado",
  rejected: "Rejeitado",
};

const grupoDoStatus = (status: string | null | undefined): StatusAba => {
  const chave = (status ?? "pending").toLowerCase();
  if (["paid", "approved"].includes(chave)) return "pago";
  if (["shipped", "in_transit", "in_process", "processing"].includes(chave)) return "enviado";
  if (["delivered", "completed"].includes(chave)) return "entregue";
  if (["cancelled", "canceled", "refunded", "charged_back", "failed", "rejected"].includes(chave)) return "cancelado";
  return "pendente";
};

const rotuloDoStatus = (status: string | null | undefined) => {
  const chave = (status ?? "pending").toLowerCase();
  return STATUS_ROTULO[chave] ?? (status ? String(status) : "Pendente");
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const texto = (valor: string | number | null | undefined) => {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
};

const urlsDeImagem = (valor: unknown): string[] => {
  if (!valor) return [];
  if (typeof valor === "string") {
    const limpo = valor.trim();
    if (!limpo) return [];
    if (limpo.startsWith("[") || limpo.startsWith("{")) {
      try {
        return urlsDeImagem(JSON.parse(limpo));
      } catch {
        /* string comum de URL */
      }
    }
    if (/^(https?:|data:image)/i.test(limpo)) {
      // Imagens antigas da C7 no WordPress não abrem mais (403/sumiram).
      if (/c7drop\.com\.br\/wp-content\/uploads/i.test(limpo)) return [];
      return [limpo];
    }
    return [];
  }
  if (Array.isArray(valor)) return valor.flatMap(urlsDeImagem);
  if (typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    return urlsDeImagem(obj.url ?? obj.src ?? obj.image ?? obj.secure_url);
  }
  return [];
};

const semRepetir = (urls: string[]) => [...new Set(urls)];

const imagensDoPedido = (
  order: MlOrderRow,
  extras: Record<string, string[]> = {},
  extrasPorTitulo: Record<string, string[]> = {},
) => {
  const titulo = texto(order.catalog_title ?? order.product_title).toLowerCase();
  return semRepetir([
    ...urlsDeImagem(order.catalog_images),
    ...(order.catalog_product_id ? extras[order.catalog_product_id] ?? [] : []),
    ...(titulo ? extrasPorTitulo[titulo] ?? [] : []),
    ...urlsDeImagem(order.product_image),
  ]);
};

const FotoPedido = ({ srcs }: { srcs: string[] }) => {
  const [indice, setIndice] = useState(0);
  const chave = srcs.join("\n");
  useEffect(() => {
    setIndice(0);
  }, [chave]);
  const src = srcs[indice];
  if (!src) {
    return <Package size={20} strokeWidth={1.6} className="text-[#C7C7CC]" />;
  }
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className="h-full w-full object-contain mix-blend-multiply"
      onError={() => setIndice((atual) => atual + 1)}
    />
  );
};

const mlParaItem = (
  order: MlOrderRow,
  extras: Record<string, string[]> = {},
  extrasPorTitulo: Record<string, string[]> = {},
): PedidoMobile => {
  const status = String(order.status ?? "pending");
  const codigo = texto(order.ml_order_id ?? order.external_order_id ?? order.id) || order.id;
  return {
    id: String(order.id),
    titulo: texto(order.catalog_title ?? order.product_title) || "Pedido",
    imagens: imagensDoPedido(order, extras, extrasPorTitulo),
    status,
    grupo: grupoDoStatus(status),
    valor: Number(order.total_amount ?? order.sale_price ?? 0) || 0,
    quantidade: Number(order.quantity ?? 1) || 1,
    codigo,
    comprador: texto(order.buyer_name),
    rastreio: texto(order.tracking_code) || null,
    data: order.ordered_at ?? order.created_at,
    canal: "ml",
    fornecedorUrl: texto(order.supplier_url) || null,
    routeId: order.ml_order_id ?? order.id ?? order.external_order_id,
  };
};

const lojaParaItem = (order: StoreOrderRow): PedidoMobile => ({
  id: order.id,
  titulo: order.product_title || "Pedido",
  imagens: urlsDeImagem(order.product_image_url),
  status: order.payment_status,
  grupo: grupoDoStatus(order.payment_status),
  valor: Number(order.total ?? 0) || 0,
  quantidade: Number(order.quantity ?? 1) || 1,
  codigo: order.variant_sku ? order.variant_sku : order.id.slice(0, 8).toUpperCase(),
  comprador: order.buyer_name,
  rastreio: order.variant_label,
  data: order.created_at,
  canal: "loja",
  fornecedorUrl: order.supplier_url,
  routeId: null,
});

export const MobileOrdersView = ({
  orders,
  isLoading,
  onSelect,
  onBuy,
  useBotPurchase,
  supplier,
}: {
  orders: MlOrderRow[];
  isLoading: boolean;
  onSelect: (order: MlOrderRow) => void;
  onBuy: (order: MlOrderRow) => void;
  useBotPurchase: boolean;
  supplier: {
    connected: boolean;
    label: string;
    action: string;
    onOpen: () => void;
  } | null;
}) => {
  const { user } = useAuth();
  const [aba, setAba] = useState<StatusAba>("todos");
  const [canal, setCanal] = useState<Canal>("ml");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const { data: lojaRows, isLoading: lojaCarregando } = useQuery({
    queryKey: ["store-orders", user?.id],
    enabled: !!user?.id && canal === "loja",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("id,product_title,product_image_url,buyer_name,quantity,total,payment_status,created_at,catalog_product_id,variant_label,variant_sku")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Omit<StoreOrderRow, "supplier_url">[];
      const ids = Array.from(new Set(rows.map((row) => row.catalog_product_id).filter((id): id is string => Boolean(id))));
      let productMap = new Map<string, string | null>();
      if (ids.length > 0) {
        const { data: prods } = await supabase.from("catalog_products").select("id,product_url").in("id", ids);
        productMap = new Map((prods ?? []).map((product) => [product.id as string, (product.product_url as string | null) ?? null]));
      }
      return rows.map((row) => ({
        ...row,
        supplier_url: row.catalog_product_id ? productMap.get(row.catalog_product_id) ?? null : null,
      })) as StoreOrderRow[];
    },
  });

  const catalogIds = useMemo(
    () => Array.from(new Set(orders.map((order) => order.catalog_product_id).filter((id): id is string => Boolean(id)))),
    [orders],
  );
  const titulosSemCatalogo = useMemo(
    () =>
      Array.from(
        new Set(
          orders
            .filter((order) => !order.catalog_product_id)
            .map((order) => texto(order.catalog_title ?? order.product_title))
            .filter(Boolean),
        ),
      ),
    [orders],
  );

  const { data: fotosCatalogo } = useQuery({
    queryKey: ["order-catalog-images", catalogIds, titulosSemCatalogo],
    enabled: catalogIds.length > 0 || titulosSemCatalogo.length > 0,
    queryFn: async () => {
      const byId: Record<string, string[]> = {};
      const byTitle: Record<string, string[]> = {};
      const fotos = (images: unknown, clean: unknown) =>
        semRepetir([...urlsDeImagem(clean), ...urlsDeImagem(images)]);

      if (catalogIds.length > 0) {
        const { data, error } = await supabase
          .from("catalog_products")
          .select("id, title, images, ml_vision_clean_images")
          .in("id", catalogIds);
        if (error) throw error;
        for (const row of data ?? []) {
          const urls = fotos(row.images, row.ml_vision_clean_images);
          byId[row.id] = urls;
          if (row.title) byTitle[row.title.toLowerCase()] = urls;
        }
      }

      const titulosFaltando = titulosSemCatalogo.filter((titulo) => !byTitle[titulo.toLowerCase()]);
      if (titulosFaltando.length > 0) {
        const { data, error } = await supabase
          .from("catalog_products")
          .select("id, title, images, ml_vision_clean_images")
          .in("title", titulosFaltando);
        if (error) throw error;
        for (const row of data ?? []) {
          const urls = fotos(row.images, row.ml_vision_clean_images);
          if (row.title) byTitle[row.title.toLowerCase()] = urls;
        }
      }

      return { byId, byTitle };
    },
  });

  const itens = useMemo(() => {
    if (canal === "loja") return (lojaRows ?? []).map(lojaParaItem);
    return orders.map((order) => mlParaItem(order, fotosCatalogo?.byId, fotosCatalogo?.byTitle));
  }, [canal, fotosCatalogo, lojaRows, orders]);

  const contagens = useMemo(() => {
    const mapa: Record<StatusAba, number> = {
      todos: itens.length,
      pago: 0,
      enviado: 0,
      entregue: 0,
      pendente: 0,
      cancelado: 0,
    };
    for (const item of itens) mapa[item.grupo] += 1;
    return mapa;
  }, [itens]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = itens.filter((item) => {
      if (aba !== "todos" && item.grupo !== aba) return false;
      if (!termo) return true;
      return (
        item.titulo.toLowerCase().includes(termo) ||
        item.codigo.toLowerCase().includes(termo) ||
        item.comprador.toLowerCase().includes(termo)
      );
    });
    filtrados.sort((a, b) => {
      if (ordem === "valor") return b.valor - a.valor;
      const left = new Date(a.data ?? 0).getTime();
      const right = new Date(b.data ?? 0).getTime();
      return ordem === "antigos" ? left - right : right - left;
    });
    return filtrados;
  }, [aba, busca, itens, ordem]);

  const carregando = canal === "loja" ? lojaCarregando : isLoading;
  const pedidoMl = (id: string) => orders.find((order) => String(order.id) === id);

  const proximaOrdem = () => {
    setOrdem((atual) => (atual === "recentes" ? "antigos" : atual === "antigos" ? "valor" : "recentes"));
  };

  const rotuloOrdem = ordem === "recentes" ? "Mais recentes" : ordem === "antigos" ? "Mais antigos" : "Maior valor";

  return (
    <div className="velo-fonte-inter min-h-full bg-white pb-4 text-[#111111]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <p className="text-[28px] font-semibold tracking-[-0.04em]" role="heading" aria-level={1}>
            Pedidos
          </p>
          <button
            type="button"
            onClick={() => setFiltrosAbertos((aberto) => !aberto)}
            aria-label="Filtros"
            aria-pressed={filtrosAbertos}
            className={`relative inline-flex h-9 w-9 items-center justify-center rounded-[12px] border bg-white active:scale-95 ${
              filtrosAbertos || canal === "loja" ? "border-[#111111]" : "border-black/[0.08]"
            }`}
          >
            <SlidersHorizontal size={16} strokeWidth={1.9} />
            {canal === "loja" && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#111111]" />}
          </button>
        </div>

        <div className="mobile-hide-scrollbar relative flex gap-5 overflow-x-auto border-b border-black/[0.06] px-5">
          {ABAS.map((item) => {
            const ativa = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`relative shrink-0 pb-2.5 pt-1.5 text-[13px] tracking-[-0.01em] transition-colors ${
                  ativa ? "font-semibold text-[#111111]" : "font-normal text-[#8E8E93]"
                }`}
              >
                {item.rotulo}
                <span className={`ml-1 ${ativa ? "text-[#8E8E93]" : "text-[#C7C7CC]"}`}>{contagens[item.id]}</span>
                {ativa && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#111111]" />}
              </button>
            );
          })}
        </div>

        {filtrosAbertos && (
          <div className="border-b border-black/[0.06] bg-white px-5 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">Canal</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { id: "ml" as const, rotulo: "Mercado Livre" },
                  { id: "loja" as const, rotulo: "Minha Loja" },
                ]
              ).map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => {
                    setCanal(opcao.id);
                    setAba("todos");
                    setMenuAberto(null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[13px] ${
                    canal === opcao.id ? "bg-[#111111] text-white" : "bg-[#F2F2F7] text-[#3A3A3C]"
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="flex items-center gap-2 px-5 pt-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar pedido</span>
          <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar"
            className="h-10 w-full rounded-full bg-[#F2F2F7] pl-9 pr-4 text-[15px] text-[#111111] outline-none placeholder:text-[#8E8E93]"
          />
        </label>
        <button
          type="button"
          onClick={proximaOrdem}
          aria-label={`Ordenar: ${rotuloOrdem}`}
          title={rotuloOrdem}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F2F7] text-[#111111] active:scale-95"
        >
          <ArrowUpDown size={16} strokeWidth={1.9} />
        </button>
      </div>

      {supplier ? (
        <button
          type="button"
          onClick={supplier.onOpen}
          className="mx-5 mt-3 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-2xl bg-[#F2F2F7] px-3.5 py-3 text-left active:opacity-70"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#111111]">
            <ShoppingBag size={15} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-[#111111]">Fornecedor</span>
            <span className="block truncate text-[12px] text-[#8E8E93]">{supplier.label}</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-[#2563EB]">{supplier.action}</span>
        </button>
      ) : null}

      <div className="pt-1">
        {carregando ? (
          <div className="divide-y divide-black/[0.06] px-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 py-3.5">
                <span className="h-12 w-12 shrink-0 animate-pulse rounded-[10px] bg-[#F2F2F7]" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block h-3 w-16 animate-pulse rounded bg-[#F2F2F7]" />
                  <span className="block h-4 w-3/4 animate-pulse rounded bg-[#F2F2F7]" />
                  <span className="block h-3 w-1/2 animate-pulse rounded bg-[#F2F2F7]" />
                </span>
              </div>
            ))}
          </div>
        ) : visiveis.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[15px] font-medium text-[#111111]">Nenhum pedido nesta lista</p>
            <p className="mt-1 text-[14px] text-[#8E8E93]">
              {canal === "loja"
                ? "Quando alguém comprar na sua loja, o pedido aparece aqui."
                : "As vendas do Mercado Livre entram aqui depois da sincronização."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06] px-5">
            {visiveis.map((item) => {
              const ml = canal === "ml" ? pedidoMl(item.id) : undefined;
              const podeComprar = Boolean(item.fornecedorUrl);
              return (
                <div key={`${item.canal}-${item.id}`} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuAberto(null);
                      if (ml) onSelect(ml);
                    }}
                    className="flex w-full items-start gap-3 py-3.5 text-left active:opacity-70"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#F5F5F5]">
                      <FotoPedido srcs={item.imagens} />
                    </span>
                    <span className="min-w-0 flex-1 pr-8">
                      <span className={`block text-[12px] font-medium ${STATUS_COR[item.grupo]}`}>{rotuloDoStatus(item.status)}</span>
                      <span className="mt-0.5 block line-clamp-2 text-[15px] font-medium leading-[20px] tracking-[-0.02em] text-[#111111]">
                        {item.titulo}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-[#8E8E93]">
                        {formatBRL(item.valor)}
                        {" · "}
                        {item.quantidade} un.
                        {" · #"}
                        {item.codigo}
                      </span>
                      {item.rastreio ? (
                        <span className="mt-0.5 block truncate text-[12px] text-[#8E8E93]">Rastreio {item.rastreio}</span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Ações do pedido"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuAberto((atual) => (atual === item.id ? null : item.id));
                    }}
                    className="absolute right-0 top-3.5 grid h-8 w-8 place-items-center rounded-full text-[#8E8E93] active:bg-[#F2F2F7]"
                  >
                    <MoreHorizontal size={18} strokeWidth={1.8} />
                  </button>
                  {menuAberto === item.id ? (
                    <div className="absolute right-0 top-12 z-20 min-w-[188px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                      {ml ? (
                        <button
                          type="button"
                          className="flex w-full items-center px-3.5 py-2.5 text-left text-[14px] text-[#111111]"
                          onClick={() => {
                            setMenuAberto(null);
                            onSelect(ml);
                          }}
                        >
                          Ver pedido
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!podeComprar}
                        className="flex w-full items-center px-3.5 py-2.5 text-left text-[14px] text-[#111111] disabled:text-[#C7C7CC]"
                        onClick={() => {
                          setMenuAberto(null);
                          if (ml) {
                            onBuy(ml);
                            return;
                          }
                          if (item.fornecedorUrl) window.open(item.fornecedorUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        {useBotPurchase ? "Comprar no fornecedor" : "Abrir fornecedor"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileOrdersView;
