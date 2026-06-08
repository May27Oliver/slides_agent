import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

test("surfaces applied theme tokens and rendered-chart evidence (honest fallback)", async ({
  page
}) => {
  await seedAuthenticatedSession(page);

  await page.route("**/api/slides/preview-jobs", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "preview_job_transparency",
        status: "queued",
        stage: "request_accepted",
        createdAt: "2026-06-02T14:00:00.000Z",
        updatedAt: "2026-06-02T14:00:00.000Z",
        statusUrl: "/api/slides/preview-jobs/preview_job_transparency"
      })
    });
  });
  await page.route("**/api/slides/preview-jobs/preview_job_transparency", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(succeeded()) });
  });

  await page.goto("/");
  await page.getByLabel("原始內容").fill("收入占比與月營收成長");
  await page.getByLabel("簡報用途").fill("Quarterly review");
  await page.getByLabel("目標受眾").fill("Leadership");
  await page.getByRole("button", { name: "生成簡報" }).click();

  await expect(page.getByRole("heading", { name: "圖表渲染" })).toBeVisible();

  // Applied-theme tokens (from generationSummary.selectedTheme)
  await expect(page.getByText("warm-professional")).toBeVisible();
  await expect(page.getByText("Poppins / Noto Sans TC")).toBeVisible();
  await expect(page.getByText("陰影")).toBeVisible();
  await expect(page.getByText("光暈")).toBeVisible();

  // Rendered-chart evidence: a real bar, and an honest fallback with its note
  await expect(page.getByText("長條圖")).toBeVisible();
  await expect(page.getByText("文字", { exact: true })).toBeVisible();
  await expect(page.getByText("退回")).toBeVisible();
  await expect(page.getByText("資料不足以成圖，改以文字呈現。")).toBeVisible();
});

function succeeded() {
  return {
    jobId: "preview_job_transparency",
    status: "succeeded",
    stage: "completed",
    createdAt: "2026-06-02T14:00:00.000Z",
    updatedAt: "2026-06-02T14:00:03.000Z",
    result: {
      slideDeck: {
        title: "Quarterly review",
        slides: [{ id: "slide_001", title: "Slide One", message: "First message" }],
        reviewReport: {
          assumptions: [],
          omittedOrCompressedContent: [],
          uncertainClaims: [],
          chartingDecisions: [],
          humanReviewNotes: []
        }
      },
      designPlanningResult: {},
      previewArtifact: {
        html: "<!doctype html><html><body>Slide One</body></html>",
        htmlGenerationValidation: {
          status: "pass",
          selfContained: true,
          slideCountAndOrderPreserved: true,
          contentFidelityPreserved: true,
          designCompliancePreserved: true,
          speakerNotesHidden: true,
          keyboardNavigationPresent: true,
          externalResourceIssues: [],
          contentIssues: [],
          designIssues: [],
          repairAttempted: false,
          fallbackUsed: false
        },
        generationSummary: {
          slideCount: 1,
          sourceFactCount: 4,
          chartIntentCount: 2,
          uncertainClaimCount: 0,
          selectedTheme: {
            kitName: "warm-professional",
            ids: { style: "style-01", palette: "palette-02", font: "font-03" },
            fallback: false,
            accentHues: [
              { name: "rose", base: "#FF6B6B" },
              { name: "amber", base: "#FFC93C" }
            ],
            fonts: { heading: "Poppins", body: "Noto Sans TC" },
            visualDensity: "medium",
            structureFeatures: { radiusPx: 22, shadow: true, glow: true }
          },
          renderedCharts: [
            {
              slideId: "slide_001",
              chartIntentId: "c1",
              visualKind: "bar",
              fallback: false,
              notes: []
            },
            {
              slideId: "slide_001",
              chartIntentId: "c2",
              visualKind: "fallback_text",
              fallback: true,
              notes: [{ code: "fallback_used", message: "資料不足以成圖，改以文字呈現。" }]
            }
          ]
        }
      }
    },
    evidence: {
      stageTransitions: [{ stage: "completed", at: "2026-06-02T14:00:03.000Z" }],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "succeeded"
    }
  };
}
