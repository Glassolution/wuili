import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

import { AdminAffiliateApplicationsPanel } from "@/components/admin/AdminAffiliateApplicationsPanel";

/** Afiliado de teste: uma solicitação pendente com o formulário todo preenchido. */
const QA_APPLICATION = {
  user_id: "11111111-2222-3333-4444-555555555555",
  code: "",
  status: "pending",
  agreed_terms: true,
  full_name: "QA Afiliado Teste",
  email: "qa.afiliado.teste@velods.com.br",
  phone: "(11) 98888-7777",
  cpf: "123.456.789-09",
  socials: [
    { platform: "Instagram", url: "https://instagram.com/qa_afiliado_teste" },
    { platform: "TikTok", url: "https://tiktok.com/@qa_afiliado_teste" },
  ],
  audience_range: "10k-50k",
  content_niche: "dropshipping",
  pix_keys: [
    { type: "CPF", value: "12345678909" },
    { type: "E-mail", value: "qa.afiliado.teste@velods.com.br" },
  ],
  promotion_plan: "Conteúdo diário no Instagram e cortes no TikTok.",
  created_at: "2026-08-06T13:45:00.000Z",
  updated_at: "2026-08-06T13:45:00.000Z",
  is_active: false,
};

const renderPanel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminAffiliateApplicationsPanel />
    </QueryClientProvider>,
  );
};

const openDrawer = async () => {
  fireEvent.click(await screen.findByText("QA Afiliado Teste"));
  return screen.getByText("Cadastro enviado").closest("div")!.parentElement!;
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation((name: string) => {
    if (name === "rpc_admin_affiliate_applications") {
      return Promise.resolve({ data: { applications: [QA_APPLICATION] }, error: null });
    }
    return Promise.resolve({ data: { status: "ok" }, error: null });
  });
});

afterEach(() => vi.restoreAllMocks());

describe("AdminAffiliateApplicationsPanel", () => {
  it("lista a solicitação pendente com nome, e-mail e data do pedido", async () => {
    renderPanel();

    expect(await screen.findByText("QA Afiliado Teste")).toBeInTheDocument();
    expect(screen.getAllByText("qa.afiliado.teste@velods.com.br").length).toBeGreaterThan(0);
    // Sem prender ao fuso da máquina: importa a data do pedido sair formatada em pt-BR.
    expect(screen.getByText(/0[67] de ago\. de 26, \d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
  });

  it("abre o formulário completo ao clicar no pedido", async () => {
    renderPanel();
    await openDrawer();

    expect(screen.getByText("(11) 98888-7777")).toBeInTheDocument();
    expect(screen.getByText("123.456.789-09")).toBeInTheDocument();
    expect(screen.getByText("10k-50k")).toBeInTheDocument();
    expect(screen.getByText("dropshipping")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo diário no Instagram e cortes no TikTok.")).toBeInTheDocument();

    // Chaves Pix do cadastro.
    expect(screen.getByText("12345678909")).toBeInTheDocument();
  });

  it("mostra cada rede social como link clicável", async () => {
    renderPanel();
    await openDrawer();

    const instagram = screen.getByRole("link", { name: "https://instagram.com/qa_afiliado_teste" });
    expect(instagram).toHaveAttribute("href", "https://instagram.com/qa_afiliado_teste");
    expect(instagram).toHaveAttribute("target", "_blank");

    expect(screen.getByRole("link", { name: "https://tiktok.com/@qa_afiliado_teste" })).toBeInTheDocument();
  });

  it("aprova chamando o RPC por user_id", async () => {
    renderPanel();
    const row = (await screen.findByText("QA Afiliado Teste")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: /aprovar/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("rpc_admin_accept_affiliate_application", {
        p_user_id: QA_APPLICATION.user_id,
      }),
    );
  });

  it("rejeita apenas depois de confirmar", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPanel();
    const row = (await screen.findByText("QA Afiliado Teste")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: /rejeitar/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("rpc_admin_reject_affiliate_application", expect.anything());

    confirmSpy.mockReturnValue(true);
    fireEvent.click(within(row).getByRole("button", { name: /rejeitar/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("rpc_admin_reject_affiliate_application", {
        p_user_id: QA_APPLICATION.user_id,
      }),
    );
  });

  it("troca o filtro e repassa o status ao RPC", async () => {
    renderPanel();
    await screen.findByText("QA Afiliado Teste");

    fireEvent.click(screen.getByRole("button", { name: "Rejeitadas" }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("rpc_admin_affiliate_applications", { p_status: "rejected" }),
    );
  });

  it("some com a solicitação quando o RPC não devolve nada", async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: { applications: [] }, error: null }));
    renderPanel();

    expect(await screen.findByText("Nenhuma solicitação nesse filtro.")).toBeInTheDocument();
  });
});
