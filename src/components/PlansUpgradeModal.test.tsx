import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { startValidaPayCheckout } = vi.hoisted(() => ({
  startValidaPayCheckout: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("@/lib/validapayCheckout", () => ({ startValidaPayCheckout }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "user-1", email: "cliente@exemplo.com" } }, role: "user" }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/sandboxMode", () => ({ useSandboxMode: () => [false] }));
vi.mock("@/lib/mobileHomeTracking", () => ({ trackMobileHomeEvent: vi.fn() }));

import PlansUpgradeModal from "./PlansUpgradeModal";

/** Cartão de um plano na versão de computador (a que aparece na imagem do bug). */
async function cartaoDoPlano(nome: string) {
  const titulo = await screen.findByRole("heading", { level: 3, name: nome }, { timeout: 3000 });
  return titulo.closest("article") as HTMLElement;
}

describe("PlansUpgradeModal", () => {
  it("com Mensal marcado, o Business mostra R$ 189,90/mês com cobrança anual e vai ao checkout no anual", async () => {
    render(<PlansUpgradeModal open onClose={() => {}} />);

    const business = await cartaoDoPlano("Business");
    expect(within(business).getByText(/Cobrança anual de R\$\s2\.278,80/)).toBeInTheDocument();
    expect(within(business).queryByText("Cobrança mensal")).toBeNull();
    expect(business.textContent).toContain("189");
    expect(business.textContent).toContain(",90");

    // Base continua no mensal quando Mensal está marcado.
    const base = await cartaoDoPlano("Base");
    expect(within(base).getByText("Cobrança mensal")).toBeInTheDocument();

    const botoes = within(business).getAllByRole("button");
    fireEvent.click(botoes[botoes.length - 1]);
    await waitFor(() => expect(startValidaPayCheckout).toHaveBeenCalled());
    expect(startValidaPayCheckout).toHaveBeenLastCalledWith("business", "annual");
  });
});
