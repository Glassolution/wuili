// Diagnóstico temporário: inspeciona de onde o checkout hospedado da ValidaPay
// puxa a logo exibida no topo da página.
import { createCheckoutSession } from "../_shared/validapay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  try {
    const priceId = Deno.env.get("VALIDAPAY_PRICE_BASE")!;
    const logoUrl =
      "https://nqzpoioxvbqavrtphtoa.supabase.co/storage/v1/object/public/assets/branding%2Fvalidapay-logo-v2.png";
    const session = await createCheckoutSession({
      priceId,
      items: [{ priceId, quantity: 1 }],
      companyName: "Velo",
      logoUrl,
      companyLogoUrl: logoUrl,
      logo: logoUrl,
      pathLogo: logoUrl,
      logoPath: logoUrl,
      allowedPaymentMethods: ["pix", "creditcard"],
    });
    const html = await (await fetch(session.url)).text();
    const imgs = Array.from(html.matchAll(/<img[^>]*>/g)).map((m) => m[0]).slice(0, 20);
    const logoMentions = Array.from(html.matchAll(/[^"']*logo[^"']*/gi)).map((m) => m[0]).slice(0, 40);
    return Response.json({ url: session.url, imgs, logoMentions, len: html.length });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
