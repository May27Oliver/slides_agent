# 任務：Redis Worker Queue for Preview Jobs

**輸入**：`/specs/004-redis-worker-queue/` 內的設計文件

**前置文件**：plan.md、spec.md、research.md、data-model.md、contracts/preview-job-queue.md、quickstart.md

**測試要求**：每個已接受的 feature spec 與 PR slice 都必須有測試或可執行驗證任務。遵守 TDD：先寫聚焦的 failing test，確認 red，再做最小實作，確認 green，最後才 refactor。004 為基礎建設替換，完成結果忠實度沿用 002/003 既有測試，不重複。

**組織方式**：任務依 user story 分組，確保每個 story 都能獨立實作、獨立展示、獨立測試。

## 格式：`[ID] [P?] [Story] 任務描述`

- **[P]**：可平行執行，因為使用不同檔案且沒有相依
- **[Story]**：任務所屬 user story，例如 US1、US2、US3
- 每個任務描述必須包含精確檔案路徑

## 測試策略備註

- **Redis-free 單元測試**：`preview-job-execution`、`BullMqPreviewJobRunner.start` 以 fake store／mock queue 測試，不需 Redis。
- **Redis 行為測試**：`RedisPreviewJobStore`、`preview-job-timeout-sweeper` 以 `ioredis-mock`（devDependency）驗證鍵／active-set／TTL／lease 行為。
- **端到端**：實際 BullMQ worker 消費以 quickstart 手動驗證（需本機 Redis）。

---

## Phase 1：Setup（共用基礎準備）

**目的**：建立 004 需要的相依、設定與測試佔位。

- [X] T001 在 `apps/api/package.json` 新增相依 `bullmq`、`ioredis`，devDependency `ioredis-mock`，並新增 scripts `worker`（`node --env-file=../../.env --import tsx src/worker/worker.main.ts`）與 `worker:dev`（加 `--watch`）
- [X] T002 [P] 更新 `.env.example` 新增 `REDIS_URL`、`PREVIEW_QUEUE_NAME`、`PREVIEW_WORKER_CONCURRENCY`、`PREVIEW_JOB_RETENTION_MS`、`PREVIEW_TIMEOUT_SWEEP_INTERVAL_MS`，並標註 `REDIS_URL` 為必要
- [X] T003 [P] 建立 API 測試佔位檔 `apps/api/test/redis-preview-job-store.test.ts`、`apps/api/test/bullmq-preview-job-runner.test.ts`、`apps/api/test/preview-job-execution.test.ts`、`apps/api/test/preview-job-timeout-sweeper.test.ts`、`apps/api/test/queue-config.test.ts`

---

## Phase 2：Foundational（阻塞性前置）

**目的**：定義所有 story 都會消費的序列化、設定與 DI tokens。

**CRITICAL**：此階段完成前，不得開始任何 user story implementation。

### Foundation 測試（REQUIRED - 先寫）

- [X] T004 [P] 在 `packages/domain/test/preview-job/preview-job-serialization.test.ts` 撰寫 failing 來回（serialize→deserialize）測試，驗證 `createdAt/updatedAt/expiresAt` Date↔ISO 可逆、其餘形狀深度相等、結構不符時丟錯
- [X] T005 [P] 在 `apps/api/test/queue-config.test.ts` 撰寫 failing 設定測試，驗證缺 `REDIS_URL` 時 `loadQueueConfig()` 丟出可被安全化的錯誤、其餘欄位有正確預設

### Foundation 實作

- [X] T006 在 `packages/domain/src/preview-job/preview-job-serialization.ts` 實作 pure `serializePreviewJob` / `deserializePreviewJob`（無 I/O、無內部時間相依）
- [X] T007 從 `packages/domain/src/index.ts` 匯出 serialization 函式
- [X] T008 在 `apps/api/src/modules/slides/queue.config.ts` 實作 `loadQueueConfig()`（讀 `REDIS_URL` 等環境變數、`REDIS_URL` 缺少時 fail-fast）
- [X] T009 在 `apps/api/src/modules/slides/slides.tokens.ts` 新增 `REDIS_CONNECTION`、`PREVIEW_JOB_QUEUE` tokens
- [X] T010 在 `apps/api/src/modules/slides/slides.module.ts` 新增 `REDIS_CONNECTION` provider（以 `loadQueueConfig()` 建立 ioredis 連線；連線設定錯誤 fail-fast，不洩漏連線字串）

