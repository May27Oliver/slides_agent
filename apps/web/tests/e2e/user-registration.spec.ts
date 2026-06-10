import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./auth-session";

const PENDING_USER = {
  id: "user_pending",
  username: "applicant@example.com",
  displayName: "Applicant",
  status: "pending",
  isAdmin: false,
  createdAt: "2026-06-10T00:00:00.000Z"
};

function json(route: import("@playwright/test").Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

test("a visitor can self-register and sees the pending-approval confirmation (US1)", async ({
  page
}) => {
  await page.route("**/api/auth/config", (route) =>
    json(route, 200, { registrationEnabled: true })
  );
  await page.route("**/api/auth/register", (route) => json(route, 201, PENDING_USER));

  await page.goto("/register");
  await page.getByLabel("Email").fill("applicant@example.com");
  await page.getByLabel("顯示名稱").fill("Applicant");
  await page.getByLabel("密碼").fill("abc123def4");
  await page.getByRole("button", { name: "註冊" }).click();

  await expect(page.getByText("註冊已送出")).toBeVisible();
  await expect(page.getByRole("link", { name: "回登入頁" })).toBeVisible();
});

test("an admin approves a pending registration from the dashboard (US2)", async ({ page }) => {
  await seedAuthenticatedSession(page, { isAdmin: true });

  let approved = false;
  await page.route("**/api/admin/users**", async (route) => {
    if (route.request().method() === "PATCH") {
      approved = true;
      return json(route, 200, { ...PENDING_USER, status: "active" });
    }
    return json(route, 200, {
      users: [{ ...PENDING_USER, status: approved ? "active" : "pending" }]
    });
  });

  await page.goto("/admin/users");
  await expect(page.getByText("applicant@example.com")).toBeVisible();
  await page.getByRole("button", { name: "核准" }).click();

  // After approval the list refreshes: the row is now active, so its actions
  // switch from approve/reject to disable/promote (and approve disappears).
  await expect(page.getByRole("button", { name: "停用" })).toBeVisible();
  await expect(page.getByRole("button", { name: "核准" })).toHaveCount(0);
  expect(approved).toBe(true);
});

test("a pending user who logs in sees the awaiting-approval message (US3)", async ({ page }) => {
  await page.route("**/api/auth/config", (route) =>
    json(route, 200, { registrationEnabled: false })
  );
  await page.route("**/api/auth/login", (route) =>
    json(route, 403, { code: "ACCOUNT_PENDING", message: "pending" })
  );

  await page.goto("/login");
  await page.getByLabel("帳號").fill("applicant@example.com");
  await page.getByLabel("密碼").fill("abc123def4");
  await page.getByRole("button", { name: "登入" }).click();

  await expect(page.getByText("帳號尚待管理員核准，核准後即可登入。")).toBeVisible();
});
