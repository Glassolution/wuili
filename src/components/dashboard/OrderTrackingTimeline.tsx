import { Check, Circle, PackageCheck, Truck } from "lucide-react";

export type OrderTrackingTimelineProps = {
  shipmentStatus?: string | null;
  dateCreated?: string | null;
  dateReadyToShip?: string | null;
  dateShipped?: string | null;
  dateDelivered?: string | null;
};

const formatTimelineDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getCompletedStage = (shipmentStatus?: string | null) => {
  if (!shipmentStatus) return 0;

  const normalized = shipmentStatus.toLowerCase().replace(/[\s-]+/g, "_");
  if (["delivered", "entregue"].includes(normalized)) return 3;
  if (["shipped", "in_transit", "out_for_delivery", "enviado", "em_transito"].includes(normalized)) return 2;
  if (["ready_to_ship", "ready", "handling", "pronto_para_envio"].includes(normalized)) return 1;
  return 0;
};

const OrderTrackingTimeline = ({
  shipmentStatus,
  dateCreated,
  dateReadyToShip,
  dateShipped,
  dateDelivered,
}: OrderTrackingTimelineProps) => {
  const completedStage = getCompletedStage(shipmentStatus);
  const steps = [
    { label: "Pedido Realizado", date: formatTimelineDate(dateCreated), icon: Check },
    { label: "Pronto para Envio", date: formatTimelineDate(dateReadyToShip), icon: PackageCheck },
    { label: "Em Trânsito", date: formatTimelineDate(dateShipped), icon: Truck },
    { label: "Entregue", date: formatTimelineDate(dateDelivered), icon: Check },
  ];

  return (
    <section aria-labelledby="order-tracking-title" className="border-b border-indigo-100/80 bg-white px-5 py-6 sm:px-7 sm:py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-indigo-500">Acompanhamento</p>
          <h2 id="order-tracking-title" className="mt-1 text-[18px] font-semibold text-slate-950">
            Rastreamento do pedido
          </h2>
        </div>
        {!shipmentStatus && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
            Aguardando atualização
          </span>
        )}
      </div>

      <ol className="grid gap-0 sm:grid-cols-4">
        {steps.map((step, index) => {
          const isComplete = index <= completedStage;
          const Icon = isComplete ? step.icon : Circle;

          return (
            <li key={step.label} className="relative flex gap-3 pb-6 last:pb-0 sm:block sm:pb-0 sm:pr-3">
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[17px] top-9 h-[calc(100%-28px)] w-px sm:left-9 sm:right-0 sm:top-[17px] sm:h-px sm:w-auto ${
                    index < completedStage ? "bg-indigo-500" : "bg-slate-200"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                  isComplete
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_6px_16px_rgba(79,70,229,0.20)]"
                    : "border-slate-200 bg-white text-slate-300"
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
              </span>
              <div className="min-w-0 pt-0.5 sm:mt-3 sm:pt-0">
                <p className={`text-[13px] font-semibold ${isComplete ? "text-slate-950" : "text-slate-400"}`}>
                  {step.label}
                </p>
                <p className={`mt-1 text-[11px] ${isComplete ? "text-slate-500" : "text-slate-300"}`}>
                  {isComplete ? step.date ?? "Concluído" : "Pendente"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default OrderTrackingTimeline;
