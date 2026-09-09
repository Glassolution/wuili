import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Copy,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  type LucideIcon,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { veloToast } from "@/components/ui/velo-toast";
import DashboardPageShell from "@/components/dashboard/DashboardPageShell";
import { isAdminEmail } from "@/lib/adminAccess";
import { usePlan, type PlanName } from "@/hooks/usePlan";


type MlOrderRow = Database["public"]["Views"]["ml_orders_view"]["Row"];

const statusLabels: Record<string, string> = {
  paid: "Pago",
  approved: "Aprovado",
  in_process: "Em processamento",
  processing: "Em processamento",
  completed: "Concluído",
  delivered: "Entregue",
  shipped: "Enviado",
  in_transit: "Em trânsito",
  pending: "Pendente",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  failed: "Falhou",
  refunded: "Cancelado",
  charged_back: "Estornado",
};

const statusStyles: Record<string, string> = {
  refunded: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  charged_back: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  cancelled: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  canceled: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  failed: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
};

const getStatusStyle = (status: string | null | undefined) =>
  statusStyles[(status ?? "").toLowerCase()] ?? "border-black/[0.08] bg-[#F5F5F5] text-[#404040]";

const pageFont = {
  fontFamily: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif',
};

const mlOrdersGridClass =
  "md:grid-cols-[minmax(200px,1.45fr)_minmax(110px,0.8fr)_88px_minmax(72px,0.55fr)_76px_104px_96px_0px] 2xl:grid-cols-[minmax(300px,1.6fr)_minmax(150px,0.75fr)_112px_144px_96px_132px_180px_24px]";

const formatBRL = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const clean = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
};

type ShippingAddress = {
  zip?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

type SupplierPurchaseInfo = {
  supplierUrl: string;
  supplierPrice: number | null;
  dropshipOrderId: string | null;
  orderCode: string;
  productTitle: string;
  quantity: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerDocument: string;
  address: ShippingAddress | null;
};

type BotPurchaseAudience = "geral" | "admin";
type BotPurchaseAccessLevel = "gratis" | "base" | "pro" | "business" | "admin";
type BotPurchaseSettings = {
  enabled: boolean;
  audience: BotPurchaseAudience;
  accessLevels: BotPurchaseAccessLevel[];
};

type C7DropAccountStatus = {
  status: "not_connected" | "connected" | "signup_requested" | "manual_action_required" | "invalid_credentials";
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  document?: string | null;
  connected_at?: string | null;
  updated_at?: string | null;
};

type C7DropAccountForm = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  document: string;
};

type SupplierPurchaseDraft = {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerDocument: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

const DEFAULT_BOT_PURCHASE_SETTINGS: BotPurchaseSettings = {
  enabled: true,
  audience: "geral",
  accessLevels: ["gratis", "base", "pro", "business", "admin"],
};

const BOT_PURCHASE_ACCESS_LEVELS: BotPurchaseAccessLevel[] = ["gratis", "base", "pro", "business", "admin"];

const normalizeBotPurchaseSettings = (row: Record<string, unknown> | null | undefined): BotPurchaseSettings => {
  const audience = row?.audience === "admin" ? "admin" : "geral";
  const accessLevels = Array.isArray(row?.access_levels)
    ? row.access_levels.filter((item): item is BotPurchaseAccessLevel =>
        BOT_PURCHASE_ACCESS_LEVELS.includes(item as BotPurchaseAccessLevel),
      )
    : audience === "admin"
      ? ["admin" as const]
      : DEFAULT_BOT_PURCHASE_SETTINGS.accessLevels;

  return {
    enabled: row?.enabled !== false,
    audience,
    accessLevels: Array.from(new Set(accessLevels)),
  };
};

const planToBotAccess = (plan: PlanName): BotPurchaseAccessLevel => {
  if (plan === "business") return "business";
  if (plan === "pro") return "pro";
  if (plan === "base") return "base";
  return "gratis";
};

const fetchBotPurchaseSettings = async (): Promise<BotPurchaseSettings> => {
  const { data, error } = await supabase
    .from("dropship_worker_settings" as never)
    .select("enabled,audience,access_levels")
    .eq("id" as never, true as never)
    .maybeSingle();

  if (error) throw error;
  return normalizeBotPurchaseSettings(data as unknown as Record<string, unknown> | null);
};

const fetchC7DropAccountStatus = async (): Promise<C7DropAccountStatus> => {
  const { data, error } = await supabase.functions.invoke("c7drop-account", {
    body: { action: "get_status" },
  });
  if (error) throw error;
  return (data as { account?: C7DropAccountStatus } | null)?.account ?? { status: "not_connected" };
};

const saveC7DropAccount = async (mode: "connect" | "signup", form: C7DropAccountForm) => {
  const { data, error } = await supabase.functions.invoke("c7drop-account", {
    body: {
      action: mode === "connect" ? "save_credentials" : "request_signup",
      ...form,
    },
  });
  const response = data as { account?: C7DropAccountStatus; error?: string } | null;
  if (error || response?.error) {
    throw new Error(response?.error ?? error?.message ?? "Não foi possível salvar a conta do fornecedor");
  }
  return response?.account ?? { status: "not_connected" as const };
};

const jsonText = (value: Json | undefined): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const normalizeShippingAddress = (value: Json | null | undefined): ShippingAddress | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, Json | undefined>;
  return {
    zip: jsonText(row.zip ?? row.cep ?? row.postal_code),
    street: jsonText(row.street ?? row.address ?? row.rua),
    number: jsonText(row.number ?? row.numero),
    complement: jsonText(row.complement ?? row.complemento),
    neighborhood: jsonText(row.neighborhood ?? row.bairro),
    city: jsonText(row.city ?? row.cidade),
    state: jsonText(row.state ?? row.uf ?? row.estado),
  };
};

const addressLines = (address: ShippingAddress | null) => {
  if (!address) return [];
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const cityState = [address.city, address.state].filter(Boolean).join(" - ");
  return [street, address.complement, address.neighborhood, cityState, address.zip ? `CEP ${address.zip}` : null]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
};

const addressEntries = (address: ShippingAddress | null) => {
  if (!address) return [];
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const entries = [
    { label: "Rua", value: street },
    { label: "Bairro", value: address.neighborhood },
    { label: "Cidade", value: [address.city, address.state].filter(Boolean).join(" - ") },
    { label: "CEP", value: address.zip },
    { label: "Complemento", value: address.complement },
  ];
  return entries.filter((entry) => entry.value?.trim());
};