**Checkpoint**：序列化、設定與 Redis 連線 token 已就緒，可開始 story work。

---

## Phase 3：User Story 1 - 生成移出 API 主程序、送出後立即可服務其他請求（Priority: P1）MVP

**目標**：有效 request 由 API 持久化到 Redis 並入列 BullMQ、2 秒內回 `queued`，且不在 API 程序內執行生成；Redis 不可用時 fail-fast。

**獨立測試**：`create` 把 job 寫入 Redis 並 `SADD active`；`runner.start` 對 queue 入列 `{ jobId }`；invalid request 不建立 job；Redis 不可用時建立 job fail-fast 回安全錯誤。

### User Story 1 測試（REQUIRED - 先寫）

- [X] T011 [P] [US1] 在 `apps/api/test/redis-preview-job-store.test.ts` 撰寫 failing 測試（ioredis-mock）：`create(job)` 寫入 `preview-job:{id}` JSON 並 `SADD preview-job:active`、設定 TTL；`findById` 可讀回等價 job、不存在回 `undefined`
- [X] T012 [P] [US1] 在 `apps/api/test/bullmq-preview-job-runner.test.ts` 撰寫 failing 測試：`start(job)` 對 queue 以 `attempts:1` 入列僅含 `{ jobId }` 的 payload，且不呼叫 `SlidesService`
- [X] T013 [P] [US1] 在 `apps/api/test/redis-preview-job-store.test.ts` 撰寫 failing 測試：Redis 連線失敗時 `create` 丟出不含連線細節的錯誤（供控制器轉安全錯誤）

### User Story 1 實作

- [X] T014 [US1] 在 `apps/api/src/modules/slides/redis-preview-job-store.ts` 實作 `RedisPreviewJobStore`（`create`/`findById`，使用 domain serialization 與 `PreviewJobService`，active-set 與 TTL）
- [X] T015 [US1] 在 `apps/api/src/modules/slides/bullmq-preview-job-runner.ts` 實作 `BullMqPreviewJobRunner.start`（注入 `PREVIEW_JOB_QUEUE`，入列 `{ jobId }`，`attempts:1`）
- [X] T016 [US1] 在 `apps/api/src/modules/slides/slides.module.ts` 把 `PREVIEW_JOB_STORE` 改 wire 到 `RedisPreviewJobStore`、`PREVIEW_JOB_RUNNER` 改 wire 到 `BullMqPreviewJobRunner`，並新增 `PREVIEW_JOB_QUEUE` provider（BullMQ `Queue`，用 `REDIS_CONNECTION` 與 `queue.config`）
- [X] T017 [US1] 在 `apps/api/src/modules/slides/slides.controller.ts` 確認 `createPreviewJob` 在 store/runner 不可用或 Redis 失敗時回安全錯誤（fail-fast，不洩漏內部細節）；公開回應形狀不變

**Checkpoint**：US1 可獨立運作：有效 request 入列且不在主程序生成；Redis 不可用 fail-fast。

---

## Phase 4：User Story 2 - job 狀態持久化，worker 消費並可跨重啟／跨實例追蹤（Priority: P2）

**目標**：獨立 worker 程序消費佇列、執行既有 pipeline 並把階段／結果寫回 Redis；任一 API 程序（含重啟後、其他副本）皆可輪詢到正確狀態與成功結果。

**獨立測試**：對 fake store 跑 `preview-job-execution` 推進階段並寫 success result；`RedisPreviewJobStore` 的 mark 轉換經 ioredis-mock 可被另一次 `findById` 讀到（模擬跨程序）。

