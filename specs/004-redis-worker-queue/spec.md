# Feature Specification: Redis Worker Queue for Preview Jobs

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `004-redis-worker-queue`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "之前沒處理好的 worker 和 redis issue。因為 LLM 生成每份 slides 都需要一些時間，不能讓 main thread 卡住，所以要設計一套 worker 搭配 redis 的模式，讓每個生成 slides 的任務在一個單獨的 worker 中進行。"

## 背景與目標

003（async-preview-jobs）已經把 preview 生成改成可追蹤的非同步 job，但 v1 為了維持 KISS，刻意採用兩個程序內（in-process）實作：

- `InMemoryPreviewJobStore`：job 狀態存在 API 程序的記憶體 `Map`。
- `InProcessPreviewJobRunner`：用 `void this.run(job)` 在「同一個 API 程序」內背景跑完整生成流程。

003 在 spec 內已明確把 Redis + BullMQ 列為後續工作（003 FR-016、CR-012、Assumptions）。本功能（004）就是兌現那條路徑：把 job 的儲存與執行從 API 程序搬出去，改用 Redis 持久化 job 狀態、用 BullMQ 佇列把每個生成任務交給「獨立的 worker 程序」處理。

需要 004 的證據（已被證實的需求，非臆測）：

1. **API 主程序資源競爭**：即使 003 是非同步回應，生成仍在 API 程序內執行；單份 slides 生成涉及多段 LLM 呼叫、JSON 解析與 HTML 組裝（實測整體可達數十秒到數分鐘），這些 CPU/event-loop/記憶體負擔會與 HTTP 請求服務互相競爭。
2. **重啟即失**：job 狀態只在記憶體 `Map`，API 重啟或崩潰時所有進行中與已完成的 job 全部消失，使用者輪詢只會得到 `unavailable`。
3. **無法水平擴展**：多個 API 實例各自持有自己的 `Map`；在實例 A 建立的 job，無法從實例 B 輪詢到狀態。
4. **缺少跨重啟的重試與背壓**：程序內背景任務沒有佇列、沒有 worker 併發上限、沒有跨重啟的重試或可見度控制。

## Clarifications

### Session 2026-06-03

- Q: Redis 在「本機開發環境」是否必要？Redis 不可用時系統應如何行為？ → A: **Redis 為必要，fail-fast**。API 與 worker 啟動及建立 job 時都需要 Redis；Redis 不可用時回安全錯誤並拒絕建立 job，不保留 003 的 in-process 退路，維持單一程式路徑。
- Q: 佇列層級是否要對失敗的 job 自動重試？ → A: **完全不重試**。任何失敗（含 worker 崩潰）皆不在佇列層自動重試；崩潰中斷的 job 由 5 分鐘逾時收斂為 `failed`，使用者以重送新 job 重試（沿用 003 契約）。
- Q: worker 的部署形態？ → A: **同 repo、獨立 entrypoint、可設定副本**。worker 與 API 共用程式碼基底，以不開 HTTP 的獨立 entrypoint 啟動；預設一個 worker，設計上允許多個 worker 副本共用同一 Redis。
- Q: 存在 Redis 的來源內容／結果要多強的保護？ → A: **網路隔離 + TTL，不加密**。依賴 Redis 網路隔離與 job TTL 回收控管，應用層不對來源內容／結果額外加密；符合本機／內部工具範圍與 KISS。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 生成不再佔用 API 主程序，送出後 API 立即可服務其他請求 (Priority: P1)

使用者送出 preview job 後，API 只負責「驗證 + 入列 + 回傳 job id」，實際的多段 LLM 生成在獨立的 worker 程序執行；即使有一份 slides 正在長時間生成，API 仍能即時接受並回應其他請求（建立新 job、輪詢既有 job、其他端點）。

**Why this priority**: 這是本功能的核心價值，也是 003 留下的主要技術債——把重負載從 API 主程序移到 worker，避免主程序被生成工作拖慢或卡住。

