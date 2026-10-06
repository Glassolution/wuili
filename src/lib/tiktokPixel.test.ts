import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { update, eq, invoke } = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: (campos: unknown) => { update(campos); return { eq: (...a: unknown[]) => { eq(...a); return Promise.resolve({ error: null }); } }; } }),
    rpc: () => Promise.resolve({ error: null }),
    functions: { invoke },
  },
}));

import {
  TIKTOK_PIXEL_ID,
  eventIdCadastro,
  iniciarTikTokPixel,
  rotaTemPixelTikTok,
  tiktokCadastroConcluido,
  tiktokCadastroServidor,
  tiktokCliqueCadastro,
  tiktokVisualizacao,
} from "./tiktokPixel";
import { captureOrigin, concluirCadastroNoTikTok, readOrigin, salvarOrigemTikTokNoPerfil } from "./signupFunnel";

type Fila = unknown[] & { _i?: Record<string, unknown> };
const w = window as unknown as Record<string, unknown> & { ttq?: Fila };

function irPara(url: string) {
  window.history.replaceState(null, "", url);
}

function resetar() {
  delete w.ttq;
  delete w.TiktokAnalyticsObject;
  delete w.__veloTikTokPixel;
  document.head.innerHTML = "";
  document.head.appendChild(document.createElement("script"));
  localStorage.clear();
  document.cookie = "_ttp=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  delete (navigator as unknown as Record<string, unknown>).globalPrivacyControl;
  update.mockClear();
  eq.mockClear();
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { status: "sent" }, error: null });
  irPara("/");
}

describe("tiktokPixel", () => {
  beforeEach(resetar);

  it("libera o pixel só na landing e no cadastro", () => {
    expect(rotaTemPixelTikTok("/")).toBe(true);
    expect(rotaTemPixelTikTok("/login")).toBe(true);
    expect(rotaTemPixelTikTok("/cadastro/")).toBe(true);
    expect(rotaTemPixelTikTok("/loja/minha-loja")).toBe(false);
    expect(rotaTemPixelTikTok("/loja/minha-loja/checkout")).toBe(false);
    expect(rotaTemPixelTikTok("/store/x/obrigado")).toBe(false);
    expect(rotaTemPixelTikTok("/dashboard")).toBe(false);
  });

  it("carrega o script uma vez só, com o ID da Velo, e enfileira os eventos padrão", () => {
    tiktokVisualizacao();
    tiktokCliqueCadastro("cta_hero_signup_click");
    tiktokVisualizacao();

    const scripts = document.querySelectorAll("#tiktok-pixel-base");
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toContain(`sdkid=${TIKTOK_PIXEL_ID}`);
    expect((scripts[0] as HTMLScriptElement).async).toBe(true);
    expect(w.ttq?._i?.[TIKTOK_PIXEL_ID]).toBeDefined();
    // Sem isso o script do TikTok conta visita sozinho em qualquer rota do app.
    expect((w.ttq as unknown as { _o: Record<string, unknown> })._o[TIKTOK_PIXEL_ID]).toEqual({ historyObserver: false });
    expect(Array.from(w.ttq ?? [])).toEqual([
      ["page"],
      ["track", "ClickButton", { content_name: "cta_hero_signup_click" }],
      ["page"],
    ]);
  });

  it("não carrega nada quando o navegador pede para não rastrear (GPC)", () => {
    (navigator as unknown as Record<string, unknown>).globalPrivacyControl = true;
    expect(iniciarTikTokPixel()).toBe(false);
    tiktokVisualizacao();
    expect(document.getElementById("tiktok-pixel-base")).toBeNull();
    expect(w.ttq).toBeUndefined();
  });

  it("cadastro concluído envia identificação em hash e event_id fixo por conta", async () => {
    await tiktokCadastroConcluido({ id: "user-1", email: " Ana@Exemplo.com " });
    const fila = Array.from(w.ttq ?? []) as unknown[][];
    const identify = fila.find((c) => c[0] === "identify") as [string, Record<string, string>];
    expect(identify[1].email).toMatch(/^[0-9a-f]{64}$/);
    expect(identify[1].email).not.toContain("ana");
    expect(identify[1].external_id).toMatch(/^[0-9a-f]{64}$/);
    expect(fila).toContainEqual(["track", "CompleteRegistration", { content_name: "cadastro_velo" }, { event_id: "cadastro_user-1" }]);
  });
});

