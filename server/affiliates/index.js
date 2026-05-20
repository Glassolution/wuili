import express from "express";
import { pathToFileURL } from "node:url";
import affiliateRoutes from "./routes.js";
import productRoutes from "../products/routes.js";

const port = Number(process.env.PORT ?? 3333);

export function createAffiliateApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  // /ref/:code -> salva cookie e redireciona para a home (tracking de afiliado)
  app.get("/ref/:code", (req, res) => {
    const code = String(req.params.code ?? "").trim().toUpperCase();
    if (code && /^[A-Z0-9]{4,32}$/.test(code)) {
      const maxAge = 60 * 60 * 24 * 90; // 90 dias
      res.setHeader("Set-Cookie", `velo_ref=${encodeURIComponent(code)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
    }
    res.statusCode = 302;
    res.setHeader("Location", "/");
    return res.end();
  });

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
