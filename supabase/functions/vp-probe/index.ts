// Função temporária de diagnóstico da API ValidaPay (checkout dinâmico).
import { validaPayFetch, ValidaPayError } from "../_shared/validapay.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function attempt(label: string, path: string, body: Record<string, unknown>, scope: string) {
  try {
    const data = await validaPayFetch(path, { method: "POST", body: JSON.stringify(body), scope });
    return { label, ok: true, data };
  } catch (e) {
    const err = e as ValidaPayError;
    return { label, ok: false, status: err.status, details: err.details, message: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const results = [];
  results.push(
    await attempt(
      "checkout-session-dynamic",
      "/v1/checkout-sessions",
      {
        items: [{ name: "Produto teste Velo", amount: 25.5, quantity: 1 }],
        companyName: "Velo",
        allowedPaymentMethods: ["pix"],
        successUrl: "https://velods.com.br/ok",
        metadata: { kind: "store_order_probe" },
      },
      "checkouts/write",
    ),
  );
  results.push(
    await attempt(
      "charge-pix",
      "/v1/charges",
      {
        amount: 25.5,
        paymentMethod: "pix",
        description: "Produto teste Velo",
        customer: { name: "Teste Velo", email: "teste@velods.com.br", documentNumber: "19100000000" },
        metadata: { kind: "store_order_probe" },
      },
      "pix.cob/write pix.cob/read",
    ),
  );

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
