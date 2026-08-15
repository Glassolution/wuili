import { describe, expect, it } from "vitest";
import {
  MOVE_THRESHOLD,
  RESIZE_LIMITS,
  computeMove,
  computeResize,
  passedMoveThreshold,
  type MoveOrigin,
  type ResizeOrigin,
} from "./storeResize";

const origin: ResizeOrigin = { startX: 100, startY: 100, startWidth: 300, startHeight: 80 };

describe("computeResize", () => {
  it("alça leste aumenta a largura ao arrastar para a direita", () => {
    // zoom 1: 50px de mouse = 50px de elemento.
    expect(computeResize("e", origin, 150, 100, 1)).toEqual({ width: 350, offsetX: 0 });
  });

  it("alça oeste encolhe ao arrastar para a direita", () => {
    expect(computeResize("w", origin, 150, 100, 1)).toEqual({ width: 250, offsetX: 50 });
  });

  it("alça sul aumenta a altura mínima", () => {
    expect(computeResize("s", origin, 100, 140, 1)).toEqual({ minHeight: 120, offsetY: 0 });
  });

  it("alça norte encolhe a altura ao arrastar para baixo", () => {
    expect(computeResize("n", origin, 100, 140, 1)).toEqual({ minHeight: 40, offsetY: 40 });
  });

  it("canto mexe nos dois eixos de uma vez", () => {
    expect(computeResize("se", origin, 160, 130, 1)).toEqual({ width: 360, offsetX: 0, minHeight: 110, offsetY: 0 });
  });

  it("alça de um eixo não devolve o outro", () => {
    // Chave ausente = o override não recebe aquele campo, então arrastar a
    // largura não pode acabar gravando uma altura mínima que o lojista não pediu.
    const result = computeResize("e", origin, 200, 400, 1);
    expect(result.minHeight).toBeUndefined();
    expect(result.offsetY).toBeUndefined();
    expect(Object.keys(result)).toEqual(["width", "offsetX"]);
  });

  it("compensa o zoom do canvas", () => {
    // No zoom padrão (0.52) o canvas é desenhado menor que o documento: 52px de
    // movimento na tela equivalem a 100px no elemento. Sem dividir pelo zoom a
    // caixa cresceria ~2x mais rápido que o cursor.
    expect(computeResize("e", origin, 152, 100, 0.52)).toEqual({ width: 400, offsetX: 0 });
    expect(computeResize("e", origin, 200, 100, 2)).toEqual({ width: 350, offsetX: 0 });
  });

  it("zoom inválido não explode o cálculo", () => {
    expect(computeResize("e", origin, 150, 100, 0)).toEqual({ width: 350, offsetX: 0 });
  });

  it("respeita os limites compartilhados com os inputs numéricos", () => {
    // Arrastar muito para a esquerda não pode zerar a caixa e torná-la
    // impossível de pegar de novo.
    expect(computeResize("w", origin, 5000, 100, 1)).toEqual({ width: RESIZE_LIMITS.minWidth, offsetX: 276 });
    expect(computeResize("e", origin, 99999, 100, 1)).toEqual({ width: RESIZE_LIMITS.maxWidth, offsetX: 0 });
    expect(computeResize("n", origin, 100, 99999, 1)).toEqual({ minHeight: RESIZE_LIMITS.minHeight, offsetY: 80 });
    expect(computeResize("s", origin, 100, 99999, 1)).toEqual({ minHeight: RESIZE_LIMITS.maxHeight, offsetY: 0 });
  });

  it("devolve inteiros — o override guarda px inteiros", () => {
    const result = computeResize("se", origin, 133.7, 121.4, 0.73);
    expect(Number.isInteger(result.width)).toBe(true);
    expect(Number.isInteger(result.minHeight)).toBe(true);
    expect(Number.isInteger(result.offsetX)).toBe(true);
    expect(Number.isInteger(result.offsetY)).toBe(true);
  });

  it("sem movimento devolve o tamanho original", () => {
    expect(computeResize("se", origin, 100, 100, 0.52)).toEqual({ width: 300, offsetX: 0, minHeight: 80, offsetY: 0 });
  });

  it("preserva deslocamento base ao redimensionar com a borda oposta ancorada", () => {
    const movedOrigin: ResizeOrigin = { ...origin, baseX: 20, baseY: -10 };
    expect(computeResize("se", movedOrigin, 110, 110, 1)).toEqual({
      width: 310,
      offsetX: 20,
      minHeight: 90,
      offsetY: -10,
    });
  });
});

const moveOrigin: MoveOrigin = { startX: 200, startY: 300, baseX: 0, baseY: 0 };

describe("passedMoveThreshold", () => {
  it("um clique seco não vira movimento", () => {
    // É isso que preserva clicar-para-selecionar e o duplo-clique de edição.
    expect(passedMoveThreshold(moveOrigin, 200, 300)).toBe(false);
    expect(passedMoveThreshold(moveOrigin, 202, 301)).toBe(false);
  });

  it("passa do limiar em qualquer direção", () => {
    expect(passedMoveThreshold(moveOrigin, 200 + MOVE_THRESHOLD + 1, 300)).toBe(true);
    expect(passedMoveThreshold(moveOrigin, 200, 300 - MOVE_THRESHOLD - 1)).toBe(true);
    // Diagonal: a distância euclidiana conta, não cada eixo isolado.
    expect(passedMoveThreshold(moveOrigin, 204, 304)).toBe(true);
  });
});

describe("computeMove", () => {
  it("desloca na direção do mouse", () => {
    expect(computeMove(moveOrigin, 260, 340, 1)).toEqual({ offsetX: 60, offsetY: 40 });
  });

  it("continua de onde o arrasto anterior parou", () => {
    // Sem somar o baseX/baseY, cada novo arrasto teleportaria o elemento de volta.
    const origin: MoveOrigin = { startX: 200, startY: 300, baseX: 25, baseY: -10 };
    expect(computeMove(origin, 210, 310, 1)).toEqual({ offsetX: 35, offsetY: 0 });
  });

  it("compensa o zoom do canvas", () => {
    expect(computeMove(moveOrigin, 252, 300, 0.52)).toEqual({ offsetX: 100, offsetY: 0 });
  });

  it("aceita deslocamento negativo", () => {
    expect(computeMove(moveOrigin, 150, 250, 1)).toEqual({ offsetX: -50, offsetY: -50 });
  });

  it("devolve inteiros", () => {
    const result = computeMove(moveOrigin, 233.7, 341.2, 0.73);
    expect(Number.isInteger(result.offsetX)).toBe(true);
    expect(Number.isInteger(result.offsetY)).toBe(true);
  });

  it("zoom inválido não explode", () => {
    expect(computeMove(moveOrigin, 260, 340, 0)).toEqual({ offsetX: 60, offsetY: 40 });
  });
});
