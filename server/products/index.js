import express from "express";
import { pathToFileURL } from "node:url";
import productRoutes from "./routes.js";

const port = Number(process.env.PRODUCTS_PORT ?? process.env.PORT ?? 3334);

export function createProductsApp() {
  const app = express();

  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "velo-products-curation" });
  });

  app.use(productRoutes);

  app.use((error, _req, res, _next) => {
    console.error("[product-curation]", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createProductsApp().listen(port, () => {
    console.log(`[product-curation] Servidor rodando em http://localhost:${port}`);
  });
}

