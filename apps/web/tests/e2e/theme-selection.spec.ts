import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

const CATALOG = {
  font: [
    {
      id: "font-00",
      kind: "font",
      name: "Inter Sans",
      keywords: ["clean"],
      support: "full",
      styleKit: { fonts: { heading: '"Inter"', body: '"Inter"' } }
    }
  ],
  palette: [
    {
      id: "palette-00",
      kind: "palette",
      name: "Neutral Slate",
      keywords: ["neutral"],
      support: "full",
      styleKit: { accentHues: [{ base: "#111827" }], background: { css: "#fff" } }
    },
    {
      id: "palette-10",
      kind: "palette",
      name: "Acid Violet",
      keywords: ["vivid"],
      support: "full",
      styleKit: { accentHues: [{ base: "#7C3AED" }], background: { css: "#0b0b0b" } }
    }
  ],
  style: [
    {
      id: "style-00",
      kind: "style",
      name: "Minimal",
      keywords: ["minimal"],
      support: "full",
      styleKit: { effects: { cardRadiusPx: 12, cardShadow: "none" } }
    }
  ]
};

test("generation: browse the theme library, pick a palette, and submit it as themeSelection", async ({
  page
}) => {
  await seedAuthenticatedSession(page);

  await page.route("**/api/themes", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(CATALOG) });
  });
  await page.route("**/api/slides/preview-jobs", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "preview_job_theme",
        status: "queued",
        stage: "request_accepted",
        createdAt: "2026-06-02T14:00:00.000Z",
        updatedAt: "2026-06-02T14:00:00.000Z",
        statusUrl: "/api/slides/preview-jobs/preview_job_theme"
      })
    });
  });

  await page.goto("/");

  // The preset cards and the custom-theme picker are mutually-exclusive tabs; switch
  // to the custom-theme tab before browsing.
  await page.getByRole("tab", { name: "自選主題" }).click();
  // Open the theme browser from the design section summary.
  await page.getByRole("button", { name: /瀏覽全部主題/ }).click();
  const dialog = page.getByRole("dialog", { name: "瀏覽主題庫" });
  await expect(dialog).toBeVisible();

  // Switch to the palette axis and pick a specific palette.
  await dialog.getByRole("tab", { name: "配色" }).click();
  await dialog.getByText("Acid Violet").click();
  await dialog.getByRole("button", { name: "套用" }).click();
  await expect(dialog).toBeHidden();

  // The summary now reflects the picked palette.
  await expect(page.getByText("Acid Violet")).toBeVisible();

  // Fill the required fields and submit; the request carries themeSelection.
  await page.getByLabel("原始內容").fill("Onboarding conversion 從 18% 提升到 25%");
  await page.getByLabel("簡報用途").fill("PM planning review");
  await page.getByLabel("目標受眾").fill("Product and engineering leads");

  const createJobRequest = page.waitForRequest("**/api/slides/preview-jobs");
  await page.getByRole("button", { name: "生成簡報" }).click();

  expect((await createJobRequest).postDataJSON()).toMatchObject({
    themeSelection: { paletteId: "palette-10" }
  });
});
