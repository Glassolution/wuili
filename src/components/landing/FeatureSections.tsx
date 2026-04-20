import { CatalogMockup, ImportModalMockup, OrdersMockup, OrdersDashboardMockup } from "./DashboardMockups";

/* ────────────────────────────────────────────
   3 seções de feature alternadas (texto + mockup)
   Layout estilo OpenAI Codex deep-dive sections
   ──────────────────────────────────────────── */

/* ═══════════════════════════════════════════
   SECTION 1 — IA que cria anúncios perfeitos
   Texto à esquerda · Mockup à direita
   ═══════════════════════════════════════════ */

const ListingMockup = () => (
  <div className="w-[300px] rounded-[16px] border border-white/[0.08] bg-[#0e0e0e]/95 shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-md">
    {/* User prompt bubble */}
    <div className="mx-4 mt-5 ml-auto w-fit max-w-[200px] rounded-2xl rounded-tr-sm bg-[#2a2a2a] px-4 py-2 text-[10px] leading-[1.5] text-white/90">
      Cria um anúncio de suporte veicular magnético com fotos do fornecedor
    </div>

    {/* AI response */}
    <div className="p-4">
      <div className="mb-2 text-[9px] text-white/40">Pensando 3s</div>
      <div className="mb-1 text-[9px] text-white/40">Gerando anúncio completo</div>

      <div className="mt-3 text-[10px] font-semibold text-white">
        Anúncio pronto:
      </div>

      {/* Generated listing card */}
      <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
        <div className="mb-2 flex gap-2">
          <div className="h-[52px] w-[52px] flex-shrink-0 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.02]" />
          <div className="flex flex-col gap-1">
            <div className="text-[9px] font-semibold leading-tight text-white">
              Suporte Veicular Magnético Universal 360° — Fixa no Painel
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#4ade80]">R$ 49,90</span>
              <span className="text-[8px] text-white/30 line-through">R$ 89,90</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <span className="rounded bg-[#4ade80]/10 px-1.5 py-[2px] text-[7px] font-semibold text-[#4ade80]">Margem 47%</span>
          <span className="rounded bg-white/[0.06] px-1.5 py-[2px] text-[7px] font-semibold text-white/40">SEO otimizado</span>
          <span className="rounded bg-white/[0.06] px-1.5 py-[2px] text-[7px] font-semibold text-white/40">5 fotos</span>
        </div>
      </div>

      {/* Composer */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <span className="text-[9px] text-white/30">Aprovar e publicar</span>
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] text-black">↑</div>
      </div>
    </div>
  </div>
);

const FeatureCreateListings = () => (
  <section className="bg-black px-6 py-[100px] md:px-10">
    <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
      {/* Text — left */}
      <div>
        <h3 className="mb-5 font-['Manrope'] text-[clamp(1.5rem,2.5vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
          Cria anúncios completos em segundos
        </h3>
        <p className="font-['Manrope'] text-[15px] leading-[1.65] text-white/55">
          Diga o produto que quer vender e a IA faz o resto — título com SEO,
          descrição persuasiva, fotos tratadas do fornecedor e preço com margem
          já calculada. Você só aprova com um clique. Se quiser ajustar, é só
          pedir em linguagem natural.
        </p>
      </div>

      {/* Gradient card — right */}
      <div
        className="relative flex items-center justify-center rounded-[24px]"
        style={{
          background: "linear-gradient(135deg, #111 0%, #1c1c1c 40%, #2a2a2a 100%)",
          minHeight: "480px",
          padding: "32px",
        }}
      >
        <ImportModalMockup />
      </div>
    </div>
  </section>
);


/* ═══════════════════════════════════════════
   SECTION 2 — Automações em segundo plano
   Mockup à esquerda · Texto à direita
   ═══════════════════════════════════════════ */

const AutomationsMockup = () => (
  <div className="w-[320px] rounded-[16px] border border-white/[0.08] bg-[#0e0e0e]/95 p-4 shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-md font-['Manrope']">
    {/* Up next */}
    <div className="mb-3 text-[10px] font-semibold text-white/50">Próximas tarefas</div>

    {[
      { icon: "↻", name: "Monitorar preços", channel: "ML", badge: "A cada 2h", badgeColor: "bg-[#0a0a0a] text-white", status: "Em andamento" },
      { icon: "◉", name: "Restock alert", channel: "Shopee", badge: "Diário 9h", badgeColor: "bg-[#2563eb] text-white", status: "Inicia em 13m" },
      { icon: "✎", name: "Atualizar títulos", channel: "ML", badge: "Seg 8h", badgeColor: "bg-[#0d9488] text-white", status: "Inicia em 4h" },
      { icon: "↻", name: "Sync fornecedores", channel: "Ali", badge: "Diário 7h", badgeColor: "bg-[#ea580c] text-white", status: "Inicia em 3d" },
    ].map((t, i) => (
      <div key={i} className="mb-[6px] flex items-center justify-between rounded-lg px-2 py-[7px] text-[10.5px] text-white/80 hover:bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <span className="text-white/35">{t.icon}</span>
          <span className="font-medium">{t.name}</span>
          <span className="text-white/30">{t.channel}</span>
          <span className={`rounded px-1.5 py-[1px] text-[8px] font-bold ${t.badgeColor}`}>{t.badge}</span>
        </div>
        <span className="text-[9px] text-white/30">{t.status}</span>
      </div>
    ))}

    {/* Concluídas */}
    <div className="mb-2 mt-4 text-[10px] font-semibold text-white/50">Concluídas</div>

    {[
      { icon: "✓", name: "Monitorar preços", channel: "ML", time: "1d" },
      { icon: "✓", name: "Responder perguntas", channel: "Shopee", time: "1d" },
      { icon: "✓", name: "Sync fornecedores", channel: "Ali", time: "2d" },
    ].map((t, i) => (
      <div key={i} className="mb-[4px] flex items-center justify-between rounded-lg px-2 py-[6px] text-[10.5px] text-white/40">
        <div className="flex items-center gap-2">
          <span className="text-[#4ade80]">{t.icon}</span>
          <span>{t.name}</span>
          <span className="text-white/20">{t.channel}</span>
        </div>
        <span className="text-[9px] text-white/20">{t.time}</span>
      </div>
    ))}
  </div>
);

