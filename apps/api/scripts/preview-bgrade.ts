/**
 * Dev-only visual harness for feature 007 US3 B-grade tokens. Composes each
 * upgraded B-grade `style` seed with a fitting `palette` + `font` seed via the
 * real `composeKit`, renders a sample deck with `renderTemplateDeck`, and writes
 * standalone HTML to /tmp/bgrade-preview/ for eyeball verification (backdrop blur,
 * glow, grain texture, animated aurora/mesh gradient). Not wired into the app.
 *
 * Run: node --import tsx scripts/preview-bgrade.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { composeKit, renderTemplateDeck } from "@slides-agent/domain";
import type {
  FontStyleKit,
  PaletteStyleKit,
  StyleStyleKit,
  TemplateDeckInput
} from "@slides-agent/domain";

const SEED_DIR = new URL("../src/infra/db/seeds/", import.meta.url);
const OUT_DIR = "/tmp/bgrade-preview/";

interface Seed {
  readonly id: string;
  readonly name: string;
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

// style id -> palette pairing chosen to make the engine token visible.
const PAIRINGS: ReadonlyArray<{ style: string; palette: string; note: string }> = [
  {
    style: "style-10-glassmorphism",
    palette: "palette-10-financial-dashboard",
    note: "backdrop blur 18 over a dark vibrant scene"
  },
  {
    style: "style-10-liquid-glass",
    palette: "palette-10-gaming",
    note: "blur 24 + animated aurora layer"
  },
  {
    style: "style-10-aurora-ui",
    palette: "palette-10-nft-web3-platform",
    note: "animated aurora gradient"
  },
  {
    style: "style-10-gradient-mesh-aurora-evolved",
    palette: "palette-10-gaming",
    note: "animated mesh (no-repeat blobs)"
  },
  {
    style: "style-10-y2k-aesthetic",
    palette: "palette-10-social-media-app",
    note: "neon glow layered on card shadow"
  },
  {
    style: "style-10-vintage-analog-retro-film",
    palette: "palette-10-social-media-app",
    note: "grain texture overlay"
  }
];

const FONT = byId(fonts, "font-00-sans-default");

const SAMPLE_SLIDES = [
  {
    id: "s1",
    title: "B 級風格視覺驗收",
    message: "這份簡報用來肉眼確認 US3 的引擎 token 是否如預期渲染。",
    outline: [
      "封面標題使用 coverTitle 尺度",
      "背景由配對的 palette 提供",
      "卡片表面為半透明，blur 才看得見"
    ]
  },
  {
    id: "s2",
    title: "卡片與互動",
    message: "每個項目都是一張卡片，套用 card-surface / card-shadow / 可選 glow。",
    outline: ["第一張卡片", "第二張卡片帶不同色點", "第三張卡片", "第四張卡片"]
  },
  {
    id: "s3",
    title: "動態背景",
    message: "Aurora / Mesh 會緩慢流動；開啟系統的減少動態後應靜止。",
    outline: ["漸層錨在 .deck::after", "mesh 已加 no-repeat 避免破圖", "reduced-motion 一律凍結"]
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

const links: string[] = [];

for (const { style: styleId, palette: paletteId, note } of PAIRINGS) {
  const styleSeed = byId(styles, styleId);
  const paletteSeed = byId(palettes, paletteId);
  const styleKit = composeKit({
    style: styleSeed.styleKit as StyleStyleKit,
    palette: paletteSeed.styleKit as PaletteStyleKit,
    font: FONT.styleKit as FontStyleKit
  });
  const backgroundCss = (paletteSeed.styleKit as PaletteStyleKit).background.css;
  const colours = textColours(backgroundCss);

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
  const html = renderTemplateDeck({ deck, designPlanningResult } as unknown as TemplateDeckInput);
  const file = `${styleId}.html`;
  writeFileSync(`${OUT_DIR}${file}`, html, "utf8");
  links.push(
    `<li><a href="${file}"><b>${styleSeed.name}</b></a> — ${note} <small>(${paletteId})</small></li>`
  );
  console.log(`✓ ${styleId} → ${OUT_DIR}${file}`);
}

const index = `<!doctype html><meta charset="utf-8"><title>US3 B-grade preview</title>
<style>body{font-family:system-ui;max-width:760px;margin:40px auto;line-height:1.7}li{margin:8px 0}</style>
<h1>007 US3 — B 級風格視覺驗收</h1>
<p>點開每一個，用方向鍵 / 點右下箭頭翻頁。Aurora/Mesh 會緩慢流動；開系統「減少動態」後應靜止。</p>
<ul>${links.join("")}</ul>`;
writeFileSync(`${OUT_DIR}index.html`, index, "utf8");
console.log(`\nOpen → ${OUT_DIR}index.html`);
