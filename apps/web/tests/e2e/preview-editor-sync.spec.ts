import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

const DECK_ID = "11111111-2222-3333-4444-555555555555";

const slideBase = {
  slideKind: "content",
  type: "content",
  message: "m",
  outline: [{ text: "一條重點", emphasis: "evidence", sourceTrace: ["f1"] }],
  layout: "content-summary",
  layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
  contentBlocks: [],
  sourceTrace: ["s1"],
  speakerNotesDraft: ""
};

const revision = {
  revision: 1,
  slideDeck: {
    id: "deck_sync",
    title: "Sync e2e",
    purpose: "p",
    audience: "a",
    slides: [
      { ...slideBase, id: "slide_001", title: "第一張標題" },
      { ...slideBase, id: "slide_002", title: "第二張標題" }
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
    chartTreatmentPlans: [],
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
      checkedSlideIds: ["slide_001", "slide_002"],
      issues: [],
      fallbackUsed: false
    }
  },
  html: "<!doctype html><html><body>gen</body></html>",
  generationSummary: {
    slideCount: 2,
    sourceFactCount: 1,
    chartIntentCount: 0,
    uncertainClaimCount: 0,
    renderedCharts: [],
    selectedTheme: { kitName: "house", fallback: false }
  },
  chartIntents: null,
  origin: "generation",
  sourceJobId: "job_1",
  createdAt: "2026-06-05T00:00:00.000Z"
};

const detail = {
  id: DECK_ID,
  title: "Sync e2e",
  status: "ready",
  sourceContent: "s",
  deckBrief: { purpose: "p", audience: "a" },
  currentRevision: revision
};

test("navigating inside the preview moves the edit panel to that slide (014)", async ({
  page
}) => {
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
  const title = page.getByRole("textbox", { name: "標題" });
  await expect(title).toHaveValue("第一張標題");

  // Click the deck runtime's own › button INSIDE the preview iframe.
  const preview = page.frameLocator('iframe[title="即時預覽"]');
  await preview.locator("#nextBtn").click();
  await expect(title).toHaveValue("第二張標題");

  // ‹ goes back, and the editor follows again.
  await preview.locator("#prevBtn").click();
  await expect(title).toHaveValue("第一張標題");
});
