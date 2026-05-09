import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSupplierProducts, selectBestSupplier, type SupplierProduct } from "@/hooks/useSupplierEngine";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Truck, DollarSign, Star, Package, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productTitle: string;
}

const formatPrice = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function SupplierCompareModal({ open, onClose, productId, productTitle }: Props) {
  const { data: supplierProducts, isLoading } = useSupplierProducts(productId);
  const { best, ranked } = selectBestSupplier(supplierProducts || []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Fornecedores disponíveis</DialogTitle>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{productTitle}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <AlertTriangle size={32} className="text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum fornecedor disponível</p>
            <p className="text-xs text-muted-foreground mt-1">
              Este produto ainda não possui fornecedores vinculados ou todos estão sem estoque.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 py-2">
            {ranked.map((sp, i) => {
              const isBest = best?.id === sp.id;
              const totalCost = sp.cost_price + sp.shipping_cost;
              return (
                <div
                  key={sp.id}
                  className={`relative rounded-xl border p-3.5 transition-colors ${
                    isBest
                      ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-border bg-background"
                  }`}
                >
                  {isBest && (
                    <span className="absolute -top-2.5 left-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      <Trophy size={10} /> Melhor opção
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {sp.supplier?.name || "Fornecedor"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Score: {sp._score ?? 0}/100
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatPrice(totalCost)}</p>
                      <p className="text-[10px] text-muted-foreground">custo total</p>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-4 gap-2">
                    <Stat icon={DollarSign} label="Custo" value={formatPrice(sp.cost_price)} />
                    <Stat icon={Truck} label="Frete" value={formatPrice(sp.shipping_cost)} />
                    <Stat icon={Package} label="Prazo" value={`${sp.shipping_days}d`} />
                    <Stat icon={Star} label="Nota" value={sp.rating ? `${sp.rating}/5` : "—"} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/50 p-1.5">
      <Icon size={12} className="text-muted-foreground mb-0.5" />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-[11px] font-semibold text-foreground">{value}</p>
    </div>
  );
}
