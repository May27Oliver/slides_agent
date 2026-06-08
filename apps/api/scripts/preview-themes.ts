/**
 * Dev-only visual harness for the feature 007 theme catalogue. For every
 * `support=full` style seed it composes a fitting `palette` + `font` via the real
 * `composeKit`, renders a sample deck with `renderTemplateDeck`, and writes
 * standalone HTML to apps/api/preview/themes/ for eyeball verification of the full
 * style gallery (A-grade structure + B-grade backdrop blur / glow / grain texture /
 * animated aurora+mesh). Reads the same committed seed JSON that seeds the DB, so
 * no DB / Redis / LLM is needed. Not wired into the app.
 *
 * Run: pnpm --filter @slides-agent/api preview:themes
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeKit, renderTemplateDeck } from "@slides-agent/domain";
import type {
  DesignStyleKit,
  FontStyleKit,
  PaletteStyleKit,
  StyleStyleKit,
  TemplateDeckInput
} from "@slides-agent/domain";

const SEED_DIR = new URL("../src/infra/db/seeds/", import.meta.url);
// Output lives inside the repo (apps/api/preview/themes/) so it's easy to find in
// Finder and survives reboots — unlike /tmp. Resolved from this script's location
// so it works no matter what cwd `pnpm` runs from. The folder is git-ignored.
const OUT_DIR = fileURLToPath(new URL("../preview/themes/", import.meta.url));

interface Seed {
  readonly id: string;
  readonly name: string;
  readonly support: string;
  readonly styleKit: unknown;
}

function load(file: string): Seed[] {
  return JSON.parse(readFileSync(new URL(file, SEED_DIR), "utf8")) as Seed[];
}

const styles = load("theme-styles.json");
const palettes = load("theme-palettes.json");
const fonts = load("theme-fonts.json");

function byId(seeds: Seed[], id: string): Seed {
  const seed = seeds.find((candidate) => candidate.id === id);
  if (!seed) {
    throw new Error(`seed not found: ${id}`);
  }
  return seed;
}

/** Picks readable text colours from the palette's base background luminance. */
function textColours(backgroundCss: string): { text: string; mutedText: string } {
  const hexes = backgroundCss.match(/#[0-9a-fA-F]{6}/gu) ?? ["#0F172A"];
  const base = hexes[hexes.length - 1]!.slice(1);
  const r = Number.parseInt(base.slice(0, 2), 16);
  const g = Number.parseInt(base.slice(2, 4), 16);
  const b = Number.parseInt(base.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5
    ? { text: "#F8FAFC", mutedText: "#CBD5E1" }
    : { text: "#1F2937", mutedText: "#475569" };
}

// Curated style -> palette pairing (also the gallery order: A-grade first, then
// B-grade). Any `full` style NOT listed here still renders, paired with the safe
// default palette and appended at the end — so new styles never silently drop out.
const PALETTE_FOR: Record<string, string> = {
  // A 級(結構風格)
  "style-00-minimalism": "palette-10-b2b-service",
  "style-10-flat-design": "palette-10-educational-app",
  "style-10-exaggerated-minimalism": "palette-10-portfolio-personal",
  "style-10-neumorphism": "palette-10-healthcare-app",
  "style-10-soft-ui-evolution": "palette-10-productivity-tool",
  "style-10-claymorphism": "palette-10-micro-saas",
  "style-10-brutalism": "palette-10-social-media-app",
  "style-10-neubrutalism": "palette-10-fintech-crypto",
  "style-10-vibrant-block-based": "palette-10-creative-agency",
  "style-10-dark-mode-oled": "palette-10-gaming",
  "style-10-dimensional-layering": "palette-10-nft-web3-platform",
  "style-10-organic-biophilic": "palette-10-sustainability-esg-platform",
  "style-10-nature-distilled": "palette-10-e-commerce-luxury",
  "style-10-e-ink-paper": "palette-10-portfolio-personal",
  // B 級(引擎 token 風格)
  "style-10-glassmorphism": "palette-10-financial-dashboard",
  "style-10-liquid-glass": "palette-10-gaming",
  "style-10-aurora-ui": "palette-10-nft-web3-platform",
  "style-10-gradient-mesh-aurora-evolved": "palette-10-gaming",
  "style-10-y2k-aesthetic": "palette-10-social-media-app",
  "style-10-vintage-analog-retro-film": "palette-10-e-commerce-luxury"
};
const FALLBACK_PALETTE = "palette-00-safe-default";

/** Derives a human token summary from the composed kit (B-grade tokens, else A-grade). */
function tokenNote(kit: DesignStyleKit): { grade: "A" | "B"; note: string } {
  const tokens: string[] = [];
  if (kit.effects.cardBackdropBlurPx !== undefined) {
    tokens.push(`backdrop blur ${kit.effects.cardBackdropBlurPx}`);
  }
  if (kit.effects.glow !== undefined) {
    tokens.push("glow");
  }
  if (kit.background.textureOverlay !== undefined) {
    tokens.push(`texture:${kit.background.textureOverlay}`);
  }
  if (kit.background.gradientAnimation !== undefined) {
    tokens.push(`anim:${kit.background.gradientAnimation.preset}`);
  }
  // Grade is decided by the B-grade engine tokens above; `ambient` is a background
  // treatment that A-grade styles can also opt into, so append it without re-grading.
  const grade: "A" | "B" = tokens.length > 0 ? "B" : "A";
  if (kit.background.ambient !== undefined) {
    tokens.push(`ambient:${kit.background.ambient}`);
  }
  if (tokens.length === 0) {
    return { grade, note: "A 級 — 結構(radius / shadow / motion)" };
  }
  return grade === "B"
    ? { grade, note: `B 級 — ${tokens.join(", ")}` }
    : { grade, note: `A 級 — 結構 + ${tokens.join(", ")}` };
}

const FONT = byId(fonts, "font-00-sans-default");

const SAMPLE_SLIDES = [
  {
    id: "s1",
    title: "設計風格一覽",
    message: "同一份範例簡報,套上不同的內建風格,用來肉眼比較整體調性。",
    outline: [
      "封面標題走 coverTitle 尺度",
      "背景由配對的 palette 提供",
      "卡片表面半透明,blur 才看得見"
    ]
  },
  {
    id: "s2",
    title: "卡片與層次",
    message: "每個項目都是一張卡片,套用 card-surface / card-shadow /(B 級)blur 或 glow。",
    outline: ["第一張卡片", "第二張卡片(不同色點)", "第三張卡片", "第四張卡片"]
  },
  {
    id: "s3",
    title: "動態與收尾",
    message: "Aurora / Mesh 背景會緩慢流動;開啟系統「減少動態」後動畫一律靜止。",
    outline: ["A 級靠結構表現個性", "B 級多一層引擎特效", "全部值都經過 sanitize"]
  }
];

function buildDeck(title: string) {
  return {
    id: "preview",
    title,
    purpose: "visual-qa",
    audience: "dev",
    slides: SAMPLE_SLIDES.map((slide) => ({
      ...slide,
      slideKind: "content",
      type: "content",
      outline: slide.outline.map((text, index) => ({ id: `${slide.id}-o${index}`, text })),
      layout: "title-bullets",
      layoutIntent: "comparison",
      contentBlocks: [],
      sourceTrace: [],
      speakerNotesDraft: ""
    })),
    reviewReport: {}
  };
}

mkdirSync(OUT_DIR, { recursive: true });

// Order: curated list first, then any unlisted `full` style appended.
const fullStyles = styles.filter((style) => style.support === "full");
const fullIds = new Set(fullStyles.map((style) => style.id));
const orderedIds = [
  ...Object.keys(PALETTE_FOR).filter((id) => fullIds.has(id)),
  ...fullStyles.map((style) => style.id).filter((id) => !(id in PALETTE_FOR))
];

interface Entry {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly paletteId: string;
  readonly grade: "A" | "B";
  readonly note: string;
}
const entries: Entry[] = [];

for (const styleId of orderedIds) {
  const styleSeed = byId(styles, styleId);
  const paletteId = PALETTE_FOR[styleId] ?? FALLBACK_PALETTE;
  const paletteSeed = byId(palettes, paletteId);
  const styleKit = composeKit({
    style: styleSeed.styleKit as StyleStyleKit,
    palette: paletteSeed.styleKit as PaletteStyleKit,
    font: FONT.styleKit as FontStyleKit
  });
  const { grade, note } = tokenNote(styleKit);
  const colours = textColours((paletteSeed.styleKit as PaletteStyleKit).background.css);

  const designPlanningResult = {
    styleKit,
    designSystem: {
      themeName: styleSeed.name,
      palette: {
        background: "#000000",
        surface: "#111111",
        text: colours.text,
        mutedText: colours.mutedText,
        accent: styleKit.accentHues[0]?.base ?? "#FF6B6B",
        warning: "#D97706"
      },
      typography: { headingFamily: "", bodyFamily: "", scale: "presentation" },
      spacing: { unit: 8, slidePadding: 64, blockGap: 16 },
      visualDensity: "medium",
      layoutGrid: "16:9",
      slidePatterns: [],
      chartStyle: "minimal"
    },
    slidePatternAssignments: [
      {
        slideId: "s1",
        primaryPattern: "title-summary",
        density: "medium",
        layoutIntent: "narrative",
        rationale: ""
      }
    ]
  };

  const deck = buildDeck(`${styleSeed.name} — ${note}`);
  // Dev harness: only the fields renderTemplateDeck actually reads are populated
  // (styleKit, designSystem, slidePatternAssignments, deck.title/slides), so cast
  // through unknown to the full input type rather than hand-build every unused field.
  const { html } = renderTemplateDeck({
    deck,
    designPlanningResult
  } as unknown as TemplateDeckInput);
  const file = `${styleId}.html`;
  writeFileSync(`${OUT_DIR}${file}`, html, "utf8");
  entries.push({ id: styleId, name: styleSeed.name, file, paletteId, grade, note });
  console.log(`✓ ${grade}  ${styleId.padEnd(40)} → preview/themes/${file}`);
}

function listFor(grade: "A" | "B"): string {
  return entries
    .filter((entry) => entry.grade === grade)
    .map(
      (entry) =>
        `<li><a href="${entry.file}"><b>${entry.name}</b></a> <span class="note">${entry.note}</span> <small>${entry.paletteId}</small></li>`
    )
    .join("");
}

const aCount = entries.filter((entry) => entry.grade === "A").length;
const bCount = entries.filter((entry) => entry.grade === "B").length;

const index = `<!doctype html><meta charset="utf-8"><title>Theme gallery — ${entries.length} full styles</title>
<style>
  body{font-family:system-ui;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1f2937}
  h1{margin-bottom:4px} .sub{color:#64748b;margin-top:0}
  h2{margin-top:32px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
  ul{list-style:none;padding:0} li{margin:10px 0;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px}
  a{text-decoration:none;color:#2563eb} .note{color:#475569;font-size:.9em;margin-left:6px}
  small{color:#94a3b8;font-size:.8em;float:right}
</style>
<h1>設計風格一覽</h1>
<p class="sub">${entries.length} 個 <code>support=full</code> 風格(A 級 ${aCount} + B 級 ${bCount})。點開每一個用方向鍵 / 右下箭頭翻頁;Aurora / Mesh 背景會緩慢流動,開系統「減少動態」後靜止。</p>
<h2>A 級 — 結構風格</h2>
<ul>${listFor("A")}</ul>
<h2>B 級 — 引擎 token 風格</h2>
<ul>${listFor("B")}</ul>`;
writeFileSync(`${OUT_DIR}index.html`, index, "utf8");
console.log(`\n${entries.length} styles (A=${aCount}, B=${bCount}) → ${OUT_DIR}index.html`);