**Independent Test**: 可在 worker 正在處理一個長時間 job 的同時，對 API 連續送出多個輪詢／建立請求，驗證 API 的回應延遲不受生成工作影響，且生成工作確實在另一個程序中執行（以程序邊界或佇列消費 evidence 佐證）。

**Independent Demo**: 啟動 API 與 worker 兩個程序，送出一份大來源內容的 job，觀察 API 立即回傳 job id 並持續可即時回應輪詢，而生成進度由 worker 推進。

**Acceptance Scenarios**:

1. **Given** API 與 worker 已啟動且 Redis 可用，**When** 使用者送出有效 preview request，**Then** API 在 2 秒內回傳可查詢的 job（status 為 `queued`），且不在 API 程序內執行生成。
2. **Given** 一個 job 正在 worker 中長時間生成，**When** 使用者同時對 API 送出其他輪詢或建立請求，**Then** API 仍能即時回應，回應延遲不被生成工作阻塞。
3. **Given** 一份有效 job 已入列，**When** worker 消費該 job，**Then** 生成在獨立 worker 程序執行，並把階段、結果或失敗寫回共享的 job 狀態。

---

### User Story 2 - job 狀態持久化，API/worker 重啟後仍可追蹤 (Priority: P2)

job 的狀態（queued/running/各階段/succeeded/failed、結果或失敗原因、evidence）存放在 Redis；不論是哪個 API 實例收到輪詢，都能讀到同一份最新狀態，且 API 或 worker 重啟後既有 job 不會無故消失。

**Why this priority**: 解決 003 in-memory 的「重啟即失」與「無法水平擴展」兩大限制，是讓非同步 job 可在實際部署中可靠運作的前提。

**Independent Test**: 建立一個 job，使其進入 running 後重啟 API 程序，再以同一 job id 輪詢，驗證仍能取得正確狀態；並以兩個 API 實例分別建立與輪詢，驗證跨實例可見。

**Independent Demo**: 建立 job → 重啟 API → 用原 job id 輪詢仍看到進行中或已完成狀態；用第二個 API 實例輪詢第一個實例建立的 job 也能讀到。

**Acceptance Scenarios**:

1. **Given** 一個 job 已建立並寫入 Redis，**When** API 程序重啟後使用者以原 job id 輪詢，**Then** 系統回傳該 job 當前的真實狀態（而非 `unavailable`），只要其尚未過期。
2. **Given** 兩個 API 實例共用同一 Redis，**When** 使用者在實例 A 建立 job 後於實例 B 輪詢，**Then** 實例 B 回傳相同 job 的狀態與結果。
3. **Given** 一個已完成的 job，**When** 其保留期限到期，**Then** 系統依既有過期規則回收狀態並對輪詢回報 `expired`，且不重新生成內容。

---

### User Story 3 - worker 失敗或崩潰時，job 不會永久卡在 running，且錯誤仍安全可追溯 (Priority: P3)

當 worker 在生成過程中失敗、逾時或程序崩潰時，job 會轉為安全的 `failed`（或在可重試的 infra 暫時性錯誤下依設定重試後才 failed），使用者看到的失敗訊息維持 003 的安全契約（不洩漏 provider 原始錯誤、API key、完整 prompt、stack trace），reviewer 可從 evidence 追溯失敗階段與是否重試。

**Why this priority**: 把執行移到獨立 worker 後新增了「worker 崩潰／佇列消費失敗」這類故障面；必須確保這些故障也有明確的失敗路徑，且不退化 003 已建立的安全與可追溯性。

**Independent Test**: 以可控方式讓 worker 在某階段拋錯或模擬崩潰，驗證 job 最終轉為 `failed`、失敗訊息安全、失敗階段可見；並驗證整體 5 分鐘逾時上限仍生效。

