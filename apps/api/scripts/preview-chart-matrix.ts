/**
 * 008 US5 — dev/test harness that renders EVERY supported chart visual inside
 * EVERY enabled 007 style, so a density/typography/background regression in
 * any one style cannot silently ship a broken chart.
 *
 * `buildChartMatrix()` is pure (no filesystem writes) so tests can assert
 * completeness + self-contained output directly. Running the file as a script
 * additionally writes per-case HTML, an index, and matrix.json under
 * apps/api/preview/chart-matrix/ for eyeball QA. Reads the same committed seed
 * JSON that seeds the DB — no DB / Redis / LLM needed.
 *
 * Run: pnpm --filter @slides-agent/api preview:chart-matrix
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeKit, renderChartIntent, renderTemplateDeck } from "@slides-agent/domain";
import type {
  ChartIntent,
  ChartTreatment,
  ChartTreatmentPlan,
  ChartVisualKind,
  DesignStyleKit,
  DesignSystem,
  FontStyleKit,
  PaletteStyleKit,
  SlideDeck,
  SourceFact,
  StyleStyleKit
} from "@slides-agent/domain";

const SEED_DIR = new URL("../src/infra/db/seeds/", import.meta.url);
const OUT_DIR = fileURLToPath(new URL("../preview/chart-matrix/", import.meta.url));

interface Seed {
  readonly id: string;
  readonly name: string;
  readonly support: string;
  readonly styleKit: unknown;
}

function load(file: string): Seed[] {
  return JSON.parse(readFileSync(new URL(file, SEED_DIR), "utf8")) as Seed[];
}

function byId(seeds: Seed[], id: string): Seed {
  const seed = seeds.find((candidate) => candidate.id === id);
  if (!seed) {
    throw new Error(`seed not found: ${id}`);
  }
  return seed;
}

/** One sample chart per ChartVisualKind, crafted to deterministically render it. */
interface VisualSample {
  readonly visual: ChartVisualKind;
  readonly title: string;
  readonly treatment: ChartTreatment;
  readonly facts: ReadonlyArray<{ value: string; sourceText: string }>;
}

const VISUAL_SAMPLES: readonly VisualSample[] = [
  {
    visual: "pie_donut",
    title: "收入占比",
    treatment: "chart",
    facts: [
      { value: "45%", sourceText: "產品A 45%" },
      { value: "30%", sourceText: "產品B 30%" },
      { value: "25%", sourceText: "產品C 25%" }
    ]
  },
  {
    visual: "line",
    title: "月營收趨勢",
    treatment: "timeline",
    facts: [
      { value: "$1.0M", sourceText: "Q1 2026 $1.0M" },
      { value: "$1.4M", sourceText: "Q2 2026 $1.4M" },
      { value: "$1.9M", sourceText: "Q3 2026 $1.9M" },
      { value: "$2.6M", sourceText: "Q4 2026 $2.6M" }
    ]
  },
  {
    visual: "bar",
    title: "區域營收",
    treatment: "chart",
    facts: [
      { value: "$2.3M", sourceText: "北區 $2.3M" },
      { value: "$1.8M", sourceText: "南區 $1.8M" },
      { value: "$1.2M", sourceText: "東區 $1.2M" },
      { value: "$0.9M", sourceText: "西區 $0.9M" }
    ]
  },
  {
    visual: "metric_card",
    title: "年度營收",
    treatment: "metric_card",
    facts: [{ value: "$2.3M", sourceText: "營收 $2.3M (↑18% YoY)" }]
  },
  {
    visual: "metric_group",
    title: "關鍵指標",
    treatment: "chart",
    facts: [
      { value: "$2.3M", sourceText: "營收 $2.3M" },
      { value: "45%", sourceText: "轉換 45%" },
      { value: "12 小時", sourceText: "回覆 12 小時" }
    ]
  },
  {
    visual: "table",
    title: "區域明細",
    treatment: "table",
    facts: [
      { value: "$2.3M", sourceText: "北區營收" },
      { value: "$1.8M", sourceText: "南區營收" },
      { value: "$1.2M", sourceText: "東區營收" }
    ]
  },
  {
    visual: "fallback_text",
    title: "市場展望",
    treatment: "fallback_text",
    facts: [{ value: "顯著成長", sourceText: "市場顯著成長" }]
  }
];