const getStatusLabel = (status: string | null | undefined) => {
  const key = (status ?? "pending").toLowerCase();
  return statusLabels[key] ?? clean(status);
};

const getOrderCode = (order: MlOrderRow) => clean(order.ml_order_id ?? order.external_order_id ?? order.id);

const getProductName = (order: MlOrderRow) =>
  clean(order.catalog_title ?? order.product_title);

const getOrderImage = (order: MlOrderRow) => {
  if (order.product_image) return order.product_image;
  if (Array.isArray(order.catalog_images)) {
    const first = order.catalog_images.find((image) => typeof image === "string" && image.trim().length > 0);
    return typeof first === "string" ? first : null;
  }
  return null;
};

const shortenTrackingCode = (code: string) => {
  const trimmed = code.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-5)}`;
};

const supplierHref = (url: string | null | undefined) => {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return `https://${trimmed}`;
};

const purchaseInfoFromMlOrder = (order: MlOrderRow): SupplierPurchaseInfo | null => {
  const supplierUrl = supplierHref(order.supplier_url);
  if (!supplierUrl) return null;
  return {
    supplierUrl,
    supplierPrice: order.cost_price && order.cost_price > 0 ? order.cost_price : null,
    dropshipOrderId: null,
    orderCode: getOrderCode(order),
    productTitle: getProductName(order),
    quantity: clean(order.quantity),
    buyerName: clean(order.buyer_name),
    buyerEmail: clean(order.buyer_email),
    buyerPhone: clean(order.buyer_phone),
    buyerDocument: "",
    address: {
      zip: order.buyer_zip,
      street: order.buyer_address,
      number: order.buyer_number,
      complement: order.buyer_complement,
      neighborhood: order.buyer_neighborhood,
      city: order.buyer_city,
      state: order.buyer_state,
    },
  };
};

const purchaseInfoFromStoreOrder = (order: StoreOrderRow): SupplierPurchaseInfo | null => {
  const supplierUrl = supplierHref(order.supplier_url);
  if (!supplierUrl) return null;
  return {
    supplierUrl,
    supplierPrice: order.supplier_price && order.supplier_price > 0 ? order.supplier_price : null,
    dropshipOrderId: null,
    orderCode: order.id,
    productTitle: order.product_title,
    quantity: clean(order.quantity),
    buyerName: clean(order.buyer_name),
    buyerEmail: clean(order.buyer_email),
    buyerPhone: clean(order.buyer_phone),
    buyerDocument: "",
    address: normalizeShippingAddress(order.shipping_address),
  };
};

const attachDropshipOrderId = async (info: SupplierPurchaseInfo, order: MlOrderRow): Promise<SupplierPurchaseInfo> => {
  let supplierPrice = info.supplierPrice;
  let buyerDocument = info.buyerDocument;

  // Custo real do fornecedor: catálogo Velo (C7Drop) x quantidade.
  if (!supplierPrice && order.catalog_product_id) {
    const { data: catalog } = await supabase
      .from("catalog_products")
      .select("cost_price")
      .eq("id", order.catalog_product_id)
      .maybeSingle();
    const unit = Number(catalog?.cost_price ?? 0);
    if (unit > 0) supplierPrice = Number((unit * Math.max(1, Number(order.quantity ?? 1))).toFixed(2));
  }

  const mlOrderId = order.ml_order_id ?? order.external_order_id;
  if (!mlOrderId) return { ...info, supplierPrice, buyerDocument };

  const { data, error } = await supabase
    .from("dropship_orders")
    .select("id, customer_document")
    .eq("ml_order_id", String(mlOrderId))
    .maybeSingle();

  if (error) throw error;
  if (typeof data?.customer_document === "string" && data.customer_document.trim()) {
    buyerDocument = data.customer_document.trim();
  }

  return {
    ...info,
    supplierPrice,
    buyerDocument,
    dropshipOrderId: typeof data?.id === "string" ? data.id : null,
  };
};

const createPurchaseDraft = (info: SupplierPurchaseInfo): SupplierPurchaseDraft => ({
  buyerName: info.buyerName === "—" ? "" : info.buyerName,
  buyerEmail: info.buyerEmail === "—" ? "" : info.buyerEmail,
  buyerPhone: info.buyerPhone === "—" ? "" : info.buyerPhone,
  buyerDocument: info.buyerDocument ?? "",
  zip: info.address?.zip ?? "",
  street: info.address?.street ?? "",
  number: info.address?.number ?? "",
  complement: info.address?.complement ?? "",
  neighborhood: info.address?.neighborhood ?? "",
  city: info.address?.city ?? "",
  state: info.address?.state ?? "",
});


const SupplierButton = ({
  url,
  compact = false,
  onOpen,
  manual = false,
}: {
  url: string | null | undefined;
  compact?: boolean;
  onOpen: () => void;
  manual?: boolean;
}) => {
  const href = supplierHref(url);
  const classes = compact
    ? "inline-flex h-8 max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#2563EB] px-3 text-[11px] font-semibold text-white transition hover:bg-[#1D4ED8]"
    : "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1D4ED8]";
  const label = compact ? (
    <>
      <span className="hidden 2xl:inline">Comprar no Fornecedor</span>
      <span className="2xl:hidden">Comprar</span>
    </>
  ) : (
    "Comprar no Fornecedor"
  );

  if (!href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              disabled
              className={`${classes} cursor-not-allowed opacity-40`}
            >
              <ShoppingBag size={15} strokeWidth={1.5} />
              {label}
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="border-black/10 bg-[#0A0A0A] text-xs text-white">
          Fornecedor não vinculado
        </TooltipContent>
      </Tooltip>
    );
  }

  if (manual) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        onClick={(event) => event.stopPropagation()}
      >
        <ShoppingBag size={15} strokeWidth={1.5} />
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <ShoppingBag size={15} strokeWidth={1.5} />
      {label}
    </button>
  );
};

type C7DropPixState = {
  copyPaste: string | null;
  pixKey: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  renewalCount: number;
  paymentStatus: string | null;
  status: string | null;
};

