import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Package,
  Eye,
  MessageSquare,
  X,
  Plus,
  TrendingUp,
  ArrowDownRight,
  RefreshCw,
  ShoppingBag,
  MapPin,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ────────────────────────────────────────────────────────────────────
type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

interface Order {
  id: string;
  external_order_id: string;
  platform: string;
  product_title: string;
  product_image: string | null;
  buyer_name: string | null;
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: OrderStatus;
  tracking_code: string | null;
  ordered_at: string;
  created_at: string;
  buyer_address: string | null;
  buyer_city: string | null;
  buyer_state: string | null;
  buyer_zip: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_number: string | null;
  buyer_neighborhood: string | null;
  cj_order_id: string | null;
  cj_product_url: string | null;
  cj_product_id: string | null;
  supplier?: string;
}

const ITEMS_PER_PAGE = 8;

export default function ProdutosMLPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncOrders = async () => {
    if (!user?.id) return;
    setIsSyncing(true);
    const toastId = veloToast.loading("Sincronizando vendas com o Mercado Livre...");

    try {
      // 1. Try to invoke the Edge Function first
      const { data, error } = await supabase.functions.invoke("ml-sync-orders");

      if (!error && data?.success) {
        veloToast.success(data.message || "Sincronização concluída com sucesso!", { id: toastId });
        refetch();
        return;
      }

      // If the function is not deployed or failed, try fallback client-side sync
      console.warn("Edge Function ml-sync-orders not available or failed, using client-side fallback. Error:", error);

      // Fetch user integration details
      const { data: integration, error: integrationError } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("platform", "mercadolivre")
        .maybeSingle();

      if (integrationError) throw integrationError;

      if (!integration || !integration.access_token) {
        veloToast.error("Por favor, conecte sua conta do Mercado Livre em Integrações primeiro.", { id: toastId });
        return;
      }

      // Check token expiration
      const expiresAt = new Date(integration.expires_at || "");
      if (expiresAt <= new Date()) {
        veloToast.error("Sua sessão do Mercado Livre expirou. Por favor, reconecte sua conta em Integrações.", { id: toastId });
        return;
      }

      const accessToken = integration.access_token;
      const mlUserId = integration.ml_user_id;

      // Fetch from Mercado Livre (using Vite proxy if local)
      const baseUrl = window.location.origin.includes("localhost") ? "/api-meli" : "https://api.mercadolibre.com";
      const searchRes = await fetch(
        `${baseUrl}/orders/search?seller=${mlUserId}&limit=20&sort=date_desc`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!searchRes.ok) {
        throw new Error(`Erro API Mercado Livre: ${searchRes.status}`);
      }

      const searchData = await searchRes.json();
      const mlOrders = searchData.results ?? [];

      let newOrdersCount = 0;

      for (const mlOrder of mlOrders) {
        const mlOrderId = String(mlOrder.id);

        // Check if exists
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", mlOrderId)
          .maybeSingle();

        if (existing) continue;

        // Fetch details
        const orderRes = await fetch(`${baseUrl}/orders/${mlOrderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!orderRes.ok) continue;
        const fullOrder = await orderRes.json();

        const item = fullOrder.order_items?.[0];
        const mlItemId = item?.item?.id;
        const buyer = fullOrder.buyer ?? {};
        const shipping = fullOrder.shipping ?? {};
        const addr = shipping.receiver_address ?? {};

        const buyerName = buyer.nickname ?? buyer.first_name ?? "Comprador";
        const buyerEmail = buyer.email ?? "";
        const buyerPhone = buyer.phone?.number ?? buyer.alternative_phone?.number ?? "";
        const streetName = addr.street_name ?? "";
        const streetNumber = addr.street_number ?? "";
        const buyerAddress = [streetName, streetNumber].filter(Boolean).join(", ");
        const buyerNeighborhood = addr.neighborhood?.name ?? "";
        const buyerCity = addr.city?.name ?? "";
        const buyerState = addr.state?.name ?? "";
        const buyerZip = addr.zip_code ?? "";

        // Lookup publication
        let costPrice = null;

        if (mlItemId) {
          const { data: pub } = await supabase
            .from("user_publications")
            .select("cost_price")
            .eq("ml_item_id", mlItemId)
            .maybeSingle();

          if (pub) {
            costPrice = pub.cost_price ?? null;
          }
        }

        const salePrice = Number(item?.unit_price ?? 0) * Number(item?.quantity ?? 1);
        const profit = costPrice ? salePrice - costPrice : null;

        // Insert order
        const { error: insertError } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            external_order_id: mlOrderId,
            platform: "mercadolivre",
            product_title: item?.item?.title ?? "Produto Mercado Livre",
            product_image: item?.item?.thumbnail_url ?? null,
            buyer_name: buyerName,
            buyer_email: buyerEmail,
            buyer_phone: buyerPhone,
            buyer_address: buyerAddress,
            buyer_number: streetNumber,
            buyer_neighborhood: buyerNeighborhood,
            buyer_city: buyerCity,
            buyer_state: buyerState,
            buyer_zip: buyerZip,
            sale_price: salePrice,
            cost_price: costPrice,
            profit: profit,
            status: fullOrder.status === "paid" ? "paid" : (fullOrder.status === "cancelled" ? "cancelled" : "pending"),
            tracking_code: fullOrder.shipping?.tracking_number ?? null,
            ordered_at: fullOrder.date_created,
          });

        if (!insertError) {
          newOrdersCount++;
        }
      }

      veloToast.success(`Sincronização concluída. ${newOrdersCount} novos pedidos importados.`, { id: toastId });
      refetch();
    } catch (err: any) {
      console.error("Erro na sincronização:", err);
      veloToast.error("Falha ao sincronizar pedidos: " + err.message, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch orders from Supabase
  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["ml-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false });

      if (error) {
        throw error;
      }

      // Map to ensure default supplier if missing
      return (data || []).map((o: any) => ({
        ...o,
        supplier: o.supplier || "C7Drop",
      })) as Order[];
    },
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = orders.length;
    const itemsCount = orders.reduce((acc, _) => acc + 1, 0); // simplified item count (1 per order row)
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const shippedOrDelivered = orders.filter(
      (o) => o.status === "shipped" || o.status === "delivered"
    ).length;

    return {
      total,
      itemsCount,
      cancelled,
      shippedOrDelivered,
    };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Filter by tab
    if (selectedTab === "pending") {
      result = result.filter((o) => o.status === "pending");
    } else if (selectedTab === "paid") {
      result = result.filter((o) => o.status === "paid");
    } else if (selectedTab === "shipped") {
      result = result.filter((o) => o.status === "shipped" || o.status === "delivered");
    } else if (selectedTab === "cancelled") {
      result = result.filter((o) => o.status === "cancelled");
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.buyer_name?.toLowerCase().includes(query) ||
          o.product_title.toLowerCase().includes(query) ||
          o.external_order_id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [orders, selectedTab, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTab, searchQuery]);

  // Simulate Sale
  const handleSimulateSale = async () => {
    if (!user?.id) return;
    setIsSimulating(true);

    const testOrders = [
      {
        user_id: user.id,
        external_order_id: "ML-1002",
        platform: "mercadolivre",
        product_title: "Álbum Copa Do Mundo Fifa 2026 Capa Mole ou Capa Dura",
        product_image: "https://c7drop.com.br/wp-content/uploads/2026/06/2-1.webp",
        buyer_name: "Wade Warren",
        buyer_email: "wade.warren@gmail.com",
        buyer_phone: "(11) 98765-4321",
        buyer_address: "Avenida Paulista",
        buyer_number: "1000",
        buyer_neighborhood: "Bela Vista",
        buyer_city: "São Paulo",
        buyer_state: "SP",
        buyer_zip: "01310-100",
        sale_price: 120.0,
        cost_price: 60.0,
        profit: 60.0,
        status: "pending",
        tracking_code: "BR123456789BR",
        ordered_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        user_id: user.id,
        external_order_id: "ML-1004",
        platform: "mercadolivre",
        product_title: "Fone de Ouvido Bluetooth JBL Tune 510BT Preto",
        product_image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150",
        buyer_name: "Esther Howard",
        buyer_email: "esther.h@yahoo.com.br",
        buyer_phone: "(21) 97654-3210",
        buyer_address: "Rua Barata Ribeiro",
        buyer_number: "350",
        buyer_neighborhood: "Copacabana",
        buyer_city: "Rio de Janeiro",
        buyer_state: "RJ",
        buyer_zip: "22040-002",
        sale_price: 249.9,
        cost_price: 120.0,
        profit: 129.9,
        status: "paid",
        tracking_code: "BR987654321BR",
        ordered_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        user_id: user.id,
        external_order_id: "ML-1007",
        platform: "mercadolivre",
        product_title: "Relógio Inteligente Smartwatch D20 Y68 Bluetooth",
        product_image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150",
        buyer_name: "Jenny Wilson",
        buyer_email: "jenny.wilson@hotmail.com",
        buyer_phone: "(31) 98888-7777",
        buyer_address: "Avenida Afonso Pena",
        buyer_number: "1500",
        buyer_neighborhood: "Centro",
        buyer_city: "Belo Horizonte",
        buyer_state: "MG",
        buyer_zip: "30130-005",
        sale_price: 89.9,
        cost_price: 35.0,
        profit: 54.9,
        status: "shipped",
        tracking_code: "BR111222333BR",
        ordered_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      },
      {
        user_id: user.id,
        external_order_id: "ML-1009",
        platform: "mercadolivre",
        product_title: "Câmera Segurança Wi-Fi Externa 360 Graus Dome HD",
        product_image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150",
        buyer_name: "Guy Hawkins",
        buyer_email: "guy.hawkins@outlook.com",
        buyer_phone: "(41) 99999-8888",
        buyer_address: "Rua XV de Novembro",
        buyer_number: "200",
        buyer_neighborhood: "Centro",
        buyer_city: "Curitiba",
        buyer_state: "PR",
        buyer_zip: "80020-300",
        sale_price: 199.9,
        cost_price: 90.0,
        profit: 109.9,
        status: "delivered",
        tracking_code: "BR444555666BR",
        ordered_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      },
    ];

    try {
      const { error } = await supabase.from("orders").insert(testOrders);
      if (error) throw error;

      veloToast.success("Vendas simuladas no Supabase com sucesso!");
      refetch();
    } catch (err: any) {
      console.error("Erro ao simular vendas:", err);
      veloToast.error("Falha ao simular vendas: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // Navigate to Supplier Chat
  const handleChatSupplier = (order: Order) => {
    const supplierName = order.supplier || "C7Drop";
    const supplierId = supplierName.toLowerCase().replace(/\s+/g, "-");

    navigate("/dashboard/chat-fornecedores", {
      state: {
        supplierId,
        supplierName,
      },
    });
  };

  // Helpers
  const formatBRL = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: OrderStatus) => {
    const configs = {
      pending: { text: "Pendente", bg: "bg-amber-50 text-amber-700 border-amber-200" },
      paid: { text: "Aprovado", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      shipped: { text: "Enviado", bg: "bg-blue-50 text-blue-700 border-blue-200" },
      delivered: { text: "Entregue", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      cancelled: { text: "Cancelado", bg: "bg-rose-50 text-rose-700 border-rose-200" },
    };
    const c = configs[status] || configs.pending;
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c.bg}`}>
        {c.text}
      </span>
    );
  };

  return (
    <div
      className="flex flex-col gap-6 w-full"
      style={{
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-neutral-900">Vendas no Mercado Livre</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Gerencie seus pedidos integrados e acompanhe o envio com os fornecedores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncOrders}
            disabled={isSyncing}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition"
            title="Sincronizar"
          >
            <RefreshCw size={15} className={`mr-2 ${isSyncing || isLoading ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </button>
          <button
            onClick={() => {
              if (orders.length === 0) {
                veloToast.error("Nenhuma venda disponível para exportar.");
                return;
              }
              veloToast.success("Exportando planilha de vendas...");
            }}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
          >
            <Download size={15} className="mr-2" />
            Exportar
          </button>
          <button
            onClick={handleSimulateSale}
            disabled={isSimulating}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {isSimulating ? (
              <RefreshCw size={15} className="mr-2 animate-spin" />
            ) : (
              <Plus size={15} className="mr-2" />
            )}
            Simular Venda
          </button>
        </div>
      </div>

      {/* ── KPI Widgets ────────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Total de Pedidos</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-neutral-900">{kpis.total}</h3>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-600">
                <TrendingUp size={10} className="mr-0.5" /> +25.2%
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">últimos 30 dias</p>
          </div>
          <div className="w-16 h-10">
            <svg className="w-full h-full text-emerald-500" viewBox="0 0 100 40">
              <path
                d="M 0 35 Q 15 20, 30 25 T 60 10 T 90 5 T 100 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Itens Vendidos</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-neutral-900">{kpis.itemsCount}</h3>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-600">
                <TrendingUp size={10} className="mr-0.5" /> +18.2%
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">produtos entregues</p>
          </div>
          <div className="w-16 h-10">
            <svg className="w-full h-full text-emerald-500" viewBox="0 0 100 40">
              <path
                d="M 0 30 Q 10 32, 20 20 T 50 15 T 80 5 T 100 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Devoluções</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-neutral-900">{kpis.cancelled}</h3>
              <span className="inline-flex items-center text-[10px] font-bold text-rose-500">
                <ArrowDownRight size={10} className="mr-0.5" /> -1.2%
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">taxa média</p>
          </div>
          <div className="w-16 h-10">
            <svg className="w-full h-full text-rose-500" viewBox="0 0 100 40">
              <path
                d="M 0 5 Q 25 10, 50 15 T 75 32 T 100 38"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Pedidos Enviados</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-neutral-900">{kpis.shippedOrDelivered}</h3>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-600">
                <TrendingUp size={10} className="mr-0.5" /> +12.2%
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">taxa de sucesso</p>
          </div>
          <div className="w-16 h-10">
            <svg className="w-full h-full text-emerald-500" viewBox="0 0 100 40">
              <path
                d="M 0 35 Q 20 28, 40 30 T 70 18 T 100 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Table controls and filters ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between bg-neutral-50/50">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 p-0.5 bg-neutral-100 rounded-xl max-w-fit">
            {[
              { id: "all", label: "Todos" },
              { id: "pending", label: "Pendentes" },
              { id: "paid", label: "Aprovados" },
              { id: "shipped", label: "Enviados" },
              { id: "cancelled", label: "Cancelados" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedTab === tab.id
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, pedido ou item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-neutral-200 pl-9 pr-4 text-xs bg-white text-neutral-800 placeholder-neutral-400 focus:border-blue-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* ── Orders Table ───────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-10 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : paginatedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="rounded-full bg-neutral-100 p-4 mb-4">
                <ShoppingBag size={28} className="text-neutral-400" />
              </div>
              <h3 className="text-base font-semibold text-neutral-950">Nenhuma venda encontrada</h3>
              <p className="mt-1 text-sm text-neutral-500 max-w-xs">
                {searchQuery
                  ? "Não encontramos nenhuma venda que corresponda aos filtros de pesquisa atuais."
                  : "Você ainda não possui pedidos sincronizados nesta conta."}
              </p>
              {!searchQuery && orders.length === 0 && (
                <button
                  onClick={handleSimulateSale}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                >
                  <Plus size={15} className="mr-2" />
                  Simular Primeiro Pedido
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/30 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-5 w-4">
                    <input
                      type="checkbox"
                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-3 px-4">Pedido</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Pagamento</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Entrega</th>
                  <th className="py-3 px-4 text-center">Itens</th>
                  <th className="py-3 px-4">Status Envio</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm">
                {paginatedOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-neutral-50/50 transition duration-150 group"
                  >
                    <td className="py-4 px-5">
                      <input
                        type="checkbox"
                        className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-4 px-4 font-semibold text-neutral-900">
                      #{order.external_order_id}
                    </td>
                    <td className="py-4 px-4 text-neutral-500 font-medium">
                      {formatDate(order.ordered_at)}
                    </td>
                    <td className="py-4 px-4 font-medium text-neutral-800">
                      {order.buyer_name || "Comprador anônimo"}
                    </td>
                    <td className="py-4 px-4">
                      {order.status === "cancelled" ? (
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          Recusado
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Sucesso
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-semibold text-neutral-900">
                      {formatBRL(order.sale_price)}
                    </td>
                    <td className="py-4 px-4 text-neutral-500 font-medium">
                      {order.status === "pending" ? "N/A" : "Mercado Envios"}
                    </td>
                    <td className="py-4 px-4 text-center text-neutral-600 font-medium">
                      1 item
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(order.status)}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition"
                          title="Visualizar Venda"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleChatSupplier(order)}
                          className="p-1.5 text-neutral-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
                          title="Falar com Fornecedor"
                        >
                          <MessageSquare size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Table Footer (Pagination) ──────────────────────────────────────────────── */}
        {!isLoading && filteredOrders.length > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50/50 p-4">
            <span className="text-xs font-semibold text-neutral-500">
              Mostrando {Math.min(filteredOrders.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}-
              {Math.min(filteredOrders.length, currentPage * ITEMS_PER_PAGE)} de{" "}
              {filteredOrders.length} vendas
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                    currentPage === page
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Details Modal ──────────────────────────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-neutral-100 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-150 p-5 bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-900 text-lg">
                  Pedido #{selectedOrder.external_order_id}
                </span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-200/50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Product and Cost Grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2 border border-neutral-150 rounded-xl p-4 flex gap-3 bg-neutral-50/30">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100 flex items-center justify-center border border-neutral-200">
                    {selectedOrder.product_image ? (
                      <img
                        src={selectedOrder.product_image}
                        alt={selectedOrder.product_title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={24} className="text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      Item do Pedido
                    </p>
                    <h4 className="mt-0.5 text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug">
                      {selectedOrder.product_title}
                    </h4>
                  </div>
                </div>

                <div className="border border-neutral-150 rounded-xl p-4 flex flex-col justify-center bg-blue-50/20">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Lucro Estimado
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-600">
                    {formatBRL(selectedOrder.profit)}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">margem líquida</p>
                </div>
              </div>

              {/* Finance detail cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border border-neutral-150 rounded-xl p-3.5 bg-white text-center">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Valor de Venda (ML)
                  </p>
                  <p className="mt-1 text-base font-bold text-neutral-900">
                    {formatBRL(selectedOrder.sale_price)}
                  </p>
                </div>
                <div className="border border-neutral-150 rounded-xl p-3.5 bg-white text-center">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Custo no Fornecedor
                  </p>
                  <p className="mt-1 text-base font-bold text-neutral-900">
                    {formatBRL(selectedOrder.cost_price)}
                  </p>
                </div>
                <div className="border border-neutral-150 rounded-xl p-3.5 bg-white text-center">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Fornecedor
                  </p>
                  <p className="mt-1 text-xs font-bold text-blue-600 truncate">
                    {selectedOrder.supplier}
                  </p>
                </div>
              </div>

              {/* Grid 2 Columns: Client details & Logistics */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Comprador */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Dados do Comprador
                  </h4>
                  <div className="space-y-2 text-sm text-neutral-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900">
                        {selectedOrder.buyer_name || "—"}
                      </span>
                    </div>
                    {selectedOrder.buyer_email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-neutral-400" />
                        <span className="truncate">{selectedOrder.buyer_email}</span>
                      </div>
                    )}
                    {selectedOrder.buyer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-neutral-400" />
                        <span>{selectedOrder.buyer_phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logistics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Entrega e Logística
                  </h4>
                  <div className="space-y-2 text-sm text-neutral-600">
                    {selectedOrder.buyer_address && (
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-neutral-400 mt-0.5 shrink-0" />
                        <span>
                          {selectedOrder.buyer_address}, {selectedOrder.buyer_number}
                          {selectedOrder.buyer_neighborhood && `, ${selectedOrder.buyer_neighborhood}`}
                          <br />
                          {selectedOrder.buyer_city} - {selectedOrder.buyer_state}
                          <br />
                          CEP: {selectedOrder.buyer_zip}
                        </span>
                      </div>
                    )}
                    {selectedOrder.tracking_code && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="rounded bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 text-xs font-bold">
                          Rastreio: {selectedOrder.tracking_code}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-neutral-150 p-5 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
                <Calendar size={13} />
                Venda em {formatDate(selectedOrder.ordered_at)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    handleChatSupplier(selectedOrder);
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                >
                  <MessageSquare size={14} className="mr-1.5" />
                  Contatar Fornecedor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
