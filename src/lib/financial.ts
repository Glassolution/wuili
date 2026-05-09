// Pure financial calculation functions for the dashboard

export type OrderStatus = "paid" | "approved" | "completed" | "refunded" | "pending" | "cancelled"
export type Period = "daily" | "weekly" | "monthly"

export interface OrderRow {
  id: string
  total: number
  cost: number
  fees: number
  status: OrderStatus | string
  created_at: string
}

export interface FinancialSummary {
  revenue: number
  costs: number
  fees: number
  profit: number
  margin: number
}

export interface SalesAnalyticsResult {
  labels: string[]
  current: number[]
  previous: number[]
}

export interface CashflowDataPoint {
  m: string
  income: number
  expense: number
  savings: number
}

const ACTIVE_STATUSES = ["paid", "approved", "completed"]

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const DAY_LABELS   = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const WEEK_LABELS  = ["S1", "S2", "S3", "S4"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function weekOfMonthLabel(date: Date): string {
  const day = date.getDate()
  if (day <= 7)  return "S1"
  if (day <= 14) return "S2"
  if (day <= 21) return "S3"
  return "S4"
}

/** Returns 0=Mon … 6=Sun index aligned to DAY_LABELS */
function dayOfWeekIndex(date: Date): number {
  // JS getDay(): 0=Sun, 1=Mon … 6=Sat → remap to Mon=0 … Sun=6
  return (date.getDay() + 6) % 7
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
}

function addYears(d: Date, n: number): Date {
  return new Date(d.getFullYear() + n, d.getMonth(), d.getDate())
}

// ── Public functions ──────────────────────────────────────────────────────────

export function calculateOrderProfit(order: OrderRow): number {
  return (order.total ?? 0) - (order.cost ?? 0) - (order.fees ?? 0)
}

export function getFinancialSummary(orders: OrderRow[]): FinancialSummary {
  const activeOrders   = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const refundedOrders = orders.filter(o => o.status === "refunded")

  const revenue = activeOrders.reduce((s, o) => s + (o.total ?? 0), 0)
               - refundedOrders.reduce((s, o) => s + (o.total ?? 0), 0)
  const costs   = activeOrders.reduce((s, o) => s + (o.cost  ?? 0), 0)
  const fees    = activeOrders.reduce((s, o) => s + (o.fees  ?? 0), 0)
  const profit  = revenue - costs - fees
  const margin  = revenue > 0 ? (profit / revenue) * 100 : 0

  return { revenue, costs, fees, profit, margin }
}

export function getSalesAnalytics(period: Period, orders: OrderRow[]): SalesAnalyticsResult {
  const now = new Date()

  let currentStart: Date, currentEnd: Date
  let previousStart: Date, previousEnd: Date
  let buckets: string[]
  let getBucket: (date: Date) => string

  if (period === "daily") {
    currentStart  = startOfDay(addDays(now, -6))
    currentEnd    = endOfDay(now)
    previousStart = startOfDay(addDays(now, -13))
    previousEnd   = endOfDay(addDays(now, -7))
    buckets       = DAY_LABELS
    getBucket     = (d) => DAY_LABELS[dayOfWeekIndex(d)]
  } else if (period === "weekly") {
    currentStart  = startOfMonth(now)
    currentEnd    = endOfMonth(now)
    previousStart = startOfMonth(addMonths(now, -1))
    previousEnd   = endOfMonth(addMonths(now, -1))
    buckets       = WEEK_LABELS
    getBucket     = weekOfMonthLabel
  } else {
    // monthly
    currentStart  = startOfYear(now)
    currentEnd    = endOfYear(now)
    previousStart = startOfYear(addYears(now, -1))
    previousEnd   = endOfYear(addYears(now, -1))
    buckets       = MONTH_LABELS
    getBucket     = (d) => MONTH_LABELS[d.getMonth()]
  }

  const currentMap  = new Map<string, number>(buckets.map(b => [b, 0]))
  const previousMap = new Map<string, number>(buckets.map(b => [b, 0]))

  for (const order of orders) {
    if (!ACTIVE_STATUSES.includes(order.status)) continue
    const date = new Date(order.created_at)
    if (isNaN(date.getTime())) continue
    const total = order.total ?? 0

    if (date >= currentStart && date <= currentEnd) {
      const bucket = getBucket(date)
      if (currentMap.has(bucket)) {
        currentMap.set(bucket, (currentMap.get(bucket) ?? 0) + total)
      }
    } else if (date >= previousStart && date <= previousEnd) {
      const bucket = getBucket(date)
      if (previousMap.has(bucket)) {
        previousMap.set(bucket, (previousMap.get(bucket) ?? 0) + total)
      }
    }
  }

  return {
    labels:   buckets,
    current:  buckets.map(b => currentMap.get(b) ?? 0),
    previous: buckets.map(b => previousMap.get(b) ?? 0),
  }
}

export function getCashflowData(orders: OrderRow[]): CashflowDataPoint[] {
  const now         = new Date()
  const currentYear = now.getFullYear()

  const incomeMap  = new Map<string, number>(MONTH_LABELS.map(m => [m, 0]))
  const expenseMap = new Map<string, number>(MONTH_LABELS.map(m => [m, 0]))

  for (const order of orders) {
    if (!ACTIVE_STATUSES.includes(order.status)) continue
    const date = new Date(order.created_at)
    if (isNaN(date.getTime())) continue
    if (date.getFullYear() !== currentYear) continue

    const label = MONTH_LABELS[date.getMonth()]
    incomeMap.set(label,  (incomeMap.get(label)  ?? 0) + (order.total ?? 0))
    expenseMap.set(label, (expenseMap.get(label) ?? 0) + (order.cost  ?? 0) + (order.fees ?? 0))
  }

  return MONTH_LABELS.map(m => {
    const income  = incomeMap.get(m)  ?? 0
    const expense = expenseMap.get(m) ?? 0
    return { m, income, expense, savings: income - expense }
  })
}

export function getPendingOrders(orders: OrderRow[]): OrderRow[] {
  return orders.filter(o => o.status === "pending")
}

// ── Period filtering ──────────────────────────────────────────────────────────

export interface PeriodBounds {
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
}

export function getPeriodBounds(period: Period): PeriodBounds {
  const now = new Date()
  if (period === "daily") {
    return {
      start:     startOfDay(now),
      end:       endOfDay(now),
      prevStart: startOfDay(addDays(now, -1)),
      prevEnd:   endOfDay(addDays(now, -1)),
    }
  }
  if (period === "weekly") {
    // Mon–Sun of current week
    const dayIdx = dayOfWeekIndex(now) // 0=Mon
    const weekStart = startOfDay(addDays(now, -dayIdx))
    const weekEnd   = endOfDay(addDays(weekStart, 6))
    const prevWeekStart = startOfDay(addDays(weekStart, -7))
    const prevWeekEnd   = endOfDay(addDays(weekStart, -1))
    return { start: weekStart, end: weekEnd, prevStart: prevWeekStart, prevEnd: prevWeekEnd }
  }
  // monthly
  return {
    start:     startOfMonth(now),
    end:       endOfMonth(now),
    prevStart: startOfMonth(addMonths(now, -1)),
    prevEnd:   endOfMonth(addMonths(now, -1)),
  }
}

/** Filter orders to those whose created_at falls within [start, end] */
export function filterOrdersByPeriod(orders: OrderRow[], start: Date, end: Date): OrderRow[] {
  return orders.filter(o => {
    const d = new Date(o.created_at)
    return !isNaN(d.getTime()) && d >= start && d <= end
  })
}

/** Build cashflow chart data grouped by the appropriate buckets for the period */
export function getCashflowDataForPeriod(orders: OrderRow[], period: Period): CashflowDataPoint[] {
  const { start, end } = getPeriodBounds(period)
  const periodOrders = filterOrdersByPeriod(orders, start, end)
    .filter(o => ACTIVE_STATUSES.includes(o.status))

  if (period === "daily") {
    // Group by hour (0–23), show every 4h for readability
    const HOUR_LABELS = ["00h","04h","08h","12h","16h","20h"]
    const incomeMap  = new Map<string, number>(HOUR_LABELS.map(h => [h, 0]))
    const expenseMap = new Map<string, number>(HOUR_LABELS.map(h => [h, 0]))
    for (const o of periodOrders) {
      const h = new Date(o.created_at).getHours()
      const bucket = HOUR_LABELS[Math.floor(h / 4)]
      incomeMap.set(bucket,  (incomeMap.get(bucket)  ?? 0) + (o.total ?? 0))
      expenseMap.set(bucket, (expenseMap.get(bucket) ?? 0) + (o.cost ?? 0) + (o.fees ?? 0))
    }
    return HOUR_LABELS.map(m => {
      const income  = incomeMap.get(m)  ?? 0
      const expense = expenseMap.get(m) ?? 0
      return { m, income, expense, savings: income - expense }
    })
  }

  if (period === "weekly") {
    const DAY_LABELS_PT = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]
    const incomeMap  = new Map<string, number>(DAY_LABELS_PT.map(d => [d, 0]))
    const expenseMap = new Map<string, number>(DAY_LABELS_PT.map(d => [d, 0]))
    for (const o of periodOrders) {
      const bucket = DAY_LABELS_PT[dayOfWeekIndex(new Date(o.created_at))]
      incomeMap.set(bucket,  (incomeMap.get(bucket)  ?? 0) + (o.total ?? 0))
      expenseMap.set(bucket, (expenseMap.get(bucket) ?? 0) + (o.cost ?? 0) + (o.fees ?? 0))
    }
    return DAY_LABELS_PT.map(m => {
      const income  = incomeMap.get(m)  ?? 0
      const expense = expenseMap.get(m) ?? 0
      return { m, income, expense, savings: income - expense }
    })
  }

  // monthly → group by week (S1–S4)
  const incomeMap  = new Map<string, number>(WEEK_LABELS.map(w => [w, 0]))
  const expenseMap = new Map<string, number>(WEEK_LABELS.map(w => [w, 0]))
  for (const o of periodOrders) {
    const bucket = weekOfMonthLabel(new Date(o.created_at))
    incomeMap.set(bucket,  (incomeMap.get(bucket)  ?? 0) + (o.total ?? 0))
    expenseMap.set(bucket, (expenseMap.get(bucket) ?? 0) + (o.cost ?? 0) + (o.fees ?? 0))
  }
  return WEEK_LABELS.map(m => {
    const income  = incomeMap.get(m)  ?? 0
    const expense = expenseMap.get(m) ?? 0
    return { m, income, expense, savings: income - expense }
  })
}
