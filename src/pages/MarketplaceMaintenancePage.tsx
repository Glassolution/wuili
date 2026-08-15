import { useNavigate } from "react-router-dom";
import { Wrench, ArrowLeft, Store } from "lucide-react";

const MarketplaceMaintenancePage = () => {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-6 py-16 text-[#111111]">
      <section className="w-full max-w-lg rounded-3xl border border-black/[0.06] bg-white p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
        <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
          <Wrench className="h-6 w-6" />
        </span>

        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-neutral-900">
          Estamos em manutenção
        </h1>

        <p className="mt-3 text-[14px] leading-relaxed text-neutral-500">
          As integrações com marketplaces estão temporariamente indisponíveis.
          Não vai demorar muito — estamos ajustando tudo para trazer mais mercados
          de integração para você vender ainda mais. Desde já, agradecemos pela paciência.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-neutral-50 px-4 py-3 text-[12.5px] font-semibold text-neutral-600">
          <Store className="h-4 w-4" />
          Novos marketplaces chegando ao Velo
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </button>
        </div>
      </section>
    </main>
  );
};

export default MarketplaceMaintenancePage;
