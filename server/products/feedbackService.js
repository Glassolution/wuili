import crypto from "node:crypto";
import { getProductCurationSupabase } from "./productCurationService.js";
import { invalidateUserRecommendations } from "./personalizedProductService.js";

const VALID_EVENTS = new Set([
  "product_viewed",
  "product_clicked_buy",
  "product_sold",
  "product_dismissed",
]);

const PREFERENCE_EVENT_WEIGHT = {
  product_viewed: 1,
  product_clicked_buy: 4,
  product_sold: 8,
};

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function safeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getProfileColumn(profile, camelName, snakeName) {
  if (profile && Object.prototype.hasOwnProperty.call(profile, camelName)) return camelName;
  if (profile && Object.prototype.hasOwnProperty.call(profile, snakeName)) return snakeName;
  return snakeName;
}

function getExperienceLevel(profile) {
  const level = profile?.experienceLevel ?? profile?.experience_level ?? "beginner";
  return ["beginner", "intermediate", "advanced"].includes(level) ? level : "beginner";
}

function buildEventId(userId, eventType, payload = {}) {
  const explicit =
    payload.eventId ??
    payload.event_id ??
    payload.id ??
    payload.metadata?.eventId ??
    payload.metadata?.event_id ??
    payload.metadata?.id;

  if (explicit) return String(explicit);

  const stableSource = [
    userId,
    eventType,
    payload.productId ?? payload.product_id ?? payload.cjProductId ?? payload.mlItemId,
    payload.orderId ?? payload.order_id ?? payload.mlOrderId ?? payload.metadata?.mlOrderId,
    payload.soldAt ?? payload.metadata?.soldAt,
  ].filter(Boolean).join(":");

  if (stableSource) {
    return crypto.createHash("sha256").update(stableSource).digest("hex");
  }

  return crypto.randomUUID();
}

function getProductId(payload = {}) {
  return String(
    payload.productId ??
    payload.product_id ??
    payload.cjProductId ??
    payload.cj_product_id ??
    payload.mlItemId ??
    payload.ml_item_id ??
    "",
  );
}

function getCategory(payload = {}) {
  return (
    payload.category ??
    payload.metadata?.category ??
    payload.product?.category ??
    payload.raw?.category ??
    null
  );
}

function buildSaleEntry(payload = {}) {
  return {
    productId: getProductId(payload),
    category: getCategory(payload),
    margin: payload.margin ?? payload.metadata?.margin ?? payload.profit_margin ?? null,
    soldAt: payload.soldAt ?? payload.sold_at ?? payload.metadata?.soldAt ?? new Date().toISOString(),
    orderId: payload.orderId ?? payload.order_id ?? payload.mlOrderId ?? payload.metadata?.mlOrderId ?? null,
  };
}

async function loadProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[product-feedback] perfil indisponível:", error.message);
    return {};
  }

  return data ?? {};
}

async function hasProcessedEvent(supabase, userId, eventId) {
  const { data, error } = await supabase
    .from("user_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.warn("[product-feedback] não foi possível checar idempotência:", error.message);
    return false;
  }

  return Boolean(data?.id);
}

async function saveEvent(supabase, userId, eventType, eventId, payload) {
  const { error } = await supabase.from("user_events").insert({
    user_id: userId,
    event_id: eventId,
    event_type: eventType,
    product_id: getProductId(payload) || null,
    category: getCategory(payload),
    metadata: payload.metadata ?? payload,
    created_at: new Date().toISOString(),
  });

  if (error) {
    if (String(error.code) === "23505") return false;
    throw error;
  }

  return true;
}

function updateCategoryPreferences(profile, payload, eventType) {
  const category = getCategory(payload);
  if (!category || !PREFERENCE_EVENT_WEIGHT[eventType]) return null;

  const preferencesColumn = getProfileColumn(profile, "categoryPreferences", "category_preferences");
  const preferredColumn = getProfileColumn(profile, "preferredCategories", "preferred_categories");
  const currentWeights = safeObject(profile?.[preferencesColumn]);
  const nextWeights = {
    ...currentWeights,
    [category]: toNumber(currentWeights[category], 0) + PREFERENCE_EVENT_WEIGHT[eventType],
  };

  const preferredCategories = Object.entries(nextWeights)
    .sort((a, b) => toNumber(b[1]) - toNumber(a[1]))
    .map(([categoryName]) => categoryName)
    .slice(0, 12);

  return {
    [preferencesColumn]: nextWeights,
    [preferredColumn]: preferredCategories,
  };
}

