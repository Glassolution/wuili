import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Period = "day" | "month" | "year";

type ValidaPayTransaction = {
  id?: string | null;
  transactionId?: string | null;
  type?: string | null;
  category?: string | null;
  direction?: string | null;
  amount?: number | string | null;
  grossAmount?: number | string | null;
  netAmount?: number | string | null;
  balanceAfter?: number | string | null;
  balance_after?: number | string | null;
  fee?: number | string | null;
  chargeId?: string | null;
  referenceId?: string | null;
  createdAt?: string | null;
  date?: string | null;
  customer?: { name?: string | null; email?: string | null } | null;
};

type ValidaPayBalance = {
  available: number;
  blocked: number | null;
  receivable: number | null;
};

type FinanceEvent = {
  id: string;
  amount: number;
  createdAt: string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalize = (value: unknown) => String(value ?? "").trim().toUpperCase();
const toAmount = (value: number | string | null | undefined) => {
  const normalized = typeof value === "string"
    ? value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")
    : value;
  const amount = Number(normalized ?? 0);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const pickAmount = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return toAmount(record[key] as number | string);
  }
  return 0;
};

const pickOptionalAmount = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return toAmount(record[key] as number | string);
  }
  return null;
};

const getBelemParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
};

const getPeriodBounds = (period: Period) => {
  const now = new Date();
  const { year, month, day } = getBelemParts(now);
  const start = period === "year"
    ? `${year}-01-01T00:00:00-03:00`
    : period === "month"
    ? `${year}-${month}-01T00:00:00-03:00`
    : `${year}-${month}-${day}T00:00:00-03:00`;
  return { start: new Date(start), end: now };
};

const isInRange = (value: string | null | undefined, start: Date, end: Date) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= end.getTime();
};

