import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

const DECK_ID = "11111111-2222-3333-4444-555555555555";

// A small render-clean revision so the editor loads and the live preview can draw.
const revision = {
  revision: 1,
  slideDeck: {
    id: "deck_e2e",
    title: "PM planning review",
    purpose: "p",
    audience: "a",
    slides: [
      {
        id: "slide_001",
        slideKind: "content",
        type: "metrics",
        title: "目標: conversion and response time",
        message: "目標",
        outline: [{ text: "Onboarding 18% → 25%", emphasis: "evidence", sourceTrace: ["f1"] }],
        layout: "content-summary",
        layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
        contentBlocks: [],
        sourceTrace: ["section_goal"],
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
  title: "PM planning review",
  status: "ready",
  sourceContent: "s",
  deckBrief: { purpose: "p", audience: "a" },
  currentRevision: revision
};

test("edits a deck, saves a new revision, and reflects the version", async ({ page }) => {
  await seedAuthenticatedSession(page);

  // 011: the editor mounts the theme picker, which fetches the catalogue — mock it so
  // the test is hermetic (no real backend / hanging request).
  await page.route("**/api/themes", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ font: [], palette: [], style: [] })
    });
  });
  await page.route(`**/api/decks/${DECK_ID}`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(detail) });
  });
  await page.route(`**/api/decks/${DECK_ID}/revisions`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ...revision, revision: 2, slideDeck: body.slideDeck, origin: "edit" })
    });
  });

  await page.goto(`/decks/${DECK_ID}/edit`);

  const title = page.getByRole("textbox", { name: "標題" });
  await expect(title).toHaveValue(/目標: conversion/);
  await title.fill("Edited via e2e");
  await expect(page.getByText("有未儲存的變更")).toBeVisible();

  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByText("已儲存版本 2")).toBeVisible();
});

test("switcher searches decks and routes into the editor", async ({ page }) => {
  await seedAuthenticatedSession(page);

  await page.route("**/api/themes", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ font: [], palette: [], style: [] })
    });
  });
  await page.route("**/api/decks", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        decks: [
          {
            id: DECK_ID,
            title: "PM planning review",
            status: "ready",
            updatedAt: "2026-06-10T00:00:00.000Z"
          }
        ]
      })
    });
  });
  await page.route(`**/api/decks/${DECK_ID}`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(detail) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /切換簡報/ }).click();
  await page.getByLabel("搜尋標題…").fill("PM planning");
  await page.getByText("PM planning review").click();

  await expect(page.getByRole("textbox", { name: "標題" })).toHaveValue(/目標: conversion/);
});
