import { useEffect, useState } from "react";
import { TUTORIAL_EMBED_ID, TUTORIAL_LOADER_BASE, preloadVidalytics } from "@/lib/vidalyticsPreload";

/**
 * Vidalytics tutorial video embed.
 * O script principal já é pré-carregado no mount do dashboard (preloadVidalytics),
 * então aqui apenas garantimos que o player está inicializado e chamamos t.run(EMBED_ID).
 */
export default function TutorialVideoEmbed() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    preloadVidalytics();

    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = window as any;
      const d = "Vidalytics";
      const y = d.toLowerCase();
      const c = d + "L";
      const vli = v[y]?.["Loader"];
      const vec = v[d]?.["Embed"];
      if (vli && vec) {
        try {
          const t = new vec();
          t.run(TUTORIAL_EMBED_ID);
          setReady(true);
          return;
        } catch {
          /* retry */
        }
      } else if (vli && !vec) {
        try {
          vli.loadScript(TUTORIAL_LOADER_BASE + "player.min.js", () => {
            /* handled next tick */
          });
        } catch {
          /* retry */
        }
      }
      tries++;
      if (tries < 60) setTimeout(tick, 100);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <div
        id={TUTORIAL_EMBED_ID}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div
            className="h-10 w-10 rounded-full border-2 border-white/25 border-t-white"
            style={{ animation: "spin 900ms linear infinite" }}
          />
        </div>
      ) : null}
    </div>
  );
}
