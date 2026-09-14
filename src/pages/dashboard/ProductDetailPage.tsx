import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Image as ImageIcon, Package } from "lucide-react";
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

// Retorno da edge function ml-item-details (fotos e status vivos no ML).
type MlItemDetails = {
  connected?: boolean;
  ok?: boolean;
  status?: string | null;
  permalink?: string | null;
  available_quantity?: number | null;
  sold_quantity?: number | null;
  pictures?: string[];
};

// Como cada status do Mercado Livre aparece para o lojista.
const STATUS_META: Record<string, { label: string; dot: string; chip: string; hint: string }> = {
  active: {
    label: "Ativo",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    hint: "O anúncio está publicado e aceitando vendas.",
  },
  paused: {
    label: "Pausado",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-600/15",
    hint: "O anúncio não aparece nas buscas até ser reativado no Mercado Livre.",
  },
  under_review: {
    label: "Em revisão",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 ring-blue-600/15",
    hint: "O Mercado Livre está revisando este anúncio.",
  },
  payment_required: {
    label: "Pagamento pendente",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-600/15",
    hint: "O Mercado Livre aguarda um pagamento para publicar o anúncio.",
  },
  inactive: {
    label: "Desativado",
    dot: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
    hint: "O anúncio está fora do ar no Mercado Livre.",
  },
  closed: {
    label: "Encerrado",
    dot: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
    hint: "O anúncio foi encerrado e não pode mais receber vendas.",
  },
};

const statusMeta = (status?: string | null) => {
  const key = String(status ?? "").toLowerCase();
  return (
    STATUS_META[key] ?? {
      label: status ? String(status) : "Sem status",
      dot: "bg-zinc-400",
      chip: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
      hint: "Status informado pelo Mercado Livre.",
    }
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  // ── Fotos e status vivos do anúncio ────────────────────────────────────────
  // A API do ML exige token (nem itens públicos abrem direto do navegador), por
  // isso a busca passa pela edge function ml-item-details.
  const { data: mlItem, isLoading: loadingMlItem } = useQuery<MlItemDetails | null>({
    queryKey: ["ml-item-details", product?.ml_item_id],
    enabled: !!product?.ml_item_id,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ml-item-details", {
        body: { ml_item_id: product!.ml_item_id },
      });
      if (error) {
        console.warn("[ProductDetailPage] ml-item-details indisponível", error);
        return null;
      }
      return data as MlItemDetails;
    },
  });

  // ── Local State ────────────────────────────────────────────────────────────
  // Apenas campos que realmente são salvos: título e preço vão para o Mercado
  // Livre; o custo interno fica só na Velo.
  const [title, setTitle] = useState("");
  const [retailPrice, setRetailPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);

  useEffect(() => {
    if (product) {
      setTitle(product.title);
      setRetailPrice(product.price ?? 0);
      setCostPrice(product.cost_price ?? 0);
    }
  }, [product]);

  // ── Mutation ───────────────────────────────────────────────────────────────
  // A edge function ml-update-listing atualiza o anúncio no Mercado Livre e só
  // depois grava em user_publications.
  const updateMutation = useMutation({
    onMutate: () => {
      const toastId = veloToast.loading("Sincronizando com Mercado Livre...");
      return { toastId };
    },
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ml-update-listing", {
        body: {
          publication_id: id,
          title,
          price: retailPrice,
          cost_price: costPrice,
        },
      });
      if (error) {
        const detalhe = await (error as { context?: { json?: () => Promise<{ error?: string }> } })
          .context?.json?.()
          .catch(() => null);
        throw new Error(detalhe?.error || "Não foi possível atualizar o anúncio no Mercado Livre.");
      }
      const resposta = data as { ok?: boolean; error?: string; warnings?: string[] };
      if (!resposta?.ok) throw new Error(resposta?.error || "Não foi possível atualizar o anúncio.");
      return resposta;
    },
    onSuccess: (resposta, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["publication", id] });
      queryClient.invalidateQueries({ queryKey: ["user-publications"] });
      queryClient.invalidateQueries({ queryKey: ["ml-item-details"] });
      const aviso = resposta?.warnings?.[0];
      if (aviso) {
        veloToast.error(`${aviso} As demais alterações foram aplicadas.`, { id: context?.toastId });
      } else {
        veloToast.success("Anúncio atualizado no Mercado Livre.", { id: context?.toastId });
      }
    },
    onError: (error, _variables, context) => {
      const message = error instanceof Error ? error.message : "Erro ao atualizar anúncio.";
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

  // O ML é a fonte da verdade do status; o banco é o fallback offline.
  const liveStatus = mlItem?.ok ? mlItem.status ?? product.status : product.status;
  const currentStatus = statusMeta(liveStatus);
  const galleryImages = (mlItem?.pictures?.length ? mlItem.pictures : [product.thumbnail]).filter(
    (image): image is string => typeof image === "string" && image.length > 0,
  );

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-4 text-[12px] text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${currentStatus.chip}`}
          title={currentStatus.hint}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} />
          {currentStatus.label}
        </span>
        <span>SKU {product.ml_item_id?.slice(0, 8) || "N/A"}</span>
        <span>·</span>
        <span>Criado em {formatDate(product.created_at)}</span>
        <span>·</span>
        <span>Atualizado {formatDate(product.created_at)}</span>
        {product.permalink && (
          <>
            <span>·</span>
            <a
              href={product.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-dotted underline-offset-2"
            >
              Ver no Mercado Livre
            </a>
          </>
        )}
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_320px]">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          
          {/* Image Gallery */}
          <div className="rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between pb-4">
              <h3 className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
                Fotos do anúncio
              </h3>
              <span className="text-[12px] text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                {loadingMlItem && galleryImages.length <= 1
                  ? "Carregando..."
                  : `${galleryImages.length} ${galleryImages.length === 1 ? "foto" : "fotos"}`}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {galleryImages.map((image, index) => (
                <div key={`${image}-${index}`} className="aspect-square overflow-hidden rounded-xl bg-gray-50">
                  <img
                    src={image}
                    alt={`${product.title} — foto ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}

              {galleryImages.length === 0 && (
                <div className="flex aspect-square items-center justify-center rounded-xl bg-gray-50">
                  <ImageIcon size={24} strokeWidth={1.5} className="text-muted-foreground/40" />
                </div>
              )}

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

              <p className="text-[11.5px] leading-4 text-muted-foreground">
                O título é enviado ao Mercado Livre ao salvar. Anúncios que já tiveram vendas não
                permitem troca de título — nesse caso avisamos e o preço é atualizado mesmo assim.
              </p>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          
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
                  Preço de venda
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                />
                <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
                  Este é o preço do anúncio no Mercado Livre. Ao salvar, ele é atualizado lá.
                </p>
              </div>

              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Custo interno (fornecedor)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] text-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
                />
                <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
                  Só para o seu controle de lucro na Velo. Não é enviado ao Mercado Livre.
                </p>
              </div>

              {/* Somente leitura: quem manda no status é o Mercado Livre. Salvar
                  outro valor aqui só mentiria até o próximo sync (a cada 6h). */}
              <div>
                <label className="text-[12px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                  Status do anúncio
                </label>
                <div className="mt-1.5 rounded-lg border border-black/[0.08] bg-gray-50 px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} />
                    {currentStatus.label}
                  </span>
                  <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">{currentStatus.hint}</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
