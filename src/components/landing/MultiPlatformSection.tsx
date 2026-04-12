import { Edit3, Clock, Package, Folder } from "lucide-react";

const MultiPlatformSection = () => (
  <section className="bg-black px-6 py-[100px] md:px-10">
    <div className="mx-auto max-w-[1200px]">
      {/* Intro headline */}
      <div className="mx-auto mb-20 max-w-[760px] text-center">
        <h2 className="font-['Manrope'] text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.025em] text-white">
          O melhor jeito de vender com agentes IA
        </h2>
      </div>

      {/* Showcase grid */}
      <div className="grid items-center gap-10 lg:grid-cols-[1.7fr_1fr] lg:gap-16">
        {/* Gradient card with sidebar mockup */}
        <div
          className="relative overflow-hidden rounded-[24px]"
          style={{
            background:
              "linear-gradient(135deg, #6366f1 0%, #818cf8 35%, #a5b4fc 70%, #bfdbfe 100%)",
            minHeight: "560px",
          }}
        >
          {/* App window centered */}
          <div className="absolute left-1/2 top-1/2 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-white/[0.08] bg-[#0e0e0e]/95 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
            {/* Traffic-light chrome */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-[9px] w-[9px] rounded-full bg-[#ff5f57]" />
                <div className="h-[9px] w-[9px] rounded-full bg-[#febc2e]" />
                <div className="h-[9px] w-[9px] rounded-full bg-[#28c840]" />
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </div>

            {/* Sidebar items */}
            <div className="flex flex-col gap-[2px] p-2 font-['Manrope']">
              <div className="flex items-center gap-2 rounded-md px-3 py-[7px] text-[11.5px] text-white/85">
                <Edit3 size={12} className="text-white/40" /> Nova conversa
              </div>
              <div className="flex items-center gap-2 rounded-md px-3 py-[7px] text-[11.5px] text-white/85">
                <Clock size={12} className="text-white/40" /> Automações
              </div>
              <div className="flex items-center gap-2 rounded-md px-3 py-[7px] text-[11.5px] text-white/85">
                <Package size={12} className="text-white/40" /> Nichos
              </div>

              <div className="mt-3 px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-white/30">
                Canais
              </div>

              {/* Mercado Livre */}
              <div className="flex items-center gap-2 px-3 py-[6px] text-[11.5px] text-white/65">
                <Folder size={12} className="text-white/40" /> Mercado Livre
              </div>
              <div className="ml-6 flex items-center justify-between rounded-md bg-white/[0.07] px-3 py-[6px] text-[11px] text-white">
                <span>Criar anúncio CTA</span>
                <span className="text-[9.5px] text-white/40">4h</span>
              </div>
              <div className="ml-6 flex items-center justify-between px-3 py-[6px] text-[11px] text-white/45">
                <span>Responder perguntas</span>
                <span className="text-[9.5px] text-white/30">8h</span>
              </div>

              {/* Shopee */}
              <div className="mt-1 flex items-center gap-2 px-3 py-[6px] text-[11.5px] text-white/65">
                <Folder size={12} className="text-white/40" /> Shopee
              </div>
              <div className="ml-6 flex items-center justify-between px-3 py-[6px] text-[11px] text-white/45">
                <span>Atualizar preços</span>
                <span className="text-[9.5px] text-white/30">2h</span>
              </div>
              <div className="ml-6 flex items-center justify-between px-3 py-[6px] text-[11px] text-white/45">
                <span>Estoque Kit 5 itens</span>
                <span className="text-[9.5px] text-white/30">em andamento</span>
              </div>

              {/* AliExpress */}
              <div className="mt-1 flex items-center gap-2 px-3 py-[6px] text-[11.5px] text-white/65">
                <Folder size={12} className="text-white/40" /> AliExpress
              </div>
              <div className="ml-6 flex items-center justify-between px-3 py-[6px] text-[11px] text-white">
                <span className="flex items-center gap-2">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#60a5fa]" />
                  Novo fornecedor
                </span>
                <span className="text-[9.5px] text-white/40">3h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description column */}
        <div>
          <h3 className="mb-5 font-['Manrope'] text-[clamp(1.5rem,2.5vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
            Feito para fluxos de vendas multiplataforma
          </h3>
          <p className="font-['Manrope'] text-[15px] leading-[1.65] text-white/55">
            A Velo é um centro de comando para operações de e-commerce com IA. Com integrações nativas
            a Mercado Livre, Shopee e AliExpress, os agentes trabalham em paralelo em várias lojas —
            transformando semanas de operação manual em dias de trabalho automatizado.
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default MultiPlatformSection;
