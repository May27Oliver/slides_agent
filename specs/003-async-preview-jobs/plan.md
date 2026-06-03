# Implementation Plan: Async Preview Jobs

**Branch**: `003-async-preview-jobs` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-async-preview-jobs/spec.md`

## Summary

將 002 的同步 preview generation 改為非同步 preview job 流程：前端送出有效 request 後，API 先建立可追蹤的 job 並在 2 秒內回傳 job id；背景 in-process worker 執行既有 preview pipeline，更新 queued/running/succeeded/failed/expired 狀態與目前 stage；前端以 polling 顯示 progress，成功後呈現與 002 同形狀的 preview result，失敗時顯示 sanitized failure。003 v1 不引入 durable persistence、Redis、BullMQ 或 distributed workers；plan 保留 future PR：當需要跨 process persistence、restart-safe retry、worker pool 或多 API instance 時，引入 Redis + BullMQ。

**Artifact Language**: 本 plan 與相關 Spec Kit artifacts 使用繁體中文；domain model、schema keys、API field names、code identifiers 使用英文。

## Technical Context

**Language/Version**: TypeScript on Node.js `v20.19.5`

**Package Manager**: pnpm `10.30.3` with workspace packages under `apps/*` and `packages/*`.

**Primary Dependencies**: React + TypeScript frontend, NestJS API, shared TypeScript domain package, shared contracts package, existing backend-configured LLM adapters, existing HTML/design/domain pipeline. No new queue dependency for 003 v1.

**Storage**: In-memory preview job store for v1. No database, Redis, durable persistence, or artifact history. Completed/failed jobs are retained only for a bounded local/runtime review window.

**Testing**: TDD with domain job lifecycle tests, API contract/integration tests, frontend unit tests, and Playwright polling/progress tests. Existing 002 rendering/design/content tests remain the authority for completed preview result fidelity.

**Target Platform**: Local development web app and local NestJS API. Generated self-contained HTML still opens directly in browser after job success.

**Project Type**: Local web app with React frontend, NestJS backend, shared domain/contracts packages.

**Performance Goals**:

- Valid job creation acknowledgement visible within 2 seconds for 95% of local submissions.
- Poll status lookup returns within 500ms for in-memory jobs under normal local conditions.
- Running jobs update stage evidence at each major pipeline transition.
- Any job not completed within 5 minutes of creation must transition to failed with sanitized timeout failure.
- Successful completed job result must continue passing 002 schema, HTML validation, keyboard navigation, and responsive smoke checks.

**Constraints**:

- No Redis/BullMQ in 003 v1; future PR should introduce Redis + BullMQ when durable queue/worker behavior is required.
- No persistence, multi-user permissions, cancellation, distributed queue, publish-to-URL, PPTX export, full editor, or revision loop.
- Provider/model selection remains backend runtime configuration and never appears in public job creation/status/result/failure response fields.
- Job failure responses must not expose API keys, provider raw errors, full prompts, stack traces, model identifiers, or unrelated internal state.
- Async job execution must not change source content, slide order, title/message meaning, outline meaning, speaker-note factual content, review warnings, or design planning source-fidelity boundaries.
- Job result must use the same successful preview result shape as 002.
- Every new domain type/service/port must have a current consumer in 003 tasks; future-only Redis/BullMQ concepts must stay in research/plan notes until the future PR.

**Scale/Scope**:

- One local API process.
- Multiple concurrently tracked jobs in memory, bounded by local development needs.
- One latest job shown in frontend by default, while direct status lookup by job id remains possible.
- Representative input and output size follows 002: pasted source content producing 3-8 slides.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification First**: PASS. Accepted source is [spec.md](./spec.md). Clarify resolved the only high-impact ambiguity: jobs must fail if not completed within 5 minutes.
- **Behavior-Driven User Value**: PASS. User stories define Given/When/Then scenarios for job creation, polling/completion, and failure/retry; each is independently demonstrable and independently testable.
- **Source Fidelity**: PASS. Async execution wraps the existing 002 preview pipeline and must preserve source facts, numbers, dates, decisions, risks, owners, constraints, slide order, title/message semantics, outline semantics, and speaker-note factual content.
- **Reviewable Generation**: PASS. Successful jobs return the 002 preview result with slide deck, design planning result, preview artifact, validation summary, generation summary, and review report. Failed jobs preserve reviewer-safe evidence: job id, stage transitions, failed stage, timeout/failure category, and fallback usage.
- **Web-First Deliverable**: PASS. Self-contained HTML slides remain the successful preview deliverable; 003 only changes how long-running generation is tracked.
- **Backend-Configured LLM Boundary**: PASS. Job APIs do not expose provider/model choices. Internal evidence may record runtime configuration category without leaking model identifiers publicly.
- **Coherent Deck Design System**: PASS. 003 does not reinterpret style direction; it carries 002 `DesignPlanningResult` through job result unchanged on success.
- **Semantic Titles and Data Visualization**: PASS. 003 does not alter semantic title or ChartIntent rules; completed result validation continues through existing 002 tests.
- **Code Quality and Simplicity**: PASS WITH JUSTIFIED COMPLEXITY. New complexity is limited to job lifecycle, in-memory store, and in-process worker. Redis/BullMQ is intentionally deferred. See Complexity Tracking.
- **TDD and DDD**: PASS. First failing tests target job lifecycle domain behavior, job store/runner ports, API job creation/status contracts, timeout/failure behavior, and frontend polling. Domain types live in `*.types.ts`, ports in `*.port.ts`, executable job behavior in `*.service.ts` or clearly named behavior files.
- **Lean Test Scope**: PASS. 003 tests assert observable job behavior and reuse 002 tests for rendering/design/content fidelity to avoid duplication.
- **Consistent UX and Language**: PASS. Canonical terms: `PreviewJob`, `JobStatus`, `JobStage`, `PreviewResult`, `JobFailure`, `JobEvidence`, queued, running, succeeded, failed, expired, stage, retry, result.
- **Performance and Operational Evidence**: PASS. Response/status/timeout goals are explicit. Evidence artifacts include job lifecycle tests, API contract tests, polling tests, manual verification notes, and timing evidence.
- **Manual Verification Path**: PASS. Quickstart will verify a long-running job, progress states, successful completed preview, failure timeout path, retry, and no sensitive leakage.
- **Release Verification**: PASS. Successful job results must retain 002 slide JSON schema, HTML rendering, keyboard navigation, and responsive checks.

## Project Structure

### Documentation (this feature)

```text
specs/003-async-preview-jobs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── preview-job-api.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── modules/slides/
│   │   │   ├── slides.controller.ts
│   │   │   ├── slides.service.ts
│   │   │   ├── slides.module.ts
│   │   │   └── slides.tokens.ts
│   │   └── main.ts
│   └── test/
│       ├── slides-preview-jobs.contract.test.ts
│       └── slides-preview-jobs.service.test.ts
└── web/
    ├── src/
    │   └── features/slide-generation/
    │       ├── SlideGenerationFeature.tsx
    │       ├── SlideGenerationForm.tsx
    │       └── job-polling helpers/components
    └── tests/
        └── e2e/
            └── preview-job-polling.spec.ts

packages/
├── domain/
│   ├── src/
│   │   └── preview-job/
│   │       ├── preview-job.types.ts
│   │       ├── preview-job-store.port.ts
│   │       ├── preview-job-runner.port.ts
│   │       ├── preview-job.service.ts
│   │       └── preview-job-timeout.ts
│   └── test/
│       └── preview-job/
└── contracts/
    ├── src/
    └── schemas/
```

**Structure Decision**: Add a small `preview-job` domain area because job lifecycle is domain behavior around generation orchestration, not a controller detail. Keep in-memory implementation in API adapter/module layer. Keep Redis/BullMQ out of source until a future PR consumes those concepts.

## Complexity Tracking

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------------|------------|-------------------------------------|
| PreviewJob lifecycle domain area | Needed to make queued/running/succeeded/failed/expired, stage transitions, timeout, retry, and evidence testable outside controllers | Keeping all job state in `SlidesController` is simpler but mixes transport, lifecycle rules, failure policy, and worker orchestration |
| In-memory job store port plus API in-memory implementation | Needed so API can create jobs, worker can update them, and polling can read them without introducing durable storage | Direct module-level `Map` is simpler but hard to test, hard to replace, and would blur lifecycle behavior with Nest wiring |
| In-process background runner | Needed to return job acceptance within 2 seconds while existing generation continues asynchronously | Keeping synchronous POST is simpler but repeats the 002 timeout/user-blocking failure |
| Overall 5-minute job timeout | Needed to prevent permanent running jobs and make failure behavior testable | Only per-LLM-call timeout is simpler but multiple calls can still leave users waiting without a clear job-level bound |
| Deferring Redis + BullMQ | 003 v1 is local/single-process and does not need durable distributed queue behavior | Introducing Redis/BullMQ now would add infrastructure not required by current scope; future PR must add it when persistence, multi-process workers, or production retries are needed |

## Evidence Plan

- **Automated Evidence**: domain tests for job lifecycle and timeout; API contract tests for create/status/result/failure; service tests for runner success/failure; frontend tests for polling/progress/retry; Playwright test for job progress to completed preview.
- **Manual Verification**: quickstart steps for one long-running successful job, one controlled failure/timeout job, retry flow, completed HTML preview, and no sensitive error leakage.
- **Operational Evidence**: timing notes for job creation acknowledgement, polling response time, stage transitions, 5-minute timeout path, and completed result validation.
- **Decision Evidence**: research.md records in-process v1 choice, rejected synchronous POST, rejected immediate Redis/BullMQ, future Redis/BullMQ trigger conditions, and rejected Node `worker_threads`.

## Phase 0 Research Output

See [research.md](./research.md).

## Phase 1 Design Output

See [data-model.md](./data-model.md), [contracts/preview-job-api.md](./contracts/preview-job-api.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

PASS. Phase 1 artifacts preserve the planned boundaries: 003 v1 adds only in-memory preview jobs and polling around the existing 002 preview result contract; no durable persistence, Redis/BullMQ, distributed worker, cancellation, publishing, PPTX, full editor, or revision loop. Redis + BullMQ remains documented as the future durable queue path with explicit trigger conditions. Job lifecycle entities have near-term consumers in API contracts, frontend polling, and domain/API tests. Successful job results preserve 002 source fidelity, design planning, rendering validation, keyboard navigation, responsive checks, and review artifacts.