### User Story 2 測試（REQUIRED - 先寫）

- [X] T018 [P] [US2] 在 `apps/api/test/preview-job-execution.test.ts` 撰寫 failing 測試：`runPreviewJobGeneration` 透過 `onStage` 依序更新 running/各階段、成功時呼叫 `store.markSucceeded` 並帶 002 result 形狀
- [X] T019 [P] [US2] 在 `apps/api/test/redis-preview-job-store.test.ts` 撰寫 failing 測試（ioredis-mock）：`markRunning`/`markStage`/`markSucceeded` 寫回後，重新 `findById` 取得更新後狀態（模擬另一個程序讀取），succeeded 後移出 active-set
- [X] T020 [P] [US2] 在 `apps/api/test/preview-job-execution.test.ts` 撰寫 failing 測試：對終態 job 再次更新為 no-op（終態守門，不覆蓋）

### User Story 2 實作

- [X] T021 [US2] 在 `apps/api/src/modules/slides/preview-job-execution.ts` 抽出並實作 `runPreviewJobGeneration({ store, slidesService, job, now, logger })`（移植自 003 in-process runner 的 run 邏輯，含 onStage 即時逾時檢查）
- [X] T022 [US2] 在 `apps/api/src/modules/slides/redis-preview-job-store.ts` 補齊 `markRunning`/`markStage`/`markSucceeded`/`markFailed`（讀-改-寫 + 終態守門 + 條件寫入；succeeded/failed 移出 active-set 並重設 TTL）
- [X] T023 [US2] 在 `apps/api/src/worker/worker.main.ts` 實作非 HTTP worker entrypoint：`createApplicationContext(SlidesModule)` 取得 `SlidesService` 與 `RedisPreviewJobStore`，建立 BullMQ `Worker(queueName, processor, { connection, concurrency })`，processor 以 `jobId` `findById` 後呼叫 `runPreviewJobGeneration`
- [X] T024 [US2] 確認 `apps/api/src/modules/slides/slides.controller.ts` 的 `GET /preview-jobs/:jobId` 透過 `RedisPreviewJobStore.findById` 讀取（沿用 003 handler，無需改公開形狀）

**Checkpoint**：US2 可獨立運作：worker 在獨立程序推進並完成 job，狀態跨程序／重啟可讀。

---

## Phase 5：User Story 3 - worker 失敗／崩潰安全收斂，錯誤可追溯（Priority: P3）

**目標**：worker 生成失敗 → 安全 `failed`；worker 崩潰／停滯 → 5 分鐘逾時 sweep 收斂 `failed`；錯誤不洩漏敏感細節；retry 建立獨立新 job。

**獨立測試**：`preview-job-execution` 在生成拋錯時 `markFailed`（sanitized）；`preview-job-timeout-sweeper` 對逾時 active job `markFailed(timeout)`；多副本 lease 僅一個執行。

### User Story 3 測試（REQUIRED - 先寫）

- [X] T025 [P] [US3] 在 `apps/api/test/preview-job-execution.test.ts` 撰寫 failing 測試：生成拋錯時呼叫 `store.markFailed`，failure 經 `createGenerationFailure` 安全化（不含 provider 原始錯誤／prompt／API key／stack trace），且記錄 failedStage
- [X] T026 [P] [US3] 在 `apps/api/test/preview-job-timeout-sweeper.test.ts` 撰寫 failing 測試（ioredis-mock + 注入 `now`）：對 active-set 中超過 5 分鐘的 job `markFailed(PREVIEW_JOB_TIMEOUT)`，已終態／不存在者從 active-set 移除
- [X] T027 [P] [US3] 在 `apps/api/test/preview-job-timeout-sweeper.test.ts` 撰寫 failing 測試：多副本 lease（`SET NX PX`）下，未取得 lock 的 tick 不執行 sweep

### User Story 3 實作

