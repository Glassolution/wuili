import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  lerProgressoTutorialMl,
  limparProgressoTutorialMl,
  salvarProgressoTutorialMl,
} from "@/lib/mlVerificacaoTutorial";

const CHAVE = "velo:ml-tutorial-verificacao";

describe("progresso do tutorial de verificação do ML", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("começa no passo 1 quando não há nada gravado", () => {
    expect(lerProgressoTutorialMl()).toMatchObject({
      etapa: 1,
      visitouMercadoLivre: false,
      concluido: false,
    });
  });

  it("só avança: voltar no tutorial não apaga o caminho já andado", () => {
    salvarProgressoTutorialMl({ etapa: 3, visitouMercadoLivre: true });
    salvarProgressoTutorialMl({ etapa: 1 });
    expect(lerProgressoTutorialMl().etapa).toBe(3);
    expect(lerProgressoTutorialMl().visitouMercadoLivre).toBe(true);
  });

  it("expira depois de 24h para não prender alguém num tutorial antigo", () => {
    const ontem = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(
      CHAVE,
      JSON.stringify({ etapa: 3, visitouMercadoLivre: true, concluido: true, criadoEm: ontem }),
    );
    expect(lerProgressoTutorialMl().etapa).toBe(1);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("ignora conteúdo corrompido em vez de quebrar o fluxo", () => {
    localStorage.setItem(CHAVE, "{ isto não é json");
    expect(lerProgressoTutorialMl().etapa).toBe(1);
  });

  it("sobrevive ao storage bloqueado (aba anônima)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => salvarProgressoTutorialMl({ etapa: 2 })).not.toThrow();
  });

  it("limpa o progresso", () => {
    salvarProgressoTutorialMl({ etapa: 3, concluido: true });
    limparProgressoTutorialMl();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});
