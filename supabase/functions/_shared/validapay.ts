// Helper de integração com a ValidaPay.
// Autenticação: OAuth2 client_credentials (docs.validapay.com.br → Autenticação)
//   POST https://oauth2.validapay.com.br/auth/token  (sandbox: oauth2-sandbox...)
//   body x-www-form-urlencoded: grant_type=client_credentials&client_id&client_secret&scope
//   resposta: { access_token, expires_in, token_type }
// As credenciais vêm exclusivamente de secrets: VALIDAPAY_CLIENT_ID / VALIDAPAY_CLIENT_SECRET.

const isSandbox = (Deno.env.get("VALIDAPAY_ENV") ?? "production").toLowerCase() === "sandbox";

export const VALIDAPAY_AUTH_URL = isSandbox
  ? "https://oauth2-sandbox.validapay.com.br/auth/token"
  : "https://oauth2.validapay.com.br/auth/token";

export const VALIDAPAY_API_URL = isSandbox
  ? "https://sandbox.validapay.com.br"
  : "https://api.validapay.com.br";

export const DEFAULT_SCOPES =
  "pix.cob/write pix.cob/read checkouts/write checkouts/read accounts/read";

type CachedToken = { token: string; expiresAt: number; scope: string };

// Cache em memória do isolate (o token dura 3600s conforme a doc).
let cached: CachedToken | null = null;

export class ValidaPayError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ValidaPayError";
    this.status = status;
    this.details = details;
  }
}