**Independent Demo**: 觸發一個 worker 端失敗 job，前端顯示安全失敗狀態與可重試訊息；reviewer 從 evidence 看到最後成功階段、失敗階段、錯誤分類與是否曾重試／fallback。

**Acceptance Scenarios**:

1. **Given** worker 在某生成階段失敗，**When** 使用者輪詢 job 狀態，**Then** 系統回傳 `failed`、安全錯誤碼、安全錯誤訊息與失敗階段，內容不含 provider 原始錯誤、API key、完整 prompt 或 stack trace。
2. **Given** worker 程序在處理 job 時崩潰，**When** 該 job 超過 5 分鐘仍未完成，**Then** 系統依逾時規則把 job 標記為 `failed`，使用者不會永久停在 running。
3. **Given** 一個 job 失敗，**When** 使用者重試，**Then** 系統建立一個可獨立追蹤的新 job，新 job 不覆蓋舊 job 的狀態或 evidence。

---

### Edge Cases

- Redis 在 API 送出 job 當下不可用：fail-fast，回安全錯誤並拒絕建立 job（無 in-process 退路），錯誤訊息不得洩漏連線字串或內部細節。
- Redis 在 worker 處理途中斷線後恢復：job 狀態不得遺失或污染，重連後狀態仍一致。
- 同一 job 被多個 worker 重複消費：必須由佇列鎖定／可見度機制保證單一 job 不會被同時生成兩次而互相覆蓋結果。
- worker 處理途中崩潰：因不自動重試，job 不會被重新消費；需由 worker 外的 5 分鐘逾時 sweep 把停滯的 `running` job 收斂為 `failed`，不得永久停在 running。
- 佇列累積大量待處理 job（超過 worker 併發上限）：超量 job 維持 `queued` 並依序處理，不得讓 API 或 worker 因背壓而崩潰。
- 已完成／已過期 job 的 Redis 鍵：需有 TTL 或回收機制，避免結果（含 HTML 負載）無限累積。
- 重複送出相同來源內容：仍各自建立可獨立追蹤的 job，不因佇列去重而混淆結果（除非後續明確加入去重）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a valid preview request, persist the new job to a Redis-backed store, enqueue it for asynchronous processing, and return a trackable job id without performing generation inside the API process.
- **FR-002**: System MUST process each enqueued preview job in a worker process that is separate from the HTTP API process, so generation work does not consume the API process's request-serving capacity.
- **FR-003**: System MUST persist job lifecycle state (status, current stage, created/updated/expiry time, request summary, result or failure, evidence) in Redis so that state survives API process restarts within the job's retention window.
- **FR-004**: System MUST allow any API instance sharing the same Redis to read a job's current status and result, so polling works regardless of which instance created the job.
- **FR-005**: System MUST keep the existing public job contract from 003 unchanged: job id, status values (queued/running/succeeded/failed/expired/unavailable), current stage, created/updated time, successful preview result shape, and sanitized failure shape.
- **FR-006**: System MUST preserve validated request semantics during queued/worker processing and MUST NOT change source content, slide order, title/message meaning, outline meaning, or speaker-note factual content.
- **FR-007**: Worker MUST update job stage transitions as generation proceeds, and MUST write the final successful preview result (slide deck, design planning result, preview artifact, validation summary, generation summary, review report) back to the shared store.
- **FR-008**: System MUST enforce the same overall 5-minute job timeout from 003; a job that has not completed within 5 minutes of creation MUST be marked failed even if the worker stalls or crashes. Because a crashed worker cannot mark itself failed, the system MUST have an out-of-worker path (e.g. a timeout sweep) that converts stalled `running` jobs to `failed`.
- **FR-009**: System MUST return sanitized failure information identifying the failed stage and safe error category without leaking provider raw messages, prompts, API keys, stack traces, queue internals, or Redis connection details.
- **FR-010**: System MUST ensure a single job is not processed concurrently by more than one worker (queue-level locking / visibility), so two workers cannot overwrite each other's result for the same job.
- **FR-011**: System MUST bound worker concurrency via configuration so a worker does not exceed a safe number of simultaneous generations; excess jobs MUST remain queued and be processed in order.
- **FR-012**: System MUST reclaim completed/failed/expired job state from Redis (e.g. TTL or sweep) so result payloads, including HTML, do not accumulate without bound.
- **FR-013**: Redis is REQUIRED. When Redis is unavailable at startup or at job submission, the system MUST fail fast with a safe user-facing error and MUST NOT create a job; there is no in-process fallback path. Redis connection errors MUST NOT leak connection strings or internal details to public responses.
- **FR-014**: The queue MUST NOT automatically retry failed jobs. Any failure — including a generation-stage error or a worker crash mid-job — results in the job becoming `failed` (a crashed/stalled job via the FR-008 timeout path), and the user retries by creating a new job (unchanged from 003). Queue retries MUST be disabled (BullMQ `attempts: 1` — a single attempt, no retry).
- **FR-015**: Users MUST be able to retry after a failed job by creating a new independently traceable job, unchanged from 003.
- **FR-016**: System MUST keep provider and model selection as backend runtime configuration; Redis connection settings, queue names, and worker configuration MUST also be backend runtime configuration and MUST NOT be exposed as user request fields or public response fields.
- **FR-017**: Frontend behavior MUST remain unchanged from 003's contract: submit → progress polling → completed/failed; the move to Redis/worker MUST be transparent to the existing frontend polling flow.
- **FR-018**: System MUST provide a documented way to run the worker process alongside the API in local development and in deployment, including required Redis configuration. The worker MUST run from the same code base as a separate non-HTTP entrypoint. The default is a single worker process, and the design MUST allow running multiple worker replicas against the same Redis without correctness loss (guaranteed by FR-010).

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: 生成內容的來源忠實度規則完全沿用 002/003，搬到 worker 執行不得改變數字、日期、命名實體、決策、風險、限制、負責人、期限與權衡。本功能不引入新的內容轉換。
- **CR-002 Review Report**: 成功 job 的結果仍包含 002/003 的 review report（assumptions、省略／壓縮內容、不確定主張、charting 決策、人工審查與設計審查註記）；搬到 worker 不得隱藏這些輸出。
- **CR-003 Web-First Output**: 成功 job 仍以 self-contained HTML slides 為主要產物，worker 產出與 003 同形狀。
- **CR-004 Backend-Configured LLM Boundary**: provider/model 仍為後端設定；新增的 Redis/queue/worker 設定同屬後端設定，公開的建立／狀態／結果／失敗回應不得洩漏 model id、API key、完整 prompt、provider 原始錯誤、Redis/queue 內部細節。
- **CR-005 Design System**: 成功 job 結果保留 002 的 design planning 契約（deck 級 design system、視覺密度、字體／色盤／間距／版面網格、slide pattern 指派、chart 處理、視覺層級、無障礙註記、設計審查註記）。本功能不改變設計層。
- **CR-006 Semantic Titles**: 沿用 002 的語意標題規則，標題僅在有來源依據時概括段落／slide 意義；本功能不改變標題邏輯。
- **CR-007 Data Visualization**: 沿用 002 的 ChartIntent 決策與數值忠實度（單位、期間、分母、數值）；本功能不改變圖表邏輯。
- **CR-008 TDD Coverage**: 測試須涵蓋——job 入列至 Redis、worker 消費並推進階段、跨重啟讀取狀態、跨實例可見、worker 失敗轉 failed、5 分鐘逾時、單一 job 不被重複消費、過期回收、Redis 不可用時的安全行為——皆於實作前先寫失敗測試或可執行驗證任務。
- **CR-009 Domain Model**: 沿用 003 的 domain 邊界（`PreviewJob`、`JobStatus`、`JobStage`、`PreviewResult`、`JobFailure`、`JobEvidence`、`PreviewJobStore` port、`PreviewJobRunner` port）；004 以新的 adapter 實作既有 port，domain 層不得混入 Redis／BullMQ 具體細節。
- **CR-010 Lean Test Scope**: 測試聚焦在「佇列／worker／持久化」這層的可觀察行為與契約，不重複 002/003 既有的 rendering／design／content 測試，除非 004 行為改變它們。
- **CR-011 Behavior-Driven Value**: 上述每個 user story 皆含 Given/When/Then，且可獨立展示與測試。
- **CR-012 Code Simplicity**: 004 範圍限於「以 Redis store + BullMQ worker 替換 003 的 in-memory store + in-process runner」。明確排除：取消功能、多使用者權限、佇列優先序／多佇列、自動擴縮基礎設施、分散式追蹤、PPTX、編輯器、publish-to-URL。新增複雜度（Redis、BullMQ、獨立 worker 程序）必須在 plan 記錄被否決的更簡單替代方案（見下方 Assumptions 與 plan）。
- **CR-013 Consistent Language**: UI、狀態回應、review 註記、quickstart、evidence 一致使用既有詞彙：preview job、queued、running、succeeded、failed、expired、stage、retry、result，並新增一致使用 worker、queue、Redis、enqueue。
- **CR-014 Performance and Evidence**: job 入列確認應在 2 秒內可見；API 回應延遲在 worker 忙碌時不得被生成工作阻塞；evidence 須記錄入列、worker 消費、階段轉換、完成／失敗、逾時、重試（若有）、過期回收與手動驗證。
- **CR-015 Manual Verification**: 手動驗證須涵蓋——同時啟動 API 與 worker、送出長時間成功 job 並觀察 API 仍即時回應、重啟 API 後仍可輪詢、觸發 worker 失敗、確認安全錯誤訊息、確認重試建立新 job、確認過期回收。
- **CR-016 Verification**: 成功 job 結果仍保留對 slide JSON schema、HTML self-contained、鍵盤導覽與基本 responsive 的驗收覆蓋（沿用 002/003）。

