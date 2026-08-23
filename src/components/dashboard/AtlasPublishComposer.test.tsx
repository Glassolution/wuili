import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProdutoDoCatalogo } from "@/lib/publicacaoMercadoLivre";

const PRODUTO: ProdutoDoCatalogo = {
  id: "prod-1",
  title: "Fone Bluetooth TWS Com Case De Carga",
  description: null,
  images: '["https://exemplo.test/1.jpg"]',
  cost_price: 40,
  suggested_price: 100,
  margin_percent: 60,
  category: "Fones de Ouvido",
  source: "c7drop",
  stock_quantity: 25,
  brand: "JBL",
  model: "TWS-9",
};

const { publicarNoMercadoLivre, gerarDescricaoComIa, invoke, maybeSingle, avisarContaDeVendedorBloqueada } =
  vi.hoisted(() => ({
    publicarNoMercadoLivre: vi.fn(),
    gerarDescricaoComIa: vi.fn(),
    invoke: vi.fn(),
    maybeSingle: vi.fn(),
    avisarContaDeVendedorBloqueada: vi.fn(),
  }));

vi.mock("@/contexts/AtlasChatContext", () => ({
  useAtlasChat: () => ({ avisarContaDeVendedorBloqueada }),
}));

vi.mock("@/lib/publicacaoMercadoLivre", async (original) => ({
  ...(await original<typeof import("@/lib/publicacaoMercadoLivre")>()),
  publicarNoMercadoLivre,
  gerarDescricaoComIa,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }), maybeSingle }) }) }),
    functions: { invoke },
  },
  supabaseUrl: "https://projeto.supabase.co",
  supabaseAnonKey: "chave-anon",
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/hooks/usePlanLimits", () => ({
  usePlanLimits: () => ({ loading: false, canPublishProducts: true, refreshUsage: vi.fn() }),
}));
vi.mock("@/components/PlansUpgradeModal", () => ({ useUpgradeModal: () => ({ open: vi.fn() }) }));
vi.mock("@/components/dashboard/MLAccountVerificationModal", () => ({ default: () => null }));
vi.mock("@/components/dashboard/FirstStoreOnboarding", () => ({
  getActiveStore: () => null,
  getStorePublishedCount: () => 0,
  incrementStorePublishedCount: vi.fn(),
}));
vi.mock("@/lib/mercadoLivreOAuth", () => ({ startMercadoLivreOAuth: vi.fn() }));
vi.mock("@/lib/mlOauthRetorno", () => ({ salvarRetornoMl: vi.fn() }));
vi.mock("@/components/ui/velo-toast", () => ({
  veloToast: {
    error: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn(() => "t"), dismiss: vi.fn(),
  },
}));

import AtlasPublishComposer from "@/components/dashboard/AtlasPublishComposer";

/**
 * O ponto do componente é publicar sem tirar a pessoa da conversa. Os testes
 * seguram o caminho inteiro: o Atlas pede título e preço, oferece escrever a
 * descrição, e o botão final publica de fato.
 */
