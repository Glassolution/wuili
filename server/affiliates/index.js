import express from "express";
import { pathToFileURL } from "node:url";
import affiliateRoutes from "./routes.js";
import productRoutes from "../products/routes.js";

const port = Number(process.env.PORT ?? 3333);

export function createAffiliateApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "velo-affiliates" });
  });

  app.use(affiliateRoutes);
  app.use(productRoutes);

  app.use((error, _req, res, _next) => {
    console.error("[afiliados]", error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createAffiliateApp().listen(port, () => {
    console.log(`[afiliados] Servidor rodando em http://localhost:${port}`);
  });
}
