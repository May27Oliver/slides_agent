# 任務：Async Preview Jobs

**輸入**：`/specs/003-async-preview-jobs/` 內的設計文件

**前置文件**：plan.md、spec.md、research.md、data-model.md、contracts/preview-job-api.md、quickstart.md

**測試要求**：每個已接受的 feature spec 與 PR slice 都必須有測試或可執行驗證任務。遵守 TDD：先寫聚焦的 failing test，確認 red，再做最小實作，確認 green，最後才 refactor。

**組織方式**：任務依 user story 分組，確保每個 story 都能獨立實作、獨立展示、獨立測試。

## 格式：`[ID] [P?] [Story] 任務描述`

- **[P]**：可平行執行，因為使用不同檔案且沒有相依
- **[Story]**：任務所屬 user story，例如 US1、US2、US3
- 每個任務描述必須包含精確檔案路徑

## Phase 1：Setup（共用基礎準備）

**目的**：建立 003 需要的共用目錄與 evidence 記錄位置。

- [X] T001 建立 preview-job domain 目錄 `packages/domain/src/preview-job/` 與測試目錄 `packages/domain/test/preview-job/`
- [X] T002 [P] 建立 API preview job 測試佔位檔 `apps/api/test/slides-preview-jobs.contract.test.ts` 與 `apps/api/test/slides-preview-jobs.service.test.ts`
- [X] T003 [P] 建立 web preview job 測試佔位檔 `apps/web/src/features/slide-generation/preview-job-flow.test.tsx` 與 `apps/web/tests/e2e/preview-job-polling.spec.ts`
- [X] T004 [P] 在 `specs/003-async-preview-jobs/quickstart.md` 補上 003 evidence 區塊佔位

---

## Phase 2：Foundational（阻塞性前置）

**目的**：定義所有 story 都會消費的共用 domain language、contract 與 boundary。

**CRITICAL**：此階段完成前，不得開始任何 user story implementation。

### Foundation 測試（REQUIRED - 先寫）

- [X] T005 [P] 在 `packages/domain/test/preview-job/preview-job-types.test.ts` 撰寫 failing domain type/export smoke test，覆蓋 `PreviewJob`、`JobStatus`、`JobStage`、`JobFailure`、`JobEvidence`
- [X] T006 [P] 在 `packages/contracts/test/preview-job-contract.test.ts` 撰寫 failing contract shape test，覆蓋 preview job create/status response types

### Foundation 實作

- [X] T007 在 `packages/domain/src/preview-job/preview-job.types.ts` 定義 `PreviewJob`、`JobStatus`、`JobStage`、`PreviewResult`、`JobFailure`、`JobEvidence` 與 transition helpers
- [X] T008 在 `packages/domain/src/preview-job/preview-job-store.port.ts` 定義 `PreviewJobStore` capability boundary
- [X] T009 在 `packages/domain/src/preview-job/preview-job-runner.port.ts` 定義 `PreviewJobRunner` capability boundary
- [X] T010 在 `packages/contracts/src/preview-job.ts` 定義 preview job public contract types 與 validators
- [X] T011 從 `packages/domain/src/index.ts` 與 `packages/contracts/src/index.ts` 匯出 preview job domain 與 contract artifacts
- [X] T012 在 `apps/api/src/modules/slides/slides.tokens.ts` 新增 preview job store/runner tokens
- [X] T013 確認 Redis/BullMQ future path 仍只記錄於 `specs/003-async-preview-jobs/research.md`，且 `package.json` 未新增 Redis/BullMQ dependency

**Checkpoint**：共用 job language 與 public contract 已準備好，可開始 story work。

---

## Phase 3：User Story 1 - 送出 preview job 並立即取得追蹤資訊（Priority: P1）MVP

**目標**：有效 preview request 可在 2 秒內建立可追蹤 job；無效 request 必須在建立 job 前失敗。

**獨立測試**：送出有效 request 建立 preview job，確認回傳 queued job id/status；送出無效 request，確認不會建立 job。

### User Story 1 測試（REQUIRED - 先寫）

- [X] T014 [P] [US1] 在 `packages/domain/test/preview-job/preview-job-service.test.ts` 撰寫 failing domain lifecycle test，驗證建立 queued job 與 accepted evidence
- [X] T015 [P] [US1] 在 `apps/api/test/slides-preview-jobs.contract.test.ts` 撰寫 failing API contract test，驗證 `POST /api/slides/preview-jobs` 回傳 `202 Accepted`、`jobId`、`queued`、`request_accepted`、timestamps、`statusUrl`
- [X] T016 [P] [US1] 在 `apps/api/test/slides-preview-jobs.contract.test.ts` 撰寫 failing API validation test，證明 invalid preview request 回傳 `400 INVALID_PREVIEW_REQUEST` 且不建立 job
- [X] T017 [P] [US1] 在 `apps/web/src/features/slide-generation/preview-job-flow.test.tsx` 撰寫 failing web unit test，證明 submit 在 job accepted 後進入 job progress state

