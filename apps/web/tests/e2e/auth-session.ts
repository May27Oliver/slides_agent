import type { Page } from "@playwright/test";

const AUTH_STORAGE_KEY = "slides-agent.auth";
const EXPIRES_AT = "2099-01-01T00:00:00.000Z";

interface SessionUserOverrides {
  id?: string;
  username?: string;
  displayName?: string;
  isAdmin?: boolean;
}

/**
 * Seeds an authenticated session for e2e: writes the stored session to
 * localStorage AND mocks `GET /api/auth/me`, because AuthProvider reconciles the
 * stored session against /me on mount (FR-017a). Without the /me mock the fake
 * e2e token is rejected (401 from a real backend, or a proxy error in CI) and the
 * session is wiped → redirect to /login. The /me mock returns the SAME user so the
 * reconcile is a no-op and the seeded isAdmin is preserved.
 */
export async function seedAuthenticatedSession(page: Page, user: SessionUserOverrides = {}) {
  const sessionUser = {
    id: "user_e2e",
    username: "e2e@example.com",
    displayName: "E2E User",
    isAdmin: false,
    ...user
  };

  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    { key: AUTH_STORAGE_KEY, session: { token: "e2e-token", expiresAt: EXPIRES_AT, user: sessionUser } }
  );

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, expiresAt: EXPIRES_AT, user: sessionUser })
    })
  );
}
