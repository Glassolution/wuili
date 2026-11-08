import { supabase } from "@/integrations/supabase/client";

/*
  Pedido de reembolso e o histórico dele (tabela refund_request_events, criada
  em 20261107120000_refund_help_center.sql). Usado pelo formulário da Central
  de Ajuda (só o que o cliente pode ver, filtrado pelo RLS) e pelo admin.

  O banco tem mais status do que o cliente precisa entender; aqui eles viram
  três: pendente, aprovado e recusado.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas de reembolso ainda fora dos tipos gerados
const db = supabase as any;

export type RefundStage = "pendente" | "aprovado" | "recusado";

export const REFUND_STAGE_LABEL: Record<RefundStage, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export function refundStage(status: string | null | undefined): RefundStage {
  const s = String(status ?? "").toLowerCase();
  if (["rejected", "denied", "cancelled", "canceled", "failed"].includes(s)) return "recusado";
  if (s === "pending") return "pendente";
  return "aprovado"; // approved, processing, processed, refunded...
}

export type RefundRequestRow = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  status: string;
  reason: string;
  reason_details: string | null;
  refund_amount: number | null;
  admin_response: string | null;
  requested_at: string;
  processed_at: string | null;
  reviewed_at: string | null;
  source: string | null;
};

export type RefundEvent = {
  id: string;
  refund_request_id: string;
  kind: "created" | "status" | "response" | "note";
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  actor_role: "customer" | "admin" | "system";
  visible_to_customer: boolean;
  created_at: string;
};

const REQUEST_COLUMNS =
  "id, user_id, subscription_id, status, reason, reason_details, refund_amount, admin_response, requested_at, processed_at, reviewed_at, source";
// Sem a migration nova, as colunas extras não existem: cai para as antigas.
const LEGACY_COLUMNS = "id, user_id, subscription_id, status, reason, reason_details, refund_amount, requested_at, processed_at";

/** Último pedido do cliente logado (o RLS já limita aos dele). */
export async function fetchLatestRefundRequest(userId: string): Promise<RefundRequestRow | null> {
  const query = (columns: string) =>
    db.from("refund_requests").select(columns).eq("user_id", userId).order("requested_at", { ascending: false }).limit(1).maybeSingle();
  let { data, error } = await query(REQUEST_COLUMNS);
  if (error) ({ data, error } = await query(LEGACY_COLUMNS));
  if (error) throw error;
  return (data as RefundRequestRow | null) ?? null;
}

/** Histórico de um ou mais pedidos. Devolve vazio se a tabela ainda não existir. */
export async function fetchRefundEvents(requestIds: string[]): Promise<RefundEvent[]> {
  if (!requestIds.length) return [];
  const { data, error } = await db
    .from("refund_request_events")
    .select("id, refund_request_id, kind, from_status, to_status, message, actor_role, visible_to_customer, created_at")
    .in("refund_request_id", requestIds)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[reembolso] histórico indisponível", error.message);
    return [];
  }
  return (data ?? []) as RefundEvent[];
}

/** Frase curta de cada evento, do ponto de vista de quem lê. */
export function describeRefundEvent(event: RefundEvent, audience: "customer" | "admin"): string {
  if (event.kind === "created") return audience === "admin" ? "Pedido aberto pelo cliente" : "Pedido enviado";
  if (event.kind === "response") return audience === "admin" ? "Resposta enviada ao cliente" : "Resposta da equipe";
  if (event.kind === "note") return "Anotação interna";
  const to = String(event.to_status ?? "").toLowerCase();
  if (to === "processing") return "Estorno em processamento no meio de pagamento";
  if (audience === "admin") return `Status: ${event.from_status ?? "—"} → ${event.to_status ?? "—"}`;
  return `Pedido ${REFUND_STAGE_LABEL[refundStage(to)].toLowerCase()}`;
}
