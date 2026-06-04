# `preview-jobs` 模組

> 維護導覽:這個模組在做什麼、檔案各自的職責、跟其他模組怎麼互動,以及幾個動手前必須知道的設計取捨。

## 1. 這個模組負責什麼

**把「slides 生成」包裝成可追蹤、跨程序、會逾時收斂的非同步 job。**

`slides` 模組(`SlidesService`)只負責「怎麼把內容生成 HTML」;`preview-jobs` 負責**編排**:接收請求 → 驗證 → 入列 → 由獨立 worker 程序消費 → 把階段/結果/失敗寫回 Redis → 對外提供輪詢。

一句話分工:**`slides` = 生成能力;`preview-jobs` = 圍繞生成的 async job 編排。** 依賴方向是單向的 **`preview-jobs → slides`**(slides 完全不認識 job)。

## 2. 兩個程序、同一份程式碼

這個模組的 provider 會跑在**兩個不同的程序**,各取所需:

| 程序 | 進入點 | 組裝模組 | 載入哪些 preview-jobs 元件 |
|------|--------|----------|------------------------------|
| **API**(HTTP) | `src/main.ts` | `AppModule` → `PreviewJobsModule` | controller、queue producer、timeout sweeper、store、config |
| **Worker**(非 HTTP) | `src/worker/worker.main.ts` | `WorkerModule` | worker runtime(consumer)、store、config |

> Worker **不會**載入 controller / producer queue / sweeper;API **不會**啟動 BullMQ consumer。兩邊共用的只有 `store` + `config`(見 `preview-jobs.providers.ts`)與同一個 Redis。

## 3. 與其他模組的互動

```
                 AppModule (API)                 WorkerModule (worker)
                      │                                  │
        imports  PreviewJobsModule              imports  RedisModule
                      │  imports                          + SlidesModule
          ┌───────────┼───────────┐                      + (shared providers)
          ▼           ▼                                   ▼
     RedisModule   SlidesModule              PreviewWorkerRuntime
   (REDIS_CONNECTION) (SlidesService)         用 SlidesService 跑生成
```

- **依賴 `RedisModule`**:注入 `REDIS_CONNECTION`(共用指令連線)。preview-jobs **不擁有** Redis 連線,只使用;BullMQ producer/worker 各自另開「自己的」連線(BullMQ 要求 `maxRetriesPerRequest: null`,與共用連線設定互斥)。
- **依賴 `SlidesModule`**:注入 `SlidesService` 來實際生成。
- **依賴 `@slides-agent/domain`**:`PreviewJobStore` / `PreviewJobRunner` port、`PreviewJobService`(生命週期規則)、逾時判斷、序列化。
- **依賴 `@slides-agent/contracts`**:request validator 與 OpenAPI schema。
- **被 `AppModule` / `WorkerModule` import**;反向沒有任何模組依賴它的內部。

## 4. 一個 job 的旅程(把元件串起來)

```
[Client] POST /api/slides/preview-jobs
   PreviewJobsController.createPreviewJob
     1. parseGeneratePreviewRequest(body)        // 驗證(parser)
     2. store.create(job)                         // RedisPreviewJobStore → Redis(status=queued)
     3. runner.start(job)                         // BullMqPreviewJobRunner → BullMQ 入列 { jobId }
     回 202 { jobId, statusUrl }

        ===== 跨程序 =====

   PreviewWorkerRuntime(worker,consumer)
     4. BullMQ 派 { jobId }
     5. store.findById(jobId)                      // 撈完整 request
     6. runPreviewJobGeneration(...)               // 呼叫 SlidesService 生成,onStage 更新階段
     7. store.markSucceeded / markFailed           // 寫回 Redis

[Client] GET /api/slides/preview-jobs/:jobId
   PreviewJobsController.previewJobStatus
     assertValidJobId → store.findById → 回目前狀態/結果

(worker 崩潰卡住時)
   PreviewJobsApiRuntime → PreviewJobTimeoutSweeper(API,每 30s)
     掃 active-set → 逾時者 store.markFailed(timeout)
```

## 5. 檔案職責

