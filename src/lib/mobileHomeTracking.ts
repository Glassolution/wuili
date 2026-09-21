import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "velo:mobile-home-session";

const getSessionId = () => {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};

export type MobileHomeEvent =
  | "home_view"
  | "search_started"
  | "search_submitted"
  | "category_clicked"
  | "banner_clicked"
  | "shortcut_clicked"
  | "checklist_clicked"
  | "checklist_completed"
  | "product_clicked"
  | "first_product_clicked"
  | "product_detail_view"
  | "product_detail_exit"
  | "product_detail_scroll"
  | "product_detail_action"
  | "import_flow_open"
  | "import_flow_exit"
  | "import_flow_step"
  | "import_flow_advance"
  | "import_flow_error"
  | "import_flow_complete"
  | "ml_connect_open"
  | "ml_connect_result"
  | "ml_prepare_open"
  | "ml_seller_not_ready"
  | "ml_seller_modal_open"
  | "ml_seller_video_play"
  | "ml_seller_recheck"
  | "ml_seller_ready"
  // Pagou antes de ter conta apta: medimos quantos ativam, em quanto tempo e
  // quantos desistem (o reembolso é cruzado por user_id em refund_requests).
  | "paid_without_seller"
  | "seller_ready_after_paid"
  | "pending_publication_queued"
  | "pending_publication_published"
  | "ml_reconnect_prompt"
  | "plans_open"
  | "plans_exit"
  | "plan_checkout_clicked"
  | "publish_result";

export const trackMobileHomeEvent = (
  userId: string | undefined,
  eventName: MobileHomeEvent,
  options: { detail?: string; productId?: string; elapsedMs?: number } = {},
) => {
  if (!userId) return;
  void supabase
    .from("mobile_home_events")
    .insert({
      user_id: userId,
      session_id: getSessionId(),
      event_name: eventName,
      detail: options.detail?.slice(0, 160),
      product_id: options.productId,
      elapsed_ms: options.elapsedMs,
    })
    .then(({ error }) => {
      if (error) console.warn("Falha ao medir interação da home", error.message);
    });
};