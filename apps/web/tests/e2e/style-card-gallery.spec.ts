import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

test("style cards show preview metadata and submit the selected preset keyword", async ({
  page
}) => {
  await seedAuthenticatedSession(page);

  await page.route("**/api/slides/preview-jobs", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "preview_job_style_cards",
        status: "queued",
        stage: "request_accepted",
        createdAt: "2026-06-02T14:00:00.000Z",
        updatedAt: "2026-06-02T14:00:00.000Z",
        statusUrl: "/api/slides/preview-jobs/preview_job_style_cards"
      })
    });
  });
  await page.route("**/api/slides/preview-jobs/preview_job_style_cards", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "preview_job_style_cards",
        status: "running",
        stage: "design_planning",
        createdAt: "2026-06-02T14:00:00.000Z",
        updatedAt: "2026-06-02T14:00:01.000Z",
        evidence: {
          stageTransitions: [{ stage: "design_planning", at: "2026-06-02T14:00:01.000Z" }],
          validationAccepted: true,
          fallbackUsed: false,
          repairAttempted: false,
          finalStatus: "running"
        }
      })
    });
  });

  await page.goto("/");

  const stylePresetGroup = page.getByRole("group", { name: "風格預設" });
  await expect(stylePresetGroup.getByText("穩重資訊")).toBeVisible();
  await expect(stylePresetGroup.getByText("中高密度")).toBeVisible();

  await page.getByLabel("原始內容").fill("Onboarding conversion 從 18% 提升到 25%");
  await page.getByLabel("簡報用途").fill("PM planning review");
  await page.getByLabel("目標受眾").fill("Product and engineering leads");
  await stylePresetGroup.getByText("科技新創").click();
  const createJobRequest = page.waitForRequest("**/api/slides/preview-jobs");
  await page.getByRole("button", { name: "生成簡報" }).click();

  expect((await createJobRequest).postDataJSON()).toMatchObject({
    deckBrief: {
      styleDirection: "tech startup developer 科技"
    }
  });
});
