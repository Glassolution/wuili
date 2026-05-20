import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

// ============================================================
// MOCK DATA — substituir por dados reais do Supabase futuramente
// ============================================================
type ApprovalProduct = {
  id: string;
  name: string;
  image: string;
  cost: number;
  suggestedPrice: number;
  marginPct: number;
};

type Metric = {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
};

type PublishedItem = {
  id: string;
  name: string;
  image: string;
  status: "ativo" | "pausado";
  sales: number;
  marginPct: number;
};

type AIActivity = {
  id: string;
  time: string;
  text: string;
};

const MOCK_APPROVAL: ApprovalProduct[] = [
  {
    id: "1",
    name: "Luminária LED Dobrável Recarregável",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80",
    cost: 24.9,
    suggestedPrice: 79.9,
    marginPct: 42,
  },
  {
    id: "2",
    name: "Mini Aspirador Portátil USB",
    image: "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=400&q=80",
    cost: 38.5,
    suggestedPrice: 119.9,
    marginPct: 38,
  },
  {
    id: "3",
    name: "Suporte Magnético para Celular Carro",
    image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=400&q=80",
    cost: 12.3,
    suggestedPrice: 49.9,
    marginPct: 51,
  },
];

const MOCK_METRICS: Metric[] = [
  { label: "Produtos no ML", value: "128", delta: "+6", positive: true },
  { label: "Vendas hoje", value: "R$ 1.847", delta: "+12,4%", positive: true },
  { label: "Vendas do mês", value: "R$ 38.219", delta: "+8,1%", positive: true },
  { label: "Margem média", value: "41%", delta: "-1,2%", positive: false },
];

const MOCK_PUBLISHED: PublishedItem[] = [
  {
    id: "p1",
    name: "Fone Bluetooth Esportivo Pro",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 42,
    marginPct: 44,
  },
  {
    id: "p2",
    name: "Garrafa Térmica 1L Inox",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 31,
    marginPct: 39,
  },
  {
    id: "p3",
    name: "Mochila Antifurto Impermeável",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 28,
    marginPct: 47,
  },
  {
    id: "p4",
    name: "Relógio Smartwatch Série 9",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80",
    status: "pausado",
    sales: 19,
    marginPct: 35,
  },
  {
    id: "p5",
    name: "Câmera de Segurança Wi-Fi",
    image: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 14,
    marginPct: 52,
  },
];

