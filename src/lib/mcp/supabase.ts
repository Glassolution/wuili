import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { ToolError } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // Malformed dictionaries can coexist with a working legacy key.
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}

export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente do usuário já confirmado como admin da Velo (RLS continua valendo). */
export async function adminClient(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw new ToolError(`Falha ao verificar permissão: ${error.message}`);
  if (data !== true) throw new ToolError("Apenas administradores da Velo podem usar estas ferramentas.");
  return supabase;
}

/** Tabelas liberadas para leitura. Ficam de fora tokens, credenciais e estados OAuth. */
export const READABLE_TABLES = [
  "affiliate_applications", "affiliate_clicks", "affiliate_conversions", "affiliate_withdrawal_requests",
  "affiliate_withdrawal_items", "affiliates", "atlas_usage_logs", "catalog_products", "category_mapping",
  "dropship_order_events", "dropship_orders", "dropship_worker_alerts", "feature_suggestions", "help_articles",
  "help_categories", "help_feed_posts", "landing_events", "ml_compliance_fixes", "ml_dimension_fixes",
  "ml_publish_errors", "ml_republication_log", "ml_seller_readiness", "mobile_home_events", "notifications",
  "orders", "payment_incidents", "pending_publications", "profiles", "referral_rewards", "referrals",
  "refund_requests", "sales_reports", "store_orders", "store_reviews", "subscription_migrations", "subscriptions",
  "support_ai_messages", "support_escalations", "support_messages", "support_tickets", "tiktok_events",
  "tiktok_shop_publications", "user_page_views", "user_products", "user_projects", "user_publications",
  "user_roles", "user_sessions", "validapay_webhook_events",
] as const;

/** Relatórios administrativos somente leitura. */
export const READ_REPORTS = [
  "rpc_admin_cohort_entry", "rpc_admin_cohort_funnel", "rpc_admin_error_breakdown", "rpc_admin_exit_pages",
  "rpc_admin_full_funnel", "rpc_admin_landing_funnel", "rpc_admin_paid_not_published",
  "rpc_admin_paid_not_published_summary", "rpc_admin_paid_without_seller", "rpc_admin_paid_without_seller_cohort",
  "rpc_admin_paying_daily", "rpc_admin_refund_reasons", "rpc_admin_signup_funnel", "rpc_admin_store_sales",
  "rpc_admin_top_pages", "rpc_admin_traffic_daily", "rpc_admin_affiliates_summary", "rpc_admin_affiliate_applications",
  "rpc_admin_affiliate_details", "rpc_admin_withdrawal_requests", "rpc_atlas_usage_summary",
  "rpc_active_subscribers_count", "rpc_landing_stats",
] as const;
