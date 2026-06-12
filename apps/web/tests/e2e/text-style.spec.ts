import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

const DECK_ID = "11111111-2222-3333-4444-666666666666";

// Legacy revision: bullets carry NO ids — the editor must backfill them lazily and
// persist them with the save (015 FR-015).
const revision = {
  revision: 1,
  slideDeck: {
    id: "deck_e2e_style",
    title: "Style deck",
    purpose: "p",
    audience: "a",
    slides: [
      {
        id: "slide_001",
        slideKind: "content",
        type: "content",
        title: "原始標題",
        message: "原始訊息",
        outline: [
          { text: "第一條重點", emphasis: "evidence", sourceTrace: ["f1"] },
          { text: "第二條重點", emphasis: "evidence", sourceTrace: ["f2"] }
        ],
        layout: "content-summary",
        layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
        contentBlocks: [],
        sourceTrace: ["s1"],
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
  },
  designPlan: {
    designSystem: { palette: { accent: "#0f766e" }, visualDensity: "medium" },
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
      checkedSlideIds: ["slide_001"],
      issues: [],
      fallbackUsed: false
    }
  },
  html: "<!doctype html><html><body>gen</body></html>",
  generationSummary: {
    slideCount: 1,
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
  title: "Style deck",
  status: "ready",
  sourceContent: "s",
  deckBrief: { purpose: "p", audience: "a" },
  currentRevision: revision
};

/**
 * 015 US3 (quickstart): pick XL + accent on the title → the live preview re-renders
 * with the inline override; Save sends the overrides AND the backfilled bullet ids;
 * the adopted post-save state keeps the toolbar selection (persistence round-trip).
 */
test("styles the title, previews it live, and persists overrides + bullet ids on save", async ({
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

  let savedBody: {
    slideDeck: {
      slides: Array<{
        outline: Array<{ id?: string }>;
        textStyleOverrides?: { title?: { sizeLevel?: string; colorToken?: string } };
      }>;
    };
  } | null = null;
  await page.route(`**/api/decks/${DECK_ID}/revisions`, async (route) => {
    savedBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ...revision,
        revision: 2,
        slideDeck: savedBody!.slideDeck,
        origin: "edit"
      })
    });
  });

  await page.goto(`/decks/${DECK_ID}/edit`);
  await expect(page.getByRole("textbox", { name: "標題" })).toHaveValue("原始標題");

  // Pick XL + accent on the title's toolbar.
  const titleToolbar = page.getByRole("group", { name: "文字樣式 標題" });
  await titleToolbar.getByRole("button", { name: "文字大小 XL" }).click();
  await titleToolbar.getByRole("button", { name: "文字顏色 強調" }).click();

  // The live preview (same domain renderer) shows the inline override.
  const preview = page.frameLocator('iframe[title="即時預覽"]');
  await expect(preview.locator(".slide-title")).toHaveAttribute(
    "style",
    /font-size:calc\(var\(--type-title\) \* 1\.6\);color:var\(--accent\)/
  );

  // Save: the request carries the override AND backfilled ids for legacy bullets.
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByText("已儲存版本 2")).toBeVisible();
  expect(savedBody).not.toBeNull();
  const savedSlide = savedBody!.slideDeck.slides[0]!;
  expect(savedSlide.textStyleOverrides?.title).toEqual({ sizeLevel: "XL", colorToken: "accent" });
  expect(savedSlide.outline.map((o) => o.id).every(Boolean)).toBe(true);

  // The adopted post-save state keeps the selection (persistence round-trip).
  await expect(titleToolbar.getByRole("button", { name: "文字大小 XL" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});
