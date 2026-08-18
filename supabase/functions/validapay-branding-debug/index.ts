// Diagnóstico interno: descobre de onde o checkout hospedado da ValidaPay lê a logo.
// Não é usada pelo app — cria uma sessão de teste e inspeciona a página gerada.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createCheckoutSession, validaPayFetch } from "../_shared/validapay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get("token") !== (Deno.env.get("VALIDAPAY_DEBUG_TOKEN") ?? "velo-debug")) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const out: Record<string, unknown> = {};
  const priceId = Deno.env.get("VALIDAPAY_PRICE_BASE");
  const logoUrl = url.searchParams.get("logo") ??
    "https://nqzpoioxvbqavrtphtoa.supabase.co/storage/v1/object/public/assets/branding%2Fvalidapay-logo.png";

  try {
    const session = await createCheckoutSession({
      priceId,
      items: [{ priceId, quantity: 1 }],
      companyName: "Velo",
      logoUrl,
      companyLogoUrl: logoUrl,
      logo: logoUrl,
      imageUrl: logoUrl,
      metadata: { debug: true },
      successUrl: "https://www.velods.com.br/assinatura/confirmada",
    });
    out.session = session;

    const page = (session as { url?: string })?.url;
    if (page) {
      const r = await fetch(page);
      const html = await r.text();
      out.page = {
        status: r.status,
        imgs: [...new Set(
          [...html.matchAll(/(https?:\/\/[^"'\s)<>]+\.(?:png|jpe?g|svg|webp))/gi)].map((m) => m[1]),
        )].slice(0, 40),
        htmlHead: html.slice(0, 1500),
      };
      const m = page.match(/([^/]+)$/);
      if (m) {
        for (const p of [`/v1/checkout-sessions/${m[1]}`, `/v1/checkouts/${m[1]}`]) {
          try {
            out[p] = await validaPayFetch(p, { method: "GET", scope: "checkouts/read" });
          } catch (e) {
            out[p] = String(e);
          }
        }
      }
    }
  } catch (e) {
    out.error = String(e);
    out.details = (e as { details?: unknown })?.details ?? null;
  }

  if (priceId) {
    for (const p of [`/v1/prices/${priceId}`, `/v1/products`]) {
      try {
        out[p] = await validaPayFetch(p, { method: "GET", scope: "checkouts/read" });
      } catch (e) {
        out[p] = String(e);
      }
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