### User Story 1 實作

- [X] T018 [US1] 在 `packages/domain/src/preview-job/preview-job.service.ts` 實作 job creation behavior 與 initial evidence
- [X] T019 [US1] 在 `apps/api/src/modules/slides/in-memory-preview-job-store.ts` 實作 in-memory preview job store
- [X] T020 [US1] 在 `apps/api/src/modules/slides/slides.controller.ts` 新增 `POST /api/slides/preview-jobs` handler
- [X] T021 [US1] 在 `apps/api/src/modules/slides/slides.module.ts` wire preview job store provider
- [X] T022 [US1] 更新 `apps/web/src/features/slide-generation/SlideGenerationFeature.tsx`，改呼叫 `POST /api/slides/preview-jobs`，不再使用同步 preview generation
- [X] T023 [US1] 在 `apps/web/src/features/slide-generation/slide-generation.types.ts` 新增 job progress state types/helpers
- [X] T024 [US1] 在 `specs/003-async-preview-jobs/quickstart.md` 記錄 US1 evidence notes

**Checkpoint**：US1 可獨立運作：有效 request 建立可追蹤 job；無效 request 在建立前失敗。

---

## Phase 4：User Story 2 - 查詢生成進度並取得完成結果（Priority: P2）

**目標**：polling 可顯示 job 執行中的目前 stage，並在成功後渲染 002 preview result。

**獨立測試**：建立 controlled job，poll status 觀察 stage changes，完成後確認 final result shape 被顯示。

### User Story 2 測試（REQUIRED - 先寫）

- [X] T025 [P] [US2] 在 `packages/domain/test/preview-job/preview-job-stage-transitions.test.ts` 撰寫 failing domain test，驗證合法 stage transitions 與 stable succeeded result
- [X] T026 [P] [US2] 在 `apps/api/test/slides-preview-jobs.contract.test.ts` 撰寫 failing API status test，驗證 `GET /api/slides/preview-jobs/:jobId` 回傳 running evidence 與 succeeded result
- [X] T027 [P] [US2] 在 `apps/api/test/slides-preview-jobs.service.test.ts` 撰寫 failing API service test，證明 in-process runner 更新 content/deck/design/html stages 並儲存 success result
- [X] T028 [P] [US2] 在 `apps/web/src/features/slide-generation/preview-job-flow.test.tsx` 撰寫 failing web unit test，覆蓋 polling queued/running/succeeded states 與既有 result panels rendering
- [X] T029 [P] [US2] 在 `apps/web/tests/e2e/preview-job-polling.spec.ts` 撰寫 failing Playwright polling test，mock create/status/result 並驗證 progress 後顯示 preview

### User Story 2 實作

- [X] T030 [US2] 在 `packages/domain/src/preview-job/preview-job.service.ts` 實作 stage transition 與 stable success behavior
- [X] T031 [US2] 在 `apps/api/src/modules/slides/in-process-preview-job-runner.ts` 實作 in-process preview job runner，包裝既有 `SlidesService.generatePreview`
- [X] T032 [US2] 在 `apps/api/src/modules/slides/slides.controller.ts` 新增 `GET /api/slides/preview-jobs/:jobId` handler
- [X] T033 [US2] 在 `apps/api/src/modules/slides/slides.module.ts` 與 `apps/api/src/modules/slides/slides.controller.ts` wire runner provider 與 job execution trigger
- [X] T034 [US2] 在 `apps/web/src/features/slide-generation/preview-job-polling.ts` 新增 frontend polling helper
- [X] T035 [US2] 更新 `apps/web/src/features/slide-generation/SlideGenerationFeature.tsx`，每 1-2 秒 poll job status 直到 terminal state
- [X] T036 [US2] 在 `apps/web/src/features/slide-generation/PreviewJobProgressPanel.tsx` 新增 progress UI component
- [X] T037 [US2] 在 `apps/web/src/features/slide-generation/SlideGenerationFeature.tsx` 於 `succeeded` 後重用既有 result panels
- [X] T038 [US2] 在 `specs/003-async-preview-jobs/quickstart.md` 記錄 US2 evidence notes

**Checkpoint**：US2 可獨立運作：執行中可看到 progress，成功後可渲染完成的 preview artifacts。

---

## Phase 5：User Story 3 - 失敗時回報安全、可追溯的錯誤狀態（Priority: P3）

**目標**：failed 或 timed-out jobs 只暴露 sanitized failure、reviewer-safe evidence，retry 會建立新的獨立 job。

**獨立測試**：模擬 generation failure 與 timeout，驗證 failed job status、safe failure payload，以及 retry 建立不同 job。