const FeatureAutomations = () => (
  <section className="bg-black px-6 py-[100px] md:px-10">
    <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
      {/* Gradient card — left */}
      <div
        className="relative flex items-center justify-center rounded-[24px]"
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 40%, #1e1e1e 100%)",
          minHeight: "520px",
          padding: "32px",
        }}
      >
        <OrdersMockup />
      </div>

      {/* Text — right */}
      <div>
        <h3 className="mb-5 font-['Manrope'] text-[clamp(1.5rem,2.5vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
          Trabalha em segundo plano, o tempo todo
        </h3>
        <p className="font-['Manrope'] text-[15px] leading-[1.65] text-white/55">
          As automações da Velo rodam sem você precisar pedir.
          Monitoramento de preços a cada 2 horas, alertas de estoque baixo,
          sync com fornecedores e atualização de títulos com SEO — tudo acontece
          em segundo plano enquanto você foca no que importa: escolher os
          próximos produtos para vender.
        </p>
      </div>
    </div>
  </section>
);


/* ═══════════════════════════════════════════
   SECTION 3 — IA responde compradores
   Texto à esquerda · Mockup à direita
   ═══════════════════════════════════════════ */

const ChatMockup = () => (
  <div className="w-[300px] rounded-[16px] border border-white/[0.08] bg-[#0e0e0e]/95 shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-md">
    {/* Header */}
    <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white/70">C</div>
      <div>
        <div className="text-[11px] font-semibold text-white">Carlos S.</div>
        <div className="text-[9px] text-white/35">Mercado Livre · agora</div>
      </div>
      <div className="ml-auto flex items-center gap-1 rounded-full bg-[#4ade80]/15 px-2 py-[2px]">
        <div className="h-[5px] w-[5px] rounded-full bg-[#4ade80] animate-pulse" />
        <span className="text-[8px] font-semibold text-[#4ade80]">IA ativa</span>
      </div>
    </div>

    {/* Chat messages */}
    <div className="flex flex-col gap-2 p-4">
      {/* Customer message */}
      <div className="self-start rounded-2xl rounded-tl-sm bg-white/[0.06] px-3 py-2 text-[10px] leading-[1.5] text-white/80">
        Oi! O suporte magnético funciona em qualquer carro? E qual o prazo de entrega?
      </div>

      {/* AI thinking */}
      <div className="flex items-center gap-1 self-start text-[9px] text-white/30">
        <span>Pensou 2s</span>
        <span>·</span>
        <span>Consultou ficha técnica</span>
      </div>

      {/* AI response */}
      <div className="self-start rounded-2xl rounded-tl-sm bg-white/[0.08] px-3 py-2 text-[10px] leading-[1.5] text-white/85">
        Olá Carlos! Sim, o suporte é universal e funciona em qualquer painel
        liso. A fixação magnética é extra-forte (grau N52).
        O prazo de entrega para sua região é de 3-5 dias úteis.
        Posso confirmar seu pedido?
      </div>

      {/* Resolution badge */}
      <div className="mt-1 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-[#4ade80]/10 px-2 py-[3px]">
          <span className="text-[8px] font-semibold text-[#4ade80]">✓ Respondido em 4s</span>
        </div>
        <span className="text-[8px] text-white/25">Sem intervenção humana</span>
      </div>

      {/* Stats row */}
      <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="text-center">
          <div className="text-[12px] font-bold text-white">142</div>
          <div className="text-[7px] text-white/35">respostas hoje</div>
        </div>
        <div className="text-center">
          <div className="text-[12px] font-bold text-[#4ade80]">4s</div>
          <div className="text-[7px] text-white/35">tempo médio</div>
        </div>
        <div className="text-center">
          <div className="text-[12px] font-bold text-white">98%</div>
          <div className="text-[7px] text-white/35">satisfação</div>
        </div>
      </div>
    </div>
  </div>
);

const FeatureChat = () => (
  <section className="bg-black px-6 py-[100px] md:px-10">
    <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
      {/* Text — left */}
      <div>
        <h3 className="mb-5 font-['Manrope'] text-[clamp(1.5rem,2.5vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
          Acompanhe cada venda em tempo real
        </h3>
        <p className="font-['Manrope'] text-[15px] leading-[1.65] text-white/55">
          A Velo centraliza todos os seus pedidos do Mercado Livre e Shopee em
          um único painel. Veja receita, lucro e status de cada pedido sem
          precisar entrar em cada plataforma separadamente.
        </p>
      </div>

      {/* Gradient card — right */}
      <div
        className="relative flex items-center justify-center rounded-[24px]"
        style={{
          background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 40%, #242424 100%)",
          minHeight: "520px",
          padding: "32px",
        }}
      >
        <OrdersDashboardMockup />
      </div>
    </div>
  </section>
);


/* ═══════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════ */

const FeatureSections = () => (
  <>
    <FeatureCreateListings />
    <FeatureAutomations />
    <FeatureChat />
  </>
);

export default FeatureSections;
