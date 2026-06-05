# Data Model: User Auth JWT

**Feature**: 005-user-auth-jwt  
**Date**: 2026-06-03

## UserAccount

Represents a person or owner-approved identity allowed to use the service.

**Fields**:

- `id`: stable internal user id used in JWT subject and logs.
- `username`: login identifier entered by user.
- `displayName`: label shown in UI.
- `passwordHash`: configured password verifier data, never returned to frontend.
- `active`: whether the account may authenticate.
- `createdAt?`: optional operational evidence.
- `disabledAt?`: optional operational evidence for inactive accounts.

**Validation Rules**:

- `id` and `username` must be unique within runtime account config.
- `username` is case-normalized before lookup.
- inactive users cannot receive new sessions.
- `passwordHash` must never appear in public responses or frontend state.

## LoginCredential

Short-lived login form input.

**Fields**:

- `username`
- `password`

**Validation Rules**:

- Both fields required.
- Public error message is generic for missing/invalid/disabled account.
- Credentials are only used for authentication and never passed to LLM or generation flow.

## AuthSession

Signed authenticated state used by API and frontend.

**Fields**:

- `token`: signed JWT stored by frontend localStorage.
- `userId`: account id.
- `username`: username claim or lookup result.
- `displayName`: display label for UI.
- `issuedAt`
- `expiresAt`

**Validation Rules**:

- token must be signed with backend secret.
- token must include subject/user id and expiry.
- expired token is invalid.
- token for inactive or missing account is invalid even if signature is valid.
- frontend must clear token on logout or unauthorized/expired response.

## AuthFailure

Sanitized failure classification.

**Values**:

- `invalid_credentials`
- `inactive_account`
- `expired_session`
- `invalid_token`
- `missing_token`
- `unavailable`

**Rules**:

- Public UI uses generic messages: "登入失敗" or "登入已失效，請重新登入".
- API tests may assert internal classification through controlled test seams, but public response must not reveal account existence or password rules.

## ProtectedGenerationAccess

The policy boundary that decides whether a request may use generation resources.

**Protected Actions**:

- synchronous preview generation
- async preview job creation
- preview job status lookup
- preview job result retrieval through status response
- generated HTML download from protected UI

**Rules**:

- unauthenticated requests are rejected before validation starts expensive generation.
- failed auth must not enqueue jobs.
- successful auth does not alter generation request/response shape.

## State Transitions

```text
unauthenticated
  -> login_success -> authenticated
  -> login_failure -> unauthenticated

authenticated
  -> logout -> unauthenticated
  -> token_expired -> unauthenticated
  -> token_invalid -> unauthenticated
  -> account_disabled -> unauthenticated
```
