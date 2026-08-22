// Diagnóstico da integração ValidaPay: apenas confirma que a autenticação OAuth2
// funciona com as credenciais salvas. Não expõe nenhum secret.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getValidaPayToken, VALIDAPAY_API_URL, VALIDAPAY_AUTH_URL } from "../_shared/validapay.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return json({ error: "Não autenticado" }, 401);

  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!isAdmin) return json({ error: "not_admin" }, 403);

  try {
    const token = await getValidaPayToken();

    // Testa de verdade os 6 preços (3 planos x 2 ciclos): cria uma sessão de
    // checkout descartável para cada um e reporta qual falha.
    const PRICE_ENV: Record<string, Record<string, string>> = {
      monthly: {
        base: "VALIDAPAY_PRICE_BASE",
        pro: "VALIDAPAY_PRICE_PRO",
        business: "VALIDAPAY_PRICE_BUSINESS",
      },
      annual: {
        base: "VALIDAPAY_PRICE_BASE_ANNUAL",
        pro: "VALIDAPAY_PRICE_PRO_ANNUAL",
        business: "VALIDAPAY_PRICE_BUSINESS_ANNUAL",
      },
    };

    const plans: Array<Record<string, unknown>> = [];
    for (const cycle of ["monthly", "annual"]) {
      for (const plan of ["base", "pro", "business"]) {
        const envName = PRICE_ENV[cycle][plan];
        const priceId = Deno.env.get(envName);
        if (!priceId) {
          plans.push({ plan, cycle, envName, configured: false, ok: false, error: "secret ausente" });
          continue;
        }
        try {
          const session = await createCheckoutSession({
            priceId,
            items: [{ priceId, quantity: 1 }],
            companyName: "Velo",
            allowedPaymentMethods: ["pix", "creditcard"],
            maxInstallments: 12,
            freeInstallments: 1,
            passFeesToCustomer: false,
            successUrl: "https://www.velods.com.br/assinatura/confirmada",
            failureUrl: "https://www.velods.com.br/dashboard/planos",
            metadata: { diag: true },
          });
          plans.push({
            plan,
            cycle,
            envName,
            configured: true,
            ok: true,
            priceIdSuffix: priceId.slice(-6),
            sessionId: session.id,
          });
        } catch (err) {
          const detail = err instanceof ValidaPayError
            ? { status: err.status, data: err.data, message: err.message }
            : { message: err instanceof Error ? err.message : String(err) };
          plans.push({ plan, cycle, envName, configured: true, ok: false, priceIdSuffix: priceId.slice(-6), ...detail });
        }
      }
    }

    return json({
      ok: plans.every((p) => p.ok),
      authUrl: VALIDAPAY_AUTH_URL,
      apiUrl: VALIDAPAY_API_URL,
      tokenLength: token.length,
      webhookTokenConfigured: Boolean(Deno.env.get("VALIDAPAY_WEBHOOK_TOKEN")),
      plans,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message }, 500);
  }
});

