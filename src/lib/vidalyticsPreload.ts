// Pré-carrega os scripts do Vidalytics para o vídeo tutorial.
// Injeta o loader assim que o dashboard monta, para que o player já esteja
// disponível quando o modal (auto ou manual) abrir.
const EMBED_ID = "vidalytics_embed_2YhLgNzzQFzg0MZP";
const LOADER_BASE = "https://fast.vidalytics.com/embeds/kW4WSpDT/2YhLgNzzQFzg0MZP/";

let preloaded = false;

export function preloadVidalytics() {
  if (typeof window === "undefined" || preloaded) return;
  preloaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = window as any;
    const d = "Vidalytics";
    const y = d.toLowerCase();
    const c = d + "L";
    if (!v[d]) v[d] = {};
    if (!v[c]) v[c] = {};
    if (!v[y]) v[y] = {};
    const vl = "Loader";
    if (v[c][vl + "Script"]) return; // já injetado

    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = LOADER_BASE + "loader.min.js";
    s.onload = () => {
      try {
        const vlc = v[c][vl];
        if (vlc) {
          const vli = new vlc();
          v[y][vl] = vli;
          vli.loadScript(LOADER_BASE + "player.min.js", () => {
            // player carregado; será usado quando o TutorialVideoEmbed rodar t.run()
          });
        }
      } catch {
        /* noop */
      }
    };
    document.head.appendChild(s);
  } catch {
    preloaded = false;
  }
}

export const TUTORIAL_EMBED_ID = EMBED_ID;
export const TUTORIAL_LOADER_BASE = LOADER_BASE;