function updateSalesHistory(profile, payload) {
  const salesColumn = getProfileColumn(profile, "salesHistory", "sales_history");
  const experienceColumn = getProfileColumn(profile, "experienceLevel", "experience_level");
  const salesHistory = safeArray(profile?.[salesColumn]);
  const sale = buildSaleEntry(payload);

  const saleId = sale.orderId ?? sale.productId;
  const alreadyRecorded = saleId
    ? salesHistory.some((item) => String(item.orderId ?? item.order_id ?? item.productId ?? item.product_id) === String(saleId))
    : false;

  const nextSalesHistory = alreadyRecorded ? salesHistory : [sale, ...salesHistory].slice(0, 500);
  const confirmedSales = nextSalesHistory.length;
  const currentLevel = getExperienceLevel(profile);
  let nextLevel = currentLevel;

  if (currentLevel === "beginner" && confirmedSales >= 1) nextLevel = "intermediate";
  if (currentLevel === "intermediate" && confirmedSales >= 10) nextLevel = "advanced";

  return {
    [salesColumn]: nextSalesHistory,
    [experienceColumn]: nextLevel,
  };
}

function updateDismissedProducts(profile, payload) {
  const productId = getProductId(payload);
  if (!productId) return null;

  const dismissedColumn = getProfileColumn(profile, "dismissedProducts", "dismissed_products");
  const dismissedProducts = new Set(safeArray(profile?.[dismissedColumn]).map(String));
  dismissedProducts.add(productId);

  return {
    [dismissedColumn]: Array.from(dismissedProducts).slice(-1000),
  };
}

async function updateProfile(supabase, userId, patch) {
  if (!patch || Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", userId);

  if (error) {
    console.error("[product-feedback] erro ao atualizar perfil:", error.message, { userId, fields: Object.keys(patch) });
  }
}

export async function trackEvent(userId, eventType, payload = {}) {
  if (!userId) throw new Error("userId é obrigatório.");
  if (!VALID_EVENTS.has(eventType)) throw new Error(`eventType inválido: ${eventType}`);

  const supabase = getProductCurationSupabase();
  if (!supabase) {
    console.warn("[product-feedback] Supabase não configurado; evento ignorado.", { userId, eventType });
    return { tracked: false, reason: "supabase_not_configured" };
  }

  const eventId = buildEventId(userId, eventType, payload);

  try {
    if (await hasProcessedEvent(supabase, userId, eventId)) {
      console.log("[product-feedback] evento duplicado ignorado", { userId, eventType, eventId });
      return { tracked: false, duplicate: true, eventId };
    }

    const inserted = await saveEvent(supabase, userId, eventType, eventId, payload);
    if (!inserted) {
      console.log("[product-feedback] evento duplicado ignorado no insert", { userId, eventType, eventId });
      return { tracked: false, duplicate: true, eventId };
    }

    const profile = await loadProfile(supabase, userId);
    const patch = {
      ...(updateCategoryPreferences(profile, payload, eventType) ?? {}),
      ...(eventType === "product_sold" ? updateSalesHistory(profile, payload) : {}),
      ...(eventType === "product_dismissed" ? updateDismissedProducts(profile, payload) : {}),
      updated_at: new Date().toISOString(),
    };

    await updateProfile(supabase, userId, patch);

    if (eventType === "product_sold" || eventType === "product_dismissed") {
      await invalidateUserRecommendations(userId);
    }

    console.log("[product-feedback] evento processado", { userId, eventType, eventId });
    return { tracked: true, eventId };
  } catch (error) {
    console.error("[product-feedback] erro ao processar evento:", {
      userId,
      eventType,
      eventId,
      error: error.message,
    });
    throw error;
  }
}

export function trackEventFireAndForget(userId, eventType, payload = {}) {
  void trackEvent(userId, eventType, payload).catch((error) => {
    console.error("[product-feedback] evento assíncrono falhou:", {
      userId,
      eventType,
      error: error.message,
    });
  });
}

