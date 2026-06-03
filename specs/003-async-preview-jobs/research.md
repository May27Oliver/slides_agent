# Research: Async Preview Jobs

**Feature**: `003-async-preview-jobs`
**Date**: 2026-06-02

## Decision: 003 v1 使用 in-process preview job queue

**Rationale**:

- 目前痛點是同步 HTTP request 等待多段 LLM workflow 導致 timeout 或 UI 卡住；不需要先解決跨 process persistence。
- 002 scope 已明確是 local preview、session-oriented、不做 persistence/publishing。
- In-process job queue 可以最小化 infrastructure，快速驗證 job creation、polling、stage transitions、completion/failure、retry。
- Constitution 要求新增複雜度需有 current consumer；Redis/BullMQ 在 003 v1 沒有 current durable persistence/multi-process consumer。

**Alternatives considered**:

- **維持同步 POST**: rejected，因為已觀察到 preview generation 會長時間無回應或在 proxy/client timeout 前無法回結果。
- **立即導入 Redis + BullMQ**: rejected for 003 v1，因為目前沒有 durable persistence、multi-process worker、restart-safe retry 或 distributed processing requirement；future PR 應導入。
- **Node `worker_threads`**: rejected，因為 preview generation 是 LLM/network I/O-bound workflow，不是 CPU-bound work；worker_threads 不能解決 durable queue、polling state 或 retry semantics。

## Decision: Redis + BullMQ 作為 future PR durable queue path

**Rationale**:

- 當需要跨 API process、worker pool、restart-safe retry、job persistence 或 production-grade queue monitoring 時，in-process queue 會不足。
- BullMQ 是 Redis-backed job queue，適合 Node.js background jobs、worker concurrency、retries、completed/failed state。
- NestJS 有 BullMQ integration，可在 future PR 將 current job port/runner/store 替換或適配到 durable queue。

**Alternatives considered**:

- **自建 Redis list queue**: rejected for future default，因為需要自行實作 retries、stalled jobs、status transitions、cleanup 與 monitoring semantics。
- **Keep in-process forever**: rejected for future production needs，因為 process restart 會丟 job，且不能水平擴展 worker。

## Decision: Job-level timeout 為 5 分鐘

**Rationale**:

- 5 分鐘比同步 HTTP/proxy timeout 長，足以容納多段 LLM calls 與 repair/fallback，但仍是清楚 bounded user experience。
- 測試可以 deterministic 地模擬 timeout，前端也能提供明確 failure/retry state。
- 單次 LLM API call 不設定 client-side timeout，必須等待 provider response 或底層網路錯誤；job-level timeout 是使用者可感知的最終保護線。

**Alternatives considered**:

- **2 分鐘**: rejected，可能對多段 semantic segmentation + design planning + HTML generation + repair/fallback 太短。
- **10 分鐘**: rejected，讓使用者等待太久，也延後失敗/重試。
- **只有 per-stage timeout**: rejected，無法保證整體 job user-facing bound。

## Decision: Polling instead of push updates for 003 v1

**Rationale**:

- Polling 足以支援 local preview progress state，且不需要新增 WebSocket/SSE infrastructure。
- API contract 明確：create job、get job status/result。前端可以每 1-2 秒查詢。
- 更容易測試 job lifecycle、failure、retry，且符合最小可行範圍。

**Alternatives considered**:

- **WebSocket/SSE**: rejected for 003 v1，因為需要額外 connection lifecycle、reconnect、server push behavior，對目前 local preview value 不必要。
- **不顯示 progress，只等完成**: rejected，因為使用者需要知道長時間生成仍在工作。

## Decision: 成功 result 沿用 002 preview response shape

**Rationale**:

- 003 解決 async lifecycle，不改 successful preview artifact contract。
- 前端既有 preview/result panels 可在 job succeeded 後重用。
- 避免同時修改 rendering/design/content semantics，降低 regression 風險。

**Alternatives considered**:

- **新增完全不同 result shape**: rejected，會破壞 002 contracts 並增加前端和 renderer 重工。

## Decision: Failure response 使用 sanitized JobFailure

**Rationale**:

- 需要讓使用者知道 failed、failedStage、safe code/message 和 retry guidance。
- 不允許 public response 泄漏 API key、provider raw errors、prompts、stack traces、model identifiers。
- Reviewer evidence 可保留 safe category、stage transitions、fallback usage、timing。

**Alternatives considered**:

- **直接回傳 provider error**: rejected，違反 backend-configured LLM boundary 和安全要求。
- **只回 generic failed**: rejected，reviewer 無法追溯失敗階段或判斷 retry 是否合理。
