// Proxy simples pra hotlinks bloqueados (ex.: c7drop.com.br via Vercel firewall).
// Uso: /functions/v1/img-proxy?u=<url-encoded>
// Recebe apenas hosts em ALLOWED_HOSTS pra evitar SSRF. Faz stream do binário e
// aplica cache agressivo, já que URLs de mídia do fornecedor são imutáveis.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ALLOWED_HOSTS = new Set([
  "c7drop.com.br",
  "www.c7drop.com.br",
]);

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("u");
    if (!raw) return new Response("missing u", { status: 400, headers: corsHeaders });

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return new Response("invalid url", { status: 400, headers: corsHeaders });
    }
    if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
      return new Response("host not allowed", { status: 400, headers: corsHeaders });
    }

    const upstream = await fetch(target.toString(), { headers: BROWSER_HEADERS, redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (e) {
    console.error("img-proxy error:", e);
    return new Response("proxy error", { status: 500, headers: corsHeaders });
  }
});
