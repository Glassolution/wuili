import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Edit3,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Loader2,
  PanelRightOpen,
  Power,
  PowerOff,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TicketCheck,
  type LucideIcon,
  Unlock,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminBadge, AdminCard, AdminPill } from "@/components/admin/AdminPrimitives";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type WorkerStatus = "starting" | "idle" | "processing" | "stopping" | "offline" | "unknown";
type Severity = "critical" | "error" | "warning" | "info" | string;

type WorkerHeartbeat = {
  id: string;
  worker_id: string | null;
  status: WorkerStatus;
  current_order_id: string | null;
  current_order_number: string | null;
  last_seen_at: string | null;
};

type WorkerAlert = {
  id: string;
  severity: Severity;
  code: string | null;
  message: string | null;
  order_id: string | null;
  order_number: string | null;
  created_at: string | null;
};

type ActionOrder = {
  id: string;
  order_number: string | null;
  ml_order_id: string | null;
  status: string | null;
  payment_status: string | null;
  updated_at: string | null;
  created_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  sku_c7drop: string | null;
  c7drop_product_url: string | null;
  etiqueta_ml_url: string | null;
  needs_manual_sku: boolean;
  needs_shipping_label: boolean;
  support_ticket_required: boolean;
  ml_price_update_status: string | null;
  refund_required: boolean;
  refund_status: string | null;
  refund_error: string | null;
  error_detail: string | null;
  isTest?: boolean;
};

type WorkerPanelData = {
  heartbeat: WorkerHeartbeat | null;
  staleWorkerIds: string[];
  alerts: WorkerAlert[];
  actionOrders: ActionOrder[];
  errors: Partial<Record<"worker" | "alerts" | "orders", string>>;
};

type EditableOrderField = "sku_c7drop" | "c7drop_product_url" | "etiqueta_ml_url";

const REFRESH_INTERVAL_MS = 30_000;
const REFRESH_INTERVAL_SECONDS = REFRESH_INTERVAL_MS / 1_000;

const ORDER_STATUSES = [
  "aguardando_dados_cliente",
  "dados_completos",
  "verificando_disponibilidade",
  "pix_gerado",
  "reservando_fornecedor",
  "reservado_aguardando_pagamento",
  "pagamento_confirmado",
  "finalizando_fornecedor",
  "pedido_concluido",
  "rastreio_pendente",
  "rastreio_disponivel",
  "cancelamento_pendente",
  "cancelado",
  "falha_reserva",
  "falha_finalizacao",
  "expirado",
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  aguardando_dados_cliente: "Aguardando dados do cliente",
  dados_completos: "Dados completos",
  verificando_disponibilidade: "Verificando disponibilidade",
  pix_gerado: "Pix gerado",
  reservando_fornecedor: "Reservando no fornecedor",
  reservado_aguardando_pagamento: "Reservado, aguardando pagamento",
  pagamento_confirmado: "Pagamento confirmado",
  finalizando_fornecedor: "Finalizando no fornecedor",
  pedido_concluido: "Pedido concluído",
  rastreio_pendente: "Rastreio pendente",
  rastreio_disponivel: "Rastreio disponível",
  cancelamento_pendente: "Cancelamento pendente",
  cancelado: "Cancelado",
  falha_reserva: "Falha na reserva",
  falha_finalizacao: "Falha na finalização",
  expirado: "Expirado",
};

const FLOW_HELP_STEPS: Array<{ status: OrderStatus; description: string }> = [
  { status: "aguardando_dados_cliente", description: "O pedido entrou, mas ainda falta dado necessário para seguir com a compra no fornecedor." },
  { status: "dados_completos", description: "O pedido tem os dados mínimos para iniciar cobrança, reserva ou preparação operacional." },
  { status: "verificando_disponibilidade", description: "O fluxo está conferindo se produto, SKU, etiqueta e dados do pedido permitem seguir sem intervenção." },
  { status: "pix_gerado", description: "Foi gerado um Pix para o vendedor/fluxo de pagamento, aguardando confirmação dentro da janela." },
  { status: "reservando_fornecedor", description: "O bot está tentando reservar o produto no C7Drop para evitar perda de estoque." },
  { status: "reservado_aguardando_pagamento", description: "A reserva no fornecedor foi feita e o fluxo espera o pagamento ser confirmado." },
  { status: "pagamento_confirmado", description: "O pagamento foi confirmado e o pedido pode avançar para finalização no fornecedor." },
  { status: "finalizando_fornecedor", description: "O bot está concluindo a compra no fornecedor com SKU, link e dados necessários." },
  { status: "pedido_concluido", description: "A compra no fornecedor foi finalizada; o próximo foco é rastreio/etiqueta quando aplicável." },
  { status: "rastreio_pendente", description: "O pedido foi concluído, mas ainda não há código ou atualização de rastreio disponível." },
  { status: "rastreio_disponivel", description: "O rastreio já está disponível para acompanhamento e suporte." },
  { status: "cancelamento_pendente", description: "Existe uma solicitação de cancelamento que precisa ser validada ou concluída." },
  { status: "cancelado", description: "O pedido foi cancelado. Só solicite novo Pix se ainda não houver pagamento confirmado." },
  { status: "falha_reserva", description: "O bot tentou reservar no fornecedor e falhou, normalmente por SKU, estoque, link ou validação." },
  { status: "falha_finalizacao", description: "A reserva ou pagamento avançou, mas a finalização no fornecedor falhou e precisa de intervenção." },
  { status: "expirado", description: "A janela de pagamento/ação expirou. Pode pedir novo Pix de 8h quando não houver pagamento confirmado." },
];

const ACTION_STATUSES = new Set(["falha_reserva", "falha_finalizacao", "cancelamento_pendente"]);
const PRICE_UPDATE_ACTION_STATUSES = new Set(["pending", "failed"]);
const RETRY_PAYMENT_STATUSES = new Set(["expirado", "cancelado"]);
const PAID_PAYMENT_STATUSES = new Set(["paid", "approved", "confirmed", "pago", "confirmado"]);

