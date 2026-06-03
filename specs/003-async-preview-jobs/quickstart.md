# Quickstart: Async Preview Jobs

## Prerequisites

- `.env` exists at repository root with backend LLM settings.
- Dependencies are installed with pnpm.
- 003 v1 uses in-process jobs; Redis/BullMQ is not required.

## Run Local Servers

```bash
pnpm --filter @slides-agent/api dev
pnpm --filter @slides-agent/web dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://localhost:5173/
```

## Manual Verification: Successful Job

1. Fill source content, purpose, audience, style direction, and language.
2. Submit generation.
3. Verify the UI leaves submit state within 2 seconds and shows progress.
4. Verify the progress state shows a stage such as queued, content planning, design planning, or HTML generation.
5. Wait for completion.
6. Verify the completed result displays:
   - HTML preview
   - design planning result
   - HTML validation result
   - generation summary
   - review report
   - slide JSON
   - downloadable HTML
7. Verify keyboard navigation in the preview.
8. Verify the downloaded HTML opens without backend.

## Manual Verification: Failed or Timeout Job

1. Trigger a controlled generation failure or use a timeout fixture.
2. Verify the UI reaches failed state within 5 minutes.
3. Verify the failure message is safe and actionable.
4. Verify the response does not expose API keys, provider raw errors, full prompts, model identifiers, or stack traces.
5. Use retry.
6. Verify retry creates a new job and does not overwrite the failed job's status.

## API Smoke Checks

Create a job:

```bash
curl -i -X POST http://localhost:3000/api/slides/preview-jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceContent": "Onboarding conversion increased from 18% to 25%.",
    "deckBrief": {
      "purpose": "PM planning review",
      "audience": "Product and engineering leads",
      "styleDirection": "operational product review",
      "language": "en-US"
    }
  }'
```

Poll status:

```bash
curl -i http://localhost:3000/api/slides/preview-jobs/<jobId>
```

## Automated Verification

Expected test commands after implementation:

```bash
pnpm --filter @slides-agent/domain test -- preview-job
pnpm --filter @slides-agent/contracts test
pnpm --filter @slides-agent/api test
pnpm --filter @slides-agent/web test
pnpm --filter @slides-agent/web test:e2e
pnpm --filter @slides-agent/domain build
pnpm --filter @slides-agent/contracts build
pnpm --filter @slides-agent/api build
pnpm --filter @slides-agent/web build
```

## Evidence To Record

- Job creation acknowledgement timing.
- Polling response timing.
- Stage transition evidence.
- Successful completed result evidence.
- Failed/timeout job evidence.
- Retry evidence.
- Screenshot or note for completed preview.
- Confirmation that Redis/BullMQ is intentionally deferred to future PR.

## Implementation Evidence

**Automated verification completed on 2026-06-02**

- `pnpm test`: PASS
  - Domain: 25 test files, 29 tests
  - Contracts: 4 test files, 12 tests
  - API: 12 test files, 24 tests
  - Web: 4 test files, 6 tests
- `pnpm --filter @slides-agent/domain build`: PASS
- `pnpm --filter @slides-agent/contracts build`: PASS
- `pnpm --filter @slides-agent/api build`: PASS
- `pnpm --filter @slides-agent/web build`: PASS
- `pnpm --filter @slides-agent/web test:e2e`: PASS, 2 Playwright tests
- `git diff --check`: PASS

**US1 evidence**

- API contract test covers `POST /api/slides/preview-jobs` returning `202 Accepted` style tracking details with `jobId`, `queued`, `request_accepted`, timestamps, and `statusUrl`.
- API validation test proves invalid preview requests are rejected before job creation.
- Web flow test covers accepted/running job progress display.

**US2 evidence**

- Domain stage transition test covers queued/running/succeeded transitions and stable succeeded result.
- API runner service test covers storing a successful preview result after stage updates.
- Playwright polling test covers create job, status polling, progress display, and completed preview rendering.

**US3 evidence**

- Domain timeout test covers 5-minute timeout failure with `PREVIEW_JOB_TIMEOUT`.
- Domain failure test covers sanitized generation failure without raw provider errors, prompts, API keys, stack traces, or model identifiers.
- API runner service test covers exception-to-`JobFailure` mapping.
- Web failure copy test covers timeout/generation/unavailable user-facing text and retry availability.
- Web progress panel test covers safe failed state and retry action.

**Manual verification status**

- Real LLM-backed successful long-running job, controlled failed job, timeout job, unavailable job, and retry behavior were not manually executed in this implementation pass.
- Manual verification path remains documented above and should be run before merging if runtime `.env` is intended to call the provider.

**Redis/BullMQ confirmation**

- No Redis/BullMQ dependency was added to `package.json`, `apps/api/package.json`, or `pnpm-lock.yaml`.
- Redis + BullMQ remains documented as a future durable queue PR path in `research.md` and `plan.md`.
