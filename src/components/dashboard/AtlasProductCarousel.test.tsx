import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProdutoRecomendado } from "@/hooks/useProdutosRecomendados";

const selecionarProduto = vi.fn();
const navigate = vi.fn();

const PRODUTOS: ProdutoRecomendado[] = [
  {
    id: "p1",
    nome: "Pulseira Loop Alpine",
    categoria: "Relogios e Smartwatchs",
    preco: 28,
    imagem: "https://exemplo.test/1.jpg",
    rating: 4.7,
    ordersCount: 900,
    motivo: "Combina com o nicho que você escolheu no cadastro",
  },
  {
    id: "p2",
    nome: "Suporte de Celular Veicular",
    categoria: "Celulares e Smartphones",
    preco: 35,
    imagem: "https://exemplo.test/2.jpg",
    rating: null,
    ordersCount: 120,
    motivo: "Preço baixo, bom para a sua primeira venda",
  },
];

const estadoDoHook = {
  produtos: PRODUTOS,
  carregando: false,
  erro: null as string | null,
  resumo: "Escolhi olhando seu nicho de tech e gadgets.",
  respostas: {},
};

vi.mock("@/hooks/useProdutosRecomendados", () => ({
  useProdutosRecomendados: () => estadoDoHook,
}));

vi.mock("@/contexts/AtlasChatContext", () => ({
  useAtlasChat: () => ({ selecionarProduto, enviando: false }),
}));

// O componente e o ProductCard (de onde vem o formatPrice) só usam estes dois.
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children?: unknown }) => children,
}));

import AtlasProductCarousel from "@/components/dashboard/AtlasProductCarousel";

/**
 * A vitrine do guia é parte da conversa, não um modal. Estes testes seguram
 * exatamente isso: os produtos aparecem no fluxo da mensagem e escolher um
 * responde ao Atlas, sem tela intermediária.
 */
describe("AtlasProductCarousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estadoDoHook.produtos = PRODUTOS;
    estadoDoHook.carregando = false;
    estadoDoHook.erro = null;
  });

  it("mostra os produtos recomendados no próprio chat, sem diálogo por cima", () => {
    const { container } = render(<AtlasProductCarousel nicho={null} />);

    expect(screen.getByText("Pulseira Loop Alpine")).toBeInTheDocument();
    expect(screen.getByText("Suporte de Celular Veicular")).toBeInTheDocument();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("mostra o motivo da escolha e a avaliação só de quem tem nota", () => {
    render(<AtlasProductCarousel nicho={null} />);

    expect(screen.getByText(/Combina com o nicho que você escolheu no cadastro/)).toBeInTheDocument();
    expect(screen.getByText("4,7")).toBeInTheDocument();
    // O segundo produto não tem nota: nenhuma outra linha de estrela aparece.
    expect(screen.getAllByText(/^\d,\d$/)).toHaveLength(1);
  });

  it("usa o rótulo do nicho confirmado no cabeçalho da seleção", () => {
    render(<AtlasProductCarousel nicho={{ id: "tech", label: "Eletrônicos", catalogTerms: ["fone"] }} />);

    expect(screen.getByText(/Eletrônicos •/)).toBeInTheDocument();
  });

  it("escolher um produto manda a escolha para o Atlas", async () => {
    render(<AtlasProductCarousel nicho={null} />);

    fireEvent.click(screen.getByTitle("Pulseira Loop Alpine"));

    await waitFor(() =>
      expect(selecionarProduto).toHaveBeenCalledWith({
        id: "p1",
        nome: "Pulseira Loop Alpine",
        categoria: "Relogios e Smartwatchs",
        preco: 28,
        imagem: "https://exemplo.test/1.jpg",
      }),
    );
  });

  it("oferece o catálogo completo quando a seleção volta vazia", () => {
    estadoDoHook.produtos = [];
    render(<AtlasProductCarousel nicho={null} />);

    expect(screen.getByText("Nenhum produto disponível no momento")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Abrir o catálogo completo"));
    expect(navigate).toHaveBeenCalledWith("/dashboard/catalogo");
  });
});
