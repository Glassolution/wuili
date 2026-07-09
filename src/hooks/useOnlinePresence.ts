import { useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";

const CHANNEL = "online-users";

/**
 * Track presence on a shared realtime channel.
 * - If `userId` is provided, this client publishes its presence.
 * - Returns the current number of distinct online users.
 */
export function useOnlinePresence(userId?: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: userId ?? `anon-${Math.random().toString(36).slice(2)}` } },
    });

    const recompute = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      setCount(Object.keys(state).length);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
