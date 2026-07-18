import { useEffect, useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  createStoreReview,
  fetchStoreReviews,
  formatReviewDate,
  summarizeReviews,
  type StoreReview,
} from "@/lib/storeReviews";

// Bloco de avaliações usado por todos os templates. Mostra só o que os clientes
// realmente escreveram (tabela store_reviews) e oferece o formulário para
// avaliar. Sem avaliação nenhuma, não inventa nota nem depoimento: exibe o
// convite para ser o primeiro.
//
// Sem `projectId` o componente entra em modo preview (canvas do editor): a UI
// aparece igual, mas o envio não grava nada — o dono não deve semear avaliação
// na própria loja pela tela de edição.

type StoreReviewsProps = {
  projectId?: string;
  productId?: string;
  accent: string;
  mobile?: boolean;
  /** Fundo alternativo para templates com seções claras/escuras alternadas. */
  background?: string;
};

const Stars = ({ value, size = 15 }: { value: number; size?: number }) => (
  <span className="inline-flex" style={{ color: "#f5b301" }} aria-label={`${value} de 5`}>
    {[1, 2, 3, 4, 5].map((index) => (
      <Star
        key={index}
        size={size}
        fill={index <= Math.round(value) ? "currentColor" : "none"}
        stroke={index <= Math.round(value) ? "none" : "currentColor"}
        strokeWidth={index <= Math.round(value) ? 0 : 1.5}
        className={index <= Math.round(value) ? "" : "text-black/25"}
      />
    ))}
  </span>
);

const StarPicker = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((index) => (
      <button
        key={index}
        type="button"
        onClick={() => onChange(index)}
        aria-label={`${index} ${index === 1 ? "estrela" : "estrelas"}`}
        className="transition hover:scale-110"
        style={{ color: index <= value ? "#f5b301" : "rgba(0,0,0,0.25)" }}
      >
        <Star size={26} fill={index <= value ? "currentColor" : "none"} strokeWidth={index <= value ? 0 : 1.5} />
      </button>
    ))}
  </div>
);

const StoreReviews = ({ projectId, productId, accent, mobile = false, background = "#ffffff" }: StoreReviewsProps) => {
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const list = await fetchStoreReviews(projectId);
        if (active) setReviews(list);
      } catch (error) {
        console.error("Erro ao carregar avaliações:", error);
        if (active) setReviews([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedComment = comment.trim();
    if (trimmedName.length < 2) {
      setNotice({ tone: "error", text: "Digite seu nome." });
      return;
    }
    if (trimmedComment.length < 3) {
      setNotice({ tone: "error", text: "Escreva sua avaliação." });
      return;
    }
    if (!projectId) {
      setNotice({ tone: "ok", text: "Pré-visualização: as avaliações são recebidas na loja publicada." });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const created = await createStoreReview({ projectId, productId, authorName: trimmedName, rating, comment: trimmedComment });
      setReviews((current) => [created, ...current]);
      setName("");
      setComment("");
      setRating(5);
      setFormOpen(false);
      setNotice({ tone: "ok", text: "Obrigado! Sua avaliação foi publicada." });
    } catch (error) {
      console.error("Erro ao enviar avaliação:", error);
      setNotice({ tone: "error", text: "Não foi possível enviar sua avaliação agora." });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "h-12 w-full rounded-[10px] border border-black/12 bg-white px-4 text-[14px] text-black outline-none transition focus:border-black/35";

  return (
    <section className="px-6 py-14 sm:px-10" style={{ backgroundColor: background }}>
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 data-editor-type="text" className="text-[28px] font-black tracking-[-0.02em] text-black md:text-[34px]">
              Avaliações de clientes
            </h2>
            {loading ? (
              <p className="mt-2 flex items-center gap-2 text-[14px] text-black/50">
                <Loader2 size={15} className="animate-spin" /> Carregando avaliações...
              </p>
            ) : summary.average !== null ? (
              <div className="mt-2 flex items-center gap-2 text-[14px] text-black/65">
                <Stars value={summary.average} size={17} />
                <span className="font-bold text-black">{summary.average.toFixed(1)}</span>
                <span>
                  {summary.count} {summary.count === 1 ? "avaliação" : "avaliações"}
                </span>
              </div>
            ) : (
              <p data-editor-type="text" className="mt-2 text-[14px] text-black/55">
                Este produto ainda não tem avaliações. Seja o primeiro a avaliar.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            className="h-12 shrink-0 rounded-[10px] px-6 text-[14px] font-bold text-white transition hover:brightness-110"
            style={{ backgroundColor: accent }}
          >
            {formOpen ? "Fechar" : "Escrever avaliação"}
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={handleSubmit} className="mt-6 rounded-[16px] border border-black/[0.08] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-black/55">Sua nota</p>
            <div className="mt-2">
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,260px) minmax(0,1fr)" }}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                maxLength={60}
                className={inputCls}
                aria-label="Seu nome"
              />
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="O que você achou do produto?"
                maxLength={1000}
                className={inputCls}
                aria-label="Sua avaliação"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-[10px] px-7 text-[14px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitting ? "Enviando" : "Publicar avaliação"}
            </button>
          </form>
        ) : null}

        {notice ? (
          <p className={`mt-4 text-[13px] font-semibold ${notice.tone === "ok" ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
            {notice.text}
          </p>
        ) : null}

        {summary.reviews.length > 0 ? (
          <div className="mt-8 grid gap-5" style={{ gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0,1fr))" }}>
            {summary.reviews.map((review) => (
              <article key={review.id} className="rounded-[16px] border border-black/[0.07] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                <Stars value={review.rating} />
                <p className="mt-3 text-[15px] leading-[1.6] text-black/75">{review.comment}</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
                  <span className="font-bold text-black">{review.authorName}</span>
                  <span className="text-black/45">{formatReviewDate(review.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default StoreReviews;