function toIntent(sample: VisualSample): ChartIntent {
  return {
    id: `chart_${sample.visual}`,
    title: sample.title,
    sourceFacts: sample.facts.map(
      (fact, index): SourceFact => ({
        id: `${sample.visual}_f${index}`,
        kind: "metric",
        value: fact.value,
        sourceText: fact.sourceText
      })
    ),
    recommendedVisuals: ["comparison"],
    rationale: "preview matrix sample"
  };
}

function toPlan(sample: VisualSample): ChartTreatmentPlan {
  return {
    chartIntentId: `chart_${sample.visual}`,
    treatment: sample.treatment,
    labelingNotes: [],
    preservedContext: []
  };
}

/** Picks readable text colours from the palette background luminance. */
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

function designSystemFor(
  styleKit: DesignStyleKit,
  name: string,
  backgroundCss: string
): DesignSystem {
  const colours = textColours(backgroundCss);
  return {
    themeName: name,
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
  };
}

function deckFor(sample: VisualSample): SlideDeck {
  return {
    id: `preview_${sample.visual}`,
    title: sample.title,
    purpose: "visual-qa",
    audience: "dev",
    slides: [
      {
        id: "s1",
        slideKind: "content",
        type: "metrics",
        title: sample.title,
        message: "008 chart × style preview",
        outline: [{ text: sample.title, emphasis: "evidence", sourceTrace: [] }],
        layout: "content-summary",
        layoutIntent: { priority: "metrics_first", density: "medium", emphasis: "numbers" },
        contentBlocks: [
          { kind: "chart_placeholder", content: {}, chartIntentId: `chart_${sample.visual}` }
        ],
        sourceTrace: [],
        speakerNotesDraft: ""
      }
    ],
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  };
}

export interface ChartMatrixCase {
  readonly styleId: string;
  readonly styleName: string;
  readonly chartVisual: ChartVisualKind;
  readonly file: string;
  /** The chart figure fragment alone (for self-contained assertions). */
  readonly chartHtml: string;
  /** The full standalone deck document (for eyeball QA + non-blank checks). */
  readonly docHtml: string;
  readonly ok: boolean;
  readonly notes: string[];
}

export interface ChartMatrix {
  readonly styleIds: string[];
  readonly visuals: ChartVisualKind[];
  readonly cases: ChartMatrixCase[];
}

// Reuse the curated style→palette pairing from the theme gallery; any unlisted
// full style falls back to the safe palette so new styles never drop out.
const FALLBACK_PALETTE = "palette-00-safe-default";

/**
 * Builds the full style × chart visual matrix in memory. Pure: no writes.
 */