describe("origem do clique (ttclid e UTMs)", () => {
  beforeEach(resetar);

  it("guarda ttclid e todas as UTMs na landing e mantém tudo ao ir para /login sem parâmetros", () => {
    irPara("/?utm_source=tiktok&utm_medium=paid&utm_campaign=lancamento&utm_content=video-3&utm_term=dropshipping&ttclid=E.C.P.abc123");
    captureOrigin();
    irPara("/login?novo=1");
    captureOrigin();

    const origem = readOrigin();
    expect(origem).toMatchObject({
      signup_source: "tiktok",
      utm_source: "tiktok",
      utm_medium: "paid",
      utm_campaign: "lancamento",
      utm_content: "video-3",
      utm_term: "dropshipping",
      ttclid: "E.C.P.abc123",
    });
    expect(origem.ttclid_captured_at).toBeTruthy();
  });

  it("uma visita nova sem ttclid troca as UTMs mas preserva o ttclid anterior", () => {
    irPara("/?utm_source=tiktok&ttclid=clique-1");
    captureOrigin();
    irPara("/?utm_source=instagram&utm_campaign=stories");
    captureOrigin();
    expect(readOrigin()).toMatchObject({ utm_source: "instagram", utm_campaign: "stories", ttclid: "clique-1" });
  });

  it("lê registros antigos (sem os campos novos) sem quebrar", () => {
    localStorage.setItem("velo_signup_origin", JSON.stringify({ signup_source: "google.com", utm_source: null, utm_medium: null, utm_campaign: null }));
    expect(readOrigin()).toMatchObject({ signup_source: "google.com", ttclid: null, utm_content: null });
  });

  it("salva no perfil só os campos que têm valor, incluindo o cookie _ttp", async () => {
    irPara("/?utm_source=tiktok&utm_content=video-3&ttclid=clique-9");
    captureOrigin();
    document.cookie = "_ttp=cookie-do-tiktok";
    await salvarOrigemTikTokNoPerfil("user-1");
    expect(update).toHaveBeenCalledTimes(1);
    const campos = update.mock.calls[0][0] as Record<string, unknown>;
    expect(campos).toMatchObject({ utm_content: "video-3", ttclid: "clique-9", tiktok_ttp: "cookie-do-tiktok" });
    expect(campos).not.toHaveProperty("utm_term");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("descarta ttclid com mais de 28 dias e não grava nada se não houver origem", async () => {
    localStorage.setItem("velo_signup_origin", JSON.stringify({ ttclid: "velho", ttclid_captured_at: "2020-01-01T00:00:00.000Z" }));
    await salvarOrigemTikTokNoPerfil("user-1");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("cadastro pelo servidor (Events API)", () => {
  beforeEach(resetar);

  const corpoEnviado = () => invoke.mock.calls[0][1].body as Record<string, unknown>;

  it("chama a função tiktok-events com o mesmo event_id do pixel, sem a query string do link", async () => {
    irPara("/cadastro?utm_source=tiktok&ttclid=abc");
    await tiktokCadastroServidor({ userId: "user-1", ttclid: "abc", ttp: "cookie-ttp" });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe("tiktok-events");
    expect(corpoEnviado()).toEqual({
      action: "complete_registration",
      event_id: "cadastro_user-1",
      page_url: `${window.location.origin}/cadastro`,
      ttclid: "abc",
      ttp: "cookie-ttp",
    });
    expect(eventIdCadastro("user-1")).toBe("cadastro_user-1");
  });

  it("não manda ttclid nem ttp quando não existem", async () => {
    await tiktokCadastroServidor({ userId: "user-1" });
    expect(corpoEnviado()).not.toHaveProperty("ttclid");
    expect(corpoEnviado()).not.toHaveProperty("ttp");
  });

  it("não chama o servidor quando o navegador pede para não rastrear (GPC)", async () => {
    (navigator as unknown as Record<string, unknown>).globalPrivacyControl = true;
    await tiktokCadastroServidor({ userId: "user-1", ttclid: "abc" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("falha do servidor nunca vira erro para o cadastro", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    invoke.mockResolvedValueOnce({ data: null, error: new Error("500") });
    await expect(tiktokCadastroServidor({ userId: "user-1" })).resolves.toBeUndefined();
    invoke.mockRejectedValueOnce(new Error("sem internet"));
    await expect(tiktokCadastroServidor({ userId: "user-1" })).resolves.toBeUndefined();
    aviso.mockRestore();
  });

  it("concluir o cadastro manda pixel e servidor com o mesmo event_id e o ttclid guardado", async () => {
    irPara("/?utm_source=tiktok&ttclid=clique-7");
    captureOrigin();
    irPara("/cadastro");
    document.cookie = "_ttp=cookie-do-tiktok";
    expect(() => concluirCadastroNoTikTok({ id: "user-9", email: "ana@exemplo.com" })).not.toThrow();
    await vi.waitFor(() => {
      const fila = Array.from(w.ttq ?? []) as unknown[][];
      expect(fila.some((c) => c[1] === "CompleteRegistration")).toBe(true);
    });
    const fila = Array.from(w.ttq ?? []) as unknown[][];
    const pixel = fila.find((c) => c[1] === "CompleteRegistration") as unknown[];
    expect(pixel[3]).toEqual({ event_id: "cadastro_user-9" });
    expect(corpoEnviado()).toMatchObject({ event_id: "cadastro_user-9", ttclid: "clique-7", ttp: "cookie-do-tiktok" });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("ttclid com mais de 28 dias não vai para o servidor", async () => {
    localStorage.setItem("velo_signup_origin", JSON.stringify({ ttclid: "velho", ttclid_captured_at: "2020-01-01T00:00:00.000Z" }));
    concluirCadastroNoTikTok({ id: "user-9" });
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(corpoEnviado()).not.toHaveProperty("ttclid");
  });
});

describe("event_id do cadastro igual no navegador e no servidor", () => {
  it("a função tiktok-events monta o código no mesmo formato do pixel", () => {
    // O código do servidor roda em Deno e não importa aqui; conferimos o texto.
    const servidor = readFileSync(path.resolve(__dirname, "../../supabase/functions/_shared/tiktokEvents.ts"), "utf8");
    const formato = servidor.match(/export function registrationEventId\(userId: string\): string \{\s*return `([^`]*)`;/);
    expect(formato?.[1]).toBe("cadastro_${userId}");
    expect(eventIdCadastro("user-1")).toBe("cadastro_user-1");

    const funcao = readFileSync(path.resolve(__dirname, "../../supabase/functions/tiktok-events/index.ts"), "utf8");
    expect(funcao).toContain("eventId: registrationEventId(user.id)");
    expect(funcao).not.toContain("eventId: body.event_id");
  });
});
