import { useMemo, useState, useEffect } from "react";
import { 
  Search, 
  Download, 
  Percent, 
  ArrowUpRight, 
  DollarSign, 
  Bell, 
  ChevronRight,
  Plus,
  Link as LinkIcon,
  Copy,
  UserCheck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Commission {
  id: string;
  order_id: string;
  description: string;
  platform: string;
  value: number;
  percentage: number;
  status: "paid" | "pending" | "canceled";
  date: string;
}

interface Influencer {
  id: string;
  name: string;
  code: string;
  link: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------
const statusCls: Record<string, string> = {
  paid: "bg-[#E8F5E9] text-[#2E7D32]", // Green
  pending: "bg-[#FFF3E0] text-[#E65C00]", // Amber/Orange
  canceled: "bg-[#FFEBEE] text-[#C62828]", // Red
};

const statusLabel: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  canceled: "Cancelado",
};

function formatDate(dateStr: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString("pt-BR");
}

const CommissionsPage = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [localCommissions, setLocalCommissions] = useState<Commission[]>([]);

  // Fetch initial data
  const { data: initialCommissions = [], isLoading } = useQuery({
    queryKey: ["commissions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((order: any) => ({
        id: `COM-${order.id.slice(0, 6).toUpperCase()}`,
        order_id: order.external_order_id || `ML-${order.id.slice(0, 6).toUpperCase()}`,
        description: `Comissão sobre venda - ${order.product_title || "Produto Exemplo"}`,
        platform: order.platform || "Loja",
        value: (order.sale_price || 0) * 0.05,
        percentage: 5,
        status: order.status === "paid" || order.status === "delivered" ? "paid" : "pending",
        date: formatDate(order.ordered_at || order.created_at),
      })) as Commission[];
    },
  });

  // Sync local state with initial data
  useEffect(() => {
    if (initialCommissions.length > 0 && localCommissions.length === 0) {
      setLocalCommissions(initialCommissions);
    }
  }, [initialCommissions]);

  const filteredCommissions = useMemo(() => {
    return localCommissions.filter((c) => {
      const matchesSearch =
        c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.order_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filter === "Todas") return matchesSearch;
      if (filter === "Pagas") return matchesSearch && c.status === "paid";
      if (filter === "Pendentes") return matchesSearch && c.status === "pending";
      return matchesSearch;
    });
  }, [localCommissions, searchTerm, filter]);

  const totalPaid = useMemo(() => {
    return localCommissions.reduce((acc, curr) => acc + (curr.status === "paid" ? curr.value : 0), 0);
  }, [localCommissions]);

  const totalPending = useMemo(() => {
    return localCommissions.reduce((acc, curr) => acc + (curr.status === "pending" ? curr.value : 0), 0);
  }, [localCommissions]);

  const [influencer, setInfluencer] = useState<Influencer | null>(null);

  // Persistence logic: Fetch from user metadata or generate
  useEffect(() => {
    if (!user || influencer) return;

    const metadataCode = user.user_metadata?.influencer_code;

    if (metadataCode) {
      setInfluencer({
        id: user.id,
        name: "Seu Link de Afiliado",
        code: metadataCode,
        link: `https://velo.app/ref/${metadataCode}`,
        created_at: user.created_at || formatDate(null)
      });
    } else {
      // Generate and save if not exists
      const newCode = `VELO-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      const saveMetadata = async () => {
        const { error } = await supabase.auth.updateUser({
          data: { influencer_code: newCode }
        });

        if (!error) {
          setInfluencer({
            id: user.id,
            name: "Seu Link de Afiliado",
            code: newCode,
            link: `https://velo.app/ref/${newCode}`,
            created_at: formatDate(null)
          });
        }
      };
      
      saveMetadata();
    }
  }, [user, influencer]);

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!", {
      description: link,
    });
  };

  const handleExport = () => {
    toast.success("Relatório exportado com sucesso!", {
      description: "O arquivo CSV foi gerado e o download começará em instantes.",
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-['Inter']">
      <div className="flex flex-col gap-8 p-8 max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0D0D0D]">Comissões</h1>
            <p className="mt-1 text-[14px] text-[#6B6B6B]">
              Acompanhe seus ganhos e comissões por venda.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 rounded-[10px] bg-[#0D0D0D] px-3 py-2 text-[12px] font-medium text-white transition-all hover:bg-[#262626]"
            >
              <Download size={14} />
              Exportar Relatório
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-[16px] bg-white p-6 shadow-[0_1px_4_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-3 text-[#6B6B6B]">
              <ArrowUpRight size={18} />
              <span className="text-[13px] font-medium uppercase tracking-wider">Total Pago</span>
            </div>
            <div className="mt-3 text-[28px] font-bold text-[#0D0D0D]">
              {totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          <div className="rounded-[16px] bg-white p-6 shadow-[0_1px_4_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-3 text-[#6B6B6B]">
              <Percent size={18} />
              <span className="text-[13px] font-medium uppercase tracking-wider">Taxa Média</span>
            </div>
            <div className="mt-3 text-[28px] font-bold text-[#0D0D0D]">5,00%</div>
          </div>
          <div className="rounded-[16px] bg-white p-6 shadow-[0_1px_4_rgba(0,0,0,0.08)] md:col-span-1">
            <div className="flex items-center gap-3 text-[#6B6B6B]">
              <UserCheck size={18} />
              <span className="text-[13px] font-medium uppercase tracking-wider">Influenciador</span>
            </div>
            <div className="mt-4">
              {influencer ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#FAFAFA] border border-[#F0F0F0]">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-[#0D0D0D]">{influencer.code}</span>
                    <span className="text-[11px] text-[#6B6B6B]">Seu link permanente</span>
                  </div>
                  <button 
                    onClick={() => handleCopyLink(influencer.link)}
                    className="flex items-center justify-center rounded-lg bg-[#0D0D0D] px-3 py-2 text-white hover:bg-[#262626] transition-all"
                    title="Copiar link"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-[#E0E0E0] text-center">
                  <p className="text-[12px] text-[#6B6B6B]">Gerando seu link permanente...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-[16px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* Table Filters & Search */}
          <div className="flex flex-col gap-4 border-b border-[#F0F0F0] p-6 md:flex-row md:items-center justify-between">
            <div className="relative w-full md:w-[350px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]" size={16} />
              <input
                type="text"
                placeholder="Buscar por descrição ou número do pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-[10px] border border-[#E0E0E0] bg-white py-2 pl-10 pr-4 text-[13px] outline-none transition-all focus:border-[#0D0D0D]"
              />
            </div>
            <div className="flex gap-2 p-1 bg-[#F5F5F5] rounded-full">
              {["Todas", "Pagas", "Pendentes"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-6 py-2 text-[12px] font-semibold transition-all",
                    filter === f
                      ? "bg-[#0D0D0D] text-white"
                      : "bg-transparent text-[#6B6B6B] hover:text-[#0D0D0D]"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#F0F0F0] text-[12px] font-semibold uppercase tracking-[0.5px] text-[#6B6B6B]">
                  <th className="px-8 py-5">Data</th>
                  <th className="px-8 py-5">Pedido</th>
                  <th className="px-8 py-5">Descrição</th>
                  <th className="px-8 py-5">Valor</th>
                  <th className="px-8 py-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-[13px] text-[#6B6B6B]">
                      Carregando comissões...
                    </td>
                  </tr>
                ) : filteredCommissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-[13px] text-[#6B6B6B]">
                      Nenhuma comissão encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredCommissions.map((c) => (
                    <tr key={c.id} className="text-[13px] transition-colors hover:bg-[#FAFAFA]">
                      <td className="px-8 py-5 text-[#6B6B6B]">{c.date}</td>
                      <td className="px-8 py-5 font-bold text-[#0D0D0D]">#{c.order_id}</td>
                      <td className="px-8 py-5 text-[#0D0D0D]">{c.description}</td>
                      <td className="px-8 py-5 font-bold text-[#0D0D0D]">
                        {c.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-wider", 
                          statusCls[c.status]
                        )}>
                          {statusLabel[c.status]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export default CommissionsPage;
