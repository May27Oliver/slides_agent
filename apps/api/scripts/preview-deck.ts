/**
 * Dev harness — feed a markdown file through the DETERMINISTIC deck pipeline
 * (no front-end, no LLM, no DB) and see what charts your content produces.
 *
 *   pnpm --filter @slides-agent/api preview:deck [markdown-file] [styleDirection]
 *
 * Defaults to ../sample-deck-input.md at repo root. Prints, per chart, which
 * concrete visual the engine chose (bar/line/pie_donut/metric_card/...), the
 * selected theme, then writes a previewable HTML to apps/api/preview/deck.html.
 *
 * Theme candidates are read from the committed seed JSON (the same data `db:seed`
 * loads), so `science startup 科技` actually selects a tech style without a DB.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  generatePreviewDeck,
  projectSelectedThemeSummary,
  renderChartIntent,
  renderTemplateDeckArtifact,
  selectTheme,
  UiUxProMaxDesignPlanner
} from "@slides-agent/domain";

const ROOT = new URL("../../../", import.meta.url);
const SEED_DIR = new URL("apps/api/src/infra/db/seeds/", ROOT);
const OUT_DIR = fileURLToPath(new URL("apps/api/preview/", ROOT));

const mdArg = process.argv[2] ?? "sample-deck-input.md";
const styleDirection = process.argv[3];
const mdUrl = new URL(mdArg, ROOT);

function loadCandidates(file: string, kind: "style" | "palette" | "font") {
  const seeds = JSON.parse(readFileSync(new URL(file, SEED_DIR), "utf8")) as Array<{
    id: string;
    keywords?: string[];
    support: string;
    styleKit: unknown;
  }>;
  return seeds.map((seed) => ({
    id: seed.id,
    kind,
    keywords: seed.keywords ?? [],
    support: seed.support,
    styleKit: seed.styleKit
  }));
}

async function main(): Promise<void> {
  const sourceContent = readFileSync(mdUrl, "utf8");
  const deckBrief = {
    purpose: "year-end operations review",
    audience: "leadership",
    ...(styleDirection ? { styleDirection } : {})
  };

  const deckResult = generatePreviewDeck({ sourceContent, deckBrief } as never);

  const designPlanningResult = await new UiUxProMaxDesignPlanner().plan({
    slideDeck: deckResult.slideDeck,
    deckBrief,
    chartIntents: deckResult.chartIntents
  } as never);

  const candidates = [
    ...loadCandidates("theme-styles.json", "style"),
    ...loadCandidates("theme-palettes.json", "palette"),
    ...loadCandidates("theme-fonts.json", "font")
  ];
  const selected = selectTheme(deckBrief, candidates as never);
  const themed = { ...designPlanningResult, styleKit: selected.styleKit };

  // Per-chart summary: planned semantic → concrete visual the renderer chose.
  const planById = new Map(
    designPlanningResult.chartTreatmentPlans.map((plan) => [plan.chartIntentId, plan])
  );
  console.log(`\nsource: ${fileURLToPath(mdUrl)}`);
  console.log(
    `theme:  ${selected.styleKit.kitName}  (style=${selected.ids.style} palette=${selected.ids.palette} font=${selected.ids.font} fallback=${selected.fallback})\n`
  );
  console.log(`chart intents (${deckResult.chartIntents.length}):`);
  for (const intent of deckResult.chartIntents) {
    const plan = planById.get(intent.id);
    const rendered = renderChartIntent({
      intent,
      ...(plan ? { treatmentPlan: plan } : {}),
      styleKit: selected.styleKit,
      designSystem: themed.designSystem
    });
    const values = intent.sourceFacts.map((fact) => fact.value).join(", ");
    console.log(
      `  - "${intent.title}"  ${intent.recommendedVisuals.join("/")} → ${rendered.visualKind}  [${values}]`
    );
  }

  const artifact = renderTemplateDeckArtifact({
    deck: deckResult.slideDeck,
    designPlanningResult: themed,
    chartIntents: deckResult.chartIntents,
    selectedTheme: projectSelectedThemeSummary(selected, themed.designSystem.visualDensity)
  });
  mkdirSync(OUT_DIR, { recursive: true });
  const out = `${OUT_DIR}deck.html`;
  writeFileSync(out, artifact.html, "utf8");
  console.log(`\n✓ ${deckResult.slideDeck.slides.length} slides → ${out}`);
  console.log(`  open ${out}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