/** Obtém (e renova automaticamente) o access token OAuth2 da ValidaPay. */
export async function getValidaPayToken(scope: string = DEFAULT_SCOPES): Promise<string> {
  const now = Date.now();
  if (cached && cached.scope === scope && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  const clientId = Deno.env.get("VALIDAPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("VALIDAPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new ValidaPayError(
      "VALIDAPAY_CLIENT_ID/VALIDAPAY_CLIENT_SECRET não configurados",
      500,
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const resp = await fetch(VALIDAPAY_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await resp.text();
  let data: { access_token?: string; expires_in?: number; error?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* resposta não-JSON */
  }

  if (!resp.ok || !data.access_token) {
    console.error("validapay: falha na autenticação", resp.status, text.slice(0, 500));
    throw new ValidaPayError("Falha ao autenticar na ValidaPay", resp.status || 500, data);
  }

  cached = {
    token: data.access_token,
    scope,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

/** Invalida o token em cache (usar quando a API responder 401). */
export function clearValidaPayToken() {
  cached = null;
}

/** Chamada autenticada à API REST da ValidaPay, com retry automático em 401. */
export async function validaPayFetch<T = unknown>(
  path: string,
  init: RequestInit & { scope?: string } = {},
): Promise<T> {
  const { scope, ...rest } = init;
  const call = async (token: string) =>
    await fetch(`${VALIDAPAY_API_URL}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
    });

  let resp = await call(await getValidaPayToken(scope));
  if (resp.status === 401) {
    clearValidaPayToken();
    resp = await call(await getValidaPayToken(scope));
  }

  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!resp.ok) {
    console.error("validapay: erro na API", path, resp.status, text.slice(0, 500));
    throw new ValidaPayError(`ValidaPay ${path} respondeu ${resp.status}`, resp.status, data);
  }
  return data as T;
}

export type ValidaPayCharge = {
  chargeId: string;
  status: string; // PAID, PENDING, EXPIRED, ...
  amount: number;
  paymentType?: string;
  paidAt?: string;
  createdAt?: string;
  endToEndId?: string;
};

/** Consulta o status real de uma cobrança — usado para validar webhooks. */
export async function getCharge(chargeId: string): Promise<ValidaPayCharge> {
  return await validaPayFetch<ValidaPayCharge>(
    `/v1/charges/${encodeURIComponent(chargeId)}`,
    { method: "GET", scope: "pix.cob/read" },
  );
}

/**
 * Devolve (reembolsa) uma cobrança já paga.
 * Pix e cartão usam o MESMO endpoint: POST /v1/wallet/refunds.
 * - Pix: envia endToEndId da transação original.
 * - Cartão: envia apenas chargeId, amount e reason.
 */
export async function refundCharge(
  chargeId: string,
  amount?: number,
  reason = "CUSTOMER_REQUEST",
) {
  const charge = await validaPayFetch<ValidaPayCharge>(
    `/v1/charges/${encodeURIComponent(chargeId)}`,
    { method: "GET", scope: "pix.cob/read wallet/read wallet/write" },
  );

  if (charge?.endToEndId) {
    return await validaPayFetch<Record<string, unknown>>("/v1/wallet/refunds", {
      method: "POST",
      scope: "wallet/write wallet/read",
      body: JSON.stringify({
        endToEndId: charge.endToEndId,
        amount: amount ?? charge.amount,
        reason,
        chargeId,
      }),
    });
  }

  // Sem endToEndId => cobrança de cartão de crédito (ou Pix ainda não liquidado).
  return await refundCardCharge(chargeId, amount ?? charge?.amount, reason, charge);
}

export type ValidaPayRefund = {
  refundId?: string;
  id?: string;
  status?: string; // CONFIRMED | PROCESSING | FAILED
  success?: boolean;
  [key: string]: unknown;
};

/**
 * Estorno de cobrança no cartão de crédito.
 * Chamada única: POST /v1/wallet/refunds com { chargeId, amount, reason }.
 * Sem endToEndId — esse campo só existe para Pix.
 * Resposta pode vir CONFIRMED (concluído) ou PROCESSING (acompanhar via
 * getRefundStatus com o refundId retornado).
 */
export async function refundCardCharge(
  chargeId: string,
  amount?: number,
  reason = "CUSTOMER_REQUEST",
  charge?: ValidaPayCharge,
): Promise<ValidaPayRefund> {
  const body = { chargeId, amount, reason };

  try {
    const result = await validaPayFetch<ValidaPayRefund>("/v1/wallet/refunds", {
      method: "POST",
      scope: "wallet/write wallet/read",
      body: JSON.stringify(body),
    });

    const status = String(result?.status ?? "").toUpperCase();
    console.log("refund_logs", JSON.stringify({
      origin: "refundCardCharge",
      outcome: status === "PROCESSING" ? "processing" : "success",
      chargeId,
      amount,
      paymentType: charge?.paymentType ?? null,
      refundId: result?.refundId ?? result?.id ?? null,
      status: result?.status ?? null,
      success: result?.success ?? null,
    }));

    return result;
  } catch (error) {
    const err = error as ValidaPayError;
    console.error("refund_logs", JSON.stringify({
      origin: "refundCardCharge",
      outcome: "error",
      chargeId,
      amount,
      paymentType: charge?.paymentType ?? null,
      status: err.status,
      details: err.details,
      message: err.message,
    }));

    throw new ValidaPayError(
      `CARD_REFUND_FAILED: a ValidaPay recusou o estorno desta cobrança (${err.status}). ${err.message}`,
      err.status ?? 500,
      { chargeId, paymentType: charge?.paymentType ?? null, providerDetails: err.details },
    );
  }
}

/** Consulta o status de um estorno (usado quando a resposta vem PROCESSING). */
export async function getRefundStatus(refundId: string): Promise<ValidaPayRefund> {
  return await validaPayFetch<ValidaPayRefund>(
    `/v1/wallet/refunds?refundId=${encodeURIComponent(refundId)}`,
    { method: "GET", scope: "wallet/read" },
  );
}

export type ValidaPaySessionStatus = {
  status: string | null;
  chargeId: string | null;
  amount: number | null;
  paymentMethod: string | null;
  /**
   * De onde veio o status. Só "charge" comprova pagamento — o status de uma
   * SESSÃO de checkout ("ACTIVE"/"COMPLETED") significa apenas que o link foi
   * aberto/finalizado, não que o dinheiro entrou.
   */
  source: "charge" | "session";
  raw: unknown;
};

// ATENÇÃO: "ACTIVE" e "COMPLETED" NÃO entram aqui. São status de sessão de
// checkout e já causaram ativação indevida de assinaturas sem pagamento.
const PAID_WORDS = ["PAID", "APPROVED", "CONFIRMED", "SUCCEEDED"];

/** Normaliza o status de uma sessão/assinatura da ValidaPay (formatos variam por endpoint). */
function normalizeSessionPayload(raw: unknown, source: "charge" | "session"): ValidaPaySessionStatus {
  // deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
  const r = (raw ?? {}) as any;
  const node = r?.data ?? r;
  const item = Array.isArray(node?.items) ? node.items[0] : null;
  const status = String(
    node?.status ?? node?.paymentStatus ?? item?.status ?? "",
  ).toUpperCase() || null;
  const chargeId = node?.chargeId ?? node?.charge?.chargeId ?? node?.charge?.id ?? null;
  const amount = Number(node?.amount ?? item?.amount ?? node?.total ?? 0) || null;
  return {
    status,
    chargeId: chargeId ? String(chargeId) : null,
    amount,
    paymentMethod: node?.paymentType ?? node?.paymentMethod ?? null,
    source,
    raw,
  };
}

export const isPaidStatus = (status?: string | null) =>
  !!status && PAID_WORDS.includes(String(status).toUpperCase());

/**
 * Única forma válida de confirmar pagamento: status pago vindo de uma COBRANÇA
 * real. Sessão de checkout nunca confirma.
 */
export const isConfirmedPayment = (info?: ValidaPaySessionStatus | null) =>
  !!info && info.source === "charge" && isPaidStatus(info.status);

/**
 * Verificação ativa (polling de segurança): consulta o estado real de uma
 * cobrança pendente na ValidaPay sem depender do webhook chegar.
 * Se a referência for uma sessão/assinatura, resolvemos o chargeId e
 * consultamos a cobrança — só ela comprova pagamento.
 */
export async function lookupPaymentStatus(reference: string): Promise<ValidaPaySessionStatus | null> {
  if (reference.startsWith("cha_")) {
    try {
      return normalizeSessionPayload(await getCharge(reference), "charge");
    } catch (err) {
      const e = err as ValidaPayError;
      console.warn("validapay: getCharge falhou", reference, e.status ?? "", e.message);
      return null;
    }
  }

  const paths = reference.startsWith("cs_")
    ? [`/v1/checkout-sessions/${encodeURIComponent(reference)}`]
    : reference.startsWith("sub_")
    ? [
      `/v1/subscriptions/${encodeURIComponent(reference)}`,
      `/v1/checkout-sessions/${encodeURIComponent(reference)}`,
    ]
    : [`/v1/charges/${encodeURIComponent(reference)}`];

  for (const path of paths) {
    try {
      const data = await validaPayFetch(path, {
        method: "GET",
        scope: "checkouts/read pix.cob/read accounts/read",
      });
      const isChargePath = path.includes("/v1/charges/");
      const session = normalizeSessionPayload(data, isChargePath ? "charge" : "session");
      if (isChargePath) return session;

      // Sessão/assinatura: só vale se houver uma cobrança para conferir.
      if (session.chargeId) {
        try {
          const charge = normalizeSessionPayload(await getCharge(session.chargeId), "charge");
          return { ...charge, chargeId: charge.chargeId ?? session.chargeId };
        } catch (err) {
          console.warn("validapay: cobrança da sessão indisponível", session.chargeId, String(err));
        }
      }
      return { ...session, source: "session" };
    } catch (err) {
      const e = err as ValidaPayError;
      // 404 => tenta o próximo formato; outros erros também não devem quebrar o cron.
      console.warn("validapay: lookupPaymentStatus falhou", path, e.status ?? "", e.message);
    }
  }
  return null;
}






/** Cria uma sessão de checkout (uso único) para um preço/assinatura já cadastrado. */
export async function createCheckoutSession(payload: Record<string, unknown>) {
  return await validaPayFetch<{ id: string; url: string }>("/v1/checkout-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
    scope: "checkouts/write",
  });
}

export type ValidaPayPixCharge = {
  chargeId: string;
  status: string;
  qrCode: string | null;        // copia e cola (BR Code)
  qrCodeBase64: string | null;  // imagem do QR em base64 (quando a API devolve)
  raw: unknown;
};

/**
 * Cria uma cobrança Pix avulsa (usada no checkout das lojas dos usuários).
 * `merchantName` é o nome que aparece para o comprador — o nome da loja do
 * dono da página, nunca a Velo.
 */
export async function createPixCharge(input: {
  amount: number;
  description: string;
  merchantName: string;
  externalReference: string;
  expiresInSeconds?: number;
  payer?: { name?: string; email?: string; document?: string };
  metadata?: Record<string, unknown>;
}): Promise<ValidaPayPixCharge> {
  const document = input.payer?.document?.replace(/\D/g, "") || undefined;
  if (!document) {
    throw new ValidaPayError("CPF/CNPJ é obrigatório para gerar o Pix", 400, { code: "MISSING_DOCUMENT" });
  }
  const payload: Record<string, unknown> = {
    amount: Number(input.amount.toFixed(2)),
    paymentMethod: "pix",
    description: input.description.slice(0, 140),
    softDescriptor: input.merchantName.slice(0, 25),
    merchantName: input.merchantName.slice(0, 60),
    companyName: input.merchantName.slice(0, 60),
    externalReference: input.externalReference,
    expiresIn: input.expiresInSeconds ?? 3600,
    customer: {
      name: input.payer?.name ?? "Cliente",
      email: input.payer?.email ?? "cliente@velo.com.br",
      documentNumber: document,
    },
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };


  let raw: Record<string, unknown>;
  try {
    raw = await validaPayFetch<Record<string, unknown>>("/v1/charges", {
      method: "POST",
      scope: "pix.cob/write pix.cob/read",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Cobrança duplicada: reaproveita a cobrança existente em vez de falhar.
    // deno-lint-ignore no-explicit-any -- details do gateway não é tipado
    const d = (err instanceof ValidaPayError ? (err.details as any) : null);
    const dupId = d?.error?.details?.chargeId ?? d?.details?.chargeId ?? d?.chargeId;
    if (err instanceof ValidaPayError && err.status === 409 && dupId) {
      raw = await validaPayFetch<Record<string, unknown>>(
        `/v1/charges/${encodeURIComponent(String(dupId))}`,
        { method: "GET", scope: "pix.cob/read" },
      );
    } else {
      throw err;
    }
  }

  // deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
  const r = (raw ?? {}) as any;
  const node = r?.data ?? r;
  const pix = node?.pix ?? node?.qrCodeData ?? node?.pointOfInteraction ?? node;
  const qrCode =
    pix?.qrCode ?? pix?.qrcode ?? pix?.brCode ?? pix?.brcode ??
    pix?.copyPaste ?? pix?.copiaECola ?? pix?.emv ?? null;
  const qrCodeBase64 =
    pix?.qrCodeBase64 ?? pix?.qrcodeBase64 ?? pix?.qrCodeImageBase64 ??
    pix?.imageBase64 ?? pix?.base64 ?? null;

  return {
    chargeId: String(node?.chargeId ?? node?.id ?? ""),
    status: String(node?.status ?? "PENDING").toUpperCase(),
    qrCode: qrCode ? String(qrCode) : null,
    qrCodeBase64: qrCodeBase64 ? String(qrCodeBase64).replace(/^data:image\/\w+;base64,/, "") : null,
    raw,
  };
}


/**
 * Envia um Pix da carteira ValidaPay da Velo para a chave Pix do vendedor
 * (repasse das vendas das lojas dos usuários).
 */
export async function sendPixPayout(input: {
  pixKey: string;
  amount: number;
  description?: string;
  externalReference?: string;
}): Promise<Record<string, unknown>> {
  const body = JSON.stringify({
    pixKey: input.pixKey,
    key: input.pixKey,
    amount: Number(input.amount.toFixed(2)),
    description: (input.description ?? "Repasse de venda").slice(0, 140),
    ...(input.externalReference ? { externalReference: input.externalReference } : {}),
  });

  // A API expõe o envio em /v1/wallet/transfers; mantemos um fallback para o
  // caminho alternativo de pagamentos Pix caso a conta use a rota antiga.
  const paths = ["/v1/wallet/transfers", "/v1/wallet/payments", "/v1/pix/payments"];
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      return await validaPayFetch<Record<string, unknown>>(path, {
        method: "POST",
        scope: "wallet/write wallet/read",
        body,
      });
    } catch (err) {
      lastError = err;
      const status = (err as ValidaPayError)?.status;
      if (status !== 404 && status !== 405) throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ValidaPayError("Não foi possível enviar o Pix de repasse", 500, lastError);
}

/** Comparação de strings resistente a timing attacks. */
export function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * CHECKOUT TRANSPARENTE (assinaturas da Velo).
 * POST /v1/charges com o priceId da assinatura — o cliente informa os dados na
 * NOSSA página (velods.com.br), sem redirecionar para o checkout hospedado.
 * Doc: docs.validapay.com.br → Checkout Transparente (Pix e Cartão).
 */
export type TransparentChargeResult = {
  chargeId: string;
  status: string;
  success: boolean;
  pix: { emv: string | null; qrCodeImage: string | null } | null;
  raw: unknown;
};

export async function createTransparentCharge(
  payload: Record<string, unknown>,
): Promise<TransparentChargeResult> {
  let raw: Record<string, unknown>;
  try {
    raw = await validaPayFetch<Record<string, unknown>>("/v1/charges", {
      method: "POST",
      scope: "checkouts/write pix.cob/write pix.cob/read",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // 409 = mesmo externalId: reaproveita a cobrança original.
    // deno-lint-ignore no-explicit-any -- details do gateway não é tipado
    const d = err instanceof ValidaPayError ? (err.details as any) : null;
    const dupId = d?.error?.details?.chargeId ?? d?.details?.chargeId ?? d?.chargeId;
    if (err instanceof ValidaPayError && err.status === 409 && dupId) {
      raw = await validaPayFetch<Record<string, unknown>>(
        `/v1/charges/${encodeURIComponent(String(dupId))}`,
        { method: "GET", scope: "pix.cob/read" },
      );
    } else {
      throw err;
    }
  }

  // deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
  const r = (raw ?? {}) as any;
  const node = r?.data ?? r;
  const pixNode = node?.pix ?? null;
  const emv = pixNode?.emv ?? pixNode?.qrCode ?? pixNode?.brCode ?? pixNode?.copyPaste ?? null;
  const image = pixNode?.qrCode && String(pixNode.qrCode).startsWith("data:image")
    ? pixNode.qrCode
    : pixNode?.qrCodeImage ?? pixNode?.qrCodeBase64 ?? null;

  return {
    chargeId: String(node?.chargeId ?? node?.id ?? ""),
    status: String(node?.status ?? (node?.success ? "PAID" : "PENDING")).toUpperCase(),
    success: node?.success !== false,
    pix: emv || image ? { emv: emv ? String(emv) : null, qrCodeImage: image ? String(image) : null } : null,
    raw,
  };
}
