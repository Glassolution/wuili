import { beforeEach, describe, expect, it, vi } from "vitest";

const { respostas, consultas } = vi.hoisted(() => ({
  respostas: [] as Array<{ data: { status: string } | null; error: { message: string } | null } | Error>,
  consultas: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => ({
      select: (colunas: string) => ({
        eq: (coluna: string, valor: string) => ({
          maybeSingle: () => {
            consultas(tabela, colunas, coluna, valor);
            const proxima = respostas.shift() ?? { data: null, error: null };
            return proxima instanceof Error ? Promise.reject(proxima) : Promise.resolve(proxima);
          },
        }),
      }),
    }),
  },
}));

import { assinaturaEstaPaga } from "./assinaturaPaga";

const esperas: number[] = [];
const esperar = async (ms: number) => {
  esperas.push(ms);
};

beforeEach(() => {
  respostas.length = 0;
  esperas.length = 0;
  consultas.mockClear();
});

const status = (s: string) => ({ data: { status: s }, error: null });

describe("conferência da assinatura antes do Purchase", () => {
  it("active → pago na primeira consulta, lendo a assinatura pelo id do sid", async () => {
    respostas.push(status("active"));
    await expect(assinaturaEstaPaga("sub-1", { esperar })).resolves.toBe(true);
    expect(consultas).toHaveBeenCalledWith("subscriptions", "status", "id", "sub-1");
    expect(esperas).toEqual([]);
  });

  it("pending vira active: tenta de 3 em 3 segundos", async () => {
    respostas.push(status("pending"), status("pending"), status("active"));
    await expect(assinaturaEstaPaga("sub-1", { esperar })).resolves.toBe(true);
    expect(esperas).toEqual([3000, 3000]);
  });

  it("pending por 30 segundos → não pago (11 consultas, 10 esperas)", async () => {
    for (let i = 0; i < 20; i++) respostas.push(status("pending"));
    await expect(assinaturaEstaPaga("sub-1", { esperar })).resolves.toBe(false);
    expect(consultas).toHaveBeenCalledTimes(11);
    expect(esperas.reduce((a, b) => a + b, 0)).toBe(30000);
  });

  it("sid inexistente ou de outra pessoa (RLS devolve vazio) → não pago, sem repetir", async () => {
    respostas.push({ data: null, error: null });
    await expect(assinaturaEstaPaga("sid-falso", { esperar })).resolves.toBe(false);
    expect(consultas).toHaveBeenCalledTimes(1);
  });

  it.each(["past_due", "refunded", "cancel_scheduled", "cancelled"])("%s → não pago", async (s) => {
    respostas.push(status(s));
    await expect(assinaturaEstaPaga("sub-1", { esperar })).resolves.toBe(false);
    expect(consultas).toHaveBeenCalledTimes(1);
  });

  it("falha de rede tenta de novo dentro do limite", async () => {
    respostas.push(new Error("rede"), { data: null, error: { message: "timeout" } }, status("active"));
    await expect(assinaturaEstaPaga("sub-1", { esperar })).resolves.toBe(true);
  });
});
