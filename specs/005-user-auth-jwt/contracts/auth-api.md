# Auth API Contract

**Feature**: 005-user-auth-jwt  
**Date**: 2026-06-03

Base path: `/api/auth`

## POST `/api/auth/login`

Authenticate an allowed user and return long-lived browser session data.

### Request

```json
{
  "username": "owner@example.com",
  "password": "plain text password entered by user"
}
```

### Success `200`

```json
{
  "token": "<jwt>",
  "expiresAt": "2026-07-03T00:00:00.000Z",
  "user": {
    "id": "user_owner",
    "username": "owner@example.com",
    "displayName": "Owner"
  }
}
```

### Failure `401`

```json
{
  "code": "AUTH_INVALID",
  "message": "Login failed."
}
```

Public failure response MUST be identical for unknown username, wrong password, inactive account, and malformed credentials.

### Rate limited `429`

`POST /api/auth/login` is rate-limited per client IP (reuses the existing `RateLimitGuard`) to limit credential brute-forcing. The `429` response MUST NOT reveal whether an account exists.

## GET `/api/auth/me`

Return current authenticated user from bearer token.

### Headers

```text
Authorization: Bearer <jwt>
```

### Success `200`

```json
{
  "authenticated": true,
  "expiresAt": "2026-07-03T00:00:00.000Z",
  "user": {
    "id": "user_owner",
    "username": "owner@example.com",
    "displayName": "Owner"
  }
}
```

### Failure `401`

```json
{
  "code": "AUTH_REQUIRED",
  "message": "Login required."
}
```

## POST `/api/auth/logout`

Stateless logout acknowledgement. Frontend clears localStorage token before/after this call.

### Headers

```text
Authorization: Bearer <jwt>
```

### Success `204`

No body.

### Failure

If token is already missing or invalid, frontend still clears local state and treats user as logged out.

## Protected Existing Endpoints

All endpoints below require `Authorization: Bearer <jwt>`.

```text
POST /api/slides/preview
POST /api/slides/preview-jobs
GET  /api/slides/preview-jobs/:jobId
```

### Unauthorized `401`

```json
{
  "code": "AUTH_REQUIRED",
  "message": "Login required."
}
```

Auth protection MUST run before expensive preview generation or queue enqueue.

## Frontend Storage Contract

Frontend stores one JSON object in localStorage:

```json
{
  "token": "<jwt>",
  "expiresAt": "2026-07-03T00:00:00.000Z",
  "user": {
    "id": "user_owner",
    "username": "owner@example.com",
    "displayName": "Owner"
  }
}
```

Rules:

- Clear this value on logout.
- Clear this value on any protected API `401`.
- Do not copy this value into generated HTML, downloaded HTML, preview result, review report, or logs.
- Generated HTML iframe remains sandboxed without same-origin access.
