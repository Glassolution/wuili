import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProdutoDoCatalogo } from "@/lib/publicacaoMercadoLivre";

/**
 * Regressão do laço relatado no celular: a pessoa chegava ao "Passo 3 de 3" do
 * tutorial de verificação do Mercado Livre, clicava em "Entendi" e o fluxo
 * voltava para o passo 1 em vez de publicar ("aperto e volta tudo de novo").
 *
 * Eram três defeitos somados:
 *   1. "Entendi" só fechava o tutorial — nunca retomava a publicação;
 *   2. reabrir o tutorial zerava o passo para 1, apagando o caminho andado;
 *   3. nada era gravado em disco, então a ida ao ML (que no celular derruba a
 *      aba para segundo plano, onde o sistema pode descartá-la) levava tudo.
 */

const PRODUTO: ProdutoDoCatalogo = {
  id: "prod-1",
  title: "Fone Bluetooth TWS",
  description: null,
  images: '["https://exemplo.test/1.jpg"]',
  cost_price: 40,
  suggested_price: 100,
  margin_percent: 60,
  category: "Fones",
  source: "c7drop",
  stock_quantity: 25,
  brand: "JBL",
  model: "TWS-9",
};

const { publicarNoMercadoLivre, invoke, maybeSingle, toastError } = vi.hoisted(() => ({
  publicarNoMercadoLivre: vi.fn(),
  invoke: vi.fn(),
  maybeSingle: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/publicacaoMercadoLivre", async (original) => ({
  ...(await original<typeof import("@/lib/publicacaoMercadoLivre")>()),
  publicarNoMercadoLivre,
  gerarDescricaoComIa: vi.fn(),
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
  usePlanLimits: () => ({
    loading: false,
    canPublishProducts: true,
    refreshUsage: vi.fn(),
    plan: "pro",
    productLimitReached: false,
  }),
}));
vi.mock("@/hooks/useStartMode", () => ({ useStartMode: () => false }));
vi.mock("@/components/PlansUpgradeModal", () => ({ useUpgradeModal: () => ({ open: vi.fn() }) }));
vi.mock("@/components/UpgradeLimitModal", () => ({ default: () => null }));
vi.mock("@/components/dashboard/VideoTutorialModal", () => ({ default: () => null }));
vi.mock("@/lib/tutorialMercadoLivre", () => ({
  TUTORIAL_CONTA_VENDEDOR: { src: "/v.mp4", aspectPadding: "56%" },
}));
vi.mock("@/components/dashboard/FirstStoreOnboarding", () => ({
  getActiveStore: () => null,
  getStorePublishedCount: () => 0,
  incrementStorePublishedCount: vi.fn(),
}));
vi.mock("@/lib/mercadoLivreOAuth", () => ({ startMercadoLivreOAuth: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/ui/velo-toast", () => ({
  veloToast: {
    error: toastError,
    success: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => "t"),
    dismiss: vi.fn(),
  },
}));

import ImportProductModal from "@/components/dashboard/ImportProductModal";

const CHAVE_PROGRESSO = "velo:ml-tutorial-verificacao";

/** Conta apta / bloqueada segundo a edge function `ml-seller-status`. */
const contaBloqueada = () => invoke.mockResolvedValue({ data: { connected: true, canList: false } });
const contaLiberada = () => invoke.mockResolvedValue({ data: { connected: true, canList: true } });

const irAteRevisao = async () => {
  await waitFor(() => expect(screen.getByRole("button", { name: /Próximo/i })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
  await screen.findByRole("button", { name: /Publicar produto/i });
};

const pedirParaPublicar = () =>
  fireEvent.click(screen.getByRole("button", { name: /Publicar produto/i }));

const deixarOsTimersCorrerem = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });

/** Passo 1 → 2 → (abre o ML) → 3. */
const percorrerTutorialAteOFim = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^Continuar/i }));
  fireEvent.click(screen.getByRole("button", { name: /Acessar página do Mercado Livre/i }));
  await screen.findByText("Passo 3 de 3");
};