const SupplierPurchaseModal = ({ info, onClose, onCreatedPix }: { info: SupplierPurchaseInfo | null; onClose: () => void; onCreatedPix?: () => void }) => {
  const [draft, setDraft] = useState<SupplierPurchaseDraft | null>(() => (info ? createPurchaseDraft(info) : null));
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [pix, setPix] = useState<C7DropPixState | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  useEffect(() => {
    setDraft(info ? createPurchaseDraft(info) : null);
    setPixOrderId(null);
    setPix(null);
    setQrDataUrl(null);
    setIsGeneratingQr(false);
  }, [info]);

  // O bot da Railway grava o Pix da C7Drop no pedido; ficamos ouvindo até chegar.
  useEffect(() => {
    if (!pixOrderId) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("dropship_orders")
        .select("status,payment_status,c7drop_pix_copy_paste,c7drop_pix_key,c7drop_pix_generated_at,c7drop_pix_expires_at,c7drop_pix_renewal_count")
        .eq("id", pixOrderId)
        .maybeSingle();
      if (!active || !data) return;
      setPix({
        copyPaste: data.c7drop_pix_copy_paste ?? null,
        pixKey: data.c7drop_pix_key ?? null,
        generatedAt: data.c7drop_pix_generated_at ?? null,
        expiresAt: data.c7drop_pix_expires_at ?? null,
        renewalCount: Number(data.c7drop_pix_renewal_count ?? 0),
        paymentStatus: data.payment_status ?? null,
        status: data.status ?? null,
      });
    };

    void load();
    const timer = window.setInterval(load, 6000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pixOrderId]);

  useEffect(() => {
    const code = pix?.copyPaste?.trim();
    if (!code) {
      setQrDataUrl(null);
      return;
    }
    let active = true;
    void import("qrcode").then(async (mod) => {
      const url = await mod.default.toDataURL(code, { width: 320, margin: 1 }).catch(() => null);
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [pix?.copyPaste]);

  if (!info || !draft) return null;

  const update = (field: keyof SupplierPurchaseDraft, value: string) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleBuy = async () => {
    if (isGeneratingQr) return;
    if (!info.dropshipOrderId) {
      veloToast.error("Este pedido ainda não está conectado ao bot. Sincronize os pedidos e tente novamente.");
      return;
    }
    const document = draft.buyerDocument.replace(/\D/g, "");
    if (document.length !== 11 && document.length !== 14) {
      veloToast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido do comprador.");
      return;
    }
    setIsGeneratingQr(true);
    try {
      const { data, error } = await supabase.functions.invoke("dropship-request-c7drop-pix", {
        body: {
          order_id: info.dropshipOrderId,
          payer_document: document,
          payer_name: draft.buyerName || undefined,
          payer_email: draft.buyerEmail || undefined,
          buyer_phone: draft.buyerPhone || undefined,
          address: {
            zip: draft.zip || undefined,
            street: draft.street || undefined,
            number: draft.number || undefined,
            complement: draft.complement || undefined,
            neighborhood: draft.neighborhood || undefined,
            city: draft.city || undefined,
            state: draft.state || undefined,
          },
        },
      });
      const response = data as { error?: string } | null;
      if (error || response?.error) {
        let detail = response?.error ?? null;
        // deno-lint-ignore no-explicit-any -- context não é tipado pelo SDK
        const context = (error as any)?.context;
        if (!detail && context && typeof context.json === "function") {
          const body = await context.json().catch(() => null);
          detail = typeof body?.error === "string" ? body.error : null;
        }
        throw new Error(detail ?? error?.message ?? "Não foi possível gerar o Pix.");
      }

      setPixOrderId(info.dropshipOrderId);
      onCreatedPix?.();
      veloToast.success("Pedido enviado ao bot. O Pix da C7Drop aparece aqui em instantes.");
    } catch (error) {
      veloToast.error(error instanceof Error ? error.message : "Não foi possível gerar o Pix.");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const supplierPriceLabel = info.supplierPrice ? formatBRL(info.supplierPrice) : "Não informado";

  if (pixOrderId) {
    const isPaid = pix?.paymentStatus === "paid";
    const expiresLabel = pix?.expiresAt
      ? new Date(pix.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/45 px-4 py-6 backdrop-blur-[3px]" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-qr-title"
          className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#D8E3F8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="h-1.5 bg-[#2563EB]" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2563EB]">Comprar no fornecedor</p>
                <h2 id="supplier-qr-title" className="mt-1 text-[22px] font-black tracking-[-0.04em] text-[#020817]">
                  Pix da C7Drop
                </h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#64748B] transition hover:bg-[#EFF6FF] hover:text-[#2563EB]" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid place-items-center rounded-[22px] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
              {isPaid ? (
                <p className="text-center text-[13px] font-black text-[#137443]">Pagamento confirmado. O bot está finalizando o pedido no fornecedor.</p>
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code Pix da compra na C7Drop" className="h-56 w-56" />
              ) : (
                <p className="text-center text-[13px] font-semibold text-[#64748B]">
                  Gerando o Pix na C7Drop... isso leva alguns instantes. Deixe esta janela aberta.
                </p>
              )}
            </div>

            {!isPaid && pix?.copyPaste ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pix.copyPaste ?? "");
                    veloToast.success("Código Pix copiado.");
                  } catch {
                    veloToast.error("Não foi possível copiar o código.");
                  }
                }}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-[#C7D7FE] bg-[#EFF6FF] px-4 text-[12px] font-black text-[#1D4ED8] transition hover:bg-[#E0EAFF]"
              >
                <Copy size={14} strokeWidth={2} />
                Copiar código Pix (copia e cola)
              </button>
            ) : null}

            <div className="mt-5 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Preço C7Drop</p>
              <p className="mt-1 text-[30px] font-black tracking-[-0.05em] text-[#020817]">{supplierPriceLabel}</p>
            </div>

            {!isPaid ? (
              <div className="mt-5 rounded-[16px] border border-[#FACC15]/50 bg-[#FEFCE8] px-4 py-3 text-center">
                <p className="text-[13px] font-black text-[#854D0E]">
                  Validade estimada: 45 minutos{expiresLabel ? ` (até ${expiresLabel})` : ""}.
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#A16207]">
                  Se vencer, o bot gera um novo Pix automaticamente (até 3 vezes).
                  {pix?.renewalCount ? ` Renovações até agora: ${pix.renewalCount}.` : ""}
                </p>
              </div>
            ) : null}

            {!isPaid ? (
              <div className="mt-4 rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-center">
                <p className="text-[13px] font-black text-[#137443]">
                  Depois de pagar, aguarde a confirmação automática.
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#15803D]">
                  O bot acompanha a C7Drop e atualiza o pedido quando o pagamento for identificado.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#2563EB] px-5 text-[13px] font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8]"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#020817]/45 px-4 pb-[calc(128px+env(safe-area-inset-bottom))] pt-4 backdrop-blur-[3px] sm:items-center sm:py-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-purchase-title"
        className="flex max-h-[calc(100dvh-144px-env(safe-area-inset-bottom))] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-[#D8E3F8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-48px)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1.5 bg-[#2563EB]" />
        <div className="min-h-0 overflow-y-auto p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2563EB]">Comprar no fornecedor</p>
              <h2 id="supplier-purchase-title" className="mt-1 text-[20px] font-black tracking-[-0.04em] text-[#020817]">
                Informações do comprador
              </h2>
              <p className="mt-1 line-clamp-2 text-[12px] font-medium text-[#64748B]">
                Confira ou complete os dados antes de comprar: {info.productTitle}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#64748B] transition hover:bg-[#EFF6FF] hover:text-[#2563EB]" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 grid gap-3 rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-4">
            <MiniInfo label="Pedido" value={info.orderCode} />
            <MiniInfo label="Quantidade" value={info.quantity} />
            <MiniInfo label="Fornecedor" value="C7Drop" />
            <MiniInfo label="Preço C7Drop" value={supplierPriceLabel} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#64748B]">
                <UserRound size={14} />
                Comprador
              </div>
              <div className="space-y-3">
                <PurchaseField label="Nome" icon={UserRound} value={draft.buyerName} onChange={(value) => update("buyerName", value)} />
                <PurchaseField label="E-mail" icon={Mail} value={draft.buyerEmail} onChange={(value) => update("buyerEmail", value)} />
                <PurchaseField label="Telefone" icon={Phone} value={draft.buyerPhone} onChange={(value) => update("buyerPhone", value)} />
                <PurchaseField label="CPF / CNPJ" value={draft.buyerDocument} onChange={(value) => update("buyerDocument", value)} />

              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#64748B]">
                <MapPin size={14} />
                Entrega
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PurchaseField label="CEP" value={draft.zip} onChange={(value) => update("zip", value)} />
                <PurchaseField label="Estado" value={draft.state} onChange={(value) => update("state", value)} />
                <PurchaseField label="Cidade" value={draft.city} onChange={(value) => update("city", value)} />
                <PurchaseField label="Bairro" value={draft.neighborhood} onChange={(value) => update("neighborhood", value)} />
                <PurchaseField label="Rua" value={draft.street} onChange={(value) => update("street", value)} className="sm:col-span-2" />
                <PurchaseField label="Número" value={draft.number} onChange={(value) => update("number", value)} />
                <PurchaseField label="Complemento" value={draft.complement} onChange={(value) => update("complement", value)} />
              </div>
            </section>
          </div>

        </div>
        <div className="shrink-0 border-t border-[#E2E8F0] bg-white/95 p-4 backdrop-blur sm:flex sm:justify-end">
          <button
            type="button"
            onClick={handleBuy}
            disabled={isGeneratingQr}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#2563EB] px-5 text-[13px] font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            <ShoppingBag size={15} />
            {isGeneratingQr ? "Gerando Pix..." : "Gerar Pix C7Drop"}
          </button>
        </div>
      </div>
    </div>
  );
};

const C7DropAccountBanner = ({
  account,
  onOpen,
}: {
  account: C7DropAccountStatus;
  onOpen: () => void;
}) => {
  const connected = account.status === "connected";
  const pending = account.status === "signup_requested";

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#D7E4FF] bg-gradient-to-r from-[#EFF6FF] via-white to-[#F8FAFC] p-4 shadow-[0_14px_34px_rgba(37,99,235,0.08)] md:mb-7 md:flex md:items-center md:justify-between md:gap-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#2563EB] text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]">
          {connected ? <CheckCircle2 size={20} /> : <UserPlus size={20} />}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-black tracking-[-0.04em] text-[#0F172A]">
            {connected ? "Conta do fornecedor conectada" : "Crie uma conta no fornecedor e automatize seus pedidos direto na Velo"}
          </p>
          <p className="mt-1 max-w-2xl text-[12.5px] font-medium leading-relaxed text-[#64748B]">
            {connected
              ? `O bot vai comprar no fornecedor usando ${account.email ?? "a conta conectada"}, mantendo reembolso e suporte no acesso do vendedor.`
              : pending
                ? "Sua solicitação de conta no fornecedor está salva. Se o fornecedor pedir validação manual, você será avisado antes do bot usar a conta."
                : "Conecte uma conta existente ou deixe os dados prontos para criar uma conta. Assim cada vendedor mantém seus próprios pedidos, reembolsos e suporte direto no fornecedor."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-[12.5px] font-bold text-white shadow-[0_10px_22px_rgba(37,99,235,0.2)] transition hover:bg-[#1D4ED8] md:mt-0 md:w-auto md:shrink-0"
      >
        <KeyRound size={15} />
        {connected ? "Gerenciar fornecedor" : "Conectar fornecedor"}
      </button>
    </section>
  );
};

const C7DropAccountModal = ({
  open,
  account,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  account: C7DropAccountStatus;
  saving: boolean;
  onClose: () => void;
  onSave: (mode: "connect" | "signup", form: C7DropAccountForm) => void;
}) => {
  const [mode, setMode] = useState<"connect" | "signup">("connect");
  const [form, setForm] = useState<C7DropAccountForm>({
    email: account.email ?? "",
    password: "",
    first_name: account.first_name ?? "",
    last_name: account.last_name ?? "",
    phone: account.phone ?? "",
    document: account.document ?? "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      email: account.email ?? "",
      password: "",
      first_name: account.first_name ?? "",
      last_name: account.last_name ?? "",
      phone: account.phone ?? "",
      document: account.document ?? "",
    });
  }, [account.document, account.email, account.first_name, account.last_name, account.phone, open]);

  if (!open) return null;

  const update = (key: keyof C7DropAccountForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const canSave = form.email && form.password && form.first_name && form.last_name && form.phone && form.document;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/45 px-4 py-6 backdrop-blur-[3px]">
      <div className="flex max-h-[calc(100dvh-48px)] w-full max-w-xl flex-col overflow-hidden rounded-[24px] border border-[#D8E3F8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
        <div className="h-1.5 bg-[#2563EB]" />
        <div className="flex items-start justify-between gap-4 border-b border-[#EEF1F6] p-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2563EB]">Fornecedor</p>
            <h2 className="mt-1 text-[19px] font-black tracking-[-0.04em] text-[#020817]">Conta do fornecedor</h2>
            <p className="mt-1 text-[12.5px] font-medium text-[#64748B]">O bot usará essa conta para comprar os pedidos desse vendedor.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#64748B] transition hover:bg-[#EFF6FF] hover:text-[#2563EB]" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F1F5F9] p-1">
            {[
              { value: "connect", label: "Já tenho conta" },
              { value: "signup", label: "Criar conta" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value as "connect" | "signup")}
                className={`h-10 rounded-xl text-[12px] font-bold transition ${mode === option.value ? "bg-white text-[#2563EB] shadow-[0_6px_16px_rgba(15,23,42,0.08)]" : "text-[#64748B]"}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PurchaseField label="E-mail do fornecedor" value={form.email} onChange={(value) => update("email", value)} type="email" icon={Mail} />
            <PurchaseField label="Senha do fornecedor" value={form.password} onChange={(value) => update("password", value)} type="password" icon={LockKeyhole} />
            <PurchaseField label="Nome" value={form.first_name} onChange={(value) => update("first_name", value)} icon={UserRound} />
            <PurchaseField label="Sobrenome" value={form.last_name} onChange={(value) => update("last_name", value)} icon={UserRound} />
            <PurchaseField label="Telefone" value={form.phone} onChange={(value) => update("phone", value)} icon={Phone} />
            <PurchaseField label="CPF/CNPJ" value={form.document} onChange={(value) => update("document", value)} icon={KeyRound} />
          </div>

          <div className="mt-4 rounded-2xl border border-[#D7E4FF] bg-[#EFF6FF] p-3 text-[12px] font-medium leading-relaxed text-[#475569]">
            {mode === "connect"
              ? "A senha será criptografada antes de salvar. Depois disso, a tela só mostra o status da conta, nunca a senha."
              : "A Velo deixará os dados prontos para o bot tentar criar a conta. Se o fornecedor pedir captcha, e-mail ou telefone, o fluxo vai pedir ação manual."}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#EEF1F6] p-5">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#D8E3F8] bg-white px-4 text-[12px] font-bold text-[#475569] transition hover:bg-[#F8FAFC]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(mode, form)}
            disabled={saving || !canSave}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#2563EB] px-4 text-[12px] font-bold text-white shadow-[0_10px_22px_rgba(37,99,235,0.2)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound size={14} />
            {mode === "connect" ? "Salvar conexão" : "Salvar para criar"}
          </button>
        </div>
      </div>
    </div>
  );
};

const MiniInfo = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
    <p className="mt-1 truncate text-[13px] font-black text-[#020817]">{value}</p>
  </div>
);

const PurchaseField = ({
  label,
  value,
  onChange,
  icon: Icon,
  className = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  className?: string;
  type?: string;
}) => (
  <label className={`block min-w-0 ${className}`}>
    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-[#64748B]">
      {Icon ? <Icon size={12} /> : null}
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-[12px] border border-[#D8E3F8] bg-white px-3 text-[13px] font-semibold text-[#020817] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
      placeholder="-"
    />
  </label>
);

const TrackingCodeBadge = ({ code }: { code: string | null | undefined }) => {
  const trackingCode = code?.trim();

  if (!trackingCode) {
    return <span className="text-[13px] font-semibold text-[#A3A3A3]">—</span>;
  }

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(trackingCode);
      veloToast.success("Código de rastreio copiado.");
    } catch {
      veloToast.error("Não foi possível copiar o código.");
    }
  };

  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[#1D4ED8]" title={trackingCode}>
      <span className="truncate text-[12px] font-black">{shortenTrackingCode(trackingCode)}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#2563EB] transition hover:bg-white"
        aria-label="Copiar código de rastreio"
      >
        <Copy size={12} strokeWidth={2} />
      </button>
    </div>
  );
};

const OrderRow = ({
  order,
  onSelect,
  onSupplierPurchase,
  useBotPurchase,
}: {
  order: MlOrderRow;
  onSelect: () => void;
  onSupplierPurchase: (order: MlOrderRow) => Promise<void> | void;
  useBotPurchase: boolean;
}) => {
  const image = getOrderImage(order);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 md:hidden"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-[#EFEFEC]">
            {image ? (
              <img src={image} alt={getProductName(order)} className="h-full w-full object-contain p-1 mix-blend-multiply" />
            ) : (
              <Package size={22} strokeWidth={1.5} className="text-[#A3A3A3]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[14px] font-semibold leading-tight tracking-[-0.03em] text-[#111111]">{getProductName(order)}</p>
            <p className="mt-1 text-[12px] font-medium text-[#777771]">
              Qtd. {clean(order.quantity)} · {formatBRL(order.total_amount ?? order.sale_price)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Pedido</p>
            <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.03em] text-[#111111]">{getOrderCode(order)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Comprador</p>
            <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.03em] text-[#111111]">{clean(order.buyer_name)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Status</p>
            <span className={`mt-1 inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold ${getStatusStyle(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Rastreio</p>
            <div className="mt-1">
              <TrackingCodeBadge code={order.tracking_code} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Data</p>
            <p className="mt-1 text-[13px] font-semibold leading-tight text-[#111111]">{formatDate(order.ordered_at ?? order.created_at)}</p>
          </div>
        </div>

        <div className="mt-4 border-t border-[#EFEFEB] pt-3">
          <SupplierButton url={order.supplier_url} compact manual={!useBotPurchase} onOpen={() => onSupplierPurchase(order)} />
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className={`group hidden cursor-pointer grid-cols-1 gap-4 border-b border-[#EFEFEB] bg-white px-4 py-4 outline-none transition hover:bg-[#F7F7F8] focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 md:grid ${mlOrdersGridClass} md:items-center`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-[#EFEFEC]">
            {image ? (
              <img src={image} alt={getProductName(order)} className="h-full w-full object-contain p-1 mix-blend-multiply" />
            ) : (
              <Package size={20} strokeWidth={1.5} className="text-[#A3A3A3]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">{getProductName(order)}</p>
            <p className="mt-1 text-[12px] text-[#777771]">Qtd. {clean(order.quantity)} · ML {getOrderCode(order)}</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Comprador</p>
          <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{clean(order.buyer_name)}</p>
        </div>

        <div className="min-w-0 md:flex md:justify-center">
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Status</p>
          <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold ${getStatusStyle(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
        </div>

        <div className="min-w-0 md:flex md:justify-center">
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Rastreio</p>
          <TrackingCodeBadge code={order.tracking_code} />
        </div>

        <div className="min-w-0 md:text-right">
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Valor</p>
          <p className="text-[13px] font-semibold text-[#0A0A0A]">{formatBRL(order.total_amount ?? order.sale_price)}</p>
        </div>

        <div className="min-w-0 md:text-right">
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Data</p>
          <p className="text-[13px] font-medium text-[#525252]">{formatDate(order.ordered_at ?? order.created_at)}</p>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <SupplierButton url={order.supplier_url} compact manual={!useBotPurchase} onOpen={() => onSupplierPurchase(order)} />
        </div>

        <ChevronRight size={18} strokeWidth={1.5} className="hidden text-[#A3A3A3] transition group-hover:translate-x-0.5 group-hover:text-[#0A0A0A] 2xl:block" />
      </div>
    </>
  );
};

const OrderSkeleton = () => (
  <div className="rounded-2xl border border-[#E5E7EB] bg-white">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className={`grid gap-4 border-b border-[#EFEFEB] px-4 py-4 last:border-b-0 ${mlOrdersGridClass} md:items-center`}>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    ))}
  </div>
);

type OrderTab = "ml" | "loja";

type StoreOrderRow = {
  id: string;
  product_title: string;
  product_image_url: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  quantity: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  catalog_product_id: string | null;
  supplier_url: string | null;
  supplier_price: number | null;
  /** Variação vendida ("Cor: Azul · Tamanho: G"), quando o produto tem. */
  variant_label: string | null;
  variant_sku: string | null;
  shipping_address: Json | null;
};

const StoreOrdersList = ({ userId, useBotPurchase }: { userId: string; useBotPurchase: boolean }) => {
  const [addressOrder, setAddressOrder] = useState<StoreOrderRow | null>(null);
  const [supplierPurchaseInfo, setSupplierPurchaseInfo] = useState<SupplierPurchaseInfo | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["store-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("id,product_title,product_image_url,buyer_name,buyer_email,buyer_phone,quantity,total,payment_method,payment_status,created_at,catalog_product_id,shipping_address,variant_label,variant_sku")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Omit<StoreOrderRow, "supplier_url" | "supplier_price">[];
      const ids = Array.from(new Set(rows.map((r) => r.catalog_product_id).filter((v): v is string => Boolean(v))));
      let productMap = new Map<string, { url: string | null; cost: number | null }>();
      if (ids.length > 0) {
        const { data: prods } = await supabase
          .from("catalog_products")
          .select("id,product_url,cost_price")
          .in("id", ids);
        productMap = new Map(
          (prods ?? []).map((p) => [
            p.id as string,
            {
              url: (p.product_url as string | null) ?? null,
              cost: typeof p.cost_price === "number" ? p.cost_price : null,
            },
          ]),
        );
      }
      return rows.map((r) => {
        const product = r.catalog_product_id ? productMap.get(r.catalog_product_id) : null;
        return {
          ...r,
          supplier_url: product?.url ?? null,
          supplier_price: product?.cost ?? null,
        };
      }) as StoreOrderRow[];
    },
  });

  if (isLoading) return <OrderSkeleton />;
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/45 p-6 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#9CA3AF] shadow-[0_10px_24px_rgba(17,17,17,0.06)]">
          <ShoppingBag size={21} strokeWidth={1.7} />
        </div>
        <p className="mt-4 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">Nenhum pedido da sua loja ainda</p>
        <p className="mt-1 max-w-md text-[12px] font-medium text-[#777771]">
          Quando um cliente comprar em uma das suas páginas de vendas, o pedido aparece aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(140px,0.9fr)_64px_104px_124px_112px_190px] border-b border-[#EFEFEB] bg-[#F7F7F8] px-4 py-3 text-[11px] font-semibold uppercase text-[#777771] md:grid">
          <span>Produto</span>
          <span>Comprador</span>
          <span>Qtd.</span>
          <span>Total</span>
          <span>Pagamento</span>
          <span>Data</span>
          <span className="text-right">Ações</span>
        </div>
        {data.map((order) => {
          const hasAddress = addressLines(normalizeShippingAddress(order.shipping_address)).length > 0;
          return (
            <div key={order.id} className="grid gap-3 border-b border-[#EFEFEB] px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.45fr)_minmax(140px,0.9fr)_64px_104px_124px_112px_190px] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-[#EFEFEC]">
                  {order.product_image_url ? <img src={order.product_image_url} alt="" className="h-full w-full object-contain p-1 mix-blend-multiply" /> : <Package size={20} className="text-[#A3A3A3]" />}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-1 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">{order.product_title}</p>
                  {order.variant_label ? (
                    <p className="line-clamp-1 text-[11px] font-semibold text-[#2563EB]">
                      {order.variant_label}
                      {order.variant_sku ? <span className="text-[#737373]"> · SKU {order.variant_sku}</span> : null}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{order.buyer_name}</p>
                <p className="truncate text-[11px] text-[#737373]">{order.buyer_email}</p>
                {order.buyer_phone ? <p className="truncate text-[11px] text-[#737373]">{order.buyer_phone}</p> : null}
                <button
                  type="button"
                  onClick={() => setAddressOrder(order)}
                  disabled={!hasAddress}
                  className="mt-2 inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-[#C7D7FE] bg-[#EFF6FF] px-2.5 text-[11px] font-semibold text-[#2563EB] transition hover:border-[#9DB8FD] hover:bg-[#E7F0FF] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
                >
                  <MapPin size={13} strokeWidth={1.8} />
                  Endereço
                </button>
              </div>
              <p className="text-[13px] text-[#525252]">{order.quantity}</p>
              <p className="text-[13px] font-semibold text-[#0A0A0A]">{formatBRL(order.total)}</p>
              <span className={`inline-flex h-7 w-fit items-center rounded-full px-2.5 text-[12px] font-semibold ${order.payment_status === "approved" ? "bg-[#C8F7DF] text-[#137443]" : order.payment_status === "rejected" ? "bg-red-100 text-red-700" : "bg-[#F5F5F5] text-[#404040]"}`}>
                {order.payment_method === "pix" ? "Pix" : "Cartão"} · {order.payment_status === "approved" ? "Pago" : order.payment_status === "rejected" ? "Rejeitado" : "Pendente"}
              </span>
              <p className="text-[13px] text-[#525252]">{formatDate(order.created_at)}</p>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <SupplierButton
                  url={order.supplier_url}
                  compact
                  manual={!useBotPurchase}
                  onOpen={() => {
                    const info = purchaseInfoFromStoreOrder(order);
                    if (info) setSupplierPurchaseInfo(info);
                    else veloToast.error("Este pedido não possui fornecedor vinculado.");
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <StoreOrderAddressModal order={addressOrder} onClose={() => setAddressOrder(null)} />
      <SupplierPurchaseModal info={supplierPurchaseInfo} onClose={() => setSupplierPurchaseInfo(null)} />
    </>
  );
};

const StoreOrderAddressModal = ({ order, onClose }: { order: StoreOrderRow | null; onClose: () => void }) => {
  if (!order) return null;

  const address = normalizeShippingAddress(order.shipping_address);
  const entries = addressEntries(address);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/45 px-4 backdrop-blur-[3px]">
      <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-[#D8E3F8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="h-1.5 bg-[#2563EB]" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#2563EB] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]">
                <MapPin size={17} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[18px] font-black tracking-[-0.035em] text-[#020817]">Endereço de entrega</h2>
                <p className="mt-0.5 truncate text-[12px] font-medium text-[#64748B]">{order.product_title}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#64748B] transition hover:bg-[#EFF6FF] hover:text-[#2563EB]" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">Comprador</p>
            <p className="mt-2 text-[14px] font-black tracking-[-0.02em] text-[#020817]">{order.buyer_name}</p>
            <p className="mt-1 text-[12px] font-medium text-[#64748B]">{order.buyer_email}</p>
            {order.buyer_phone ? <p className="mt-1 text-[12px] font-medium text-[#64748B]">{order.buyer_phone}</p> : null}
          </div>

          <div className="mt-4 rounded-[18px] border border-[#D8E3F8] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2563EB]">Entrega</p>
            <div className="mt-3 space-y-2.5">
              {entries.length > 0 ? (
                entries.map((entry) => (
                  <div key={entry.label} className="grid grid-cols-[86px_minmax(0,1fr)] gap-3 text-[13px] leading-snug">
                    <span className="font-black uppercase tracking-[0.08em] text-[#94A3B8]">{entry.label}</span>
                    <span className="font-semibold text-[#020817]">{entry.value}</span>
                  </div>
                ))
              ) : (
                <p className="text-[14px] font-semibold text-[#020817]">Endereço não informado.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-[14px] bg-[#2563EB] text-[13px] font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const OrdersPage = () => {
  const { user, role } = useAuth();
  const { plan } = usePlan();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<OrderTab>("ml");
  const [supplierPurchaseInfo, setSupplierPurchaseInfo] = useState<SupplierPurchaseInfo | null>(null);
  const [c7DropAccountModalOpen, setC7DropAccountModalOpen] = useState(false);
  const syncedRef = useRef(false);
  const isAdminUser = useMemo(() => {
    const metadataRole =
      (user?.app_metadata?.role as string | undefined) ??
      (user?.user_metadata?.role as string | undefined) ??
      null;
    return role === "admin" || metadataRole === "admin" || isAdminEmail(user?.email);
  }, [role, user?.app_metadata?.role, user?.email, user?.user_metadata?.role]);

  const { data: botPurchaseSettings = DEFAULT_BOT_PURCHASE_SETTINGS } = useQuery({
    queryKey: ["dropship-worker-settings"],
    queryFn: fetchBotPurchaseSettings,
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const userAccessLevels = useMemo(() => {
    const levels = new Set<BotPurchaseAccessLevel>([planToBotAccess(plan)]);
    if (isAdminUser) levels.add("admin");
    return levels;
  }, [isAdminUser, plan]);

  const useBotPurchase =
    botPurchaseSettings.enabled &&
    botPurchaseSettings.accessLevels.some((level) => userAccessLevels.has(level));

  const { data: c7DropAccount = { status: "not_connected" as const } } = useQuery({
    queryKey: ["c7drop-account", user?.id],
    queryFn: fetchC7DropAccountStatus,
    enabled: !!user?.id && useBotPurchase,
    refetchInterval: 60_000,
  });

  const c7DropAccountMutation = useMutation({
    mutationFn: ({ mode, form }: { mode: "connect" | "signup"; form: C7DropAccountForm }) => {
      if (!useBotPurchase) {
        throw new Error("A automação por fornecedor não está liberada para este acesso.");
      }
      return saveC7DropAccount(mode, form);
    },
    onSuccess: (account) => {
      queryClient.setQueryData(["c7drop-account", user?.id], account);
      setC7DropAccountModalOpen(false);
      veloToast.success(account.status === "connected" ? "Conta do fornecedor conectada." : "Solicitação de conta no fornecedor salva.");
    },
    onError: (error: unknown) => {
      veloToast.error(error instanceof Error ? error.message : "Não foi possível salvar a conta do fornecedor.");
    },
  });

  const triggerSync = useMemo(
    () => () => {
      if (!user?.id) return;
      supabase.functions
        .invoke("ml-sync-orders")
        .then(({ error: syncErr }) => {
          if (syncErr) {
            console.warn("[OrdersPage] ml-sync-orders falhou", syncErr);
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["ml-orders-view", user.id] });
          queryClient.invalidateQueries({ queryKey: ["store-orders", user.id] });
        })
        .catch((err) => console.warn("[OrdersPage] ml-sync-orders exception", err));
    },
    [user?.id, queryClient],
  );

  // Initial sync on mount
  useEffect(() => {
    if (!user?.id || syncedRef.current) return;
    syncedRef.current = true;
    triggerSync();
  }, [user?.id, triggerSync]);

  // Periodic sync every 45s while page is visible
  useEffect(() => {
    if (!user?.id) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") triggerSync();
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") triggerSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, triggerSync]);

  // Realtime subscription: invalidate queries on any change
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`orders-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ml-orders-view", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_orders", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["store-orders", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);


  const {
    data: rawOrders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ml-orders-view", user?.id],
    enabled: !!user?.id,
    // Verifica continuamente se surgiram pedidos da conta de vendedor conectada
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) return [];

      // Sellers ML conectados nesta conta (pedidos podem ter sido gravados em outra conta Velo
      // que usa o mesmo seller — trazemos todos eles).
      const { data: integrations } = await supabase
        .from("user_integrations")
        .select("ml_user_id")
        .eq("user_id", user.id)
        .eq("platform", "mercadolivre");

      const sellerIds = Array.from(
        new Set(
          (integrations ?? [])
            .map((row) => (row.ml_user_id == null ? null : String(row.ml_user_id)))
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const filters = [`user_id.eq.${user.id}`];
      if (sellerIds.length > 0) {
        filters.push(`ml_user_id.in.(${sellerIds.join(",")})`);
      }

      const { data, error: queryError } = await supabase
        .from("ml_orders_view")
        .select("*")
        .or(filters.join(","))
        .order("ordered_at", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (queryError) throw queryError;

      // Deduplica caso o mesmo pedido apareça por mais de um critério
      const seen = new Set<string>();
      return (data ?? []).filter((row) => {
        const key = String(row.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });


  useEffect(() => {
    if (error) {
      veloToast.error("Não foi possível carregar seus pedidos.");
    }
  }, [error]);

  const orders = useMemo(
    () => {
      const baseOrders = [...(rawOrders ?? [])];

      return baseOrders.sort((a, b) => {
        const left = new Date(a.ordered_at ?? a.created_at ?? 0).getTime();
        const right = new Date(b.ordered_at ?? b.created_at ?? 0).getTime();
        return right - left;
      });
    },
    [rawOrders, user?.email, user?.id],
  );

  const isEmpty = !isLoading && orders.length === 0;
  const activeTabCount = tab === "ml" ? orders.length : 0;

  return (
    <TooltipProvider delayDuration={120}>
      <DashboardPageShell
        title="Pedidos"
        className="overflow-visible"
        panelClassName="overflow-visible"
        style={pageFont}
      >

        <div className="mobile-hide-scrollbar mb-5 flex gap-2 overflow-x-auto md:mb-7 md:items-center xl:overflow-visible" data-dashboard-tour="pedidos-filtros">
          <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[12px] font-semibold text-[#111111] shadow-[0_8px_18px_rgba(17,17,17,0.035)]">
            <Calendar size={14} strokeWidth={1.8} className="text-[#8E8E87]" />
            <span>{activeTabCount}</span>
            <span className="text-[#8E8E87]">{activeTabCount === 1 ? "pedido" : "pedidos"}</span>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("ml")}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold transition-all duration-200 ${
                tab === "ml"
                  ? "border-[#2563EB] bg-[#2563EB] text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]"
                  : "border-black/[0.08] bg-white text-[#111111] hover:border-black/15 hover:bg-[#F7F7F8]"
              }`}
            >
              <span className={tab === "ml" ? "text-white/65" : "text-[#8E8E87]"}>Canal</span>
              <span>Mercado Livre</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("loja")}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold transition-all duration-200 ${
                tab === "loja"
                  ? "border-[#2563EB] bg-[#2563EB] text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]"
                  : "border-black/[0.08] bg-white text-[#111111] hover:border-black/15 hover:bg-[#F7F7F8]"
              }`}
            >
              <span className={tab === "loja" ? "text-white/65" : "text-[#8E8E87]"}>Canal</span>
              <span>Minha Loja</span>
            </button>
          </div>

          <div className="hidden xl:block xl:flex-1" />
        </div>

        {useBotPurchase ? (
          <C7DropAccountBanner account={c7DropAccount} onOpen={() => setC7DropAccountModalOpen(true)} />
        ) : null}

        {tab === "loja" && user?.id ? (
          <StoreOrdersList userId={user.id} useBotPurchase={useBotPurchase} />
        ) : isLoading ? (
          <OrderSkeleton />
        ) : isEmpty ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/45 p-6 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#9CA3AF] shadow-[0_10px_24px_rgba(17,17,17,0.06)]">
              <ShoppingBag size={21} strokeWidth={1.7} />
            </div>
            <p className="mt-4 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">Nenhum pedido encontrado</p>
            <p className="mt-1 max-w-md text-[12px] font-medium text-[#777771]">
              Seus pedidos do Mercado Livre aparecerão aqui quando a sincronização registrar vendas na view.
            </p>
          </div>
        ) : (
          <div data-dashboard-tour="pedidos-lista" className="space-y-3 bg-transparent md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-[#E5E7EB] md:bg-white">
            <div className={`hidden gap-4 border-b border-[#EFEFEB] bg-[#F7F7F8] px-4 py-3 text-[11px] font-semibold uppercase text-[#777771] md:grid ${mlOrdersGridClass}`}>
              <span>Produto</span>
              <span>Comprador</span>
              <span className="text-center">Status</span>
              <span className="text-center">Rastreio</span>
              <span className="text-right">Valor</span>
              <span className="text-right">Data</span>
              <span className="text-right">Fornecedor</span>
              <span />
            </div>
            {orders.map((order) => (
              <OrderRow
                key={order.id ?? `${order.ml_order_id}-${order.created_at}`}
                order={order}
                onSelect={() => {
                  const routeId = order.ml_order_id ?? order.id ?? order.external_order_id;
                  if (routeId) navigate(`/dashboard/orders/${encodeURIComponent(routeId)}`);
                  else veloToast.error("Este pedido não possui um identificador válido.");
                }}
                onSupplierPurchase={async (selectedOrder) => {
                  const info = purchaseInfoFromMlOrder(selectedOrder);
                  if (!info) {
                    veloToast.error("Este pedido não possui fornecedor vinculado.");
                    return;
                  }
                  try {
                    setSupplierPurchaseInfo(await attachDropshipOrderId(info, selectedOrder));
                  } catch {
                    veloToast.error("Não foi possível localizar este pedido na fila do bot.");
                  }
                }}
                useBotPurchase={useBotPurchase}
              />
            ))}
          </div>
        )}
        <C7DropAccountModal
          open={useBotPurchase && c7DropAccountModalOpen}
          account={c7DropAccount}
          saving={c7DropAccountMutation.isPending}
          onClose={() => setC7DropAccountModalOpen(false)}
          onSave={(mode, form) => c7DropAccountMutation.mutate({ mode, form })}
        />
        <SupplierPurchaseModal info={supplierPurchaseInfo} onClose={() => setSupplierPurchaseInfo(null)} onCreatedPix={() => queryClient.invalidateQueries({ queryKey: ["ml-orders-view", user?.id] })} />
      </DashboardPageShell>
    </TooltipProvider>
  );
};

export default OrdersPage;