const TEST_ACTION_ORDERS: ActionOrder[] = [
  {
    id: "teste-001",
    order_number: "TESTE-1001",
    ml_order_id: "ML-TESTE-1001",
    status: "falha_reserva",
    payment_status: "approved",
    updated_at: new Date(Date.now() - 8 * 60_000).toISOString(),
    created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    locked_by: "worker-local",
    locked_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    sku_c7drop: "",
    c7drop_product_url: "https://c7drop.com.br/produto/teste-1001",
    etiqueta_ml_url: "",
    needs_manual_sku: true,
    needs_shipping_label: false,
    support_ticket_required: false,
    ml_price_update_status: null,
    refund_required: false,
    refund_status: "not_required",
    refund_error: null,
    error_detail: "SKU ausente para reservar no fornecedor",
    isTest: true,
  },
  {
    id: "teste-002",
    order_number: "TESTE-1002",
    ml_order_id: "ML-TESTE-1002",
    status: "rastreio_pendente",
    payment_status: "approved",
    updated_at: new Date(Date.now() - 24 * 60_000).toISOString(),
    created_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    locked_by: null,
    locked_at: null,
    sku_c7drop: "C7-887-BLK",
    c7drop_product_url: "https://c7drop.com.br/produto/teste-1002",
    etiqueta_ml_url: "",
    needs_manual_sku: false,
    needs_shipping_label: true,
    support_ticket_required: false,
    ml_price_update_status: null,
    refund_required: false,
    refund_status: "not_required",
    refund_error: null,
    error_detail: "Aguardando URL da etiqueta do Mercado Livre",
    isTest: true,
  },
  {
    id: "teste-003",
    order_number: "TESTE-1003",
    ml_order_id: "ML-TESTE-1003",
    status: "falha_finalizacao",
    payment_status: "approved",
    updated_at: new Date(Date.now() - 38 * 60_000).toISOString(),
    created_at: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
    locked_by: "worker-local",
    locked_at: new Date(Date.now() - 42 * 60_000).toISOString(),
    sku_c7drop: "C7-DEP-YES",
    c7drop_product_url: "",
    etiqueta_ml_url: "https://envios.mercadolivre.com.br/etiqueta/teste-1003",
    needs_manual_sku: false,
    needs_shipping_label: false,
    support_ticket_required: true,
    ml_price_update_status: null,
    refund_required: false,
    refund_status: "not_required",
    refund_error: null,
    error_detail: "Fornecedor recusou finalização automática",
    isTest: true,
  },
  {
    id: "teste-004",
    order_number: "TESTE-1004",
    ml_order_id: "ML-TESTE-1004",
    status: "expirado",
    payment_status: "pending",
    updated_at: new Date(Date.now() - 70 * 60_000).toISOString(),
    created_at: new Date(Date.now() - 9 * 60 * 60_000).toISOString(),
    locked_by: null,
    locked_at: null,
    sku_c7drop: "C7-FONE-CAT",
    c7drop_product_url: "https://c7drop.com.br/produto/teste-1004",
    etiqueta_ml_url: "",
    needs_manual_sku: false,
    needs_shipping_label: false,
    support_ticket_required: false,
    ml_price_update_status: "pending",
    refund_required: false,
    refund_status: "not_required",
    refund_error: null,
    error_detail: "Pix expirado; pode solicitar nova cobrança de 8h",
    isTest: true,
  },
  {
    id: "teste-005",
    order_number: "TESTE-1005",
    ml_order_id: "ML-TESTE-1005",
    status: "cancelado",
    payment_status: "pending",
    updated_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    created_at: new Date(Date.now() - 12 * 60 * 60_000).toISOString(),
    locked_by: null,
    locked_at: null,
    sku_c7drop: "C7-KIT-102",
    c7drop_product_url: "https://c7drop.com.br/produto/teste-1005",
    etiqueta_ml_url: "",
    needs_manual_sku: false,
    needs_shipping_label: false,
    support_ticket_required: false,
    ml_price_update_status: "failed",
    refund_required: true,
    refund_status: "pending",
    refund_error: null,
    error_detail: "Atualização de preço falhou antes do pagamento",
    isTest: true,
  },
];

const getString = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
};

const getBoolean = (row: Record<string, unknown>, key: string) => row[key] === true;

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const getMetadataDetail = (row: Record<string, unknown>) => {
  const metadata = getRecord(row.metadata);
  if (!metadata) return null;
  const worker = getRecord(metadata.worker);
  return (
    (worker
      ? getString(worker, ["error_detail", "erro_detalhe", "error", "erro", "message", "mensagem", "last_error", "error_message", "failure_reason", "reason"])
      : null) ??
    getString(metadata, ["error", "erro", "message", "mensagem", "last_error", "error_message", "failure_reason", "reason"])
  );
};

const getWorkerMetadata = (row: Record<string, unknown>) => {
  const metadata = getRecord(row.metadata);
  return metadata ? getRecord(metadata.worker) : null;
};

const normalizeStatus = (status: string | null): WorkerStatus => {
  if (status === "starting" || status === "idle" || status === "processing" || status === "stopping") return status;
  if (status === "offline") return "offline";
  return "unknown";
};

const normalizeHeartbeat = (row: Record<string, unknown>): WorkerHeartbeat => ({
  id: getString(row, ["id", "worker_id"]) ?? "worker",
  worker_id: getString(row, ["worker_id", "instance_id", "worker_name"]),
  status: normalizeStatus(getString(row, ["status", "state", "current_status"])),
  current_order_id: getString(row, ["current_order_id", "order_id", "dropship_order_id"]),
  current_order_number: getString(row, ["current_order_number", "order_number"]),
  last_seen_at: getString(row, ["last_seen_at", "heartbeat_at", "seen_at", "updated_at", "created_at"]),
});

