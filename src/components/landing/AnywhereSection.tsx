import { ArrowUpRight, BarChart3, PackageCheck, Store } from "lucide-react";

type CardDef = {
  title: string;
  cta: string;
  href: string;
  gradient: string;
  mockup: "dashboard" | "marketplace" | "orders";
};

const cards: CardDef[] = [
  {
    title: "Comece pela plataforma web",
    cta: "Acessar plataforma",
    href: "/login",
    gradient: "linear-gradient(135deg, #111 0%, #1c1c1c 45%, #0a0a0a 100%)",
    mockup: "dashboard",
  },
  {
    title: "Integre ao Mercado Livre",
    cta: "Conectar Mercado Livre",
    href: "/login",
    gradient: "linear-gradient(135deg, #161616 0%, #2a2a2a 52%, #0b0b0b 100%)",
    mockup: "marketplace",
  },
  {
    title: "Gerencie tudo em um só lugar",
    cta: "Ver painel",
    href: "/login",
    gradient: "linear-gradient(135deg, #0a0a0a 0%, #171717 48%, #262626 100%)",
    mockup: "orders",
  },
];

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
    <div className="text-[7px] font-medium uppercase tracking-[0.12em] text-white/35">{label}</div>
    <div className="mt-1 text-[13px] font-bold text-white">{value}</div>
  </div>
);

const MockupDashboard = () => (
  <div className="w-[220px] rounded-xl border border-white/[0.12] bg-[#0a0a0a]/88 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-[9px] font-semibold text-white">Painel Velo</div>
        <div className="text-[7px] text-white/38">Operação web</div>
      </div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
        <BarChart3 size={12} strokeWidth={2.4} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Metric label="Vendas" value="R$ 8,4k" />
      <Metric label="Lucro" value="R$ 2,1k" />
    </div>
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="mb-2 flex items-center justify-between text-[7px] text-white/38">
        <span>Produtos importados</span>
        <span>Hoje</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-white/75" />
        <div className="h-2 w-4/5 rounded-full bg-white/35" />
        <div className="h-2 w-2/3 rounded-full bg-white/20" />
      </div>
    </div>
  </div>
);

const MockupMarketplace = () => (
  <div className="w-[220px] rounded-xl border border-white/[0.12] bg-[#0a0a0a]/88 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
    <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <div>
        <div className="text-[8px] font-semibold text-white">Mercado Livre</div>
        <div className="text-[7px] text-white/38">Conta conectada</div>
      </div>
      <div className="rounded-full bg-white px-2 py-1 text-[7px] font-bold text-black">Ativo</div>
    </div>
    <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.04] p-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-black">
        <Store size={14} strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[8px] font-semibold text-white">Monitor fitness</div>
        <div className="text-[7px] text-white/38">Pronto para publicar</div>
      </div>
      <div className="text-[8px] font-bold text-white">R$ 74</div>
    </div>
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-[8px] text-white/46">
      Categoria, preço e descrição preparados para o marketplace.
    </div>
  </div>
);

const MockupOrders = () => (
  <div className="w-[220px] rounded-xl border border-white/[0.12] bg-[#0a0a0a]/88 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-[9px] font-semibold text-white">Pedidos</div>
        <div className="text-[7px] text-white/38">Acompanhamento centralizado</div>
      </div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
        <PackageCheck size={12} strokeWidth={2.4} />
      </div>
    </div>
    <div className="space-y-2">
      {[
        ["VL-00001", "Em andamento", "R$ 89,90"],
        ["VL-00002", "Enviado", "R$ 124,50"],
        ["VL-00003", "Entregue", "R$ 67,20"],
      ].map(([id, status, price]) => (
        <div key={id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2">
          <div>
            <div className="text-[8px] font-semibold text-white">{id}</div>
            <div className="text-[7px] text-white/38">{status}</div>
          </div>
          <div className="text-[8px] font-bold text-white">{price}</div>
        </div>
      ))}
    </div>
  </div>
);

const AnywhereSection = () => (
  <section className="bg-black px-6 py-[120px] md:px-10">
    <div className="mx-auto max-w-[1200px]">
      <h2 className="mx-auto max-w-[760px] text-center font-['Manrope'] text-[clamp(1.9rem,3.5vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.025em] text-white">
        Uma plataforma web para operar<br className="hidden sm:block" /> seu marketplace com clareza
      </h2>
      <p className="mx-auto mt-5 max-w-[610px] text-center font-['Manrope'] text-[15px] leading-[1.65] text-white/50">
        A Velo reúne catálogo, publicação no Mercado Livre, pedidos e indicadores em um painel online simples de acompanhar.
      </p>
      <div className="mt-8 flex justify-center">
        <a
          href="/login"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-[11px] font-['Manrope'] text-[13px] font-semibold text-black transition hover:bg-white/90"
        >
          Entrar na plataforma
          <ArrowUpRight size={14} strokeWidth={2.5} />
        </a>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#111]"
          >
            <div
              className="relative flex h-[260px] items-center justify-center overflow-hidden"
              style={{ background: card.gradient }}
            >
              {card.mockup === "dashboard" && <MockupDashboard />}
              {card.mockup === "marketplace" && <MockupMarketplace />}
              {card.mockup === "orders" && <MockupOrders />}
            </div>

            <div className="flex flex-col gap-5 p-7">
              <h3 className="font-['Manrope'] text-[16px] font-semibold tracking-[-0.01em] text-white">
                {card.title}
              </h3>
              <a
                href={card.href}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-[12px] font-['Manrope'] text-[13px] font-semibold text-black transition hover:bg-white/90"
              >
                {card.cta}
                <ArrowUpRight size={14} strokeWidth={2.5} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AnywhereSection;
