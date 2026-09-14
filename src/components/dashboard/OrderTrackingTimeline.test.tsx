import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OrderTrackingTimeline from "@/components/dashboard/OrderTrackingTimeline";

describe("OrderTrackingTimeline", () => {
  it("mantém somente o pedido realizado concluído sem status de envio", () => {
    render(<OrderTrackingTimeline dateCreated="2026-07-10T12:00:00.000Z" />);

    expect(screen.getByText("Pedido Realizado")).toBeInTheDocument();
    expect(screen.getByText("Aguardando atualização")).toBeInTheDocument();
    expect(screen.getAllByText("Pendente")).toHaveLength(3);
  });

  it("preenche todas as etapas quando o envio estiver entregue", () => {
    render(
      <OrderTrackingTimeline
        shipmentStatus="delivered"
        dateCreated="2026-07-10T12:00:00.000Z"
        dateReadyToShip="2026-07-11T12:00:00.000Z"
        dateShipped="2026-07-12T12:00:00.000Z"
        dateDelivered="2026-07-13T12:00:00.000Z"
      />,
    );

    expect(screen.queryByText("Aguardando atualização")).not.toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
    expect(screen.getByText("Entregue")).toBeInTheDocument();
  });
});