const normalizeAlert = (row: Record<string, unknown>): WorkerAlert => ({
  id: getString(row, ["id"]) ?? crypto.randomUUID(),
  severity: getString(row, ["severity"]) ?? "info",
  code: getString(row, ["code", "error_code"]),
  message: getString(row, ["message", "error_message"]),
  order_id: getString(row, ["order_id", "dropship_order_id"]),
  order_number: getString(row, ["order_number"]),
  created_at: getString(row, ["created_at"]),
});

const normalizeOrder = (row: Record<string, unknown>): ActionOrder => {
  const worker = getWorkerMetadata(row);

  return {
    id: getString(row, ["id"]) ?? crypto.randomUUID(),
    order_number: getString(row, ["order_number"]),
    ml_order_id: getString(row, ["ml_order_id"]),
    status: getString(row, ["status"]),
    payment_status: getString(row, ["payment_status"]),
    updated_at: getString(row, ["updated_at"]),
    created_at: getString(row, ["created_at"]),
    locked_by: getString(row, ["locked_by"]) ?? (worker ? getString(worker, ["locked_by"]) : null),
    locked_at: getString(row, ["locked_at"]) ?? (worker ? getString(worker, ["locked_at"]) : null),
    sku_c7drop: getString(row, ["sku_c7drop"]),
    c7drop_product_url: getString(row, ["c7drop_product_url"]),
    etiqueta_ml_url: getString(row, ["etiqueta_ml_url"]),
    needs_manual_sku: getBoolean(row, "needs_manual_sku"),
    needs_shipping_label: getBoolean(row, "needs_shipping_label"),
    support_ticket_required: getBoolean(row, "support_ticket_required"),
    ml_price_update_status: getString(row, ["ml_price_update_status"]) ?? (worker ? getString(worker, ["ml_price_update_status"]) : null),
    refund_required: getBoolean(row, "refund_required"),
    refund_status: getString(row, ["refund_status"]),
    refund_error: getString(row, ["refund_error"]),
    error_detail:
      getString(row, ["error_detail", "error_details", "error_message", "last_error", "failure_reason", "fulfillment_error"]) ??
      getMetadataDetail(row),
  };
};

const minutesSince = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 60_000));
};

const formatRelativeSilence = (minutes: number | null) => {
  if (minutes === null) return "sem sinal";
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
};

const dateFmt = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const statusLabel = (status: string) =>
  status in ORDER_STATUS_LABELS ? ORDER_STATUS_LABELS[status as OrderStatus] : status.replaceAll("_", " ");

const severityTone = (severity: Severity): "danger" | "warning" | "neutral" => {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "error") return "danger";
  if (normalized === "warning") return "warning";
  return "neutral";
};

const workerStatusTone = (status: WorkerStatus, online: boolean): "success" | "danger" | "warning" | "neutral" => {
  if (!online || status === "offline") return "danger";
  if (status === "processing") return "warning";
  if (status === "idle") return "success";
  return "neutral";
};

const needsAction = (order: ActionOrder) =>
  order.needs_manual_sku ||
  (order.needs_shipping_label && !order.etiqueta_ml_url) ||
  ACTION_STATUSES.has(order.status ?? "") ||
  order.support_ticket_required ||
  PRICE_UPDATE_ACTION_STATUSES.has(order.ml_price_update_status ?? "") ||
  (order.refund_required && order.refund_status !== "succeeded" && order.refund_status !== "not_required");

const actionReasons = (order: ActionOrder) => {
  const reasons: string[] = [];
  if (order.needs_manual_sku) reasons.push("SKU C7Drop");
  if (order.needs_shipping_label && !order.etiqueta_ml_url) reasons.push("Etiqueta ML");
  if (ACTION_STATUSES.has(order.status ?? "")) reasons.push("Status do pedido");
  if (order.support_ticket_required) reasons.push("Suporte obrigatório");
  if (PRICE_UPDATE_ACTION_STATUSES.has(order.ml_price_update_status ?? "")) reasons.push("Preço no ML");
  if (order.refund_required && order.refund_status !== "succeeded" && order.refund_status !== "not_required") reasons.push("Estorno");
  return reasons;
};

const canRequestPaymentRetry = (order: ActionOrder) =>
  RETRY_PAYMENT_STATUSES.has(order.status ?? "") && !PAID_PAYMENT_STATUSES.has(order.payment_status ?? "");

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message);
  return "erro ao carregar";
};

const fetchWorkerPanelData = async (): Promise<WorkerPanelData> => {
  const errors: WorkerPanelData["errors"] = {};

  const [heartbeatResult, staleResult, alertsResult, filteredOrdersResult] = await Promise.all([
    supabase
      .from("dropship_worker_heartbeats" as never)
      .select("*")
      .order("last_seen_at" as never, { ascending: false })
      .limit(1),
    supabase.rpc("stale_dropship_worker_heartbeats" as never),
    supabase
      .from("dropship_worker_alerts" as never)
      .select("*")
      .is("resolved_at" as never, null)
      .order("created_at" as never, { ascending: false })
      .limit(80),
    supabase
      .from("dropship_orders")
      .select("*")
      .or(
        [
          "needs_manual_sku.eq.true",
          "needs_shipping_label.eq.true",
          "status.in.(falha_reserva,falha_finalizacao,cancelamento_pendente)",
          "support_ticket_required.eq.true",
          "ml_price_update_status.in.(pending,failed)",
          "refund_required.eq.true",
          "refund_status.in.(pending,requested,failed)",
        ].join(","),
      )
      .order("updated_at", { ascending: false })
      .limit(120),
  ]);

  let orderRows = (filteredOrdersResult.data ?? []) as unknown as Record<string, unknown>[];

  if (heartbeatResult.error) errors.worker = errorMessage(heartbeatResult.error);
  if (alertsResult.error) errors.alerts = errorMessage(alertsResult.error);

  if (filteredOrdersResult.error) {
    const fallbackOrders = await supabase
      .from("dropship_orders")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (fallbackOrders.error) {
      errors.orders = errorMessage(fallbackOrders.error);
      orderRows = [];
    } else {
      orderRows = (fallbackOrders.data ?? []) as unknown as Record<string, unknown>[];
    }
  }

  const heartbeatRows = heartbeatResult.error ? [] : ((heartbeatResult.data ?? []) as unknown as Record<string, unknown>[]);
  const alertRows = alertsResult.error ? [] : ((alertsResult.data ?? []) as unknown as Record<string, unknown>[]);
  const staleRows = staleResult.error ? [] : ((staleResult.data ?? []) as unknown as Record<string, unknown>[]);
  const staleWorkerIds = staleRows
    .map((row) => getString(row, ["worker_id", "id", "instance_id"]))
    .filter((value): value is string => Boolean(value));

  return {
    heartbeat: heartbeatRows[0] ? normalizeHeartbeat(heartbeatRows[0]) : null,
    staleWorkerIds,
    alerts: alertRows.map(normalizeAlert),
    actionOrders: orderRows.map(normalizeOrder).filter(needsAction),
    errors,
  };
};

