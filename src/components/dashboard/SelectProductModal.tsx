import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Package, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Product = {
  id: string;
  title: string;
  images: any;
  cost_price: number;
  suggested_price: number;
  category: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
};

const getImage = (images: any): string | null => {
  try {
    const arr = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch { return null; }
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SelectProductModal = ({ open, onClose, onSelect }: Props) => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const { data, isLoading } = useQuery({
    queryKey: ["catalog-select", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/catalog?${params}`, {
        headers: { Authorization: `Bearer ${anonKey}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open,
  });

  const products: Product[] = useMemo(() => data?.products || [], [data]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1a1c1c]">Selecionar Produto</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                  <Skeleton className="aspect-square w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package size={40} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((p) => {
                const img = getImage(p.images);
                return (
                  <div key={p.id} className="rounded-xl border border-gray-100 overflow-hidden hover:border-gray-300 transition-all group">
                    <div className="aspect-square bg-gray-50 overflow-hidden">
                      {img ? (
                        <img src={img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={32} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-medium text-[#1a1c1c] line-clamp-2 leading-tight">{p.title}</p>
                      <p className="text-xs text-gray-400">{formatBRL(p.suggested_price)}</p>
                      <button
                        onClick={() => { onSelect(p); onClose(); }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#000000] text-white text-xs font-semibold py-2 hover:bg-[#3b3b3b] active:scale-95 transition-all"
                      >
                        <Check size={12} />
                        Selecionar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {(data?.totalPages || 1) > 1 && (
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-500">{page} / {data?.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(data?.totalPages || 1, p + 1))}
              disabled={page === (data?.totalPages || 1)}
              className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectProductModal;
