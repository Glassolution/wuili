import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, Pencil, Trash2, Loader2, Upload, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { startMercadoLivreOAuth, ML_CONNECT_FALLBACK_MESSAGE } from "@/lib/mercadoLivreOAuth";
import MlMissingInfoModal from "@/components/dashboard/MlMissingInfoModal";
import OwnProductFormModal, { type OwnProduct } from "@/components/dashboard/OwnProductFormModal";

const SUPABASE_URL = "https://nqzpoioxvbqavrtphtoa.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const OwnProductsPanel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OwnProduct | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  // Códigos crus do ML (ex.: "address_pending") quando o cadastro da conta
  // bloqueia a publicação — alimentam o modal que diz o que falta preencher.
  const [mlMissingCodes, setMlMissingCodes] = useState<string[] | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["user-own-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_products" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OwnProduct[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["user-own-products", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["user-publications", user?.id] });
  };

  const handleDelete = async (p: OwnProduct) => {
    if (!confirm(`Excluir "${p.title}"? Isso não remove anúncios já publicados no Mercado Livre.`)) return;
    const { error } = await supabase.from("user_products" as any).delete().eq("id", p.id);
    if (error) return veloToast.error("Não foi possível excluir o produto.");
    veloToast.success("Produto excluído.");
    refresh();
  };

  const handlePublish = async (p: OwnProduct) => {
    if (publishingId) return;
    const images = Array.isArray(p.images) ? p.images : [];
    if (images.length < 3) {
      veloToast.error("Este produto precisa de pelo menos 3 fotos para ser publicado no Mercado Livre.");
      return;
    }
    // O modal deve representar somente a tentativa de publicação atual.
    setMlMissingCodes(null);
    setPublishingId(p.id);
    // Não exibimos toast de carregamento: o botão já comunica o estado.
    const toastId = `ml-publish-${Date.now()}`;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token ?? SUPABASE_ANON;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ml-publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          product: {
            title: p.title,
            description: p.description,
            images,
            price: Number(p.price),
            cost_price: p.cost_price ?? null,
            category: p.category ?? null,
            brand: p.brand ?? null,
            model: p.model ?? null,
            weight: p.weight ?? null,
            length_cm: p.length_cm ?? null,
            width_cm: p.width_cm ?? null,
            height_cm: p.height_cm ?? null,
            available_quantity: p.stock_quantity ?? 10,
            external_id: `own-${p.id.slice(0, 8)}`,
          },
        }),
      });

      const raw = await res.text();
      let body: any = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

      if (!res.ok || body?.error) {
        const code: string | undefined = body?.code;
        const friendly: string | undefined = body?.error || body?.message;

        if (code === "ML_TOKEN_EXPIRED") {
          veloToast.error(friendly || "Sua conexão com o Mercado Livre expirou. Reconecte sua conta.", {
            id: toastId,
            duration: 12000,
            action: { label: "Reconectar", onClick: () => { void startMercadoLivreOAuth(); } },
          });
          return;
        }
        if (code === "ML_SELLER_CANNOT_LIST") {
          veloToast.dismiss(toastId);
          setMlMissingCodes(Array.isArray(body?.seller_codes) ? body.seller_codes : []);
          return;
        }
        if (code === "DUPLICATE_PUBLICATION") {
          veloToast.info("Este produto já foi publicado no seu Mercado Livre.", { id: toastId });
          return;
        }
        if (code === "CATEGORY_REQUIRES_MANUAL" || code === "CATEGORY_LOW_CONFIDENCE") {
          veloToast.error(
            "Essa categoria exige grade de tamanho no Mercado Livre. Ajuste o nome do produto para algo mais específico e tente de novo.",
            { id: toastId, duration: 10000 },
          );
          return;
        }
        veloToast.error(friendly || ML_CONNECT_FALLBACK_MESSAGE, { id: toastId, duration: 10000 });
        return;
      }

      setMlMissingCodes(null);
      await supabase.from("user_products" as any).update({ status: "published" }).eq("id", p.id);
      veloToast.success("Produto publicado no Mercado Livre.", { id: toastId });
      refresh();
    } catch (err) {
      console.error("[own-product] publish:", err);
      veloToast.error(ML_CONNECT_FALLBACK_MESSAGE, { id: toastId });
    } finally {
      setPublishingId(null);
    }
  };

  const list = products ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 pb-4">
        <p className="text-[13px] text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
          Produtos cadastrados por você, fora do catálogo de fornecedores.
        </p>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-black px-3 text-[13px] font-medium text-white transition-colors hover:bg-black/90"
          style={{ letterSpacing: "-0.01em" }}
        >
          <Plus size={14} strokeWidth={1.5} />
          Adicionar produto próprio
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[200px] animate-pulse rounded-2xl border border-black/[0.05] bg-white" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20">
          <Package size={48} strokeWidth={1.5} className="text-muted-foreground/30" />
          <p className="mt-4 text-[15px] font-medium text-foreground">Nenhum produto próprio cadastrado</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Cadastre um produto seu e publique direto no seu Mercado Livre.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const images = Array.isArray(p.images) ? p.images : [];
            const margin = p.cost_price ? ((Number(p.price) - Number(p.cost_price)) / Number(p.price)) * 100 : null;
            return (
              <div
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-black/[0.05] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                    {images[0] ? (
                      <img src={images[0]} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={20} strokeWidth={1.5} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-[14px] font-medium leading-snug text-foreground" style={{ letterSpacing: "-0.01em" }}>
                      {p.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {p.category ?? "Sem categoria"} · {images.length} foto(s)
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${p.status === "published" ? "bg-emerald-500" : "bg-gray-400"}`} />
                    {p.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    Produto próprio
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between border-t border-black/[0.05] pt-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Preço de venda</p>
                    <p className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
                      {formatBRL(Number(p.price))}
                    </p>
                  </div>
                  {margin !== null && (
                    <p className="text-[13px] font-medium text-emerald-600">{margin.toFixed(0)}% margem</p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handlePublish(p)}
                    disabled={publishingId === p.id}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-black px-3 text-[13px] font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-60"
                  >
                    {publishingId === p.id ? (
                      <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                    ) : (
                      <Upload size={14} strokeWidth={1.5} />
                    )}
                    Publicar no Mercado Livre
                  </button>
                  <button
                    onClick={() => { setEditing(p); setFormOpen(true); }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] transition-colors hover:bg-black/[0.02]"
                    aria-label="Editar produto"
                  >
                    <Pencil size={14} strokeWidth={1.5} className="text-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] transition-colors hover:bg-black/[0.02]"
                    aria-label="Excluir produto"
                  >
                    <Trash2 size={14} strokeWidth={1.5} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OwnProductFormModal
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

      <MlMissingInfoModal
        open={mlMissingCodes !== null}
        sellerCodes={mlMissingCodes ?? []}
        onClose={() => setMlMissingCodes(null)}
      />
    </div>
  );
};

export default OwnProductsPanel;
