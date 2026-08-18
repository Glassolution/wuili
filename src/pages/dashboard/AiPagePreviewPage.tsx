import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, EyeOff, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type AiProductPageRow,
  type PreviewSection,
  fetchAiPageStatus,
  fetchAiProductPage,
  toPreviewSections,
} from "@/lib/aiPageGeneration";

/**
 * Prévia da página gerada por IA.
 *
 * Esta tela é o fim do fluxo nesta fase: o conteúdo está salvo na Velo e NÃO
 * foi publicado em lugar nenhum. O aviso disso é fixo no topo, de propósito —
 * o usuário não pode sair daqui achando que a loja dele já está no ar.
 */

const INK = "#0A0A0A";
const SUCCESS = "#22C55E";
const POLL_INTERVAL_MS = 3000;

const languageLabel: Record<string, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "Inglês",
  es: "Espanhol",
};

const AiPagePreviewPage = () => {
  const navigate = useNavigate();
  const { pageId } = useParams<{ pageId: string }>();

  const [page, setPage] = useState<AiProductPageRow | null>(null);
  const [sections, setSections] = useState<PreviewSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!pageId) return;
    let active = true;

    const stopPolling = () => {
      if (pollTimer.current) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };

    const load = async () => {
      try {
        const row = await fetchAiProductPage(pageId);
        if (!active) return;

        if (!row) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setPage(row);
        setSections(toPreviewSections(row.content ?? {}));
        setLoading(false);

        // Reabriu a prévia com a geração ainda em andamento: retoma o polling
        // de onde parou, já que o estado mora no nosso banco.
        if (row.status === "gerando") {
          await fetchAiPageStatus(pageId).catch(() => null);
          pollTimer.current = window.setTimeout(() => void load(), POLL_INTERVAL_MS);
        }
      } catch {
        if (!active) return;
        setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      stopPolling();
    };
  }, [pageId]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[900px] items-center justify-center py-24">
        <Loader2 size={20} className="animate-spin text-[#8A8A8A]" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="mx-auto w-full max-w-[900px] rounded-[16px] border border-[#EDEDED] bg-white p-8 text-center">
        <h1 className="text-[17px] font-semibold text-[#0A0A0A]">Prévia não encontrada</h1>
        <p className="mt-1.5 text-[13px] text-[#8A8A8A]">Ela pode ter sido apagada.</p>
        <Button type="button" variant="pilot" onClick={() => navigate("/dashboard/paginas-com-ia")} className="mt-5">
          Voltar para Páginas com IA
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="mb-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate("/dashboard/paginas-com-ia")}
          aria-label="Voltar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-black/[0.08] bg-white text-[#0A0A0A] transition hover:bg-black/[0.04]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A8A8A]">Etapa 3 de 3 · Prévia</p>
          <h1 className="mt-0.5 truncate text-[22px] font-semibold tracking-[-0.02em] text-[#0A0A0A]">
            Página gerada com IA
          </h1>
        </div>
      </div>

      {/* Aviso de não publicada — o ponto mais importante desta tela. */}
      <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3.5">
        <EyeOff size={17} className="mt-0.5 shrink-0 text-[#0A0A0A]" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#0A0A0A]">Esta página ainda não está publicada</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[#6B6B6B]">
            É uma prévia salva na Velo, visível só para você. Nada foi enviado para loja externa nem para qualquer
            loja externa. A publicação entra numa próxima fase.
          </p>
        </div>
      </div>

      {page.status === "gerando" && (
        <div className="mb-4 flex items-center gap-2.5 rounded-[12px] border border-[#EDEDED] bg-white px-4 py-3.5">
          <Loader2 size={16} className="animate-spin text-[#0A0A0A]" />
          <p className="text-[13px] text-[#6B6B6B]">Ainda gerando. Esta tela atualiza sozinha quando ficar pronta.</p>
        </div>
      )}

      {page.status === "erro" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-[#F3D0D0] bg-[#FDF5F5] px-4 py-3.5">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#B42318]" />
          <div>
            <p className="text-[13px] font-semibold text-[#8C2C22]">A geração falhou</p>
            <p className="mt-0.5 text-[12.5px] text-[#8C2C22]">
              {page.error_message ?? "A IA da Velo não conseguiu gerar essa página."}
            </p>
          </div>
        </div>
      )}

      {/* Ficha da geração */}
      <div className="mb-4 rounded-[16px] border border-[#EDEDED] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
          {page.status === "pronto" && (
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: SUCCESS }}>
              <CheckCircle2 size={15} /> Conteúdo salvo na Velo
            </span>
          )}
          <span className="text-[#6B6B6B]">
            Idioma: <strong className="font-semibold text-[#0A0A0A]">{languageLabel[page.language] ?? page.language}</strong>
          </span>
          <span className="text-[#6B6B6B]">
            Imagens por IA: <strong className="font-semibold text-[#0A0A0A]">{page.image_count || "nenhuma"}</strong>
          </span>
        </div>
        {page.source_url && (
          <p className="mt-2.5 truncate text-[12px] text-[#8A8A8A]">
            Origem:{" "}
            <a href={page.source_url} target="_blank" rel="noopener noreferrer" className="underline">
              {page.source_url}
            </a>
          </p>
        )}
      </div>

      {/* Imagens */}
      {page.images?.length > 0 && (
        <div className="mb-4 rounded-[16px] border border-[#EDEDED] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-[#0A0A0A]">
            <Sparkles size={15} /> Imagens geradas
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {page.images.map((image, index) => (
              <img
                key={image}
                src={image}
                alt={`Imagem gerada ${index + 1}`}
                className="aspect-square w-full rounded-[10px] border border-[#EDEDED] object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="rounded-[16px] border border-[#EDEDED] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="mb-3 text-[14px] font-semibold text-[#0A0A0A]">Conteúdo da página</h2>

        {sections.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A]">
            {page.status === "pronto"
              ? "A geração terminou, mas não veio texto no formato esperado."
              : "O conteúdo aparece aqui assim que a geração terminar."}
          </p>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.title} className="border-t border-[#F0F0F0] pt-4 first:border-t-0 first:pt-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8A8A8A]">{section.title}</p>
                <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-[1.6] text-[#0A0A0A]">{section.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[12px] text-[#8A8A8A]">
        Revise o texto antes de usar. Publicação em loja externa ainda não está disponível.
      </p>
    </div>
  );
};

export default AiPagePreviewPage;
