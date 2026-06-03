# Contract: Preview Job API

## POST `/api/slides/preview-jobs`

從已驗證的 preview generation request 建立非同步 preview job。

### Request

沿用 002 preview generation request body。

```json
{
  "sourceContent": "string",
  "deckBrief": {
    "purpose": "string",
    "audience": "string",
    "styleDirection": "string",
    "chartEmphasis": "string",
    "segmentationGuidance": "string",
    "language": "string"
  }
}
```

### Success Response

`202 Accepted`

```json
{
  "jobId": "preview_job_123",
  "status": "queued",
  "stage": "request_accepted",
  "createdAt": "2026-06-02T14:00:00.000Z",
  "updatedAt": "2026-06-02T14:00:00.000Z",
  "statusUrl": "/api/slides/preview-jobs/preview_job_123"
}
```

### Validation Failure

`400 Bad Request`

```json
{
  "code": "INVALID_PREVIEW_REQUEST",
  "message": "Preview request validation failed",
  "issues": ["deckBrief.purpose is required"]
}
```

## GET `/api/slides/preview-jobs/:jobId`

回傳目前 job state、完成結果或安全化失敗資訊。

### Queued/Running Response

`200 OK`

```json
{
  "jobId": "preview_job_123",
  "status": "running",
  "stage": "design_planning",
  "createdAt": "2026-06-02T14:00:00.000Z",
  "updatedAt": "2026-06-02T14:00:08.000Z",
  "evidence": {
    "stageTransitions": [
      { "stage": "request_accepted", "at": "2026-06-02T14:00:00.000Z" },
      { "stage": "content_planning", "at": "2026-06-02T14:00:01.000Z" },
      { "stage": "design_planning", "at": "2026-06-02T14:00:08.000Z" }
    ],
    "validationAccepted": true,
    "fallbackUsed": false,
    "repairAttempted": false,
    "finalStatus": "running"
  }
}
```

### Succeeded Response

`200 OK`

```json
{
  "jobId": "preview_job_123",
  "status": "succeeded",
  "stage": "completed",
  "createdAt": "2026-06-02T14:00:00.000Z",
  "updatedAt": "2026-06-02T14:00:42.000Z",
  "result": {
    "slideDeck": {},
    "designPlanningResult": {},
    "previewArtifact": {}
  },
  "evidence": {
    "stageTransitions": [],
    "validationAccepted": true,
    "fallbackUsed": false,
    "repairAttempted": false,
    "finalStatus": "succeeded"
  }
}
```

`result` 使用 002 preview response 的相同 shape。

### Failed Response

`200 OK`

```json
{
  "jobId": "preview_job_123",
  "status": "failed",
  "stage": "failed",
  "createdAt": "2026-06-02T14:00:00.000Z",
  "updatedAt": "2026-06-02T14:05:00.000Z",
  "failure": {
    "code": "PREVIEW_JOB_TIMEOUT",
    "message": "Preview generation did not complete in time.",
    "failedStage": "html_generation",
    "retryable": true,
    "retryGuidance": "Create a new preview job."
  },
  "evidence": {
    "stageTransitions": [],
    "validationAccepted": true,
    "fallbackUsed": false,
    "repairAttempted": false,
    "finalStatus": "failed",
    "failureCategory": "timeout"
  }
}
```

### Unavailable Response

`404 Not Found`

```json
{
  "code": "PREVIEW_JOB_UNAVAILABLE",
  "message": "Preview job is unavailable."
}
```

## Public Response Safety Rules

- Public responses 不得包含 provider raw errors。
- Public responses 不得包含 API keys。
- Public responses 不得包含 full prompts。
- Public responses 不得包含 model identifiers。
- Public responses 不得包含 stack traces。
- Public responses 不得包含 unrelated internal state。

## Polling Guidance

- Frontend 在 status 為 `queued` 或 `running` 時，每 1-2 秒 polling 一次。
- Frontend 在 status 為 `succeeded`、`failed`、`expired` 或 unavailable 時停止 polling。
- Frontend retry 必須透過 `POST /api/slides/preview-jobs` 建立新的 job。