const getBucketKey = (value: string, period: Period) => {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  if (period === "year") return `${part("year")}-${part("month")}`;
  if (period === "month") return `${part("year")}-${part("month")}-${part("day")}`;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}`;
};

const buildSeries = (events: FinanceEvent[], period: Period) => {
  const grouped = new Map<string, number>();
  events.forEach((event) => {
    const key = getBucketKey(event.createdAt, period);
    grouped.set(key, (grouped.get(key) ?? 0) + event.amount);
  });
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, value: Number(value.toFixed(2)) }));
};

async function isAdmin(adminClient: SupabaseClient, userId: string) {
  const { data } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function getValidaPayToken() {
  const clientId = Deno.env.get("VALIDAPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("VALIDAPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const sandbox = (Deno.env.get("VALIDAPAY_ENV") ?? "production").toLowerCase() === "sandbox";
  const authUrl = sandbox
    ? "https://oauth2-sandbox.validapay.com.br/auth/token"
    : "https://oauth2.validapay.com.br/auth/token";
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "wallet/read",
    }).toString(),
  });
  const data = await response.json().catch(() => null) as { access_token?: string } | null;
  if (!response.ok || !data?.access_token) throw new Error(`ValidaPay OAuth respondeu ${response.status}`);
  return data.access_token;
}

async function fetchValidaPayTransactions(start: Date, end: Date) {
  const token = await getValidaPayToken();
  if (!token) return { available: false, transactions: [] as ValidaPayTransaction[] };

  const sandbox = (Deno.env.get("VALIDAPAY_ENV") ?? "production").toLowerCase() === "sandbox";
  const apiUrl = sandbox ? "https://sandbox.validapay.com.br" : "https://api.validapay.com.br";
  const transactions: ValidaPayTransaction[] = [];
  const seen = new Set<string>();
  // Alguns ambientes da ValidaPay expõem o extrato em caminhos diferentes.
  const paths = ["/v1/wallet/transactions", "/v1/wallet/statement", "/v1/transactions"];
  let activePath: string | null = null;

  for (const path of paths) {
    let nextPageToken: string | null = null;
    let notFound = false;

    for (let page = 0; page < 100; page += 1) {
      const url = new URL(`${apiUrl}${path}`);
      url.searchParams.set("dateFrom", start.toISOString());
      url.searchParams.set("dateTo", end.toISOString());
      url.searchParams.set("limit", "100");
      if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);

      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null) as {
        transactions?: ValidaPayTransaction[];
        data?: { transactions?: ValidaPayTransaction[]; nextPageToken?: string | null; hasMore?: boolean };
        nextPageToken?: string | null;
        hasMore?: boolean;
      } | null;

      if (response.status === 404) {
        console.warn(`[admin-wallet-finance] extrato 404 em ${path}`);
        notFound = true;
        break;
      }
      if (!response.ok) throw new Error(`ValidaPay extrato respondeu ${response.status}`);

      const rows = payload?.transactions ?? payload?.data?.transactions ?? [];
      rows.forEach((row) => {
        const key = String(
          row.transactionId ?? row.id ?? row.referenceId ?? `${row.type}-${row.category}-${row.amount}-${row.createdAt ?? row.date}`,
        );
        if (seen.has(key)) return;
        seen.add(key);
        transactions.push(row);
      });

      const hasMore = payload?.hasMore ?? payload?.data?.hasMore ?? false;
      nextPageToken = payload?.nextPageToken ?? payload?.data?.nextPageToken ?? null;
      if (!hasMore || !nextPageToken || rows.length === 0) break;
    }

    if (!notFound) {
      activePath = path;
      break;
    }
  }

  if (!activePath) {
    // Nenhum endpoint de extrato disponível: degrada sem quebrar o painel.
    console.warn("[admin-wallet-finance] nenhum endpoint de extrato disponível na ValidaPay");
  }

  return { available: true, transactions };
}

async function fetchValidaPayBalance(): Promise<ValidaPayBalance | null> {
  const token = await getValidaPayToken();
  if (!token) return null;

  const sandbox = (Deno.env.get("VALIDAPAY_ENV") ?? "production").toLowerCase() === "sandbox";
  const apiUrl = sandbox ? "https://sandbox.validapay.com.br" : "https://api.validapay.com.br";
  const response = await fetch(`${apiUrl}/v1/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Saldo ValidaPay respondeu ${response.status}`);

  const root = asRecord(payload);
  const data = asRecord(root.data);
  const balance = asRecord(root.balance);
  const nestedBalance = asRecord(data.balance);
  const source = Object.keys(nestedBalance).length > 0
    ? nestedBalance
    : Object.keys(data).length > 0
    ? data
    : Object.keys(balance).length > 0
    ? balance
    : root;

  const availableKeys = [
    "availableBalance",
    "available_balance",
    "available",
    "balanceAvailable",
    "balance",
    "saldoDisponivel",
  ];
  const blockedKeys = [
    "blockedBalance",
    "blocked_balance",
    "blocked",
    "balanceBlocked",
    "saldoBloqueado",
  ];
  const receivableKeys = [
    "receivableBalance",
    "receivable_balance",
    "receivable",
    "pendingBalance",
    "balanceReceivable",
    "amountToReceive",
    "saldoAReceber",
  ];
  if (![...availableKeys, ...blockedKeys, ...receivableKeys].some((key) => key in source)) return null;

  return {
    available: pickAmount(source, availableKeys),
    blocked: pickOptionalAmount(source, blockedKeys),
    receivable: pickOptionalAmount(source, receivableKeys),
  };
}

const getBalanceFromLatestTransaction = (transactions: ValidaPayTransaction[]): ValidaPayBalance | null => {
  const latest = [...transactions]
    .filter((transaction) => transaction.balanceAfter !== undefined || transaction.balance_after !== undefined)
    .sort((left, right) => {
      const rightDate = new Date(right.createdAt ?? right.date ?? 0).getTime();
      const leftDate = new Date(left.createdAt ?? left.date ?? 0).getTime();
      return rightDate - leftDate;
    })[0];
  if (!latest) return null;

  return {
    available: toAmount(latest.balanceAfter ?? latest.balance_after),
    blocked: null,
    receivable: null,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    if (!supabaseUrl || !anonKey || !serviceKey || !dbUrl) return json({ error: "Configuração incompleta" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(dbUrl, serviceKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Token inválido" }, 401);
    if (!(await isAdmin(adminClient, userData.user.id))) return json({ error: "Acesso restrito" }, 403);

    const body = await req.json().catch(() => ({})) as { period?: Period };
    const period: Period = body.period === "day" || body.period === "month" ? body.period : "year";
    const { start, end } = getPeriodBounds(period);

    const [validaPay, balance] = await Promise.all([
      fetchValidaPayTransactions(start, end),
      fetchValidaPayBalance().catch((balanceError) => {
        console.error("[admin-wallet-finance] Saldo ValidaPay:", balanceError);
        return null;
      }),
    ]);
    if (!validaPay.available) {
      return json({
        error: "ValidaPay não configurada",
        detail: "Configure VALIDAPAY_CLIENT_ID e VALIDAPAY_CLIENT_SECRET para consultar o extrato.",
      }, 503);
    }
    const resolvedBalance = balance ?? getBalanceFromLatestTransaction(validaPay.transactions);

    const validaRevenue = new Map<string, FinanceEvent>();
    const validaSales = new Map<string, FinanceEvent>();
    const validaRefunds = new Map<string, FinanceEvent>();
    const validaFees = new Map<string, FinanceEvent>();
    const validaWithdrawals = new Map<string, FinanceEvent>();
    const validaOtherDebits = new Map<string, FinanceEvent>();

    validaPay.transactions.forEach((transaction) => {
      const createdAt = transaction.createdAt ?? transaction.date;
      if (!createdAt || !isInRange(createdAt, start, end)) return;
      const type = normalize(transaction.type ?? transaction.direction);
      const category = normalize(transaction.category);
      const descriptor = `${type} ${category}`;
      const id = String(
        transaction.transactionId ??
        transaction.id ??
        transaction.referenceId ??
        `${type}-${category}-${transaction.amount}-${createdAt}`,
      );
      // O extrato da ValidaPay usa o valor líquido para os totais de Entrada e
      // Saída. `amount` é mantido como compatibilidade para respostas antigas.
      const amount = toAmount(transaction.netAmount ?? transaction.amount ?? transaction.grossAmount);
      if (amount <= 0) return;
      const event = { id, amount, createdAt };
      const isCredit = ["CREDIT", "CREDITO", "ENTRADA"].includes(type);
      const isDebit = ["DEBIT", "DEBITO", "SAIDA", "BLOQUEIO"].includes(type);

      if (isCredit) {
        validaRevenue.set(id, event);
        const looksLikeSale =
          !!transaction.chargeId ||
          !!transaction.customer?.name ||
          ["PAYMENT", "PAGAMENTO", "PIX_IN", "CHARGE", "COBRANCA"].some((word) => descriptor.includes(word));
        if (looksLikeSale) validaSales.set(id, event);
        return;
      }
      if (!isDebit) return;
      if (["REFUND", "REEMBOLSO", "CHARGEBACK", "ESTORNO"].some((word) => descriptor.includes(word))) {
        validaRefunds.set(id, event);
      } else if (["WITHDRAWAL", "WITHDRAW", "SAQUE", "TRANSFER"].some((word) => descriptor.includes(word))) {
        validaWithdrawals.set(id, event);
      } else if (["FEE", "FEES", "TAX", "TAXA", "COST", "TARIFA"].some((word) => descriptor.includes(word))) {
        validaFees.set(id, event);
      } else {
        validaOtherDebits.set(id, event);
      }
    });

    const revenueEvents = [...validaRevenue.values()];
    const refundEvents = [...validaRefunds.values()];
    const feeEvents = [...validaFees.values()];
    const withdrawalEvents = [...validaWithdrawals.values()];
    const otherDebitEvents = [...validaOtherDebits.values()];
    const debitEvents = [...refundEvents, ...feeEvents, ...withdrawalEvents, ...otherDebitEvents];
    const sum = (events: FinanceEvent[]) => events.reduce((total, event) => total + event.amount, 0);
    const totalEntries = sum(revenueEvents);
    const refundAmount = sum(refundEvents);
    const feeAmount = sum(feeEvents);
    const withdrawalAmount = sum(withdrawalEvents);
    const totalDebits = sum(debitEvents);

    return json({
      provider: "validapay",
      source: "providers",
      activity_source: "validapay_webhooks",
      balance: resolvedBalance,
      balance_source: balance ? "wallet_balance" : resolvedBalance ? "latest_transaction" : null,
      period,
      range: { start: start.toISOString(), end: end.toISOString() },
      metrics: {
        approved_sales: validaSales.size,
        gross_revenue: Number(totalEntries.toFixed(2)),
        refunds: Number(refundAmount.toFixed(2)),
        fees: Number(feeAmount.toFixed(2)),
        costs: Number(totalDebits.toFixed(2)),
        withdrawals: Number(withdrawalAmount.toFixed(2)),
        net_revenue: Number((totalEntries - totalDebits).toFixed(2)),
      },
      series: {
        revenue: buildSeries(revenueEvents, period),
        costs: buildSeries(debitEvents, period),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-wallet-finance]", message);
    return json({ error: "Não foi possível consolidar o financeiro", detail: message }, 500);
  }
});
