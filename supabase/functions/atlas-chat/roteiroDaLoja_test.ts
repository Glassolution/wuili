import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { comecarLoja, continuarLoja, pedeLoja, type BriefingDaLoja } from "./roteiroDaLoja.ts";

const contar = async () => 5;
const passo = async (b: BriefingDaLoja, t: string) => (await continuarLoja(t, b, contar))!;

Deno.test("loja com marca: marca → cores → fonte → público → estilo → diferencial → produtos → resumo", async () => {
  let r = comecarLoja("Quero uma loja de roupas fitness");
  assertEquals(r.briefing!.etapa, "marca");
  assert(r.message.includes("você já tem uma marca ou uma loja?"));
  r = await passo(r.briefing!, "Já tenho uma marca");
  assertEquals(r.briefing!.marca, { tem: true });
  assertEquals(r.briefing!.etapa, "cores");
  r = await passo(r.briefing!, "Minhas cores: verde (#2F7D46) e creme (#F5F0E6)");
  assertEquals(r.briefing!.cores, "verde (#2F7D46) e creme (#F5F0E6)");
  assertEquals(r.briefing!.etapa, "fonte");
  r = await passo(r.briefing!, "Não sei a fonte");
  assertEquals(r.briefing!.marca, { tem: true, fonte: null });
  assertEquals(r.briefing!.etapa, "publico");
  r = await passo(r.briefing!, "mulheres que treinam cedo");
  assertEquals(r.briefing!.etapa, "estilo");
  r = await passo(r.briefing!, "Ousada");
  assertEquals(r.briefing!.estilo, "Ousada");
  assertEquals(r.briefing!.etapa, "diferencial");
  r = await passo(r.briefing!, "Pular");
  assertEquals(r.briefing!.diferencial, null);
  assertEquals(r.briefing!.etapa, "produtos");
  r = await passo(r.briefing!, "Usar o catálogo da Velo");
  assertEquals(r.briefing!.etapa, "resumo");
  assert(r.message.includes("**Marca:** a sua (logo, cores)"));
  assert(r.message.includes("a logo da sua marca"));
  assertEquals(r.actions[0].type, "create_store");
});

Deno.test("sem marca: estilo vem antes das cores e personalidade livre é ligada", async () => {
  let r = await passo(comecarLoja("loja de velas").briefing!, "Ainda não tenho");
  assertEquals(r.briefing!.etapa, "publico");
  r = await passo(r.briefing!, "Ainda não sei");
  assertEquals(r.briefing!.publico, null);
  r = await passo(r.briefing!, "bem sofisticada");
  assertEquals(r.briefing!.estilo, "Elegante (bem sofisticada)");
  assertEquals(r.briefing!.etapa, "cores");
});

Deno.test("mudar algo com marca oferece mudar a fonte", async () => {
  const b: BriefingDaLoja = { ...comecarLoja("loja de velas").briefing!, marca: { tem: true, fonte: null }, etapa: "resumo" };
  const r = await passo(b, "Quero mudar algo");
  assertEquals(r.briefing!.etapa, "mudar");
  assert(r.actions.some((a) => a.label === "Mudar a fonte"));
  assert(r.actions.some((a) => a.label === "Mudar a marca"));
});

Deno.test("resumo + assunto fora do roteiro volta para o modelo; pedido de loja do ML não abre roteiro", async () => {
  const b: BriefingDaLoja = { ...comecarLoja("loja de velas").briefing!, etapa: "resumo" };
  assertEquals(await continuarLoja("como conecto o mercado livre?", b, contar), null);
  assert(pedeLoja("quero criar uma loja"));
  assert(!pedeLoja("quero criar minha loja no mercado livre"));
});

Deno.test("pedeLoja só abre o roteiro para loja ou site novo", () => {
  for (const f of ["quero mudar o banner da minha loja", "quero ver minha loja", "quero colocar produtos na minha loja", "quero editar meu site", "quero publicar no meu site"])
    assert(!pedeLoja(f), f);
  for (const f of ["quero criar uma loja de roupas", "quero montar uma loja de velas", "quero abrir uma loja de doces", "quero ter uma loja", "quero um site para meu consultório"])
    assert(pedeLoja(f), f);
});

Deno.test("personalidade usa dois-pontos e resumo não repete descrição de texto livre", async () => {
  const base = { ...comecarLoja("loja de velas").briefing!, marca: { tem: false }, publico: null, etapa: "estilo" as const };
  const r = await passo(base, "Elegante");
  assert(r.message.startsWith("Boa: uma marca **elegante**: discreta, sofisticada, poucas palavras."));
  const fim = await passo({ ...base, estilo: "Elegante (bem sofisticada, discreta)", cores: "Azul", diferencial: null, etapa: "produtos" }, "Meus próprios produtos");
  assert(fim.message.includes("**Personalidade:** Elegante (bem sofisticada, discreta)\n"));
});