| 檔案 | 角色 | 跑在哪 |
|------|------|--------|
| `preview-jobs.module.ts` | API 端模組組裝(controller + producer + sweeper + 共用 providers) | API |
| `preview-jobs.controller.ts` | HTTP 端點(`@Controller("slides")`):POST `/preview`(同步)、POST `/preview-jobs`、GET `/preview-jobs/:jobId` | API |
| `preview-jobs.tokens.ts` | DI tokens:`PREVIEW_JOB_STORE`、`PREVIEW_JOB_RUNNER`、`QUEUE_CONFIG` | 共用 |
| `preview-jobs.providers.ts` | 共用 provider 定義(store + queue config),API 與 worker 各自 include,避免 worker 載入 API-only 元件 | 共用 |
| `redis-preview-job-store.ts` | `PreviewJobStore` port 的 Redis 實作(create/findById/markX、active-set、TTL);所有 Redis 呼叫經 `guarded()` 轉 sanitized 錯誤 | API + worker |
| `bullmq-preview-job-runner.ts` | `PreviewJobRunner` port 的實作:把 `{ jobId }` 入列 BullMQ(`attempts:1`、`removeOnComplete/Fail`) | API |
| `preview-job-queue.service.ts` | **擁有** BullMQ producer Queue + 其連線,`onModuleDestroy` 關閉 | API |
| `preview-worker.runtime.ts` | BullMQ **consumer**:`onApplicationBootstrap` 啟動 Worker、消費 job、呼叫 execution;`onModuleDestroy` 關閉 | **Worker only** |
| `preview-job-execution.ts` | 抽出的「跑一個 job」邏輯(呼叫 `SlidesService.generatePreview` + 更新階段/結果/失敗);worker 與測試共用 | Worker |
| `preview-job-timeout-sweeper.ts` | worker 外的 5 分鐘逾時收斂(active-set 掃描 + 多副本 Redis lease) | API |
| `preview-jobs-api.runtime.ts` | 把 sweeper 接上 Nest lifecycle(`onApplicationBootstrap → start`、`onModuleDestroy → stop`),**只在 API 程序** | API |
| `preview-request.parser.ts` | `parseGeneratePreviewRequest`(統一 400 錯誤形狀)+ `assertValidJobId`(param 防護) | API |
| `queue.config.ts` | 佇列旋鈕(queueName、workerConcurrency、timeoutSweepIntervalMs);`REDIS_URL` 在 `infra/redis` | 共用 |
| `rate-limit.guard.ts` | 兩個 POST 共用的 per-IP 滑動視窗速率限制 | API |

> `PreviewWorkerRuntime` 的檔案放在這個資料夾(它是 preview-jobs 的一環),但**只在 `WorkerModule` 註冊**,API 不會載入它。

## 6. 動手前必讀的設計取捨 / 雷區

1. **runtime 沒有 decorator metadata**:app 跑在 `tsx`(esbuild),**不 emit `emitDecoratorMetadata`**。所以**所有建構子注入都必須顯式 `@Inject(...)`**——只靠型別注入(沒寫 `@Inject`)會拿到 `undefined`。新增 provider 時務必遵守。
2. **Redis 為必要,fail-fast**:沒有 in-process 退路。Redis 不可用時,建立 job 回 sanitized **503**(`PREVIEW_QUEUE_UNAVAILABLE`),絕不洩漏連線字串。
3. **佇列不重試**(`attempts: 1`):任何失敗 → `failed`,使用者重送新 job。worker 崩潰/卡住由 **timeout sweeper** 在 5 分鐘內收斂(因為崩潰的 worker 無法自報)。
4. **連線 lifecycle 各有其主**:共用連線歸 `RedisService`(infra)、producer queue 歸 `PreviewJobQueueService`、worker 連線歸 `PreviewWorkerRuntime`——都在 `onModuleDestroy` 關閉,兩程序皆 `enableShutdownHooks()`。新增任何「自己開連線」的東西,記得補關閉。
5. **已接受的窄競態**:store 用「讀-改-寫 + domain 終態守門」,沒上 Lua/CAS。唯一風險視窗是「worker 在第 5 分鐘邊界剛好 succeed」與「sweeper 同刻 markFailed」對撞(last-write-wins)。內部工具 MVP 刻意接受;若未來變嚴重再加 Lua compare-and-set。
6. **OpenAPI 是手組的**(`src/openapi/openapi-document.ts`),不是 `SwaggerModule.createDocument`——同樣是因為 tsx 無 metadata,反射式掃描會崩。schema 定義在 `@slides-agent/contracts`,**新增端點時要手動補一段 path**。
7. **公開契約穩定**:HTTP 形狀沿用 003;錯誤一律 sanitized(無 API key / provider 原始錯誤 / prompt / stack trace / Redis 細節)。

## 7. 常見維護情境

- **改生成邏輯** → 去 `slides` 模組,不是這裡。
- **新增 job 階段 / 狀態** → 改 `@slides-agent/domain` 的 `preview-job.types.ts`(union)+ `preview-job.service.ts`(轉移規則);serialization 的 enum set 也要同步。
- **調整逾時 / 併發 / 佇列名** → `queue.config.ts` + `.env`(`PREVIEW_*`);`REDIS_URL` 在 `infra/redis`。
- **新增端點 / 改回應** → controller + `@slides-agent/contracts` schema + `openapi-document.ts`(手動補 path)。
- **多副本 / 生產級 rate limit** → 目前是程序內 Map(單實例 OK);多副本需改成 Redis-backed(已知待辦)。
