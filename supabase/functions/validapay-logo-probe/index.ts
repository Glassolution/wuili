// Diagnóstico temporário: procura endpoint de conta para trocar a logo.
import { VALIDAPAY_API_URL } from "../_shared/validapay.ts";
import { getToken } from "../_shared/validapay.ts";

Deno.serve(async () => {
  try {
    const token = await getToken();
    const paths = ["/customers/me", "/me", "/account", "/customer", "/customers", "/settings", "/company"];
    const out: Record<string, unknown> = {};
    for (const path of paths) {
      const r = await fetch(`${VALIDAPAY_API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      out[path] = { status: r.status, body: (await r.text()).slice(0, 300) };
    }
    return Response.json(out);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
