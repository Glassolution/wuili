import { ShoppingBag, ExternalLink, Headphones } from "lucide-react";

const OrdersPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Pedidos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe os pedidos dos seus produtos publicados.
        </p>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShoppingBag size={48} className="text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-foreground">Nenhum pedido ainda</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Seus pedidos aparecerão aqui quando alguém comprar seus produtos no Mercado Livre.
        </p>
      </div>

      {/* Supplier contact card */}
      <div className="card-wuili p-6 max-w-lg mx-auto">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Headphones size={18} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Suporte ao Fornecedor</h3>
            <p className="text-xs text-muted-foreground">
              Para dúvidas sobre entrega, rastreamento ou troca de produtos.
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-bold text-background hover:opacity-80 transition-opacity"
            >
              <ExternalLink size={11} />
              Contato do fornecedor
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
