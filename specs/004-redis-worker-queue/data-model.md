# Data Model: Redis Worker Queue for Preview Jobs

004 不改變 003 的領域實體（`PreviewJob`、`JobStatus`、`JobStage`、`PreviewResult`、`JobFailure`、`JobEvidence`）與兩個 port（`PreviewJobStore`、`PreviewJobRunner`）的「形狀與規則」。本文件只描述 004 新增的**持久化與佇列資料表示**，以及它們如何映射到既有領域實體。既有實體定義見 [../003-async-preview-jobs/data-model.md](../003-async-preview-jobs/data-model.md)。

## Redis 鍵結構

| Key | 型別 | 內容 | TTL |
|-----|------|------|-----|
| `preview-job:{id}` | String | 單一 `PreviewJob` 的 JSON 序列化（見下） | 對齊 `expiresAt` + 小緩衝（例：retention 10 分鐘 + 60 秒） |
| `preview-job:active` | Set | 目前所有「非終態」（queued/running）job 的 id，供 timeout sweep 迭代 | 無（成員於轉終態時移除） |
| `preview-job:sweep:lock` | String | timeout sweep 的多副本 lease（值為隨機 token） | 短期（例：sweep 間隔的一半，PX 毫秒） |
| BullMQ 內部鍵（`bull:{queue}:*`） | 多型別 | BullMQ 自管的 queue/job/lock 結構 | 由 BullMQ 與 `removeOnComplete/Fail` 管理 |

**前綴設定**：鍵前綴（`preview-job`）與 BullMQ queue 名稱皆為後端設定（`queue.config.ts`），不對外公開。

## PreviewJob 序列化（`preview-job-serialization.ts`，pure domain）

**目的**：在 `PreviewJob`（含 `Date` 欄位）與可存入 Redis 字串的 JSON 之間可逆轉換。

**規則**：

- `serializePreviewJob(job)`：把 `createdAt`、`updatedAt`、`expiresAt` 轉為 ISO 字串；其餘欄位（`evidence.stageTransitions` 已為 ISO 字串、`result`、`failure`、`request`）原樣保留；輸出 `JSON.stringify` 可接受的物件。
- `deserializePreviewJob(raw)`：解析字串／物件，把上述三個時間欄位還原為 `Date`；保留其餘形狀。
- 來回轉換（serialize → deserialize）必須得到語意相同的 `PreviewJob`（時間值相等、其餘深度相等）。
- 反序列化遇到結構不符（缺必要欄位、時間無法解析）必須丟出明確錯誤，不得回傳半殘物件。
- 純函式，無 I/O、無時間相依（不在內部呼叫 `new Date()`）。

## RedisPreviewJobStore（實作既有 `PreviewJobStore` port）

把既有 port 操作映射到 Redis；生命週期轉換仍委派純 domain 的 `PreviewJobService`。

| Port 操作 | Redis 行為 |
|-----------|-----------|
| `create(job)` | `SET preview-job:{id} = serialize(job)`（含 TTL）並 `SADD preview-job:active {id}` |
| `findById(id)` | `GET preview-job:{id}` → `deserialize`；不存在回 `undefined` |
| `markRunning(id, stage, at)` | 讀-改-寫：load → `PreviewJobService.markRunning` → 條件寫回（終態守門）；維持在 active set |
| `markStage(id, stage, at)` | 同上，套用 `markStage` |
| `markSucceeded(id, result, at)` | 同上，套用 `markSucceeded`；`SREM preview-job:active {id}`；重設 TTL 對齊 `expiresAt` |
| `markFailed(id, failure, at)` | 同上，套用 `markFailed`；`SREM preview-job:active {id}`；重設 TTL |
| `expireOldJobs(at)` | 迭代終態且 `expiresAt <= at` 者標記 `expired`（或直接令其 TTL 自然回收）；回傳受影響 job |

**規則**：

