import { ArrowLeft, MoreVertical, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { salesPageTemplates } from "@/lib/salesPageTemplates";

const ModelosPage = () => {
  const navigate = useNavigate();

  return (
    <section className="min-h-[calc(100vh-7rem)] bg-[#F7F7F5]">
      <div className="w-full">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#101114] transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} strokeWidth={2.1} aria-hidden="true" />
            </button>
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.04em] text-[#101114] sm:text-[24px]">
              Templates de página
            </h1>
          </div>

          <Button
            type="button"
            variant="pilot"
            onClick={() => navigate("/dashboard/paginas-com-ia/criar")}
            className="h-12 min-w-[145px] px-5 text-[16px]"
          >
            Criar novo
          </Button>
        </header>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {salesPageTemplates.map((template) => (
            <article
              key={template.id}
              className="group overflow-hidden rounded-[14px] border border-black/[0.08] bg-white shadow-[0_10px_28px_rgba(17,24,39,0.045)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(17,24,39,0.09)]"
            >
              <div className="flex h-12 items-center justify-between px-4">
                <div className="min-w-0">
                  <h2 className="truncate text-[14px] font-semibold tracking-[-0.025em] text-[#101114]">
                    {template.name}
                  </h2>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#101114] transition hover:bg-black/[0.05]"
                  aria-label={`Opções do template ${template.name}`}
                >
                  <MoreVertical size={17} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate("/dashboard/paginas-com-ia/criar", { state: { templateId: template.id } })}
                className="block w-full px-3 pb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/45 focus-visible:ring-offset-2"
                aria-label={`Criar página usando o template ${template.name}`}
              >
                {/* Moldura fixa de 350px. A imagem é a página inteira (bem mais
                    alta), então no hover ela sobe até o fim e o visitante vê o
                    template rolando — como se estivesse na página. Ao tirar o
                    mouse, volta ao topo, mais rápido do que desceu. */}
                <span className="relative block h-[350px] overflow-hidden rounded-[10px] bg-[#F1F2EF] ring-1 ring-black/[0.05]">
                  <img
                    src={template.preview}
                    alt={`Prévia do template ${template.name}`}
                    className="w-full origin-top will-change-transform [transition:transform_1200ms_cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-[calc(100%_-_350px)] group-hover:[transition:transform_18000ms_linear] motion-reduce:[transition:none] motion-reduce:group-hover:translate-y-0"
                    loading="lazy"
                  />

                  {/* Escurece a prévia no hover para o botão ganhar contraste. */}
                  <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/[0.12]" />

                  {/* Pílula "Editar template" — ancorada embaixo, sobe ao aparecer. */}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-6">
                    <span className="flex translate-y-3 items-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#101114] opacity-0 shadow-[0_8px_24px_rgba(16,17,20,0.18)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100">
                      <Pencil size={16} strokeWidth={2.1} aria-hidden="true" />
                      Editar template
                    </span>
                  </span>
                </span>
                <span className="mt-3 block text-[12px] font-medium leading-5 text-[#747873]">
                  {template.description}
                </span>
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ModelosPage;
