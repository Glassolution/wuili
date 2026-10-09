#!/usr/bin/env node
/**
 * Gera src/styles/admin-dark-classes.css: a versão noturna das cores fixas
 * (classes Tailwind como `bg-white`, `text-[#171715]`, `border-[#EEF1F6]`)
 * usadas nas páginas antigas do admin.
 *
 * Cada cor clara ganha um equivalente escuro calculado:
 *   - fundo claro neutro  → grafite (#171717 / #1b1b1b / #222)
 *   - fundo claro colorido → a mesma cor, translúcida
 *   - texto escuro         → texto claro
 *   - texto colorido       → a mesma cor, mais clara (para ter contraste)
 *   - borda clara          → borda escura
 * Cores médias (botões azuis, verdes etc.) ficam como estão.
 *
 * As regras só valem com o tema noturno ligado e fora das telas que já têm
 * cores próprias ([data-admin-native]).
 *
 * Rode de novo sempre que uma página do admin ganhar cores novas:
 *   node scripts/gerar-tema-noturno-admin.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tailwindColors = require("tailwindcss/colors");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = ["src/pages/admin", "src/components/admin"];
const OUTPUT = "src/styles/admin-dark-classes.css";
const SCOPE = '.velo-admin-root[data-admin-theme="dark"] .admin-page-surface';
const NOT_NATIVE = ":not([data-admin-native] *)";

const files = SOURCE_DIRS.flatMap((dir) =>
  readdirSync(join(root, dir))
    .filter((name) => name.endsWith(".tsx") && !name.startsWith("Old") && !name.includes(".test."))
    .map((name) => join(root, dir, name)),
);

const CLASS_RE =
  /(?<![\w-])(hover:)?(bg|text|border|divide)-(\[#[0-9a-fA-F]{3,8}\]|white|black|(?:slate|gray|zinc|neutral|stone|red|green|emerald|blue|amber|yellow|orange|rose|sky|indigo|violet|purple|teal|cyan|lime|pink)-\d{2,3})(?:\/(\d{1,3}|\[[0-9.]+\]))?(?![\w-])/g;

const found = new Set();
for (const file of files) {
  for (const match of readFileSync(file, "utf8").matchAll(CLASS_RE)) found.add(match[0]);
}

// ---------- cores ----------

const hexToRgb = (hex) => {
  let value = hex.replace("#", "");
  if (value.length === 3) value = [...value].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
};

const rgbToHsl = ([r, g, b]) => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
};

const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
const hsla = (h, s, l, a) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}% / ${a})`;

const resolveColor = (token) => {
  if (token === "white") return "#ffffff";
  if (token === "black") return "#000000";
  if (token.startsWith("[#")) return token.slice(1, -1);
  const [family, shade] = token.split("-");
  return tailwindColors[family]?.[shade] ?? null;
};

/**
 * Neutro = quase sem cor. Mede o croma (distância entre o canal mais forte e
 * o mais fraco) em vez da saturação HSL: assim cinzas "ardósia" como #0F172A
 * e #64748B, que fazem papel de preto e cinza, continuam neutros, enquanto
 * azul, verde e vermelho de verdade ficam coloridos.
 */
const NEUTRAL_CHROMA = { bg: 0.06, border: 0.06, divide: 0.06, text: 0.2 };
const isNeutral = (rgb, kind) => (Math.max(...rgb) - Math.min(...rgb)) / 255 < NEUTRAL_CHROMA[kind];

const darkFor = (kind, hex, alpha) => {
  const rgb = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(rgb);
  const neutral = isNeutral(rgb, kind);
  const withAlpha = (value) => (alpha === null ? value : value.replace(/^#([0-9a-f]{6})$/i, (_, v) => {
    const [r, g, b] = hexToRgb(v);
    return `rgb(${r} ${g} ${b} / ${alpha})`;
  }));

  if (kind === "bg") {
    if (neutral) {
      if (l >= 0.985) return withAlpha("#171717");
      if (l >= 0.955) return withAlpha("#1b1b1b");
      if (l >= 0.9) return withAlpha("#222222");
      if (l >= 0.75) return withAlpha("#2a2a2a");
      if (l < 0.2) return withAlpha("#262626");
      return null;
    }
    if (l >= 0.9) return hsla(h, Math.min(s, 0.8), 0.6, alpha === null ? 0.13 : +(0.13 * alpha).toFixed(3));
    if (l >= 0.75) return hsla(h, Math.min(s, 0.8), 0.6, alpha === null ? 0.22 : +(0.22 * alpha).toFixed(3));
    return null;
  }

  if (kind === "text") {
    if (neutral) {
      if (l > 0.97) return null; // texto branco: já é claro (botões coloridos)
      if (l < 0.2) return "#fafafa";
      if (l < 0.4) return "#e4e4e7";
      if (l < 0.55) return "#a1a1aa";
      if (l < 0.7) return "#8b8b93";
      return "#71717a";
    }
    if (l < 0.62) return hsl(h, Math.min(Math.max(s, 0.55), 0.9), 0.7);
    return null;
  }

  // borda / divisória
  if (neutral) {
    if (l > 0.97) return "#1f1f1f";
    if (l >= 0.75) return "#2a2a2a";
    return "#3f3f46";
  }
  if (l >= 0.75) return hsla(h, Math.min(s, 0.8), 0.6, 0.3);
  return null;
};

// ---------- seletores ----------

const escapeClass = (cls) => cls.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

const rules = [];
for (const cls of [...found].sort()) {
  const match = new RegExp(CLASS_RE.source).exec(cls);
  if (!match) continue;
  const [, hover, kind, token, rawAlpha] = match;
  const hex = resolveColor(token);
  if (!hex) continue;
  const alpha = rawAlpha === undefined ? null : rawAlpha.startsWith("[") ? Number(rawAlpha.slice(1, -1)) : Number(rawAlpha) / 100;
  const value = darkFor(kind, hex, alpha);
  if (!value) continue;

  const selector = `${SCOPE} .${escapeClass(cls)}${hover ? ":hover" : ""}${NOT_NATIVE}`;
  if (kind === "divide") {
    rules.push(`${selector} > :not([hidden]) ~ :not([hidden]) {\n  border-color: ${value} !important;\n}`);
  } else {
    const property = kind === "bg" ? "background-color" : kind === "text" ? "color" : "border-color";
    rules.push(`${selector} {\n  ${property}: ${value} !important;\n}`);
  }
}

const header = `/* Gerado por scripts/gerar-tema-noturno-admin.mjs — não edite à mão.
   Versão noturna das cores fixas das páginas antigas do admin
   (${found.size} classes encontradas, ${rules.length} regras). */\n\n`;
writeFileSync(join(root, OUTPUT), header + rules.join("\n\n") + "\n");
console.log(`${OUTPUT}: ${rules.length} regras a partir de ${found.size} classes em ${files.length} arquivos.`);
