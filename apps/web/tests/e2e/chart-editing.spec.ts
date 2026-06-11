import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

const DECK_ID = "11111111-2222-3333-4444-555555555555";

// A render-clean revision WITH a chart: two part-to-whole % facts → the automatic
// selection draws a pie; "表格" overrides to a table; "折線圖" cannot be honored
// (no time order) and degrades with a disclosure note (FR-003).
const revision = {
  revision: 1,
  slideDeck: {
    id: "deck_e2e_chart",
    title: "Chart editing e2e",
    purpose: "p",
    audience: "a",
    slides: [
      {
        id: "slide_001",
        slideKind: "content",
        type: "metrics",
        title: "市占結構",
        message: "兩大產品線的市占",
        outline: [{ text: "產品A 占 45%", emphasis: "evidence", sourceTrace: ["f1"] }],
        layout: "content-summary",
        layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
        contentBlocks: [{ kind: "chart_placeholder", content: {}, chartIntentId: "chart-0" }],
        sourceTrace: ["section_share"],
        speakerNotesDraft: "hidden notes"
      }
    ],
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  },
  designPlan: {
    designSystem: { palette: { accent: "#0f766e" }, visualDensity: "high" },
    slidePatternAssignments: [],
    chartTreatmentPlans: [
      { chartIntentId: "chart-0", treatment: "chart", labelingNotes: [], preservedContext: [] }
    ],
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
    consistencyValidation: {
      ok: true,
      checkedSlideIds: ["slide_001"],
      issues: [],
      fallbackUsed: false
    }
  },
  html: "<!doctype html><html><body>gen</body></html>",
  generationSummary: {
    slideCount: 1,
    sourceFactCount: 2,
    chartIntentCount: 1,
    uncertainClaimCount: 0,
    renderedCharts: [],
    selectedTheme: { kitName: "house", fallback: false }
  },
  chartIntents: [
    {
      id: "chart-0",
      title: "市占比較",
      sourceFacts: [
        { id: "f1", kind: "metric", value: "45%", sourceText: "產品A 占 45%" },
        { id: "f2", kind: "metric", value: "55%", sourceText: "產品B 占 55%" }
      ],
      recommendedVisuals: ["comparison"],
      rationale: "show share split"
    }
  ],
  origin: "generation",
  sourceJobId: "job_1",
  createdAt: "2026-06-05T00:00:00.000Z"
};

const detail = {
  id: DECK_ID,
  title: "Chart editing e2e",
  status: "ready",
  sourceContent: "s",
  deckBrief: { purpose: "p", audience: "a" },
  currentRevision: revision
};

async function openEditor(page: import("@playwright/test").Page) {
  await seedAuthenticatedSession(page);
  await page.route("**/api/themes", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ font: [], palette: [], style: [] })
    });
  });
  await page.route(`**/api/decks/${DECK_ID}`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(detail) });
  });
  await page.goto(`/decks/${DECK_ID}/edit`);
  await expect(page.getByText("市占比較")).toBeVisible();
}

test("US1 happy path: switch the visual, preview updates, save carries the operation", async ({
  page
}) => {
  let savedBody: { chartOperations?: unknown } = {};
  await page.route(`**/api/decks/${DECK_ID}/revisions`, async (route) => {
    savedBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ...revision, revision: 2, origin: "edit" })
    });
  });
  await openEditor(page);

  // The automatic selection draws a real pie in the LOCAL preview (zero network).
  const previewChart = page
    .frameLocator('iframe[title="即時預覽"]')
    .locator('[data-chart-intent-id="chart-0"]');
  await expect(previewChart).toHaveAttribute("data-chart-visual", "pie_donut");

  // Override to a table → the preview re-renders deterministically.
  await page.getByLabel("視覺類型").selectOption("table");
  await expect(page.getByText("有未儲存的變更")).toBeVisible();
  await expect(previewChart).toHaveAttribute("data-chart-visual", "table");
  await expect(page.getByText(/目前呈現：表格/)).toBeVisible();

  // Save → the structured operation (not contentBlocks) rides the request body.
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByText("已儲存版本 2")).toBeVisible();
  expect(savedBody.chartOperations).toEqual([
    { op: "set_visual", chartIntentId: "chart-0", visual: "table" }
  ]);
});

test("a line override without time order degrades honestly with a note", async ({ page }) => {
  await openEditor(page);

  await page.getByLabel("視覺類型").selectOption("line");

  // The validators refuse a line (no reliable time order) → degraded + disclosed.
  await expect(page.getByText("已自動降級")).toBeVisible();
  await expect(page.getByText(/使用者指定的視覺類型（折線圖）資料不符/)).toBeVisible();
  const previewChart = page
    .frameLocator('iframe[title="即時預覽"]')
    .locator('[data-chart-intent-id="chart-0"]');
  await expect(previewChart).not.toHaveAttribute("data-chart-visual", "line");
});
