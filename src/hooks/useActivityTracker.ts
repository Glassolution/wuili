import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

    (async () => {
      const { data, error } = await (supabase as any)
        .from("user_sessions")
        .insert({
          user_id: userId,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
        })
        .select("id")
        .maybeSingle();
      if (cancelled || error || !data?.id) return;
      sessionIdRef.current = data.id as string;

      const beat = async () => {
        if (!sessionIdRef.current) return;
        await (supabase as any)
          .from("user_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", sessionIdRef.current);
      };
      heartbeat = setInterval(beat, 20_000);
      const onVisibility = () => {
        if (document.visibilityState === "visible") void beat();
      };
      const onUnload = () => {
        if (!sessionIdRef.current) return;
        try {
          const url = `${(supabase as any).supabaseUrl}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`;
          const body = JSON.stringify({ last_seen_at: new Date().toISOString() });
          const key = (supabase as any).supabaseKey;
          // best-effort final beat
          navigator.sendBeacon?.(
            url + `&apikey=${encodeURIComponent(key)}`,
            new Blob([body], { type: "application/json" })
          );
        } catch {
          // ignore
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("beforeunload", onUnload);

      // cleanup captured in outer effect return
      (heartbeat as any)._cleanup = () => {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("beforeunload", onUnload);
      };
    })();

    return () => {
      cancelled = true;
      if (heartbeat) {
        (heartbeat as any)._cleanup?.();
        clearInterval(heartbeat);
      }
    };
  }, [userId]);

  // Page views
  useEffect(() => {
    if (!userId) return;
    const path = location.pathname;
    if (lastPathRef.current === path) return;
    lastPathRef.current = path;

    const productMatch = path.match(/\/dashboard\/catalogo\/([^/?#]+)/);
    const productId = productMatch?.[1] ?? null;

    void (supabase as any).from("user_page_views").insert({
      user_id: userId,
      path,
      title: typeof document !== "undefined" ? document.title.slice(0, 200) : null,
      product_id: productId,
    });
  }, [userId, location.pathname]);
}
