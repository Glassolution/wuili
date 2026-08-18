// Diagnóstico interno: descobre de onde o checkout hospedado da ValidaPay lê a logo.
// Não é usada pelo app — serve para inspecionar a conta/produto e a página gerada.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getValidaPayToken, VALIDAPAY_API_URL } from "../_shared/validapay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("VALIDAPAY_DEBUG_TOKEN") ?? "velo-debug";
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== secret) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = await getValidaPayToken();
  const out: Record<string, unknown> = {};

  const probe = async (path: string) => {
    try {
      const r = await fetch(`${VALIDAPAY_API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const t = await r.text();
      return { status: r.status, body: t.slice(0, 3000) };
    } catch (e) {
      return { error: String(e) };
    }
  };

  out["/v1/accounts/me"] = await probe("/v1/accounts/me");
  out["/v1/account"] = await probe("/v1/account");
  out["/v1/checkouts/settings"] = await probe("/v1/checkouts/settings");
  out["/v1/products"] = await probe("/v1/products");
  out["/v1/prices"] = await probe("/v1/prices");

  const page = url.searchParams.get("page");
  if (page) {
    try {
      const r = await fetch(page);
      const html = await r.text();
      const imgs = [...html.matchAll(/(https?:\/\/[^"'\s)]+\.(?:png|jpe?g|svg|webp))/gi)]
        .map((m) => m[1]);
      out["page"] = { status: r.status, imgs: [...new Set(imgs)].slice(0, 40) };
    } catch (e) {
      out["page"] = { error: String(e) };
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