const passosVisiveis = () => screen.queryAllByText(/Passo \d de 3/).map((n) => n.textContent);

describe("ImportProductModal — tutorial de verificação do Mercado Livre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("open", vi.fn());
    maybeSingle.mockResolvedValue({ data: { access_token: "tok" } });
    publicarNoMercadoLivre.mockResolvedValue({ permalink: "https://ml/x", item_id: "MLB1" });
  });

  it('"Entendi" no passo 3 retoma a publicação em vez de só fechar', async () => {
    contaBloqueada();
    render(<ImportProductModal open onClose={vi.fn()} product={PRODUTO} />);
    await irAteRevisao();

    pedirParaPublicar();
    await screen.findByText("Passo 1 de 3");
    await percorrerTutorialAteOFim();

    // A pessoa verificou a conta no ML; agora o ML confirma que ela pode publicar.
    contaLiberada();
    fireEvent.click(screen.getByRole("button", { name: /Entendi/i }));
    await deixarOsTimersCorrerem();

    expect(publicarNoMercadoLivre).toHaveBeenCalledTimes(1);
  });

  it("avisa e mantém o passo 3 quando o ML ainda não liberou a conta", async () => {
    contaBloqueada();
    render(<ImportProductModal open onClose={vi.fn()} product={PRODUTO} />);
    await irAteRevisao();

    pedirParaPublicar();
    await screen.findByText("Passo 1 de 3");
    await percorrerTutorialAteOFim();

    // O ML continua bloqueando: nada de publicar, nada de rebobinar o tutorial.
    fireEvent.click(screen.getByRole("button", { name: /Entendi/i }));
    await deixarOsTimersCorrerem();

    expect(publicarNoMercadoLivre).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("ainda não confirmou"));

    // Nova tentativa reabre onde ela parou — antes voltava para o "Passo 1 de 3".
    pedirParaPublicar();
    await deixarOsTimersCorrerem();
    expect(passosVisiveis()).toEqual(["Passo 3 de 3"]);
  });

  it("grava o progresso antes de mandar a pessoa para o Mercado Livre", async () => {
    contaBloqueada();
    render(<ImportProductModal open onClose={vi.fn()} product={PRODUTO} />);
    await irAteRevisao();

    pedirParaPublicar();
    await screen.findByText("Passo 1 de 3");
    await percorrerTutorialAteOFim();

    const salvo = JSON.parse(localStorage.getItem(CHAVE_PROGRESSO) ?? "{}");
    expect(salvo).toMatchObject({ etapa: 3, visitouMercadoLivre: true });
  });

  it("reabre no passo 3 depois de a aba ser descartada e recarregada (celular)", async () => {
    contaBloqueada();
    const primeira = render(<ImportProductModal open onClose={vi.fn()} product={PRODUTO} />);
    await irAteRevisao();
    pedirParaPublicar();
    await screen.findByText("Passo 1 de 3");
    await percorrerTutorialAteOFim();

    // Android/iOS descartam a aba em segundo plano enquanto ela está no ML.
    primeira.unmount();

    render(<ImportProductModal open onClose={vi.fn()} product={PRODUTO} />);
    await irAteRevisao();
    pedirParaPublicar();

    expect(await screen.findByText("Passo 3 de 3")).toBeInTheDocument();
    expect(passosVisiveis()).toEqual(["Passo 3 de 3"]);
  });

  it("esquece o tutorial depois que o produto é publicado", async () => {
    contaLiberada();
    render(<ImportProductModal open onClose={vi.fn()} product={PRODUTO} />);
    await irAteRevisao();

    pedirParaPublicar();
    await deixarOsTimersCorrerem();

    expect(publicarNoMercadoLivre).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CHAVE_PROGRESSO)).toBeNull();
  });
});