const MOCK_ACTIVITY: AIActivity[] = [
  { id: "a1", time: "08h14", text: "47 produtos analisados no CJ Dropshipping" },
  { id: "a2", time: "08h15", text: "3 produtos selecionados com margem acima de 35%" },
  { id: "a3", time: "Ontem 18h22", text: "5 anúncios otimizados no Mercado Livre" },
  { id: "a4", time: "Ontem 09h02", text: "2 produtos publicados no Mercado Livre" },
  { id: "a5", time: "Anteontem 14h40", text: "Catálogo CJ atualizado — 312 novos itens" },
];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ============================================================

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, loja_nome")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("[DashboardHomePage] erro ao buscar perfil:", error);
        return null;
      }

      return data as { display_name?: string | null; loja_nome?: string | null } | null;
    },
  });

  const firstName = useMemo(() => {
    const metadataName =
      (user?.user_metadata?.name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined);
    const source = profile?.display_name?.trim() || metadataName || "";
    return source ? source.split(" ")[0] : "";
  }, [profile?.display_name, user?.user_metadata]);

  const approvalQueue = MOCK_APPROVAL;
  const metrics = MOCK_METRICS;
  const published = MOCK_PUBLISHED;
  const activity = MOCK_ACTIVITY;

  const analyzedCount = 47;
  const pendingCount = approvalQueue.length;

  return (
    <main className="-m-3 min-h-[calc(100vh-96px)] bg-[#F4F4F4] px-4 py-8 text-[#0a0a0a] antialiased [font-family:'Hanken_Grotesk',-apple-system,BlinkMacSystemFont,'Helvetica_Neue',Arial,sans-serif] sm:-m-4 sm:px-8 lg:-m-6 lg:px-12 lg:py-10">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-12 gap-6">
        {/* 1. Header pessoal */}
        <header className="col-span-12">
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-black sm:text-[48px]">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16a34a] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#16a34a]" />
            </span>
            <p className="text-[15px] font-medium text-[#4a4a4a]">
              Última varredura: hoje às 08h — {analyzedCount} produtos analisados,{" "}
              <span className="font-semibold text-black">{pendingCount} aguardando sua aprovação</span>
            </p>
          </div>
        </header>

        {/* 2. Card de destaque — Fila de Aprovação */}
        <section className="col-span-12 rounded-[16px] bg-[#111] p-7 text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-9">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.01em] sm:text-[28px]">
                Produtos encontrados pela IA hoje
              </h2>
              <p className="mt-1.5 text-[14px] text-white/60">
                Revise e aprove para publicar automaticamente no Mercado Livre.
              </p>
            </div>
          </div>

          {approvalQueue.length === 0 ? (
            <div className="rounded-[12px] border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-[15px] text-white/70">
              A IA está varrendo o catálogo. Novos produtos em breve.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {approvalQueue.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-[14px] bg-white text-[#0a0a0a]"
                >
                  <div
                    className="aspect-[4/3] w-full bg-[#f4f4f4] bg-cover bg-center"
                    style={{ backgroundImage: `url(${p.image})` }}
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 min-h-[44px] text-[15px] font-semibold leading-snug">
                      {p.name}
                    </h3>
                    <dl className="mt-4 space-y-1.5 text-[13px]">
                      <div className="flex justify-between text-[#6b6b6b]">
                        <dt>Custo</dt>
                        <dd className="font-medium text-[#0a0a0a]">{formatBRL(p.cost)}</dd>
                      </div>
                      <div className="flex justify-between text-[#6b6b6b]">
                        <dt>Sugerido</dt>
                        <dd className="font-medium text-[#0a0a0a]">{formatBRL(p.suggestedPrice)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#6b6b6b]">Margem</dt>
                        <dd className="font-semibold text-[#16a34a]">{p.marginPct}%</dd>
                      </div>
                    </dl>
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        className="h-10 rounded-[8px] bg-black text-[14px] font-semibold text-white transition hover:bg-[#1f1f1f]"
                      >
                        Aprovar e Publicar
                      </button>
                      <button
                        type="button"
                        className="h-9 rounded-[8px] text-[13px] font-medium text-[#6b6b6b] transition hover:text-[#0a0a0a]"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* 3. Métricas rápidas */}
        <section className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <article
              key={m.label}
              className="rounded-[16px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold tracking-[-0.02em] text-black">
                  {m.value}
                </span>
                {m.delta && (
                  <span
                    className={`text-[13px] font-semibold ${
                      m.positive ? "text-[#16a34a]" : "text-[#dc2626]"
                    }`}
                  >
                    {m.delta}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-[#6b6b6b]">{m.label}</p>
            </article>
          ))}
        </section>

        {/* 4 + 5. Publicados recentemente + Atividade IA */}
        <section className="col-span-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Publicados recentemente */}
          <article className="rounded-[16px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2">
            <header className="mb-5 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-black">
                Publicados recentemente
              </h2>
              <button
                type="button"
                onClick={() => navigate("/dashboard/publicacoes")}
                className="text-[13px] font-medium text-[#6b6b6b] transition hover:text-black"
              >
                Ver tudo
              </button>
            </header>

            <ul className="divide-y divide-[#f1f1f1]">
              {published.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div
                    className="h-12 w-12 flex-shrink-0 rounded-[8px] bg-[#f4f4f4] bg-cover bg-center"
                    style={{ backgroundImage: `url(${item.image})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-black">{item.name}</p>
                    <p className="mt-0.5 text-[12px] text-[#6b6b6b]">
                      {item.sales} vendas · margem {item.marginPct}%
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.status === "ativo"
                        ? "bg-[#e8f5ec] text-[#16a34a]"
                        : "bg-[#f4f4f4] text-[#6b6b6b]"
                    }`}
                  >
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          {/* Atividade da IA */}
          <article className="rounded-[16px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-5 text-[18px] font-semibold tracking-[-0.01em] text-black">
              Atividade da IA
            </h2>
            <ol className="relative space-y-5 border-l border-[#ececec] pl-5">
              {activity.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full bg-black" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                    {a.time}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[#0a0a0a]">{a.text}</p>
                </li>
              ))}
            </ol>
          </article>
        </section>
      </div>
    </main>
  );
}
