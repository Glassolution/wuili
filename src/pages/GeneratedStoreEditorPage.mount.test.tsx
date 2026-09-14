import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * O editor quebrou uma vez com tela de erro porque um `const` do corpo do
 * componente foi usado antes da própria declaração (TDZ). O TypeScript não pega
 * esse caso — só estoura no render, em runtime.
 *
 * Este teste monta a página inteira: se qualquer valor voltar a ser lido antes
 * da hora, o render lança e o teste falha.
 */

// APIs de navegador que o jsdom não traz e que o editor usa em efeitos.
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("ResizeObserver", ObserverStub);
vi.stubGlobal("IntersectionObserver", ObserverStub);
vi.stubGlobal("scrollTo", () => {});

vi.mock("@/integrations/supabase/client", () => {
  const resultado = { data: null, error: null };
  const query: Record<string, unknown> = {};
  for (const metodo of ["select", "insert", "update", "delete", "eq", "in", "gt", "order", "limit", "range", "filter"]) {
    query[metodo] = () => query;
  }
  query.maybeSingle = () => Promise.resolve(resultado);
  query.single = () => Promise.resolve(resultado);
  query.then = (resolve: (value: typeof resultado) => unknown) => Promise.resolve(resultado).then(resolve);

  return {
    isSupabaseEnabled: false,
    supabase: {
      from: () => query,
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null } }),
      },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      removeChannel: () => {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: null, error: null }) }) },
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-teste", email: "teste@velo.com" }, loading: false }),
}));

vi.mock("@/hooks/usePlan", () => ({ usePlan: () => ({ plan: "pro", loading: false }) }));

vi.mock("@/components/PlansUpgradeModal", () => ({
  useUpgradeModal: () => ({ open: () => {}, close: () => {} }),
  UpgradeModalProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/profileContext", () => ({
  useProfile: () => ({ profile: null, loading: false, refresh: () => {} }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const importarEditor = async () => (await import("@/pages/GeneratedStoreEditorPage")).default;

describe("GeneratedStoreEditorPage", () => {
  it("monta sem erro de runtime", async () => {
    // Sem um fluxo salvo o editor redireciona para /comecar e o JSX principal
    // nunca chega a ser avaliado — que é justamente onde o erro aparecia.
    sessionStorage.setItem(
      "velo-example-product",
      JSON.stringify({ id: "prod-1", title: "Produto de teste", price: 99, imageUrl: "/logo.png" }),
    );
    sessionStorage.setItem("velo-store-language", "pt-BR");
    sessionStorage.setItem("velo-customer-persona", "Mulher");
    sessionStorage.setItem("velo-sales-angle", "Benefício principal");
    sessionStorage.setItem("velo-onboarding-choice", "sales-page");

    const Editor = await importarEditor();

    render(
      <MemoryRouter initialEntries={["/minha-loja/editor"]}>
        <Editor />
      </MemoryRouter>,
    );

    // O painel de customização é a última coisa do JSX: se ele existe, o corpo
    // inteiro do componente foi avaliado sem estourar.
    expect(screen.getByLabelText("Painel de customização do template")).toBeInTheDocument();
  });

  it("abre a gaveta de produtos em tema claro", async () => {
    const Editor = await importarEditor();

    const { container } = render(
      <MemoryRouter initialEntries={["/minha-loja/editor"]}>
        <Editor />
      </MemoryRouter>,
    );

    // Consulta direta ao DOM: `getByRole` varre a árvore inteira e o jsdom
    // engasga nos seletores `:has()` que o template injeta.
    const botaoProdutos = [...container.querySelectorAll("button")].find((botao) =>
      botao.textContent?.includes("Produtos"),
    );
    expect(botaoProdutos).toBeDefined();
    fireEvent.click(botaoProdutos!);

    const gaveta = await waitFor(() => {
      const encontrada = container.querySelector(".editor-context-drawer");
      if (!encontrada) throw new Error("gaveta não abriu");
      return encontrada;
    });

    // Se alguém devolver o fundo escuro, o teste acusa.
    expect(gaveta.className).toContain("bg-white");
    expect(gaveta.className).not.toContain("bg-[#0A0A0A]");
  });

});
