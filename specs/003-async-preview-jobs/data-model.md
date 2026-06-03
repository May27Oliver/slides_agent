# Data Model: Async Preview Jobs

## PreviewJob

代表一次已接受的 preview generation request 與其生命週期。

**Fields**:

- `id`: 穩定的 job identifier。
- `status`: `JobStatus`。
- `stage`: `JobStage`。
- `createdAt`: job 建立時間。
- `updatedAt`: 最近一次狀態、階段、結果或失敗更新時間。
- `expiresAt`: job 可被視為 expired/unavailable 的時間。
- `request`: 已驗證的 preview generation request。
- `evidence`: `JobEvidence`。
- `result`: `PreviewResult`，只在 `status = succeeded` 時存在。
- `failure`: `JobFailure`，只在 `status = failed` 時存在。

**Rules**:

- `id` 在目前 runtime 內必須唯一。
- 只有通過 request validation 後才能建立 job。
- job 從 `createdAt` 起不得執行超過 5 分鐘。
- completed/failed job 被重複查詢時必須穩定回傳同一狀態與結果。
- retry 必須建立新的 job id，不得覆蓋原本 failed job 的狀態。

## JobStatus

使用者可見的 job 生命週期狀態。

**Values**:

- `queued`: job 已接受但尚未開始。
- `running`: job 正在處理。
- `succeeded`: job 已完成並有 `result`。
- `failed`: job 已失敗並有 `failure`。
- `expired`: job 曾經存在但已不再保留。
- `unavailable`: job id 不存在或無法查詢。

**Transitions**:

```text
queued -> running
queued -> failed
running -> succeeded
running -> failed
succeeded -> expired
failed -> expired
unknown lookup -> unavailable
```

無效 transition 必須被拒絕或忽略並留下 evidence；`succeeded` 或 `failed` job 不得回到 `running`。

## JobStage

代表目前或最後的 preview pipeline 階段。

**Values**:

- `request_accepted`
- `queued`
- `content_planning`
- `deck_planning`
- `design_planning`
- `html_generation`
- `html_validation`
- `repair_or_fallback`
- `completed`
- `failed`

**Rules**:

- stage 名稱必須在 UI/API/documentation 中一致使用。
- stage transition 必須更新 `updatedAt`，並 append 到 `JobEvidence.stageTransitions`。
- stage 只描述既有 002 pipeline 進度，不代表可以改寫內容語意。

## PreviewResult

成功完成的 job result，沿用 002 completed preview response shape。

**Fields**:

- `slideDeck`
- `designPlanningResult`
- `previewArtifact`

**Rules**:

- 必須保留 source fidelity 與 002 validation 行為。
- 必須通過 slide JSON schema、self-contained HTML validation、keyboard navigation、basic responsive smoke checks。

## JobFailure

安全化的失敗結果。

**Fields**:

- `code`: 安全 error code，例如 `PREVIEW_JOB_TIMEOUT`、`PREVIEW_GENERATION_FAILED`、`PREVIEW_JOB_UNAVAILABLE`。
- `message`: 使用者可讀的安全訊息。
- `failedStage`: `JobStage`。
- `retryable`: 是否可重試。
- `retryGuidance`: 簡短、安全的重試指引。

**Rules**:

- 不得包含 API keys、provider raw errors、full prompts、stack traces、model identifiers 或 hidden internal state。
- 必須標明 failed stage 與安全 failure category。

## JobEvidence

供 reviewer 使用、且不含敏感 provider 細節的 job traceability artifacts。

**Fields**:

- `acceptedAt`
- `stageTransitions`: 依時間排序的 stage/timestamp entries。
- `validationAccepted`: request validation 是否通過。
- `fallbackUsed`: 是否啟用 fallback。
- `repairAttempted`: 是否曾嘗試 repair。
- `timingMs`: 可選 timing summary。
- `finalStatus`
- `failureCategory`: failed job 才存在。

**Rules**:

- evidence 必須可安全供 reviewer 檢查，不得含 provider secrets。
- evidence 必須能追溯 accepted input、stage transitions、fallback/repair usage、final status、timeout/failure。

## PreviewJobStore

儲存與讀取 job 的 capability boundary。

**Operations**:

- 建立 accepted job。
- 標記 running/stage。
- 標記 succeeded 並保存 result。
- 標記 failed 並保存 failure。
- 依 id 查詢 job。
- expire old jobs。

**Rules**:

- 003 v1 implementation 為 in-memory。
- Future Redis/BullMQ PR 可以替換或適配此 boundary。

## PreviewJobRunner

非同步執行 job 的 capability boundary。

**Operations**:

- enqueue/start accepted job。
- 執行既有 preview generation pipeline。
- 更新 stages。
- 套用 5 分鐘 job timeout。
- 記錄 success/failure。

**Rules**:

- 必須保留 002 preview pipeline semantics。
- 不得在 public job state 暴露 provider/model details。
