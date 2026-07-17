import { useEffect } from "react";

const EMBED_ID = "vidalytics_embed_2YhLgNzzQFzg0MZP";
const LOADER_BASE = "https://fast.vidalytics.com/embeds/kW4WSpDT/2YhLgNzzQFzg0MZP/";

/**
 * Vidalytics tutorial video embed.
 * Loads the vendor's loader/player scripts on mount, preserving the
 * idempotency checks from the original IIFE so remounts don't duplicate work.
 */
export default function TutorialVideoEmbed() {
  useEffect(() => {
    // Replica fiel do snippet do vendor, adaptado para rodar em useEffect.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (function (v: any, i: Document, d: string, a: string, l: string) {
      let t: any;
      let s: HTMLScriptElement | undefined;
      const y = "" + d.toLowerCase();
      const c = d + "L";
      if (!v[d]) v[d] = {};
      if (!v[c]) v[c] = {};
      if (!v[y]) v[y] = {};
      const vl = "Loader";
      let vli = v[y][vl];
      let vsl = v[c][vl + "Script"];
      let vlf = v[c][vl + "Loaded"];
      const ve = "Embed";
      if (!vsl) {
        vsl = function (u: string, cb: () => void) {
          if (t) {
            cb();
            return;
          }
          s = i.createElement("script");
          s.type = "text/javascript";
          s.async = true;
          s.src = u;
          // @ts-expect-error legacy IE
          if (s.readyState) {
            // @ts-expect-error legacy IE
            s.onreadystatechange = function () {
              // @ts-expect-error legacy IE
              if (s!.readyState === "loaded" || s!.readyState === "complete") {
                // @ts-expect-error legacy IE
                s!.onreadystatechange = null;
                vlf = 1;
                cb();
              }
            };
          } else {
            s.onload = function () {
              vlf = 1;
              cb();
            };
          }
          i.getElementsByTagName("head")[0].appendChild(s);
        };
        v[c][vl + "Script"] = vsl;
      }
      vsl(l + "loader.min.js", function () {
        if (!vli) {
          const vlc = v[c][vl];
          vli = new vlc();
          v[y][vl] = vli;
        }
        vli.loadScript(l + "player.min.js", function () {
          const vec = v[d][ve];
          t = new vec();
          t.run(a);
        });
      });
    })(window, document, "Vidalytics", EMBED_ID, LOADER_BASE);
  }, []);

  return (
    <div
      id={EMBED_ID}
      style={{ width: "100%", position: "relative", paddingTop: "56.25%" }}
    />
  );
}