describe("AtlasPublishComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Produto do catálogo e integração do Mercado Livre conectada.
    maybeSingle
      .mockResolvedValueOnce({ data: PRODUTO, error: null })
      .mockResolvedValueOnce({ data: { access_token: "ml-token" }, error: null });
    invoke.mockResolvedValue({ data: { connected: true, canList: true } });
    publicarNoMercadoLivre.mockResolvedValue({ permalink: "https://ml.test/MLB1", item_id: "MLB1" });
  });

  const carregar = async () => {
    render(<AtlasPublishComposer produtoId="prod-1" label="Publicar no Mercado Livre" />);
    await screen.findByDisplayValue(/Fone Bluetooth TWS/);
  };

  it("abre pedindo título e preço, com o lucro calculado sobre o custo", async () => {
    await carregar();

    // 40 de custo x 2,5 sugerido = 100; lucro de 60.
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*60,00/)).toBeInTheDocument();
    expect(screen.getByText("60% de margem")).toBeInTheDocument();
  });

  it("recalcula o lucro quando o preço muda", async () => {
    await carregar();

    fireEvent.change(screen.getByDisplayValue("100"), { target: { value: "150" } });

    expect(screen.getByText(/R\$\s*110,00/)).toBeInTheDocument();
  });

  it("mostra quanto o produto custa junto do campo de preço", async () => {
    await carregar();

    // Ficha do produto, dica do campo de preço e a conta do lucro: o custo
    // aparece nos três, porque é o número que dá sentido ao preço.
    expect(screen.getByText(/Você paga R\$\s*40,00 ao fornecedor/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*100,00 − R\$\s*40,00 de custo/)).toBeInTheDocument();
    expect(screen.getByText("R$ 40,00", { selector: "strong" })).toBeInTheDocument();
  });

  it("leva o custo para o resumo da revisão", async () => {
    await carregar();

    fireEvent.click(screen.getByRole("button", { name: /Agora a descrição/ }));
    fireEvent.click(screen.getByRole("button", { name: /Revisar antes de publicar/ }));

    expect(screen.getByText("Custo do produto")).toBeInTheDocument();
  });

  it("não deixa avançar com preço abaixo do custo", async () => {
    await carregar();

    fireEvent.change(screen.getByDisplayValue("100"), { target: { value: "30" } });

    expect(screen.getByRole("button", { name: /Agora a descrição/ })).toBeDisabled();
  });

  it("oferece gerar a descrição e traz o texto para edição", async () => {
    gerarDescricaoComIa.mockResolvedValue("Descrição escrita pelo Atlas.");
    await carregar();

    fireEvent.click(screen.getByRole("button", { name: /Agora a descrição/ }));
    fireEvent.click(screen.getByRole("button", { name: /Escreve pra mim/ }));

    await waitFor(() =>
      expect(screen.getByDisplayValue("Descrição escrita pelo Atlas.")).toBeInTheDocument(),
    );
    expect(gerarDescricaoComIa).toHaveBeenCalledWith({
      titulo: "Fone Bluetooth TWS Com Case De Carga",
      categoria: "Fones de Ouvido",
      preco: 100,
    });
  });

  it("publica no Mercado Livre e mostra o anúncio, sem sair do chat", async () => {
    await carregar();

    fireEvent.click(screen.getByRole("button", { name: /Agora a descrição/ }));
    fireEvent.click(screen.getByRole("button", { name: /Eu escrevo/ }));
    fireEvent.change(screen.getByPlaceholderText("Descrição do anúncio…"), {
      target: { value: "Texto meu." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Revisar antes de publicar/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Publicar no Mercado Livre$/ }));

    await waitFor(() => expect(publicarNoMercadoLivre).toHaveBeenCalledTimes(1));
    expect(publicarNoMercadoLivre).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Fone Bluetooth TWS Com Case De Carga",
        preco: 100,
        descricao: "Texto meu.",
        marca: "JBL",
        estoque: 25,
      }),
    );

    expect(await screen.findByText("Anúncio publicado no Mercado Livre")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver anúncio no Mercado Livre/ })).toHaveAttribute(
      "href",
      "https://ml.test/MLB1",
    );
  });

  it("passa a explicação para o Atlas quando a conta de vendedor não está ativa", async () => {
    // É assim que o Mercado Livre avisa que a conta não pode anunciar.
    invoke.mockResolvedValue({ data: { connected: true, canList: false } });
    await carregar();

    fireEvent.click(screen.getByRole("button", { name: /Agora a descrição/ }));
    fireEvent.click(screen.getByRole("button", { name: /Revisar antes de publicar/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Publicar no Mercado Livre$/ }));

    // O Atlas assume a explicação na conversa, e nada é publicado.
    await waitFor(() => expect(avisarContaDeVendedorBloqueada).toHaveBeenCalledTimes(1));
    expect(publicarNoMercadoLivre).not.toHaveBeenCalled();
    expect(await screen.findByText(/conta de vendedor ainda não está ativa/)).toBeInTheDocument();
  });

  it("também avisa o Atlas quando o bloqueio só aparece na resposta da publicação", async () => {
    const { ErroDePublicacao } = await import("@/lib/publicacaoMercadoLivre");
    publicarNoMercadoLivre.mockRejectedValue(
      new ErroDePublicacao("Conta não habilitada", "ML_SELLER_CANNOT_LIST"),
    );
    await carregar();

    fireEvent.click(screen.getByRole("button", { name: /Agora a descrição/ }));
    fireEvent.click(screen.getByRole("button", { name: /Revisar antes de publicar/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Publicar no Mercado Livre$/ }));

    await waitFor(() => expect(avisarContaDeVendedorBloqueada).toHaveBeenCalledTimes(1));
    // O botão continua disponível: a pessoa resolve lá e tenta de novo aqui.
    expect(screen.getByRole("button", { name: /^Publicar no Mercado Livre$/ })).not.toBeDisabled();
  });

  it("bloqueia a publicação e oferece conectar quando não há conta do Mercado Livre", async () => {
    maybeSingle.mockReset();
    maybeSingle
      .mockResolvedValueOnce({ data: PRODUTO, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await carregar();

    expect(screen.getByRole("button", { name: /Conectar Mercado Livre/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Agora a descrição/ }));
    fireEvent.click(screen.getByRole("button", { name: /Revisar antes de publicar/ }));
    expect(screen.getByRole("button", { name: /^Publicar no Mercado Livre$/ })).toBeDisabled();
    expect(publicarNoMercadoLivre).not.toHaveBeenCalled();
  });
});
