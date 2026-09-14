import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Copy, Loader2, ShoppingBag } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminKPIStat } from "@/components/admin/AdminPrimitives";

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
      <div className="flex h-screen items-center justify-center bg-white text-[#2563EB]">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AdminShell active="sales" userId={user.id} title="Vendas" subtitle="Pedidos pagos com a chave Pix de cada vendedor">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[18px] border border-[#E3E8F4] bg-[#F7FAFF] shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#E3E8F4] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="admin-metric-icon"><ShoppingBag /></span>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#171715]">Controle de vendas</h2>
                <p className="mt-1 text-[12px] text-[#777772]">Pedidos pagos prontos para conferência e repasse via Pix.</p>
              </div>
            </div>
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#D9E4FF] bg-[#EFF6FF] px-3 text-[11px] font-semibold text-[#2563EB]">
              <CheckCircle2 size={13} />
              Somente pagamentos confirmados
            </span>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <MetricCard label="Pedidos pagos" value={String(totals.count)} />
            <MetricCard label="A repassar" value={String(totals.pendingCount)} />
            <MetricCard label="Valor pago" value={brl(totals.paidValue)} />
          </div>
        </section>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center rounded-[18px] border border-[#E8ECF5] bg-white text-[#2563EB]">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : sales.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#D8E1F2] bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
              <ShoppingBag size={20} />
            </div>
            <p className="mt-4 text-[14px] font-semibold text-[#171715]">Nenhum pedido pago encontrado</p>
            <p className="mt-1 text-[12px] text-[#777772]">Quando uma compra for aprovada, ela aparecerá aqui com os dados do vendedor.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-[#E6EAF2] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-[#EEF1F6] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#171715]">Pedidos confirmados</h2>
                <p className="mt-1 text-[11px] text-[#8A8F9B]">{sales.length} venda(s) aguardando acompanhamento</p>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead className="bg-[#F8FAFC] text-[10.5px] uppercase tracking-[0.11em] text-[#8A8F9B]">
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
                  <tr key={s.id} className="border-t border-[#EEF1F6] align-top transition hover:bg-[#F9FBFF]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.product_image_url ? (
                          <img src={s.product_image_url} alt="" className="h-10 w-10 rounded-[10px] border border-[#EEF1F6] object-cover" />
                        ) : null}
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-semibold text-[#171715]">{s.product_title ?? "—"}</p>
                          <p className="text-[11px] text-[#8A8F9B]">
                            {s.quantity ?? 1}x {brl(s.unit_price)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#171715]">{s.buyer_name ?? "—"}</p>
                      <p className="text-[11px] text-[#8A8F9B]">{s.buyer_email ?? ""}</p>
                      <p className="text-[11px] text-[#8A8F9B]">{s.buyer_phone ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#171715]">{s.seller_name ?? "—"}</p>
                      <p className="text-[11px] text-[#8A8F9B]">{s.seller_email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.seller_pix_key ? (
                        <button
                          type="button"
                          onClick={() => copy(s.seller_pix_key)}
                          className="flex items-center gap-2 rounded-[9px] border border-[#DDE6F6] bg-[#F8FAFF] px-2.5 py-1.5 text-[12px] font-medium text-[#273449] transition hover:border-[#BFD0F6] hover:bg-[#EFF6FF]"
                        >
                          <span className="max-w-[180px] truncate">{s.seller_pix_key}</span>
                          <Copy size={13} />
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#9CA3AF]">Não cadastrada</span>
                      )}
                      <p className="mt-1 text-[11px] uppercase text-[#9CA3AF]">{s.seller_pix_key_type ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#171715]">{brl(s.total)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2.5 py-1 text-[11px] font-semibold text-[#087443]">
                        {s.payment_status ?? "—"}
                      </span>
                      <p className="mt-1 text-[11px] text-[#8A8F9B]">{s.payment_method ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6B7280]">{dateFmt(s.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handlePay(s)}
                        disabled={paying === s.id || settled[s.id]}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-70 ${
                          settled[s.id]
                            ? "border border-[#DDE3EE] bg-[#F8FAFC] text-[#7C8493]"
                            : "bg-[#2563EB] text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)] hover:bg-[#1D4ED8]"
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
          </div>
        )}
      </div>
    </AdminShell>
  );
}

const MetricCard = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <AdminKPIStat label={label} value={<span className="admin-kpi-value">{value}</span>} />
);
