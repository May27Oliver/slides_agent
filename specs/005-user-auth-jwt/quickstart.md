# Quickstart: User Auth JWT

**Feature**: 005-user-auth-jwt  
**Date**: 2026-06-03

## 1. Configure Auth

Set backend runtime configuration for v1:

```text
AUTH_JWT_SECRET=<long random secret>
AUTH_JWT_EXPIRES_IN_DAYS=30
AUTH_USERS_JSON=[{"id":"user_owner","username":"owner@example.com","displayName":"Owner","passwordHash":"<scrypt hash>","active":true}]
```

Do not commit real secrets or password hashes.

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

Expected coverage:

- Auth contract validation.
- JWT sign/verify/expiry/tamper behavior.
- Login success and sanitized failures.
- Slides endpoints protected by auth guard.
- Frontend localStorage persistence, logout, and `401` handling.
- Login-to-preview smoke path.
