import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeEmail } from "./refundIdentity.ts";

Deno.test("gmail com pontos e + vira o mesmo e-mail", () => {
  assertEquals(normalizeEmail(" Joao.Silva+velo2@Gmail.com "), "joaosilva@gmail.com");
});

Deno.test("outros provedores mantêm pontos, removem +", () => {
  assertEquals(normalizeEmail("joao.silva+x@hotmail.com"), "joao.silva@hotmail.com");
});