- 寫回採**讀-改-寫 + domain 終態守門**：`PreviewJobService.markX` 對終態 job 回傳原物件（no-op），store 偵測到無變更即不寫回，因此正常情況不會把終態 job 退回 running。
- **已接受的窄競態（MVP 取捨）**：唯一風險視窗是「worker 在第 5 分鐘邊界剛好 `markSucceeded`」與「timeout sweeper 同一刻 `markFailed`」兩者都讀到非終態 → last-write-wins，極少數情況下成功 job 可能被標成 failed（使用者重送即可）。本內部工具 MVP **刻意不**引入 `WATCH`／Lua CAS 來消除此競態，以維持 KISS；若日後競態被證實為實際問題，再加一個小型 Lua compare-and-set helper。
- Redis 不可用時，`create` 必須 fail-fast 丟出可被控制器轉為安全錯誤的例外（不洩漏連線細節）。
- `id` 唯一性沿用 003（`PreviewJobService` 產生）。

## active-set 與 timeout sweep

- **active-set**：`preview-job:active` 保存所有未終態 job id；於 `create` 加入、於 `markSucceeded`/`markFailed`/expire 移除。用途是讓 sweep 無需 `KEYS` 全掃描。
- **timeout sweep**（`preview-job-timeout-sweeper.ts`）：週期性執行——
  1. （多副本時）嘗試取得 `preview-job:sweep:lock`；取不到則本 tick 跳過。
  2. `SMEMBERS preview-job:active`，逐一 `findById`。
  3. 對 `hasPreviewJobTimedOut(job, now)` 為真者，`markFailed(id, timeoutFailureForJob(job), now)`（重用既有 `preview-job-timeout.ts`）。
  4. 對已不存在（TTL 已過）或已終態者，`SREM` 出 active set。
- sweep 間隔為後端設定（建議 ≤ 30 秒，遠小於 5 分鐘上限，以保證收斂時效）。

## BullMQ 佇列承載（內部，非公開契約）

- **Queue 名稱**：後端設定（例：`preview-jobs`）。
- **Job payload**：僅承載 `{ jobId }`（不放完整 request；request 已存於 `preview-job:{id}`），降低重複資料與 payload 大小。
- **Job 選項**：`attempts: 1`（不重試）、無 backoff、`removeOnComplete`/`removeOnFail` 設定為限量保留以利除錯。
- **消費**：worker 端 `Worker(queueName, processor, { connection, concurrency })`；processor 以 `jobId` 從 store 載入並執行 `preview-job-execution`。

## PreviewJobRunner（BullMQ 實作，既有 port）

| Port 操作 | BullMQ 行為 |
|-----------|------------|
| `start(job)` | `queue.add(name, { jobId: job.id }, { attempts: 1 })`，立即返回（不等待生成） |

**規則**：入列失敗（Redis 不可用）必須讓 `createPreviewJob` 走 fail-fast 安全錯誤路徑；不得在 API 主程序執行生成。

## preview-job-execution（worker 與測試共用）

抽出自 003 `InProcessPreviewJobRunner.run` 的執行邏輯，簽章近似 `runPreviewJobGeneration({ store, slidesService, job, now, logger })`：

- 呼叫 `slidesService.generatePreview(job.request, { onStage })`，`onStage` 透過 store 更新 `markRunning`/`markStage` 並做逾時檢查（worker 存活時的即時收斂）。
- 成功 → `store.markSucceeded(id, result, now)`；失敗 → `store.markFailed(id, createGenerationFailure(error, stage), now)`。
- 不在 public 狀態洩漏 provider/model 細節；錯誤一律經 `createGenerationFailure` 安全化。

## 狀態轉換（沿用 003，新增承載）

```text
create()         -> queued      （寫 Redis + 加入 active-set）
enqueue + worker -> running      （worker 消費，onStage 推進）
worker success   -> succeeded    （寫 result，移出 active-set，重設 TTL）
worker failure   -> failed       （寫 failure，移出 active-set，重設 TTL）
worker crash/停滯 -> failed       （由 timeout sweep 於 5 分鐘內收斂）
succeeded/failed -> expired      （expireOldJobs 或 TTL 自然回收）
unknown lookup   -> unavailable  （findById 不存在）
```

終態（succeeded/failed/expired）不得回到 running；所有更新走終態守門。
