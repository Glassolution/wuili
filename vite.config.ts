import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { pathToFileURL } from "url";
import { componentTagger } from "lovable-tagger";

function affiliateApiDevMiddleware() {
  return {
    name: "affiliate-api-dev-middleware",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const requestUrl = new URL(req.url ?? "/", "http://localhost");

        // /ref/:code -> salva cookie e redireciona para home (tracking de afiliado)
        if (req.method === "GET" && requestUrl.pathname.startsWith("/ref/")) {
          const code = requestUrl.pathname.slice("/ref/".length).trim().toUpperCase();
          res.statusCode = 302;
          res.setHeader("Location", "/");

          if (/^[A-Z0-9]{4,32}$/.test(code)) {
            const maxAge = 60 * 60 * 24 * 90; // 90 dias
            const cookie = `velo_ref=${encodeURIComponent(code)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
            res.setHeader("Set-Cookie", cookie);
          }

          res.end();
          return;
        }

        const handlerByPath: Record<string, string> = {
          "/api/affiliates/generate": "api/affiliates/generate.js",
          "/api/affiliates/link": "api/affiliates/link.js",
          "/api/products/curated": "api/products/curated.js",
          "/api/products/recommended": "api/products/recommended.js",
        };
        const handlerPath = handlerByPath[requestUrl.pathname];

        if (!handlerPath) {
          return next();
        }

        req.query = Object.fromEntries(requestUrl.searchParams.entries());
        const moduleUrl = pathToFileURL(path.resolve(__dirname, handlerPath)).href;
        const { default: handler } = await import(`${moduleUrl}?t=${Date.now()}`);
        const chunks: any[] = [];

        req.on("data", (chunk: any) => chunks.push(chunk));
        req.on("end", async () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          if (rawBody) {
            try {
              req.body = JSON.parse(rawBody);
            } catch {
              req.body = rawBody;
            }
          }

          const vercelRes = {
            setHeader: (name: string, value: any) => res.setHeader(name, value),
            status: (statusCode: number) => {
              res.statusCode = statusCode;
              return vercelRes;
            },
            json: (payload: any) => {
              if (!res.hasHeader("Content-Type")) {
                res.setHeader("Content-Type", "application/json; charset=utf-8");
              }
              res.end(JSON.stringify(payload));
              return vercelRes;
            },
          };

          try {
            await handler(req, vercelRes);
          } catch (error: any) {
            console.error("[vite-dev] affiliate API handler failed:", error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({
              error: "Erro interno no handler local de afiliados.",
              message: error?.message ?? "Erro desconhecido.",
            }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Garante que os handlers locais em /api/* consigam ler variaveis do .env via process.env, assim como no deploy.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    server: {
      host: "::",
      port: Number(process.env.PORT) || 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), affiliateApiDevMiddleware(), mode === "development" && componentTagger()].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (/node_modules[/\\](react|react-dom|scheduler)[/\\]/.test(id)) return "vendor-react";
            return "vendor";
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
