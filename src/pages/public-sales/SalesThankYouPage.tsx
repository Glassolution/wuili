import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

const SalesThankYouPage = () => {
  const { slug = "" } = useParams();
  const [sp] = useSearchParams();
  const orderId = sp.get("order");

  return (
    <div className="grid min-h-screen place-items-center bg-[#F3F3F1] p-6" style={{ fontFamily: '"Geist", system-ui, sans-serif' }}>
      <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]">
        <CheckCircle2 size={54} className="mx-auto text-emerald-500" strokeWidth={1.4} />
        <h1 className="mt-6 text-[28px] font-medium text-black">Pedido confirmado</h1>
        <p className="mt-2 text-[14px] text-black/60">
          Obrigado pela compra! Enviaremos os próximos passos no seu e-mail.
        </p>
        {orderId && (
          <p className="mt-4 text-[11px] uppercase tracking-wide text-black/40">Pedido {orderId.slice(0, 8)}</p>
        )}
        <Link
          to={`/loja/${slug}`}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-black/90"
        >
          Voltar para a loja
        </Link>
      </div>
    </div>
  );
};

export default SalesThankYouPage;