### User Story 3 測試（REQUIRED - 先寫）

- [X] T039 [P] [US3] 在 `packages/domain/test/preview-job/preview-job-timeout.test.ts` 撰寫 failing domain timeout test，證明超過 5 分鐘的 jobs 會以 `PREVIEW_JOB_TIMEOUT` 失敗
- [X] T040 [P] [US3] 在 `packages/domain/test/preview-job/preview-job-failure.test.ts` 撰寫 failing domain failure sanitization test，證明 raw provider errors、prompts、API keys、stack traces 不會外露
- [X] T041 [P] [US3] 在 `apps/api/test/slides-preview-jobs.contract.test.ts` 撰寫 failing API status test，覆蓋 failed job response 與 unavailable job response
- [X] T042 [P] [US3] 在 `apps/api/test/slides-preview-jobs.service.test.ts` 撰寫 failing API service test，證明 runner 會把 generation exceptions 映射成 sanitized `JobFailure`
- [X] T043 [P] [US3] 在 `apps/web/src/features/slide-generation/preview-job-flow.test.tsx` 撰寫 failing web unit test，覆蓋 failed state 與 retry 建立 new job
- [X] T044 [P] [US3] 在 `apps/web/tests/e2e/preview-job-polling.spec.ts` 撰寫 failing Playwright test，覆蓋 failed job UI 與 retry flow
- [X] T045 [P] [US3] 在 `apps/web/src/features/slide-generation/preview-job-failure-copy.test.ts` 撰寫 failing web unit test，驗證 `PREVIEW_JOB_TIMEOUT`、generation failure、unavailable job 會映射到使用者可理解的標題、訊息與 retry availability，且不顯示 raw provider errors、prompts、API keys、stack traces、model identifiers

### User Story 3 實作

- [X] T046 [US3] 在 `packages/domain/src/preview-job/preview-job-timeout.ts` 實作 5-minute timeout helper
- [X] T047 [US3] 在 `packages/domain/src/preview-job/preview-job.service.ts` 實作 sanitized failure mapping
- [X] T048 [US3] 更新 `apps/api/src/modules/slides/in-process-preview-job-runner.ts`，強制 timeout 並映射 exceptions
- [X] T049 [US3] 更新 `apps/api/src/modules/slides/slides.controller.ts`，讓 status handler 回傳 failed、expired、unavailable responses
- [X] T050 [US3] 在 `apps/web/src/features/slide-generation/preview-job-failure-copy.ts` 實作 failure code 到使用者文案的 mapping，至少包含「生成失敗」、「生成逾時」、「無法取得此工作」與 retry/no-retry action guidance
- [X] T051 [US3] 在 `apps/web/src/features/slide-generation/PreviewJobProgressPanel.tsx` 新增 failed/timeout/unavailable 顯示狀態與 retry UI，畫面只顯示 sanitized user-facing title/message/action，不顯示內部錯誤細節
- [X] T052 [US3] 在 `apps/web/src/features/slide-generation/SlideGenerationFeature.tsx` 更新 frontend retry behavior，retry 必須建立 new job 並重置 polling state
- [X] T053 [US3] 在 `specs/003-async-preview-jobs/quickstart.md` 記錄 US3 evidence notes，包含 failed、timeout、unavailable 與 retry 顯示截圖或手動驗證描述

**Checkpoint**：US3 可獨立運作：failures 有界、安全、可追溯，且可 retry。

---

## Phase 6：Polish 與 Cross-Cutting Concerns

**目的**：完成跨 story 的最終驗證、清理與 evidence capture。

- [X] T054 [P] 從 `packages/domain/test/preview-job/`、`apps/api/test/`、`apps/web/src/features/slide-generation/` 移除 redundant 或 implementation-detail tests
- [X] T055 [P] 在 `packages/domain/test/preview-job/` 補上任何缺漏的 focused job lifecycle rule tests
- [X] T056 執行完整 domain/contracts/API/web test suite，並把摘要記錄到 `specs/003-async-preview-jobs/quickstart.md`
- [X] T057 執行 `pnpm --filter @slides-agent/domain build`、`pnpm --filter @slides-agent/contracts build`、`pnpm --filter @slides-agent/api build`、`pnpm --filter @slides-agent/web build`，並把摘要記錄到 `specs/003-async-preview-jobs/quickstart.md`
- [X] T058 執行 Playwright polling/progress checks，並把摘要記錄到 `specs/003-async-preview-jobs/quickstart.md`
- [ ] T059 依 `specs/003-async-preview-jobs/quickstart.md` manual verify 一個成功 long-running job、一個 failed job、一個 timeout job、一個 unavailable job，以及 retry behavior
- [ ] T060 手動檢查 `apps/web/src/features/slide-generation/PreviewJobProgressPanel.tsx` 的 failed/timeout/unavailable 畫面，確認使用者看得到清楚標題、簡短原因、下一步 action，且不看到 raw provider errors、prompts、API keys、stack traces、model identifiers
- [X] T061 驗證 successful job results 仍通過 002 slide JSON schema、self-contained HTML、keyboard navigation、responsive checks，範圍包含 `packages/domain/test/rendering/` 與 `apps/web/tests/e2e/`
- [X] T062 驗證 public job responses 不會暴露 provider raw errors、API keys、full prompts、stack traces、model identifiers，測試檔為 `apps/api/test/slides-preview-jobs.contract.test.ts`
- [X] T063 驗證 `package.json`、`apps/api/package.json`、`pnpm-lock.yaml` 未引入 Redis/BullMQ dependency 或 durable persistence
- [X] T064 驗證 future Redis/BullMQ path 仍記錄於 `specs/003-async-preview-jobs/research.md` 與 `specs/003-async-preview-jobs/plan.md`
- [X] T065 執行 `git diff --check`，並在 `specs/003-async-preview-jobs/quickstart.md` 捕捉 final evidence note

