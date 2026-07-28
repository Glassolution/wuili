import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Image as ImageIcon, Sparkles, Package, Box, Ruler, Weight,
  ChevronDown, TrendingUp, Store, Tag, Layers, Building2
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Publication = {
  id: string;
  ml_item_id: string | null;
  permalink: string | null;
  title: string;
  price: number | null;
  cost_price: number | null;
  thumbnail: string | null;
  status: string;
  user_id: string;
  published_at: string | null;
  created_at: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Mock Sales Data ────────────────────────────────────────────────────────
  const salesData = [
    { date: "Fev 01", current: 420, previous: 380 },
    { date: "Fev 03", current: 450, previous: 410 },
    { date: "Fev 05", current: 480, previous: 440 },
    { date: "Fev 07", current: 520, previous: 470 },
    { date: "Fev 09", current: 490, previous: 450 },
    { date: "Fev 11", current: 550, previous: 500 },
    { date: "Fev 13", current: 580, previous: 520 },
    { date: "Fev 15", current: 620, previous: 560 },
    { date: "Fev 17", current: 590, previous: 540 },
    { date: "Fev 19", current: 650, previous: 590 },
    { date: "Fev 21", current: 680, previous: 610 },
    { date: "Fev 23", current: 720, previous: 650 },
    { date: "Fev 25", current: 760, previous: 680 },
    { date: "Fev 27", current: 800, previous: 720 },
    { date: "Fev 28", current: 840, previous: 750 },
  ];

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: product, isLoading } = useQuery({
    queryKey: ["publication", id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any)
        .select("*")
        .eq("id", id)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as Publication;
    },
  });

  // ── Local State ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("Experience unparalleled performance with this premium product, featuring advanced technology and seamless functionality. Perfect for handling intensive tasks, creative projects, and professional use.");
  const [retailPrice, setRetailPrice] = useState(0);
  const [wholesalePrice, setWholesalePrice] = useState(0);
  const [status, setStatus] = useState("active");
  const [stock, setStock] = useState(150);
  const [weight, setWeight] = useState(5);
  const [length, setLength] = useState(40);
  const [shippingType, setShippingType] = useState<"physical" | "digital">("physical");
  const [category, setCategory] = useState("Laptop");
  const [type, setType] = useState("Electronic");
  const [vendor, setVendor] = useState("");
  const [channel, setChannel] = useState("Fikri Store");

  useEffect(() => {
    if (product) {
      setTitle(product.title);
      setRetailPrice(product.price ?? 0);
      setWholesalePrice(product.cost_price ?? 0);
      setStatus(product.status);
    }
  }, [product]);

  // ── Mutation ───────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    onMutate: () => {
      const toastId = veloToast.loading("Salvando produto...");
      return { toastId };
    },
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_publications" as any)
        .update({
          title,
          price: retailPrice,
          cost_price: wholesalePrice,
          status,
        })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["publication", id] });
      queryClient.invalidateQueries({ queryKey: ["user-publications"] });
      veloToast.success("Produto atualizado com sucesso.", { id: context?.toastId });
    },
    onError: (error, _variables, context) => {
      const message = error instanceof Error ? error.message : "Erro ao atualizar produto.";
      veloToast.error(message, { id: context?.toastId });
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Package size={48} strokeWidth={1.5} className="text-muted-foreground/30" />
        <p className="mt-4 text-[15px] font-medium text-foreground">Produto não encontrado</p>
        <button
          onClick={() => navigate("/dashboard/publicacoes")}
          className="mt-4 rounded-xl bg-[#111111] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black/90"
        >
          Voltar para publicações
        </button>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4">
        <button
          onClick={() => navigate("/dashboard/publicacoes")}
          className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/dashboard/publicacoes")}
            className="rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-[#111111] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-50"
            style={{ letterSpacing: "-0.01em" }}
          >
            <Save size={14} strokeWidth={1.8} />
            <span>{updateMutation.isPending ? "Salvando..." : "Salvar alterações"}</span>
          </button>
        </div>
      </div>

      {/* ── Meta Info ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-4 text-[12px] text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
        <span>SKU {product.ml_item_id?.slice(0, 8) || "N/A"}</span>
        <span>·</span>
        <span>Criado em {formatDate(product.created_at)}</span>
        <span>·</span>
        <span>Atualizado {formatDate(product.created_at)}</span>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_320px]">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          
          {/* Image Gallery */}
          <div className="rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="grid grid-cols-4 gap-3">
              {product.thumbnail ? (
                <div className="aspect-square overflow-hidden rounded-xl bg-gray-50">
                  <img src={product.thumbnail} alt={product.title} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl bg-gray-50">
                  <ImageIcon size={24} strokeWidth={1.5} className="text-muted-foreground/40" />
                </div>
              )}
              
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex aspect-square items-center justify-center rounded-xl bg-gray-50">
                  <ImageIcon size={24} strokeWidth={1.5} className="text-muted-foreground/40" />
                </div>
              ))}
              
              <button className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/[0.08] bg-white transition-colors hover:bg-gray-50">
                <ImageIcon size={20} strokeWidth={1.8} className="text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Adicionar
                </span>
              </button>
            </div>
          </div>

          {/* Product Details */}
          <div className="rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <h3 className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
              Detalhes do produto
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                  style={{ letterSpacing: "-0.01em" }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                    Descrição
                  </label>
                  <button className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700">
                    <Sparkles size={12} strokeWidth={1.8} />
                    <span>Gerar com IA</span>
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                  style={{ letterSpacing: "-0.01em" }}
                />
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <h3 className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
              Envio
            </h3>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShippingType("physical")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
                  shippingType === "physical"
                    ? "border-black bg-white text-foreground"
                    : "border-black/[0.08] bg-white text-muted-foreground hover:bg-gray-50"
                }`}
                style={{ letterSpacing: "-0.01em" }}
              >
                <Package size={14} strokeWidth={1.8} />
                <span>Produto físico</span>
              </button>
              <button
                onClick={() => setShippingType("digital")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
                  shippingType === "digital"
                    ? "border-black bg-white text-foreground"
                    : "border-black/[0.08] bg-white text-muted-foreground hover:bg-gray-50"
                }`}
                style={{ letterSpacing: "-0.01em" }}
              >
                <Box size={14} strokeWidth={1.8} />
                <span>Produto digital ou serviço</span>
              </button>
            </div>

            {shippingType === "physical" && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                    Peso
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                    />
                    <select className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0">
                      <option>Quilograma (kg)</option>
                      <option>Grama (g)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                    Comprimento
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="number"
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                      className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                    />
                    <select className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0">
                      <option>Centímetro (cm)</option>
                      <option>Metro (m)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          
          {/* Total Sales */}
          <div className="rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} strokeWidth={1.8} className="text-muted-foreground" />
                <h3 className="text-[13px] font-semibold text-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Vendas totais
                </h3>
              </div>
              <button className="text-[11px] font-medium text-foreground underline decoration-dotted underline-offset-2">
                Ver detalhes
              </button>
            </div>

            <div className="mt-4">
              <p className="text-[24px] font-bold text-foreground" style={{ letterSpacing: "-0.03em" }}>
                R$ 840,00
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">
                + 1.34% vs mês passado
              </p>
            </div>

            <div className="mt-4 h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#F0F0F0" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
                    }}
                    labelStyle={{ color: "#111111", fontWeight: 600, marginBottom: "4px" }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, ""]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="previous" 
                    stroke="#FDB462" 
                    strokeWidth={2}
                    dot={false}
                    opacity={0.4}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="current" 
                    stroke="#FB923C" 
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Product Organization */}
          <div className="rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <h3 className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
              Organização do produto
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  SKU
                </label>
                <input
                  type="text"
                  value={product.ml_item_id || ""}
                  disabled
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-gray-50 px-3 py-2 text-[13px] text-muted-foreground"
                  style={{ letterSpacing: "-0.01em" }}
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Canal
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <button className="flex flex-1 items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] font-medium text-foreground">
                    <Store size={14} strokeWidth={1.8} />
                    <span>{channel}</span>
                  </button>
                  <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] bg-white transition-colors hover:bg-gray-50">
                    <span className="text-[16px]">+</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  <option>Laptop</option>
                  <option>Smartphone</option>
                  <option>Tablet</option>
                  <option>Acessórios</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  <option>Electronic</option>
                  <option>Clothing</option>
                  <option>Food</option>
                  <option>Books</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Fornecedor
                </label>
                <select
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-muted-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  <option value="">Selecionar fornecedor</option>
                  <option>Fornecedor A</option>
                  <option>Fornecedor B</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Preço Varejo
                </label>
                <input
                  type="number"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Preço Atacado
                </label>
                <input
                  type="number"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  <option value="active">Ativo</option>
                  <option value="pending">Rascunho</option>
                  <option value="paused">Arquivado</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Estoque
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
