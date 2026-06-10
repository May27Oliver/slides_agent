import type { Page } from "@playwright/test";

const AUTH_STORAGE_KEY = "slides-agent.auth";

interface SessionUserOverrides {
  id?: string;
  username?: string;
  displayName?: string;
  isAdmin?: boolean;
}

export async function seedAuthenticatedSession(page: Page, user: SessionUserOverrides = {}) {
  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: AUTH_STORAGE_KEY,
      session: {
        token: "e2e-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        user: {
          id: "user_e2e",
          username: "e2e@example.com",
          displayName: "E2E User",
          isAdmin: false,
          ...user
        }
      }
    }
  );
}
