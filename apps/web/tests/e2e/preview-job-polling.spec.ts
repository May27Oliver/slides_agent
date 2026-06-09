import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

test("polls preview job progress and renders completed preview", async ({ page }) => {
  await seedAuthenticatedSession(page);

  await page.route("**/api/slides/preview-jobs", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "preview_job_e2e",
        status: "queued",
        stage: "request_accepted",
        createdAt: "2026-06-02T14:00:00.000Z",
        updatedAt: "2026-06-02T14:00:00.000Z",
        statusUrl: "/api/slides/preview-jobs/preview_job_e2e"
      })
    });
  });
  let statusCalls = 0;
  await page.route("**/api/slides/preview-jobs/preview_job_e2e", async (route) => {
    statusCalls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(statusCalls === 1 ? runningResponse() : succeededResponse())
    });
  });

  await page.goto("/");
  await page.getByLabel("原始內容").fill("Onboarding conversion 從 18% 提升到 25%");
  await page.getByLabel("簡報用途").fill("PM planning review");
  await page.getByLabel("目標受眾").fill("Product and engineering leads");
  await page.getByRole("button", { name: "生成簡報" }).click();

  await expect(page.getByText("正在生成預覽")).toBeVisible();
  await expect(page.getByRole("heading", { name: "簡報預覽" })).toBeVisible();
});

function runningResponse() {
  return {
    jobId: "preview_job_e2e",
    status: "running",
    stage: "html_generation",
    createdAt: "2026-06-02T14:00:00.000Z",
    updatedAt: "2026-06-02T14:00:03.000Z",
    evidence: {
      stageTransitions: [{ stage: "html_generation", at: "2026-06-02T14:00:03.000Z" }],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "running"
    }
  };
}

function succeededResponse() {
  return {
    ...runningResponse(),
    status: "succeeded",
    stage: "completed",
    result: {
      slideDeck: {
        title: "PM planning review",
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
          sourceFactCount: 1,
          chartIntentCount: 0,
          uncertainClaimCount: 0
        }
      }
    },
    evidence: { ...runningResponse().evidence, finalStatus: "succeeded" }
  };
}