const updateDropshipOrder = async (orderId: string, patch: Record<string, string | boolean | null>) => {
  const { error } = await supabase
    .from("dropship_orders")
    .update(patch as never)
    .eq("id", orderId);
  if (error) throw error;
};

const resolveAlert = async (alertId: string) => {
  const { error } = await supabase
    .from("dropship_worker_alerts" as never)
    .update({ resolved_at: new Date().toISOString() } as never)
    .eq("id" as never, alertId);
  if (error) throw error;
};

const requestPaymentRetry = async (orderId: string) => {
  const { data, error } = await supabase.functions.invoke("dropship-request-payment-retry", {
    body: { order_id: orderId, expires_in_hours: 8 },
  });
  const response = data as { error?: string } | null;
  if (error || response?.error) throw new Error(response?.error ?? error?.message ?? "Falha ao solicitar novo Pix");
};

const controlWorker = async (action: "start" | "stop") => {
  const { data, error } = await supabase.functions.invoke("dropship-worker-control", {
    body: { action },
  });
  const response = data as { error?: string; warning?: string } | null;
  if (error || response?.error) {
    throw new Error(response?.error ?? error?.message ?? "Falha ao controlar o bot");
  }
  return response;
};

export default function AdminBotAutomationPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [testOrders, setTestOrders] = useState<ActionOrder[]>(() => (import.meta.env.DEV ? TEST_ACTION_ORDERS : []));
  const [showTestOrders, setShowTestOrders] = useState(() => import.meta.env.DEV);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bot-automation-slim"],
    queryFn: fetchWorkerPanelData,
    enabled: !!user?.id,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const invalidatePanel = () => queryClient.invalidateQueries({ queryKey: ["admin-bot-automation-slim"] });

  const updateOrderMutation = useMutation({
    mutationFn: ({ orderId, patch }: { orderId: string; patch: Record<string, string | boolean | null> }) =>
      updateDropshipOrder(orderId, patch),
    onSuccess: () => {
      toast.success("Pedido atualizado.");
      void invalidatePanel();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pedido."),
  });

  const resolveAlertMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      toast.success("Alerta marcado como resolvido.");
      void invalidatePanel();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível resolver o alerta."),
  });

  const paymentRetryMutation = useMutation({
    mutationFn: requestPaymentRetry,
    onSuccess: () => {
      toast.success("Novo Pix de 8h solicitado.");
      void invalidatePanel();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível solicitar novo Pix."),
  });

  const workerControlMutation = useMutation({
    mutationFn: controlWorker,
    onSuccess: (response, action) => {
      toast.success(response?.warning ?? (action === "start" ? "Comando para ligar o bot registrado." : "Comando para desligar o bot registrado."));
      void invalidatePanel();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível controlar o bot."),
  });

  const heartbeat = data?.heartbeat ?? null;
  const silentMinutes = minutesSince(heartbeat?.last_seen_at);
  const staleByFunction = heartbeat?.worker_id ? data?.staleWorkerIds.includes(heartbeat.worker_id) : false;
  const online = Boolean(heartbeat && !staleByFunction && silentMinutes !== null && silentMinutes <= 2);
  const workerStatus = online ? heartbeat?.status ?? "unknown" : "offline";

  const filteredAlerts = data?.alerts ?? [];

  const summaryOrders = useMemo(
    () => [...(data?.actionOrders ?? []), ...(showTestOrders ? testOrders : [])],
    [data?.actionOrders, showTestOrders, testOrders],
  );

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return summaryOrders.filter((order) => {
      const bySearch =
        !normalizedSearch ||
        order.order_number?.toLowerCase().includes(normalizedSearch) ||
        order.ml_order_id?.toLowerCase().includes(normalizedSearch) ||
        order.id.toLowerCase().includes(normalizedSearch) ||
        order.sku_c7drop?.toLowerCase().includes(normalizedSearch);
      return bySearch;
    });
  }, [search, summaryOrders]);

  const selectedOrder = selectedOrderId ? filteredOrders.find((order) => order.id === selectedOrderId) ?? null : null;

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-[#2563EB]">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AdminShell
      active="automation"
      userId={user.id}
      title="Automação BOT"
      subtitle={`Verifica as informações do BOT novamente a cada ${REFRESH_INTERVAL_SECONDS}s.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminPill onClick={() => setHelpOpen(true)} className="gap-2">
            <HelpCircle size={14} />
            Ajuda
          </AdminPill>
        </div>
      }
    >
      <div className="space-y-4">
        <StatusPanel
          loading={isLoading}
          heartbeat={heartbeat}
          workerStatus={workerStatus}
          online={online}
          silentMinutes={silentMinutes}
          error={data?.errors.worker}
          controlling={workerControlMutation.isPending}
          onToggle={() => workerControlMutation.mutate(online ? "stop" : "start")}
        />

        <OrderStatsPanel orders={summaryOrders} loading={isLoading} />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <AlertsPanel
            alerts={filteredAlerts}
            loading={isLoading}
            error={data?.errors.alerts}
            resolving={resolveAlertMutation.isPending}
            onResolve={(alertId) => resolveAlertMutation.mutate(alertId)}
          />

          <OrdersPanel
            orders={filteredOrders}
            loading={isLoading}
            error={data?.errors.orders}
            search={search}
            selectedOrder={selectedOrder}
            showTestOrders={showTestOrders}
            onSearchChange={setSearch}
            onSelectOrder={(orderId) => setSelectedOrderId(orderId)}
            onCloseDetails={() => setSelectedOrderId(null)}
            onToggleTestOrders={() => setShowTestOrders((current) => !current)}
            saving={updateOrderMutation.isPending}
            retrying={paymentRetryMutation.isPending}
            onSave={(orderId, field, value) => {
              if (orderId.startsWith("teste-")) {
                setTestOrders((orders) =>
                  orders.map((order) => {
                    if (order.id !== orderId) return order;
                    return {
                      ...order,
                      [field]: value.trim() || null,
                      needs_shipping_label: field === "etiqueta_ml_url" && value.trim() ? false : order.needs_shipping_label,
                      updated_at: new Date().toISOString(),
                    };
                  }),
                );
                toast.success("Pedido de teste atualizado.");
                return;
              }
              const patch: Record<string, string | boolean | null> = { [field]: value.trim() || null };
              if (field === "etiqueta_ml_url" && value.trim()) patch.needs_shipping_label = false;
              updateOrderMutation.mutate({ orderId, patch });
            }}
            onUnlock={(orderId) => {
              if (orderId.startsWith("teste-")) {
                setTestOrders((orders) =>
                  orders.map((order) =>
                    order.id === orderId ? { ...order, locked_by: null, locked_at: null, updated_at: new Date().toISOString() } : order,
                  ),
                );
                toast.success("Trava do pedido de teste liberada.");
                return;
              }
              updateOrderMutation.mutate({ orderId, patch: { locked_by: null, locked_at: null } });
            }}
            onPaymentRetry={(orderId) => {
              if (orderId.startsWith("teste-")) {
                toast.success("Novo Pix de teste solicitado.");
                return;
              }
              paymentRetryMutation.mutate(orderId);
            }}
          />
        </section>
      </div>
      {helpOpen ? <FlowHelpModal onClose={() => setHelpOpen(false)} /> : null}
    </AdminShell>
  );
}

const FlowHelpModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#0F172A]/35 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bot-flow-help-title">
    <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-[16px] border border-[#E4E8F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#EEF1F6] bg-white px-5 py-4">
        <div>
          <h2 id="bot-flow-help-title" className="text-[16px] font-semibold text-[#171715]">Fluxo do bot</h2>
          <p className="mt-1 text-[12.5px] text-[#7C8493]">Ordem dos status e o que cada um significa na operação.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar ajuda"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-[#E1E6EF] bg-white text-[#596171] transition hover:bg-[#F8FAFC]"
        >
          <X size={15} />
        </button>
      </div>
      <div className="px-5 py-4">
        <ol className="space-y-2">
          {FLOW_HELP_STEPS.map((step, index) => {
            const attention = step.status.includes("falha") || step.status.includes("cancel") || step.status === "expirado";
            return (
              <li key={step.status} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-[12px] border border-[#EEF1F6] bg-[#FBFCFF] p-3">
                <span className={attention ? "grid h-7 w-7 place-items-center rounded-full bg-[#FFF1F2] text-[11px] font-semibold text-[#B42318]" : "grid h-7 w-7 place-items-center rounded-full bg-[#EFF6FF] text-[11px] font-semibold text-[#2563EB]"}>
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#171715]">{ORDER_STATUS_LABELS[step.status]}</p>
                    {attention ? <AdminBadge tone="warning">atenção</AdminBadge> : null}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-5 text-[#596171]">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  </div>
);

const StatusPanel = ({
  loading,
  heartbeat,
  workerStatus,
  online,
  silentMinutes,
  error,
  controlling,
  onToggle,
}: {
  loading: boolean;
  heartbeat: WorkerHeartbeat | null;
  workerStatus: WorkerStatus;
  online: boolean;
  silentMinutes: number | null;
  error?: string;
  controlling: boolean;
  onToggle: () => void;
}) => (
  <AdminCard className="overflow-hidden border-[#E4E8F0] p-0">
    <div className="flex flex-col gap-3 border-b border-[#EEF1F6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F2F6FF] text-[#2563EB]">
          <Bot size={18} />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-[#171715]">Status do bot</h2>
            <AdminBadge tone={workerStatusTone(workerStatus, online)}>{online ? "online" : "offline"}</AdminBadge>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[#7C8493]">Atualização automática a cada {REFRESH_INTERVAL_SECONDS}s.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {error ? <InlineError text={error} /> : null}
        <button
          type="button"
          onClick={onToggle}
          disabled={controlling}
          className={
            online
              ? "inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[#F1C9C9] bg-white px-3 text-[11.5px] font-semibold text-[#B42318] transition hover:bg-[#FFF7F7] disabled:opacity-60"
              : "inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#2563EB] px-3 text-[11.5px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
          }
        >
          {controlling ? <Loader2 size={13} className="animate-spin" /> : online ? <PowerOff size={13} /> : <Power size={13} />}
          {online ? "Desligar bot" : "Ligar bot"}
        </button>
      </div>
    </div>
    <div className="grid divide-y divide-[#EEF1F6] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
      <StatusField label="Status atual" value={loading ? "..." : workerStatus} />
      <StatusField label="Último sinal" value={loading ? "..." : dateFmt(heartbeat?.last_seen_at)} />
      <StatusField label="Sem responder" value={loading ? "..." : formatRelativeSilence(silentMinutes)} />
      <StatusField
        label="Pedido atual"
        value={workerStatus === "processing" ? heartbeat?.current_order_number ?? heartbeat?.current_order_id ?? "-" : "-"}
      />
    </div>
  </AdminCard>
);

const OrderStatsPanel = ({ orders, loading }: { orders: ActionOrder[]; loading: boolean }) => {
  const stats = [
    { label: "Precisam de ação", value: orders.length, icon: TicketCheck, tone: "blue" },
    { label: "Falhas", value: orders.filter((order) => ACTION_STATUSES.has(order.status ?? "")).length, icon: AlertTriangle, tone: "danger" },
    { label: "Sem SKU", value: orders.filter((order) => order.needs_manual_sku).length, icon: KeyRound, tone: "warning" },
    {
      label: "Sem etiqueta",
      value: orders.filter((order) => order.needs_shipping_label && !order.etiqueta_ml_url).length,
      icon: ShieldCheck,
      tone: "neutral",
    },
    { label: "Travados", value: orders.filter((order) => order.locked_by || order.locked_at).length, icon: Unlock, tone: "danger" },
    {
      label: "Estornos",
      value: orders.filter((order) => order.refund_required && order.refund_status !== "succeeded" && order.refund_status !== "not_required").length,
      icon: RotateCcw,
      tone: "danger",
    },
    { label: "Pix renovável", value: orders.filter(canRequestPaymentRetry).length, icon: RotateCcw, tone: "blue" },
  ] as const;

  return (
    <AdminCard className="overflow-hidden p-0">
      <SectionHeader title="Resumo dos pedidos" subtitle="Estatísticas rápidas da fila que precisa de intervenção." />
      <div className="grid divide-y divide-[#EEF1F6] sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-7">
        {stats.map((stat) => (
          <OrderStatTile key={stat.label} {...stat} loading={loading} />
        ))}
      </div>
    </AdminCard>
  );
};

const OrderStatTile = ({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "blue" | "danger" | "warning" | "neutral";
  loading: boolean;
}) => (
  <div className="flex min-w-0 items-center gap-3 bg-white px-4 py-3">
    <span
      className={
        tone === "danger"
          ? "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#FFF1F2] text-[#B42318]"
          : tone === "warning"
            ? "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#FFF7ED] text-[#A16207]"
            : tone === "blue"
              ? "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]"
              : "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#F1F5F9] text-[#64748B]"
      }
    >
      <Icon size={15} />
    </span>
    <div className="min-w-0">
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8F9B]">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold leading-none text-[#171715]">{loading ? "..." : value}</p>
    </div>
  </div>
);

const AlertsPanel = ({
  alerts,
  loading,
  error,
  resolving,
  onResolve,
}: {
  alerts: WorkerAlert[];
  loading: boolean;
  error?: string;
  resolving: boolean;
  onResolve: (alertId: string) => void;
}) => (
  <AdminCard className="overflow-hidden p-0">
    <SectionHeader
      title="Alertas abertos"
      subtitle="Somente alertas não resolvidos."
    />
    {error ? <PanelError text={error} /> : null}
    <div className="max-h-[560px] overflow-y-auto">
      {loading ? (
        <LoadingBlock />
      ) : alerts.length ? (
        alerts.map((alert) => (
          <div key={alert.id} className="border-b border-[#EEF1F6] px-4 py-3 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminBadge tone={severityTone(alert.severity)}>{alert.severity}</AdminBadge>
                  {alert.code ? <span className="text-[11px] font-semibold text-[#596171]">{alert.code}</span> : null}
                  <span className="text-[11px] text-[#8A8F9B]">{dateFmt(alert.created_at)}</span>
                </div>
                <p className="mt-2 text-[13px] leading-5 text-[#23272F]">{alert.message ?? "Sem mensagem"}</p>
                <p className="mt-1 text-[11.5px] text-[#8A8F9B]">Pedido {alert.order_number ?? alert.order_id ?? "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => onResolve(alert.id)}
                disabled={resolving}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#DDE6F6] bg-white px-2.5 text-[11.5px] font-semibold text-[#2563EB] transition hover:bg-[#F8FAFF] disabled:opacity-60"
              >
                <TicketCheck size={13} />
                Resolver
              </button>
            </div>
          </div>
        ))
      ) : (
        <EmptyBlock title="Nenhum alerta aberto" />
      )}
    </div>
  </AdminCard>
);

const OrdersPanel = ({
  orders,
  loading,
  error,
  search,
  selectedOrder,
  showTestOrders,
  onSearchChange,
  onSelectOrder,
  onCloseDetails,
  onToggleTestOrders,
  saving,
  retrying,
  onSave,
  onUnlock,
  onPaymentRetry,
}: {
  orders: ActionOrder[];
  loading: boolean;
  error?: string;
  search: string;
  selectedOrder: ActionOrder | null;
  showTestOrders: boolean;
  onSearchChange: (value: string) => void;
  onSelectOrder: (orderId: string) => void;
  onCloseDetails: () => void;
  onToggleTestOrders: () => void;
  saving: boolean;
  retrying: boolean;
  onSave: (orderId: string, field: EditableOrderField, value: string) => void;
  onUnlock: (orderId: string) => void;
  onPaymentRetry: (orderId: string) => void;
}) => (
  <AdminCard className="overflow-hidden p-0">
    <SectionHeader
      title="Pedidos que precisam de ação"
      subtitle="Apenas dados operacionais para destravar pedido."
      aside={
        <div className="flex flex-col gap-2 sm:flex-row">
          {import.meta.env.DEV ? (
            <button
              type="button"
              onClick={onToggleTestOrders}
              className={
                showTestOrders
                  ? "h-8 rounded-[9px] border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-[12px] font-semibold text-[#1D4ED8]"
                  : "h-8 rounded-[9px] border border-[#E1E6EF] bg-white px-2.5 text-[12px] font-semibold text-[#596171]"
              }
            >
              {showTestOrders ? "Ocultar testes" : "Mostrar testes"}
            </button>
          ) : null}
          <label className="flex h-8 min-w-[210px] items-center gap-2 rounded-[9px] border border-[#E1E6EF] bg-white px-2.5">
            <Search size={13} className="text-[#8A8F9B]" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Pedido, ML ou SKU"
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#9AA2AF]"
            />
          </label>
        </div>
      }
    />
    {error ? <PanelError text={error} /> : null}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-[12.5px]">
        <thead className="bg-[#F8FAFC] text-[10.5px] uppercase tracking-[0.09em] text-[#8A8F9B]">
          <tr>
            <th className="px-3 py-3">Pedido ML</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Motivo</th>
            <th className="px-3 py-3">Erro/detalhe</th>
            <th className="px-3 py-3">Atualizado</th>
            <th className="px-3 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="h-32 text-center text-[#2563EB]">
                <Loader2 size={22} className="mx-auto animate-spin" />
              </td>
            </tr>
          ) : orders.length ? (
            orders.map((order) => (
              <ActionOrderRow
                key={order.id}
                order={order}
                selected={selectedOrder?.id === order.id}
                onOpen={() => onSelectOrder(order.id)}
              />
            ))
          ) : (
            <tr>
              <td colSpan={6} className="h-32 text-center text-[13px] text-[#777772]">
                Nenhum pedido precisa de ação com os filtros atuais.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {selectedOrder ? (
      <OrderDetailsDrawer
        order={selectedOrder}
        saving={saving}
        retrying={retrying}
        onClose={onCloseDetails}
        onSave={(field, value) => onSave(selectedOrder.id, field, value)}
        onUnlock={() => onUnlock(selectedOrder.id)}
        onPaymentRetry={() => onPaymentRetry(selectedOrder.id)}
      />
    ) : null}
  </AdminCard>
);

const SectionHeader = ({ title, subtitle, aside }: { title: string; subtitle: string; aside?: ReactNode }) => (
  <div className="flex flex-col gap-3 border-b border-[#EEF1F6] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <h2 className="text-[14px] font-semibold text-[#171715]">{title}</h2>
      <p className="text-[11.5px] text-[#7C8493]">{subtitle}</p>
    </div>
    {aside}
  </div>
);

const StatusField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 bg-white px-4 py-3">
    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8F9B]">{label}</p>
    <p className="mt-1 truncate text-[13px] font-semibold text-[#171715]" title={value}>{value}</p>
  </div>
);

const InlineError = ({ text }: { text: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7F7] px-2.5 py-1 text-[11px] font-semibold text-[#B42318]">
    <AlertTriangle size={12} />
    {text}
  </span>
);

const PanelError = ({ text }: { text: string }) => (
  <div className="border-b border-[#F7C8C8] bg-[#FFF7F7] px-4 py-2.5 text-[12px] font-medium text-[#9F1D1D]">
    {text}
  </div>
);

const LoadingBlock = () => (
  <div className="flex h-36 items-center justify-center text-[#2563EB]">
    <Loader2 size={22} className="animate-spin" />
  </div>
);

const EmptyBlock = ({ title }: { title: string }) => (
  <div className="flex h-36 flex-col items-center justify-center text-center">
    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F2F6FF] text-[#2563EB]">
      <CheckCircle2 size={17} />
    </span>
    <p className="mt-3 text-[13px] font-semibold text-[#171715]">{title}</p>
  </div>
);

const InlineEditor = ({
  label,
  value,
  icon: Icon,
  onSave,
  disabled,
}: {
  label: string;
  value: string | null;
  icon: typeof Edit3;
  onSave: (value: string) => void;
  disabled: boolean;
}) => {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <div className="flex min-w-[160px] items-center gap-1.5">
      <Icon size={13} className="shrink-0 text-[#8A8F9B]" />
      <label className="sr-only">{label}</label>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="-"
        className="h-8 min-w-0 flex-1 rounded-[8px] border border-[#E1E6EF] bg-white px-2 text-[12px] text-[#171715] outline-none focus:border-[#B9C8EA]"
      />
      <button
        type="button"
        onClick={() => onSave(draft)}
        disabled={disabled}
        aria-label={`Salvar ${label}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-[#DDE6F6] bg-white text-[#2563EB] transition hover:bg-[#F8FAFF] disabled:opacity-60"
      >
        <Save size={13} />
      </button>
    </div>
  );
};

const ActionOrderRow = ({
  order,
  selected,
  onOpen,
}: {
  order: ActionOrder;
  selected: boolean;
  onOpen: () => void;
}) => (
  <tr
    className={selected ? "cursor-pointer border-t border-[#BFDBFE] bg-[#F8FAFF] align-top transition hover:bg-[#F8FAFF]" : "cursor-pointer border-t border-[#EEF1F6] align-top transition hover:bg-[#F9FBFF]"}
    onClick={onOpen}
  >
    <td className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="font-semibold text-[#171715]">{order.ml_order_id ?? order.order_number ?? order.id.slice(0, 8)}</p>
        {order.isTest ? <span className="rounded-full bg-[#FFF7ED] px-1.5 py-0.5 text-[10px] font-semibold text-[#C2410C]">Teste</span> : null}
      </div>
      {order.order_number && order.ml_order_id ? <p className="mt-0.5 text-[11px] text-[#8A8F9B]">Velo {order.order_number}</p> : null}
    </td>
    <td className="px-3 py-3">
      <AdminBadge tone={ACTION_STATUSES.has(order.status ?? "") ? "danger" : "neutral"}>{statusLabel(order.status ?? "-")}</AdminBadge>
    </td>
    <td className="px-3 py-3">
      <div className="flex max-w-[220px] flex-wrap gap-1">
        {actionReasons(order).map((reason) => (
          <span key={reason} className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-semibold text-[#475569]">
            {reason}
          </span>
        ))}
      </div>
    </td>
    <td className="px-3 py-3">
      <p className="max-w-[260px] whitespace-normal break-words text-[12px] leading-5 text-[#4B5563]" title={order.error_detail ?? undefined}>
        {order.error_detail ?? "-"}
      </p>
      {order.ml_price_update_status ? <p className="mt-1 text-[11px] text-[#8A8F9B]">Preço ML: {order.ml_price_update_status}</p> : null}
    </td>
    <td className="px-3 py-3 text-[11.5px] text-[#596171]">{dateFmt(order.updated_at || order.created_at)}</td>
    <td className="px-3 py-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#DDE6F6] bg-white px-2.5 text-[11px] font-semibold text-[#2563EB] transition hover:bg-[#F8FAFF]"
        >
          <PanelRightOpen size={13} />
          Detalhes
        </button>
      </div>
    </td>
  </tr>
);

const DetailField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="rounded-[10px] border border-[#EEF1F6] bg-[#FBFCFF] px-3 py-2.5">
    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8F9B]">{label}</p>
    <p className="mt-1 break-words text-[12.5px] font-semibold text-[#171715]">{value || "-"}</p>
  </div>
);

