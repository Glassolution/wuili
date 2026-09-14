/**
 * mlBuyerDetails
 * --------------
 * O checkout da C7Drop exige CPF, telefone e e-mail do destinatário.
 * O objeto de pedido do Mercado Livre entrega esses campos mascarados
 * ("XXXXXXX") ou ausentes, o que faz o bot parar com
 * `required_c7drop_form_value_missing`.
 *
 * Aqui buscamos os dados reais nas rotas específicas do ML:
 *   GET /orders/{id}/billing_info   → CPF/CNPJ e nome fiscal do comprador
 *   GET /shipments/{id}             → telefone e nome do destinatário
 *
 * Nunca lança: quando o ML não devolve algo, o campo volta como null.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mlFetch } from "./mlClient.ts";
import { getMlAccessToken } from "./mlShippingLabel.ts";

// deno-lint-ignore no-explicit-any -- payloads crus do ML variam por versão
type Json = any;

export interface BuyerDetails {
  document: string | null;
  documentType: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Endereço de entrega já enriquecido com telefone real quando disponível. */
  receiverAddress: Json | null;
}

const MASKED = /^[x*\s.-]*$/i;

function clean(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || MASKED.test(trimmed)) return null;
  return trimmed;
}

function digits(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const only = raw.replace(/\D/g, "");
  return only.length >= 8 ? only : null;
}

/** Procura recursivamente a primeira chave que satisfaz o teste. */
function deepFind(
  node: Json,
  keyTest: (key: string) => boolean,
  valueTest: (value: unknown) => string | null,
  depth = 0,
): string | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  const entries = Array.isArray(node) ? node.map((v, i) => [String(i), v]) : Object.entries(node);
  for (const [key, value] of entries) {
    if (keyTest(key)) {
      const found = valueTest(value);
      if (found) return found;
    }
  }
  for (const [, value] of entries) {
    const nested = deepFind(value, keyTest, valueTest, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function findDocument(node: Json): string | null {
  return deepFind(
    node,
    (k) => /^(doc_number|document|identification_number|cpf|cnpj|number)$/i.test(k),
    (v) => {
      const d = digits(v);
      return d && (d.length === 11 || d.length === 14) ? d : null;
    },
  );
}

function findPhone(node: Json): string | null {
  return deepFind(
    node,
    (k) => /phone|celular|telefone/i.test(k),
    (v) => {
      if (v && typeof v === "object") {
        const obj = v as Json;
        const composed = [obj.area_code, obj.number ?? obj.extension].filter(Boolean).join("");
        const d = digits(composed);
        if (d && d.length >= 10) return d;
        return null;
      }
      const d = digits(v);
      return d && d.length >= 10 ? d : null;
    },
  );
}

function findEmail(node: Json): string | null {
  return deepFind(
    node,
    (k) => /email/i.test(k),
    (v) => {
      const s = clean(v);
      return s && s.includes("@") ? s : null;
    },
  );
}

async function getJson(url: string, token: string): Promise<Json | null> {
  try {
    const res = await mlFetch(url, {
      headers: { Authorization: `Bearer ${token}`, "x-format-new": "true" },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[buyer] ML ${res.status} em ${url}: ${detail.slice(0, 160)}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`[buyer] erro em ${url}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Reúne CPF, telefone, e-mail e nome reais do comprador de um pedido do ML.
 */
export async function fetchBuyerDetails(
  supabase: SupabaseClient,
  params: {
    mlOrderId: string;
    userId: string;
    mlOrder?: Json;
    shipmentId?: string | null;
    accessToken?: string | null;
  },
): Promise<BuyerDetails> {
  const { mlOrderId, userId, mlOrder } = params;
  const addr = mlOrder?.shipping?.receiver_address ?? null;

  const base: BuyerDetails = {
    document: findDocument(mlOrder?.buyer) ?? findDocument(mlOrder?.payments) ?? findDocument(addr),
    documentType: null,
    name: clean(addr?.receiver_name) ??
      clean([mlOrder?.buyer?.first_name, mlOrder?.buyer?.last_name].filter(Boolean).join(" ")),
    email: findEmail(mlOrder?.buyer),
    phone: findPhone(addr) ?? findPhone(mlOrder?.buyer),
    receiverAddress: addr,
  };

  const token = params.accessToken ?? (await getMlAccessToken(supabase, userId));
  if (!token) return base;

  // 1) Dados fiscais → CPF/CNPJ e nome
  const billing = await getJson(
    `https://api.mercadolibre.com/orders/${mlOrderId}/billing_info`,
    token,
  );
  if (billing) {
    base.document = base.document ?? findDocument(billing);
    const docType = deepFind(billing, (k) => /^doc_type$/i.test(k), (v) => clean(v));
    base.documentType = base.documentType ?? docType;
    const first = deepFind(billing, (k) => /^first_name$/i.test(k), (v) => clean(v));
    const last = deepFind(billing, (k) => /^last_name$/i.test(k), (v) => clean(v));
    const fiscalName = [first, last].filter(Boolean).join(" ").trim();
    if (!base.name && fiscalName) base.name = fiscalName;
  }

  // 2) Envio → telefone real e nome do destinatário
  const shipmentId = params.shipmentId ??
    (mlOrder?.shipping?.id ? String(mlOrder.shipping.id) : null);
  if (shipmentId) {
    const shipment = await getJson(
      `https://api.mercadolibre.com/shipments/${shipmentId}`,
      token,
    );
    if (shipment) {
      const shipAddr = shipment?.receiver_address ?? shipment?.destination?.shipping_address ?? null;
      base.phone = base.phone ?? findPhone(shipAddr) ?? findPhone(shipment);
      base.name = base.name ??
        clean(shipAddr?.receiver_name) ??
        clean(shipment?.destination?.receiver_name);
      base.document = base.document ?? findDocument(shipment);
      if (shipAddr && base.receiverAddress) {
        base.receiverAddress = { ...base.receiverAddress, ...shipAddr };
      } else if (shipAddr) {
        base.receiverAddress = shipAddr;
      }
    }
  }

  // 3) Telefone do destinatário no endereço enriquecido
  if (base.phone && base.receiverAddress && typeof base.receiverAddress === "object") {
    base.receiverAddress = { ...base.receiverAddress, receiver_phone: base.phone };
  }

  return base;
}