export function buildChartMatrix(): ChartMatrix {
  const styles = load("theme-styles.json").filter((style) => style.support === "full");
  const palettes = load("theme-palettes.json");
  const fonts = load("theme-fonts.json");
  const font = byId(fonts, "font-00-sans-default");
  const safePalette = byId(palettes, FALLBACK_PALETTE);

  const visuals = VISUAL_SAMPLES.map((sample) => sample.visual);
  const cases: ChartMatrixCase[] = [];

  for (const styleSeed of styles) {
    const paletteSeed = safePalette;
    const styleKit = composeKit({
      style: styleSeed.styleKit as StyleStyleKit,
      palette: paletteSeed.styleKit as PaletteStyleKit,
      font: font.styleKit as FontStyleKit
    });
    const designSystem = designSystemFor(
      styleKit,
      styleSeed.name,
      (paletteSeed.styleKit as PaletteStyleKit).background.css
    );

    for (const sample of VISUAL_SAMPLES) {
      const intent = toIntent(sample);
      const rendered = renderChartIntent({
        intent,
        treatmentPlan: toPlan(sample),
        styleKit,
        designSystem
      });
      const docHtml = renderTemplateDeck({
        deck: deckFor(sample),
        designPlanningResult: {
          designSystem,
          styleKit,
          slidePatternAssignments: [],
          chartTreatmentPlans: [toPlan(sample)],
          visualHierarchyPlans: [],
          accessibilityNotes: {
            minContrastRatio: 4.5,
            colorContrastNotes: [],
            readingOrderNotes: [],
            keyboardNavigationNotes: [],
            manualVerificationNotes: []
          },
          designReviewNotes: {
            styleDirectionInterpretation: [],
            visualDensityDecision: "",
            rejectedSuggestions: [],
            htmlGenerationConstraints: [],
            manualVerificationNotes: []
          },
          consistencyValidation: { ok: true, checkedSlideIds: [], issues: [], fallbackUsed: false }
        },
        chartIntents: [intent]
      });
      const ok = rendered.visualKind === sample.visual;
      cases.push({
        styleId: styleSeed.id,
        styleName: styleSeed.name,
        chartVisual: sample.visual,
        file: `${styleSeed.id}__${sample.visual}.html`,
        chartHtml: rendered.html,
        docHtml,
        ok,
        notes: ok ? [] : [`expected ${sample.visual} but got ${rendered.visualKind}`]
      });
    }
  }

  return { styleIds: styles.map((style) => style.id), visuals, cases };
}

function writeArtifacts(matrix: ChartMatrix): void {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const entry of matrix.cases) {
    writeFileSync(`${OUT_DIR}${entry.file}`, entry.docHtml, "utf8");
  }
  const rows = matrix.styleIds
    .map((styleId) => {
      const name = matrix.cases.find((entry) => entry.styleId === styleId)?.styleName ?? styleId;
      const links = matrix.visuals
        .map((visual) => {
          const entry = matrix.cases.find((c) => c.styleId === styleId && c.chartVisual === visual);
          const flag = entry?.ok ? "" : " ⚠️";
          return entry ? `<a href="${entry.file}">${visual}${flag}</a>` : `<s>${visual}</s>`;
        })
        .join(" · ");
      return `<li><b>${name}</b><br><small>${links}</small></li>`;
    })
    .join("");
  const index = `<!doctype html><meta charset="utf-8"><title>Chart × style matrix</title>
<style>body{font-family:system-ui;max-width:920px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1f2937}
ul{list-style:none;padding:0}li{margin:10px 0;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px}
a{color:#2563eb;text-decoration:none;margin-right:4px}</style>
<h1>Chart × style matrix</h1>
<p>${matrix.styleIds.length} styles × ${matrix.visuals.length} visuals = ${matrix.cases.length} cases。⚠️ 表示退回了非預期 visual。</p>
<ul>${rows}</ul>`;
  writeFileSync(`${OUT_DIR}index.html`, index, "utf8");
  const summary = {
    styleIds: matrix.styleIds,
    visuals: matrix.visuals,
    cases: matrix.cases.map((entry) => ({
      styleId: entry.styleId,
      chartVisual: entry.chartVisual,
      file: entry.file,
      ok: entry.ok,
      notes: entry.notes
    }))
  };
  writeFileSync(`${OUT_DIR}matrix.json`, JSON.stringify(summary, null, 2), "utf8");
}

const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const matrix = buildChartMatrix();
  writeArtifacts(matrix);
  const failures = matrix.cases.filter((entry) => !entry.ok);
  console.log(
    `✓ ${matrix.cases.length} cases (${matrix.styleIds.length} styles × ${matrix.visuals.length} visuals) → ${OUT_DIR}index.html`
  );
  if (failures.length > 0) {
    // FR-014: a sample that did not render its intended visual is a regression —
    // fail the script (non-zero exit) so CI/maintainers cannot miss it.
    console.error(
      `✗ ${failures.length} cases fell back to an unintended visual: ${failures
        .map((f) => f.file)
        .join(", ")}`
    );
    process.exitCode = 1;
  }
}
