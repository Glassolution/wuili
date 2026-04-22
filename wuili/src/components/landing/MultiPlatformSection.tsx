import { CatalogMockup, ImportModalMockup } from "./DashboardMockups";

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
        {/* Catalog mockup */}
        <div
          className="relative flex items-center justify-center rounded-[24px]"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #818cf8 35%, #a5b4fc 70%, #bfdbfe 100%)",
            minHeight: "560px",
            padding: "32px",
          }}
        >
          <CatalogMockup />
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
          <div style={{ marginTop: 28 }}>
            <ImportModalMockup />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default MultiPlatformSection;
