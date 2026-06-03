# Contract: Preview Job Queue (內部 API ↔ Worker)

> **公開 HTTP 契約不變**：`POST /api/slides/preview-jobs` 與 `GET /api/slides/preview-jobs/:jobId` 的請求／回應形狀沿用 003，見 [../../003-async-preview-jobs/contracts/preview-job-api.md](../../003-async-preview-jobs/contracts/preview-job-api.md)。004 僅替換底層儲存與執行，對前端與外部呼叫者透明。本文件描述的是 **API 程序與 worker 程序之間的內部契約**，不對外公開。

## 角色與資料流

```text
[Client] --POST--> [API 程序]
                      | 1. validate request（沿用 003）
                      | 2. RedisPreviewJobStore.create(job)  → SET preview-job:{id}, SADD active
                      | 3. BullMqPreviewJobRunner.start(job)  → queue.add({ jobId })
                      | 4. 回 202 { jobId, status:queued, ... }（沿用 003）
                      v
                   [Redis] <----- 共享狀態 + BullMQ 佇列 ----->
                      ^
                      | 5. Worker(queue).process({ jobId })
                      | 6. store.findById(jobId) → 載入 request
                      | 7. preview-job-execution：generatePreview + onStage 更新階段
                      | 8. store.markSucceeded / markFailed
                   [Worker 程序（非 HTTP）]

[Client] --GET--> [API 程序] → store.findById(jobId)（讀 Redis，與哪個程序處理無關）

[API 程序] timeout sweep（每 tick，多副本以 lease 互斥）：
   SMEMBERS active → 對逾時者 markFailed(timeout)
```

## BullMQ Job Payload（入列內容）

```json
{
  "jobId": "preview_job_xxxxxxxxxxxxxxxx"
}
```

- **只放 `jobId`**：完整 request 已存於 `preview-job:{id}`，避免重複資料與大 payload。
- worker 以 `jobId` 從 `RedisPreviewJobStore.findById` 取得 `request` 後執行。
- Job 選項：`attempts = 1`（不重試）、無 backoff。

## Redis 鍵（內部）

| Key | 說明 |
|-----|------|
| `preview-job:{id}` | `PreviewJob` JSON（序列化見 data-model.md），TTL 對齊 `expiresAt` + 緩衝 |
| `preview-job:active` | 非終態 job id 集合，供 timeout sweep 迭代 |
| `preview-job:sweep:lock` | timeout sweep 的多副本 lease（`SET NX PX`） |
| `bull:{queueName}:*` | BullMQ 自管鍵 |

鍵前綴與 queue 名稱皆為後端設定，不出現在任何公開回應。

## 設定（後端 runtime configuration，`queue.config.ts`）

| 環境變數 | 用途 | 預設 |
|----------|------|------|
| `REDIS_URL` | Redis 連線（含 host/port/密碼）；缺少時 API/worker fail-fast | 無（必要） |
| `PREVIEW_QUEUE_NAME` | BullMQ 佇列名稱 | `preview-jobs` |
| `PREVIEW_WORKER_CONCURRENCY` | 單一 worker 同時處理 job 數 | `1` |
| `PREVIEW_JOB_RETENTION_MS` | job 保留時間（對齊既有 retention） | `600000`（10 分鐘） |
| `PREVIEW_TIMEOUT_SWEEP_INTERVAL_MS` | timeout sweep 間隔 | `30000`（30 秒） |

- 以上皆為後端設定，不得作為公開 job 請求／回應欄位（CR-004、FR-016）。
- provider/model 設定維持既有 `llm.config.ts` 邊界，不在此重複。

## 安全與錯誤（沿用並延伸 003）

- 公開回應與錯誤訊息不得包含：API key、provider 原始錯誤、完整 prompt、model id、stack trace、Redis 連線字串、queue 內部鍵或 lock token。
- **Redis 不可用**：`createPreviewJob` fail-fast，回安全錯誤（例如 `503` 或既有錯誤封套的安全碼），不建立 job、不洩漏連線細節。
- **worker 失敗**：job 經 `createGenerationFailure` 安全化為 `failed`（沿用 003 `JobFailure` 形狀）。
- **worker 崩潰／停滯**：timeout sweep 以 `createTimeoutFailure` 標記 `failed`（沿用 003）。

## 不變式（驗收依據）

1. 同一 `jobId` 不被多個 worker 同時消費（BullMQ 鎖定）。
2. API 對輪詢／建立的回應不因 worker 生成負載而阻塞。
3. job 狀態跨 API 重啟與跨 API 副本一致可讀（只要未過期）。
4. 任一 job 自建立起 5 分鐘內必達終態（succeeded/failed）。
5. 終態 job 狀態最終被 TTL／expire 回收，Redis 不無限增長。