---

## 相依性與執行順序

### Phase Dependencies

- **Setup（Phase 1）**：沒有相依。
- **Foundational（Phase 2）**：依賴 Setup；阻塞所有 user story implementation。
- **User Story 1（Phase 3）**：依賴 Foundation；MVP。
- **User Story 2（Phase 4）**：依賴 Foundation，並承接 US1 create-job path；也可用 store fixtures 獨立測試。
- **User Story 3（Phase 5）**：依賴 Foundation；failure mapping 可用 controlled runner fixtures 獨立測試，retry UI 依賴 US1 create-job path。
- **Polish（Phase 6）**：依賴已選 user stories 完成。

### User Story Dependencies

- **US1**：必要 MVP。交付 job creation 與 immediate tracking。
- **US2**：建立在 job creation 上，加入 polling 與 success result。
- **US3**：建立在 job lifecycle 上，加入 timeout、sanitized failure、unavailable/expired response 與 retry。

### 每個 User Story 內的順序

- 必須先寫測試，並確認 red 或尚未實作。
- 先做 domain lifecycle behavior，再接 API/service wiring。
- 先做 contract tests，再實作 endpoint。
- 先做 frontend unit tests，再改 UI。
- 先做 Playwright tests，再完成最後 browser behavior implementation。
- 只有 green 後才 refactor。
- story 完成前，移除或簡化沒有 current consumers 的 domain artifacts。

### 可平行執行機會

- Setup 任務 T002-T004 可平行。
- Foundation 測試 T005-T006 可平行。
- 每個 story 內標記 [P] 的測試任務可平行。
- 測試就位後，不同檔案的 domain/API/web 任務可平行。
- Polish verification 中 T054-T055 可平行；T056-T065 應在 implementation 完成後執行。

---

## 平行範例：US1

```text
Task: T014 在 packages/domain/test/preview-job/preview-job-service.test.ts 撰寫 failing domain lifecycle test
Task: T015 在 apps/api/test/slides-preview-jobs.contract.test.ts 撰寫 failing API create-job contract test
Task: T016 在 apps/api/test/slides-preview-jobs.contract.test.ts 撰寫 failing API invalid-request contract test
Task: T017 在 apps/web/src/features/slide-generation/preview-job-flow.test.tsx 撰寫 failing web job-acceptance state test
```

## 平行範例：US2

```text
Task: T025 撰寫 failing domain stage transition test
Task: T026 撰寫 failing API status/result contract test
Task: T028 撰寫 failing web polling state test
Task: T029 撰寫 failing Playwright polling test
```

## 平行範例：US3

```text
Task: T039 撰寫 failing domain timeout test
Task: T040 撰寫 failing domain failure sanitization test
Task: T041 撰寫 failing API failed/unavailable status test
Task: T043 撰寫 failing web failed/retry test
Task: T045 撰寫 failing web failure display copy test
```

---

## Implementation Strategy

### MVP First

完成 Phase 1、Phase 2、US1。此時 app 可以非同步接受 preview request，並在 2 秒內回傳可追蹤的 job id。

### Incremental Delivery

1. **US1**：建立 job 與 immediate progress state。
2. **US2**：poll status、更新 stages、回傳 completed preview result。
3. **US3**：加入 timeout、sanitized failure、unavailable/expired response 與 retry。
4. **Polish**：完整 verification、manual evidence 與 cleanup。

### Quality Bar

- 不得在 failing tests 前開始 implementation。
- 003 v1 不得新增 Redis/BullMQ dependency。
- 每個新增 domain artifact 都必須在上述 tasks 中有 current consumer。
- public responses 必須保持 sanitized。
- successful job results 必須保留 002 preview result contract 與 validation behavior。
