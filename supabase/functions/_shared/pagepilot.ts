// Único ponto de contato HTTP com a API do PagePilot (2.0.0).
// Paths, corpo do request e parse da resposta ficam isolados aqui — se a API
// mudar, ajusta-se apenas este arquivo.
//
// Base: https://app.pagepilot.ai
// Auth: Authorization: Bearer <PAGEPILOT_API_KEY> (somente Deno.env, nunca VITE_)
// POST /api/v2/pages/create  -> inicia a geração a partir da URL do produto
// GET  /api/v2/pages/status  -> status da geração (id na query)
// POST /api/v2/pages/publish -> NÃO USAR (publicação Shopify será da Velo)

export const PAGEPILOT_BASE_URL = "https://app.pagepilot.ai";
export const PAGEPILOT_CREATE_PATH = "/api/v2/pages/create";
export const PAGEPILOT_STATUS_PATH = "/api/v2/pages/status";

export type PagePilotErrorCode =
  | "missing_api_key"
  | "plan_required"
  | "rate_limited"
  | "provider_error"
  | "provider_unreachable"
  | "invalid_response";

export class PagePilotError extends Error {
  code: PagePilotErrorCode;
  status: number;
  transient: boolean;
  constructor(code: PagePilotErrorCode, message: string, status = 502, transient = false) {
    super(message);
    this.code = code;
    this.status = status;
    this.transient = transient;
  }
}

const apiKey = (): string => {
  const key = Deno.env.get("PAGEPILOT_API_KEY");
  if (!key) throw new PagePilotError("missing_api_key", "PAGEPILOT_API_KEY não configurada", 500);
  return key;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const pick = (obj: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

/** Mapeia falhas HTTP do provedor para códigos estáveis da Velo. */
const classify = (status: number, bodyText: string): PagePilotError => {
  const lower = bodyText.toLowerCase();
  if (status === 403 && /plan|subscription|starter|upgrade/.test(lower)) {
    return new PagePilotError("plan_required", "Plano do provedor insuficiente para gerar páginas", 403);
  }
  if (status === 429) {
    return new PagePilotError("rate_limited", "Limite de geração do provedor atingido", 429);
  }
  if (status >= 500) {
    // Erro transitório: quem chama deve manter o registro como 'gerando'.
    return new PagePilotError("provider_error", `PagePilot ${status}: ${bodyText.slice(0, 300)}`, 502, true);
  }
  return new PagePilotError("provider_error", `PagePilot ${status}: ${bodyText.slice(0, 300)}`, 502);
};

const request = async (
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string> },
): Promise<Record<string, unknown>> => {
  const url = new URL(PAGEPILOT_BASE_URL + path);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      method: init.method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    throw new PagePilotError(
      "provider_unreachable",
      e instanceof Error ? e.message : "falha de rede ao chamar PagePilot",
      502,
      true,
    );
  }

  const text = await resp.text();
  if (!resp.ok) throw classify(resp.status, text);

  try {
    return asRecord(JSON.parse(text || "{}"));
  } catch {
    throw new PagePilotError("invalid_response", "Resposta não-JSON do PagePilot", 502);
  }
};

export type CreateInput = {
  productUrl: string;
  language: string;
  imageCount: number;
};

export type CreateResult = { providerPageId: string; raw: Record<string, unknown> };

export const createPage = async (input: CreateInput): Promise<CreateResult> => {
  // Enviamos as variações de nome de campo aceitas pela referência; campos
  // extras são ignorados pelo provedor.
  const data = await request(PAGEPILOT_CREATE_PATH, {
    method: "POST",
    body: {
      url: input.productUrl,
      product_url: input.productUrl,
      language: input.language,
      image_count: input.imageCount,
      images: input.imageCount,
    },
  });

  const payload = asRecord(pick(data, ["data", "page", "result"]) ?? data);
  const id = pick(payload, ["id", "page_id", "pageId", "uuid"]) ?? pick(data, ["id", "page_id", "pageId"]);
  if (typeof id !== "string" && typeof id !== "number") {
    throw new PagePilotError("invalid_response", "PagePilot não retornou o id da página", 502);
  }
  return { providerPageId: String(id), raw: data };
};

export type StatusResult = {
  state: "gerando" | "pronto" | "erro";
  content: Record<string, unknown>;
  images: unknown[];
  errorMessage?: string;
  raw: Record<string, unknown>;
};

const READY = ["ready", "done", "completed", "complete", "success", "succeeded", "finished", "published", "pronto"];
const FAILED = ["error", "failed", "failure", "cancelled", "canceled", "erro"];

export const getStatus = async (providerPageId: string): Promise<StatusResult> => {
  const data = await request(PAGEPILOT_STATUS_PATH, {
    method: "GET",
    query: { id: providerPageId },
  });

  const payload = asRecord(pick(data, ["data", "page", "result"]) ?? data);
  const rawStatus = String(pick(payload, ["status", "state"]) ?? pick(data, ["status", "state"]) ?? "").toLowerCase();

  const state: StatusResult["state"] = READY.includes(rawStatus)
    ? "pronto"
    : FAILED.includes(rawStatus)
      ? "erro"
      : "gerando";

  const content = asRecord(pick(payload, ["content", "page", "sections", "result", "html"]));
  const rawImages = pick(payload, ["images", "image_urls", "assets"]);

  return {
    state,
    content: Object.keys(content).length ? content : payload,
    images: Array.isArray(rawImages) ? rawImages : [],
    errorMessage:
      typeof pick(payload, ["error", "error_message", "message"]) === "string"
        ? String(pick(payload, ["error", "error_message", "message"]))
        : undefined,
    raw: data,
  };
};
