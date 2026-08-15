import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Copy, Loader2, ShoppingBag } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";

type SaleRow = {
  id: string;
  created_at: string;
  product_title: string | null;
  product_image_url: string | null;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  payment_status: string | null;
  payment_method: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  seller_user_id: string | null;
  seller_name: string | null;
  seller_email: string | null;
  seller_pix_key: string | null;
  seller_pix_key_type: string | null;
};

const PAID_STATUSES = ["paid", "approved", "accredited"];

const brl = (v: number | null | undefined) =>
  `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`;

const dateFmt = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(v));

export default function AdminSalesPage() {
  const { user, loading: authLoading } = useAuth();
  const [settled, setSettled] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-store-sales", "paid"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_store_sales" as never, {
        p_status: "all",
        p_limit: 300,
      } as never);
      if (error) throw error;
      return ((data as { sales?: SaleRow[] } | null)?.sales ?? []) as SaleRow[];
    },
  });

  const sales = useMemo(
    () => (data ?? []).filter((s) => PAID_STATUSES.includes((s.payment_status ?? "").toLowerCase())),
    [data]
  );
  const totals = useMemo(() => {
    const pendingPayout = sales.filter((s) => !settled[s.id]);
    return {
      count: sales.length,
      pendingCount: pendingPayout.length,
      paidValue: sales.reduce((acc, s) => acc + Number(s.total ?? 0), 0),
    };
  }, [sales, settled]);

  const copy = (value: string | null) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success("Chave Pix copiada.");
  };

  const [paying, setPaying] = useState<string | null>(null);

  // O repasse sai da carteira ValidaPay da Velo direto para a chave Pix do vendedor.
  const handlePay = async (s: SaleRow) => {
    if (!s.seller_pix_key) {
      toast.error("Vendedor ainda não cadastrou a chave Pix.");
      return;
    }
    setPaying(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-pay-seller", {
        body: { order_id: s.id },
      });
      const err = (data as { error?: string } | null)?.error;
      if (error || err) throw new Error(err || error?.message || "Falha no repasse");
      setSettled((prev) => ({ ...prev, [s.id]: true }));
      toast.success(`Pix de ${brl(s.total)} enviado para ${s.seller_name ?? "o vendedor"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o Pix.");
    } finally {
      setPaying(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B] text-[#F5F5F5]">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AdminShell active="revenue" userId={user.id} title="Vendas" subtitle="Pedidos pagos com a chave Pix de cada vendedor">
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
            <ShoppingBag size={18} strokeWidth={1.9} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-[#F5F5F5]">Vendas</h1>
            <p className="text-sm text-[#6b7280]">Somente pedidos comprados (pagos), com a chave Pix de cada vendedor.</p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#26262a] bg-[#141416] p-4">
            <p className="text-[12px] font-medium text-[#6b7280]">Pedidos pagos</p>
            <p className="mt-1 text-xl font-semibold text-[#F5F5F5]">{totals.count}</p>
          </div>
          <div className="rounded-xl border border-[#26262a] bg-[#141416] p-4">
            <p className="text-[12px] font-medium text-[#6b7280]">A repassar</p>
            <p className="mt-1 text-xl font-semibold text-[#F5F5F5]">{totals.pendingCount}</p>
          </div>
          <div className="rounded-xl border border-[#26262a] bg-[#141416] p-4">
            <p className="text-[12px] font-medium text-[#6b7280]">Valor pago</p>
            <p className="mt-1 text-xl font-semibold text-[#F5F5F5]">{brl(totals.paidValue)}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-[#6b7280]">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : sales.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2c2c31] bg-[#141416] p-10 text-center text-sm text-[#6b7280]">
Nenhum pedido pago encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#26262a] bg-[#141416]">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead className="bg-[#1a1a1d] text-[11px] uppercase tracking-wide text-[#6b7280]">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Comprador</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Chave Pix do vendedor</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-[#232327] align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.product_image_url ? (
                          <img src={s.product_image_url} alt="" className="h-9 w-9 rounded-md object-cover" />
                        ) : null}
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-medium text-[#F5F5F5]">{s.product_title ?? "—"}</p>
                          <p className="text-[11px] text-[#6b7280]">
                            {s.quantity ?? 1}x {brl(s.unit_price)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#F5F5F5]">{s.buyer_name ?? "—"}</p>
                      <p className="text-[11px] text-[#6b7280]">{s.buyer_email ?? ""}</p>
                      <p className="text-[11px] text-[#6b7280]">{s.buyer_phone ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#F5F5F5]">{s.seller_name ?? "—"}</p>
                      <p className="text-[11px] text-[#6b7280]">{s.seller_email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.seller_pix_key ? (
                        <button
                          type="button"
                          onClick={() => copy(s.seller_pix_key)}
                          className="flex items-center gap-2 rounded-md border border-[#2c2c31] px-2 py-1 text-[12px] hover:bg-[#1f1f23]"
                        >
                          <span className="max-w-[180px] truncate">{s.seller_pix_key}</span>
                          <Copy size={13} />
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#a1a1aa]">Não cadastrada</span>
                      )}
                      <p className="mt-1 text-[11px] uppercase text-[#9a9a96]">{s.seller_pix_key_type ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#F5F5F5]">{brl(s.total)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#232327] px-2 py-1 text-[11px] font-semibold text-[#D4D4D8]">
                        {s.payment_status ?? "—"}
                      </span>
                      <p className="mt-1 text-[11px] text-[#6b7280]">{s.payment_method ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6b7280]">{dateFmt(s.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handlePay(s)}
                        disabled={paying === s.id || settled[s.id]}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-70 ${
                          settled[s.id]
                            ? "border border-[#2c2c31] bg-[#1a1a1d] text-[#6b7280]"
                            : "bg-white text-black hover:bg-[#e7e7e7]"
                        }`}
                      >
                        {paying === s.id ? <Loader2 className="animate-spin" size={14} /> : <Banknote size={14} />}
                        {settled[s.id] ? "Pago" : paying === s.id ? "Enviando" : "Pagar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
