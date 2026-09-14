// Gera as miniaturas da galeria de modelos (public/template-*.png).
//
// Como usar:
//   1. suba o dev server:  npm run dev
//   2. rode:               node scripts/gerar-previews-templates.mjs [porta]
//
// O script abre /__preview-template/:id (rota só de dev) para cada template,
// espera as imagens carregarem e salva o PNG da PÁGINA INTEIRA — a galeria usa
// essa altura toda para "rolar" o preview quando o mouse passa por cima. Rode de novo sempre que mexer no
// visual de um template — assim o card da galeria nunca fica desatualizado.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const porta = process.argv[2] ?? "8080";
const base = `http://localhost:${porta}`;

const templates = [
  { id: "produto-velo", arquivo: "template-produto-preview.png" },
  { id: "produto-blue", arquivo: "template-produto-blue-preview.png" },
  { id: "produto-black", arquivo: "template-produto-black-preview.png" },
];

const navegador = await chromium.launch();
const pagina = await navegador.newPage({
  viewport: { width: 1280, height: 1200 },
  deviceScaleFactor: 1,
});

await mkdir("public", { recursive: true });

for (const { id, arquivo } of templates) {
  const url = `${base}/__preview-template/${id}`;
  await pagina.goto(url, { waitUntil: "networkidle" });

  // Garante que toda <img> terminou de decodificar antes do print. As imagens
  // com `loading="lazy"` só baixam ao entrar na viewport — num print de página
  // inteira elas ficariam em branco e o `decode()` nunca resolveria, então aqui
  // o carregamento preguiçoso é desligado antes da espera.
  await pagina.evaluate(async () => {
    for (const img of document.images) img.loading = "eager";
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))),
    );
  });
  await pagina.waitForTimeout(600);

  // `animations: disabled` congela o ticker de benefícios: sem isso o print sai
  // com a faixa em posição aleatória (ou o Playwright espera a animação acabar,
  // e ela é infinita).
  await pagina.screenshot({ path: `public/${arquivo}`, fullPage: true, animations: "disabled" });
  console.log(`✓ ${arquivo}  (${id})`);
}

await navegador.close();
console.log("\nPronto. Aponte os previews em src/lib/salesPageTemplates.ts para os arquivos gerados.");