const OrderDetailsDrawer = ({
  order,
  saving,
  retrying,
  onClose,
  onSave,
  onUnlock,
  onPaymentRetry,
}: {
  order: ActionOrder;
  saving: boolean;
  retrying: boolean;
  onClose: () => void;
  onSave: (field: EditableOrderField, value: string) => void;
  onUnlock: () => void;
  onPaymentRetry: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/30 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="order-detail-title" onClick={onClose}>
    <aside
      className="h-full w-full max-w-[460px] overflow-y-auto border-l border-[#E4E8F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="sticky top-0 z-10 border-b border-[#EEF1F6] bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#8A8F9B]">Detalhes do pedido</p>
            <h2 id="order-detail-title" className="mt-1 truncate text-[17px] font-semibold text-[#171715]">
              {order.ml_order_id ?? order.order_number ?? order.id.slice(0, 8)}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <AdminBadge tone={ACTION_STATUSES.has(order.status ?? "") ? "danger" : "neutral"}>{statusLabel(order.status ?? "-")}</AdminBadge>
              {order.isTest ? <span className="rounded-full bg-[#FFF7ED] px-1.5 py-0.5 text-[10px] font-semibold text-[#C2410C]">Teste</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-[#E1E6EF] bg-white text-[#596171] transition hover:bg-[#F8FAFC]"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="space-y-5 px-5 py-4">
        <section className="grid grid-cols-2 gap-2">
          <DetailField label="Pedido Velo" value={order.order_number} />
          <DetailField label="Pagamento" value={order.payment_status} />
          <DetailField label="Atualizado" value={dateFmt(order.updated_at || order.created_at)} />
          <DetailField label="Trava" value={order.locked_by || order.locked_at ? "ativa" : "livre"} />
          <DetailField label="Estorno" value={order.refund_required ? order.refund_status ?? "pendente" : "não necessário"} />
        </section>

        <section>
          <p className="text-[12px] font-semibold text-[#171715]">Motivos da ação</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actionReasons(order).map((reason) => (
              <span key={reason} className="rounded-full bg-[#F1F5F9] px-2 py-1 text-[11px] font-semibold text-[#475569]">
                {reason}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[12px] font-semibold text-[#171715]">Campos editáveis</p>
          <InlineEditor label="SKU C7Drop" value={order.sku_c7drop} icon={KeyRound} onSave={(value) => onSave("sku_c7drop", value)} disabled={saving} />
          <div>
            <InlineEditor label="Link C7Drop" value={order.c7drop_product_url} icon={Edit3} onSave={(value) => onSave("c7drop_product_url", value)} disabled={saving} />
            {order.c7drop_product_url ? <ExternalTextLink href={order.c7drop_product_url} label="Abrir produto" /> : null}
          </div>
          <div>
            <InlineEditor label="Etiqueta ML" value={order.etiqueta_ml_url} icon={ShieldCheck} onSave={(value) => onSave("etiqueta_ml_url", value)} disabled={saving} />
            {order.etiqueta_ml_url ? <ExternalTextLink href={order.etiqueta_ml_url} label="Abrir etiqueta" /> : null}
          </div>
        </section>

        <section>
          <p className="text-[12px] font-semibold text-[#171715]">Erro/detalhe</p>
          <p className="mt-2 rounded-[10px] border border-[#EEF1F6] bg-[#FBFCFF] px-3 py-2.5 text-[12.5px] leading-5 text-[#4B5563]">
            {order.error_detail ?? "-"}
          </p>
          {order.ml_price_update_status ? <p className="mt-2 text-[11.5px] text-[#7C8493]">Preço ML: {order.ml_price_update_status}</p> : null}
          {order.refund_error ? <p className="mt-2 text-[11.5px] text-[#B42318]">Estorno: {order.refund_error}</p> : null}
        </section>

        <section className="flex flex-wrap gap-2 border-t border-[#EEF1F6] pt-4">
          {order.locked_by || order.locked_at ? (
            <button
              type="button"
              onClick={onUnlock}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#F1C9C9] bg-white px-3 text-[12px] font-semibold text-[#B42318] transition hover:bg-[#FFF7F7] disabled:opacity-60"
            >
              <Unlock size={13} />
              Liberar trava
            </button>
          ) : null}
          {canRequestPaymentRetry(order) ? (
            <button
              type="button"
              onClick={onPaymentRetry}
              disabled={retrying}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[#2563EB] px-3 text-[12px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {retrying ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Solicitar Pix 8h
            </button>
          ) : null}
          {!order.locked_by && !order.locked_at && !canRequestPaymentRetry(order) ? (
            <span className="text-[12px] text-[#7C8493]">Nenhuma ação extra disponível para este pedido.</span>
          ) : null}
        </section>
      </div>
    </aside>
  </div>
);

const ExternalTextLink = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline"
  >
    {label}
    <ExternalLink size={11} />
  </a>
);