### Key Entities *(include if feature involves data)*

- **PreviewJob**（沿用 003）：一個被接受的 preview 請求及其生命週期；004 將其狀態持久化到 Redis 而非記憶體 Map。
- **PreviewJobStore**（既有 port，新增 adapter）：job 持久化邊界；004 新增 Redis-backed 實作 `RedisPreviewJobStore`，取代 `InMemoryPreviewJobStore`。
- **PreviewJobRunner**（既有 port，新增 adapter）：job 執行邊界；004 改為把 job 入列到 BullMQ，由 worker 程序消費，取代 `InProcessPreviewJobRunner`。
- **PreviewJobQueue**：BullMQ 佇列抽象，承載「待生成的 job」，提供入列、消費、鎖定／可見度、併發上限與（infra 層）重試。
- **PreviewJobWorker**：獨立的 worker 程序進入點，消費佇列、呼叫既有生成流程、把階段／結果／失敗寫回 store；不開 HTTP。
- **JobEvidence / JobFailure**（沿用 003）：可追溯與安全失敗的既有結構；004 在 evidence 中補記入列、worker 消費與重試資訊。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 當一份 job 正在 worker 中生成時，API 對輪詢／建立請求的回應時間維持在與閒置時相近的水準（不因生成工作而出現可感知的阻塞或排隊延遲）。
- **SC-002**: 至少 95% 的有效 preview 送出在 2 秒內取得 job 接受回饋（status `queued`），與 003 相同。
- **SC-003**: 在 job 進行中重啟 API 程序後，以原 job id 輪詢仍能取得正確狀態（非 `unavailable`），只要 job 未過期。
- **SC-004**: 由兩個 API 實例共用同一 Redis 時，任一實例皆能讀到另一實例建立之 job 的狀態與結果。
- **SC-005**: worker 失敗、崩潰或逾時的 job，在 5 分鐘內收斂為安全的 `failed` 狀態，且絕不洩漏 API key、provider 原始錯誤、完整 prompt、stack trace 或 Redis/queue 內部細節。
- **SC-006**: 完成／失敗／過期的 job 狀態會被回收，Redis 中的 job 鍵不會無限累積。
- **SC-007**: 手動驗證可從「送出 → 入列 → worker 消費 → 完成或失敗」以記錄的 evidence 完整追溯一個成功 job 與一個失敗 job，無需重跑整個 demo。

