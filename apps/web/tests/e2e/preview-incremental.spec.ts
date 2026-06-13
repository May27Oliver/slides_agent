import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

const DECK_ID = "11111111-2222-3333-4444-777777777777";

function slide(id: string, title: string) {
  return {
    id,
    slideKind: "content",
    type: "content",
    title,
    message: "訊息",
    outline: [{ text: "重點", emphasis: "evidence", sourceTrace: ["f1"] }],
    layout: "content-summary",
    layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
    contentBlocks: [],
    sourceTrace: ["s1"],
    speakerNotesDraft: ""
  };
}

const revision = {
  revision: 1,
  slideDeck: {
    id: "deck_e2e_inc",
    title: "Incremental deck",
    purpose: "p",
    audience: "a",
    slides: [slide("slide_001", "原始標題"), slide("slide_002", "第二張")],
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
    consistencyValidation: { ok: true, checkedSlideIds: [], issues: [], fallbackUsed: false }
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
  title: "Incremental deck",
  status: "ready",
  sourceContent: "s",
  deckBrief: { purpose: "p", audience: "a" },
  currentRevision: revision
};

/**
 * 016 (US1, SC-001/SC-004): editing the deck updates the preview WITHOUT reloading the
 * iframe document — verified by counting iframe `load` events (0 during an edit) and by
 * the patched slide reflecting the edit in place.
 */
test("editing patches the preview in place with zero iframe reloads", async ({ page }) => {
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
  const preview = page.frameLocator('iframe[title="即時預覽"]');
  await expect(preview.locator(".slide-title").first()).toHaveText("原始標題");

  // Instrument: count iframe reloads AND remember the iframe element + its srcdoc.
  await page.evaluate(() => {
    const f = document.querySelector("iframe[sandbox]") as HTMLIFrameElement;
    const w = window as unknown as {
      __reloads: number;
      __iframe: HTMLIFrameElement;
      __srcdoc: string;
    };
    w.__reloads = 0;
    w.__iframe = f;
    w.__srcdoc = f.getAttribute("srcdoc") ?? "";
    f.addEventListener("load", () => {
      w.__reloads += 1;
    });
  });
  // Let the initial document's own `load` settle, then zero the counter so we only
  // measure reloads caused by the EDIT.
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    (window as unknown as { __reloads: number }).__reloads = 0;
  });

  // Edit the title; the preview should patch in place.
  await page.getByRole("textbox", { name: "標題" }).fill("就地更新標題");
  await expect(preview.locator(".slide-title").first()).toHaveText("就地更新標題");

  const probe = await page.evaluate(() => {
    const w = window as unknown as {
      __reloads: number;
      __iframe: HTMLIFrameElement;
      __srcdoc: string;
    };
    const now = document.querySelector("iframe[sandbox]") as HTMLIFrameElement;
    return {
      reloads: w.__reloads,
      sameElement: now === w.__iframe,
      srcdocChanged: (now.getAttribute("srcdoc") ?? "") !== w.__srcdoc
    };
  });
  // No reload, no remount, srcDoc untouched — the edit went through the patch channel.
  expect(probe).toEqual({ reloads: 0, sameElement: true, srcdocChanged: false });
});
