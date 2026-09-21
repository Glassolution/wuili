import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function detectDevice(): "mobile" | "tablet" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

// Tracks user session (start + heartbeat) and every page view.
export function useActivityTracker(userId: string | null | undefined) {
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const lastPathRef = useRef<string | null>(null);

  // Session lifecycle
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let cleanupListeners: (() => void) | null = null;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela de telemetria sem tipos gerados estáveis
      const { data, error } = await (supabase as any)
        .from("user_sessions")
        .insert({
          user_id: userId,
          device: detectDevice(),
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
        })
        .select("id")
        .maybeSingle();
      if (cancelled || error || !data?.id) {
        if (error) console.warn("[tracker] sessão não registrada:", error.message);
        return;
      }
      sessionIdRef.current = data.id as string;

      const beat = async () => {
        if (!sessionIdRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem acima
        await (supabase as any)
          .from("user_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", sessionIdRef.current);
      };
      heartbeat = setInterval(beat, 20_000);
      const onVisibility = () => {
        if (document.visibilityState === "visible") void beat();
      };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", () => void beat());

      cleanupListeners = () => {
        document.removeEventListener("visibilitychange", onVisibility);
      };
    })();

    return () => {
      cancelled = true;
      cleanupListeners?.();
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [userId]);

  // Page views
  useEffect(() => {
    if (!userId) return;
    const path = location.pathname;
    if (lastPathRef.current === path) return;
    const previous = lastPathRef.current;
    lastPathRef.current = path;

    const productMatch = path.match(/\/dashboard\/catalogo\/([^/?#]+)/);
    const productId = productMatch?.[1] ?? null;

    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem acima
      const { error } = await (supabase as any).from("user_page_views").insert({
        user_id: userId,
        path,
        title: typeof document !== "undefined" ? document.title.slice(0, 200) : null,
        product_id: productId,
        device: detectDevice(),
        session_id: sessionIdRef.current,
        referrer: previous ?? (typeof document !== "undefined" ? document.referrer.slice(0, 300) || null : null),
      });
      if (error) console.warn("[tracker] page view não registrada:", error.message);
    })();
  }, [userId, location.pathname]);
}