## Assumptions

- 003 的非同步 job 公開契約（job id、狀態值、階段、成功結果形狀、安全失敗形狀、前端輪詢流程）維持不變；004 只替換底層儲存與執行機制。
- 既有的 `PreviewJobStore` 與 `PreviewJobRunner` port 是穩定接縫；004 以新 adapter 實作，domain 層不需更動具體生成邏輯。
- Redis 與 BullMQ 為本功能選定的持久化佇列方案，理由：003 已指名此路徑、為業界成熟方案、提供持久化＋多 worker＋鎖定＋重試／背壓，避免自行重造佇列。
- 被否決的更簡單替代方案（將於 plan 詳述）：(a) 維持 003 in-process + in-memory——無法解決主程序競爭、重啟即失、無法水平擴展；(b) 僅用 Node `worker_threads`／`child_process` 不接 Redis——仍重啟即失、跨實例不可見、需自行實作重試與鎖定；(c) 自建 DB 輪詢佇列表——重造 BullMQ 既有的鎖定／可見度／重試／背壓，維護成本更高。
- worker 與 API 共用同一個 repo／程式碼基底與既有生成流程，僅以不同 entrypoint 啟動（worker 不開 HTTP）。
- 取消（cancellation）、多使用者授權、佇列優先序、自動擴縮基礎設施維持 out of scope。
- 完成的 job 結果僅供即時 preview review，仍非長期儲存或發佈；Redis 中的保留期限沿用 003 的 expiry 語意。
- 部署面（容器編排、Redis 供應、worker 副本數）的細節由 plan／quickstart 文件描述，不在本 spec 規定具體基礎設施廠商。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: 成功 job 結果仍揭露 002/003 的生成 assumptions（slide review report 與設計審查註記）；搬到 worker 不改變揭露內容。
- **Omitted or Compressed Content Policy**: 沿用 002/003 對省略／壓縮來源內容的回報政策；不得因改為佇列／worker 處理而隱藏。
- **Uncertain Claims Policy**: 不確定或無依據主張仍須保留在 review artifacts；失敗或被重試中的 job 不得把部分生成內容當成最終真相呈現。
- **Sensitive Content Handling**: 來源內容僅透過既有後端設定的生成 provider 處理；新增的 Redis 中僅儲存 job 狀態、請求摘要與生成結果。依本功能決議，採**網路隔離 + TTL**控管：Redis 不對外開放、job 鍵設定 TTL 自動回收，應用層不對來源內容／結果額外加密。公開回應與錯誤訊息不得包含 API key、provider 原始錯誤、完整 prompt、model id、stack trace、Redis 連線字串或 queue 內部細節。
- **Evidence and Traceability**: 每個 job 須保留足以追溯 accepted input、validation、入列、worker 消費、階段轉換、fallback／repair、重試（若有）、逾時／失敗與最終結果的 evidence，且不改變 slide 語意、不需重跑 job。
- **Manual Verification Path**: 手動驗證須同時啟動 API 與 worker，送出一個長時間成功請求與一個可控失敗請求，觀察 API 在 worker 忙碌時仍即時回應、重啟 API 後仍可輪詢、檢視完成 artifacts、檢視失敗訊息安全性、確認重試建立獨立新 job、確認過期回收，並確認無敏感 provider／infra 細節外洩。
