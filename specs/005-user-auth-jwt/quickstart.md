# Quickstart: User Auth JWT

**Feature**: 005-user-auth-jwt  
**Date**: 2026-06-03

## 1. Configure Auth

Set backend runtime configuration for v1 (in `.env`):

```text
AUTH_JWT_SECRET=<long random secret>
AUTH_JWT_EXPIRES_IN=30d
AUTH_ACCOUNTS=[{"id":"user_owner","username":"owner@example.com","displayName":"Owner","passwordHash":"<scrypt hash>","active":true}]
```

Generate `passwordHash` with the helper script (do not commit real secrets/hashes):

```bash
pnpm auth:hash 'the-password'
```

## 2. Start Services

If 004 Redis/BullMQ is active, start Redis and worker as usual, then:

```bash
pnpm --filter @slides-agent/api dev
pnpm --filter @slides-agent/web dev
```

## 3. Manual Verification

### Login Required

1. Open the web app in a clean browser profile.
2. Confirm the login screen appears instead of the slide generation form.
3. Directly request `/api/slides/preview-jobs` without token.
4. Confirm response is `401` and no preview job is created.

### Successful Login

1. Enter a configured username and password.
2. Confirm the app shows the slide generation UI.
3. Create a preview job with representative source content.
4. Confirm the job follows existing queued/running/succeeded flow.

### Long-Lived Local Login

1. After login, reload the page.
2. Close and reopen the browser.
3. Confirm the app remains logged in while token is not expired.

### Logout

1. Click logout.
2. Confirm localStorage auth entry is removed.
3. Reload page and confirm login screen appears.
4. Try protected API call with old cleared state and confirm `401`.

### Expired or Tampered Token

1. Modify the stored token or use an expired fixture token.
2. Reload or call protected API.
3. Confirm frontend clears auth state and shows login screen.

### Multi-Tab

1. Open two tabs while logged in.
2. Logout in one tab.
3. Confirm the other tab no longer allows generation after auth state changes or next protected API response.

### Generated HTML Isolation

1. Generate a preview successfully.
2. Inspect iframe sandbox attribute.
3. Confirm generated `srcDoc` HTML does not contain the auth token and cannot read parent localStorage.

## 4. Automated Evidence

Run:

```bash
pnpm test
pnpm --filter @slides-agent/web test:e2e
```

## 5. Implementation status / evidence

**Implemented + automated (green):**

- domain `evaluate-login`/`evaluate-session` policy (8 tests); contracts `validateLoginRequest` (4).
- `auth-config` fail-fast + allowlist parse (5); `scrypt-password` hash/verify (4); `auth:hash` script.
- `LocalStrategy` / `JwtStrategy` validate (2 + 2); `LocalAuthGuard`/`JwtAuthGuard` sanitized 401 (4); `AuthController` login/me/logout (3).
- Preview endpoints carry `@UseGuards(JwtAuthGuard)`; `module-bootstrap` proves Auth DI resolves under tsx.
- Frontend `auth-storage` (3), `auth-client` (3), `AuthProvider` login/restore/logout/cross-tab (4); react-router protected route + login-aware fetch + logout button.

**Deferred:** the Playwright `auth-gated-preview` E2E (live login→generate happy path, SC-006) — backend guard/strategy units + frontend AuthProvider tests cover the logic; run the manual verification in §3 against a live API + Redis for the end-to-end smoke.