- [X] T028 [US3] 在 `apps/api/src/modules/slides/preview-job-execution.ts` 完成失敗路徑（catch → `createGenerationFailure` → `store.markFailed`，沿用 003 安全化）
- [X] T029 [US3] 在 `apps/api/src/modules/slides/preview-job-timeout-sweeper.ts` 實作 sweep：取得 lease → `SMEMBERS active` → 逐一 `findById` → 逾時者 `markFailed(timeoutFailureForJob)`（重用 `preview-job-timeout.ts`）→ 終態/不存在者 `SREM`
- [X] T030 [US3] 在 `apps/api/src/modules/slides/redis-preview-job-store.ts` 實作 `expireOldJobs`（終態且 `expiresAt<=at` 標記 expired／交由 TTL 回收）並從 active-set 清除
- [X] T031 [US3] 在 `apps/api/src/modules/slides/slides.module.ts` 於 API 程序以 `onApplicationBootstrap` 啟動 timeout sweeper 週期計時器（`unref`），`onModuleDestroy` 清除；worker 程序不啟動 sweeper

**Checkpoint**：US3 可獨立運作：worker 失敗與崩潰皆於 5 分鐘內安全收斂，錯誤不外洩。

---

## Phase 6：Polish（移除 dead code、收尾、驗證）

**目的**：刪除被取代的程序內實作、遷移受影響的 003 測試、跑全套測試、補 evidence 與文件。

- [X] T032 刪除 `apps/api/src/modules/slides/in-memory-preview-job-store.ts` 與 `apps/api/src/modules/slides/in-process-preview-job-runner.ts`（不留 dead code）
- [X] T033 遷移／更新受影響的 003 測試 `apps/api/test/slides-preview-jobs.service.test.ts`（改用 `preview-job-execution` + fake store）與 `apps/api/test/slides-preview-jobs.contract.test.ts`（store 以 ioredis-mock 或 fake 注入），移除對已刪除類別的引用
- [X] T034 [P] 更新 `README.md` 與 `README.zh-TW.md`：新增「啟動 Redis + worker」的本機執行說明
- [X] T035 [P] 在 `specs/004-redis-worker-queue/quickstart.md` 記錄手動驗證 evidence（主程序卸載、跨重啟追蹤、失敗/逾時收斂、過期回收的觀察結果）
- [X] T036 執行全套測試與型別檢查：`pnpm -r test`、`pnpm --filter @slides-agent/api build`、各套件 `tsc --noEmit`，確認全綠
- [X] T037 依 CLAUDE.md 於 commit 前執行 `gitnexus_detect_changes()` 確認影響範圍符合預期（若 gitnexus 可用）

---

## Dependencies & 執行順序

- **Setup（T001–T003）** → **Foundational（T004–T010）** 必須最先完成且阻塞所有 story。
- **US1（T011–T017）** 依賴 Foundational；為 MVP，可先獨立交付（建立＋入列＋fail-fast）。
- **US2（T018–T024）** 依賴 US1 的 store/runner/queue 與 Foundational 的 serialization；worker entrypoint 依賴 `preview-job-execution`。
- **US3（T025–T031）** 依賴 US2 的 store mark 轉換與 execution 失敗路徑；sweeper 依賴 active-set（US1 建立、US2/US3 維護）。
- **Polish（T032–T037）** 最後執行：刪除 dead code 必須在 US1/US2 的新實作接上 module 之後。

## 平行執行建議

- 同一 story 內標 [P] 的測試任務可平行（不同檔案）。
- T002、T034、T035 等文件任務可與程式任務平行。
- 跨 story 不建議平行：US2 依賴 US1 的 store/queue、US3 依賴 US2 的 mark 轉換與 execution。

## MVP 範圍

- **最小可交付**：Setup + Foundational + US1 → API 可把 job 持久化到 Redis 並入列、fail-fast、不在主程序生成。
- **可展示完整非同步**：再加 US2（worker 消費 + 跨重啟追蹤）。
- **生產級安全收斂**：再加 US3（失敗／逾時 sweep）。
