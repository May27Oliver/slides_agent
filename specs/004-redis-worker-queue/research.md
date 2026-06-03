# Research: Redis Worker Queue for Preview Jobs

**Feature**: `004-redis-worker-queue`
**Date**: 2026-06-03

## Decision: 以 Redis + BullMQ 替換 003 的 in-process queue

**Rationale**:

- 003 已明文（FR-016、CR-012、Assumptions）把 Redis + BullMQ 列為「當需要跨 process persistence、restart-safe retry、worker pool 或多 API instance 時」的後續路徑；該需求現已被證實。
- 已被證實的痛點：(1) 即使 003 非同步回應，生成仍在 API 主程序執行，與 HTTP 服務競爭 CPU/event-loop/記憶體；(2) job 狀態只在記憶體 `Map`，API 重啟即失；(3) 多 API 副本各自持有 `Map`，跨實例不可見。
- BullMQ 為 Redis-backed、業界成熟的 Node.js job queue，內建 worker 併發、job 鎖定／可見度、stalled 偵測與 completed/failed 狀態；避免自行重造佇列語意。
- `PreviewJobStore` 與 `PreviewJobRunner` port 早在 003 為此預留，替換成本集中在 adapter 層，domain 不動。

**Alternatives considered**:

- **維持 003 in-process + in-memory**：rejected。無法解決主程序競爭、重啟即失、跨實例不可見——正是本功能要解決的問題。
- **僅用 Node `worker_threads` / `child_process`，不接 Redis**：rejected。生成為 LLM/network I/O-bound 而非 CPU-bound，thread 無助益；且仍重啟即失、跨實例不可見，並需自行實作鎖定／重試／狀態查詢。
- **自建 DB（或 Redis list）輪詢佇列表**：rejected。需自行實作鎖定、可見度、stalled 偵測、背壓與清理，重造 BullMQ 既有能力，維護成本更高且易錯。

## Decision: Redis 為必要相依，fail-fast（無 in-process 退路）

**Rationale**:

- 維持單一程式路徑，降低分支與測試面；避免「兩套 runtime（記憶體 vs Redis）」的長期維護負擔（符合憲章 KISS）。
- 部署形態本就需要 Redis；本機開發以一個容器化 Redis 即可滿足。
- Redis 不可用時，建立 job 立即 fail-fast 回安全錯誤、拒絕建立，不讓使用者落入無法追蹤的狀態。

**Alternatives considered**:

- **無 Redis 時退回 003 in-process 模式**：rejected（使用者定案）。雖改善本機免裝 Redis 的便利性，但需長期維護兩套執行路徑，與 KISS 衝突，且容易讓「本機行為」與「部署行為」分歧而隱藏問題。

## Decision: 佇列完全不自動重試

**Rationale**:

- 沿用 003 契約：失敗即 `failed`，由使用者重送新 job（新 job 可獨立追蹤）。
- 生成失敗多為內容相關或 provider 拒絕，屬偏確定性失敗；自動重試只會重複耗用 LLM 成本。
- worker 崩潰／停滯的 job 不被重新消費，改由 worker 外的 5 分鐘逾時 sweep 收斂為 `failed`（見下）。

**Implementation note**: BullMQ job 的 `attempts` 設為 1（即不重試）、不設 backoff；`removeOnComplete` / `removeOnFail` 設為清理 BullMQ 自身的 job 記錄（與我們 `preview-job:{id}` 狀態鍵分開管理）。

**Alternatives considered**:

- **只重試 infra 暫時性錯誤**：rejected（使用者定案「完全不重試」）。可減少偶發崩潰的使用者重工，但需區分錯誤類別、增加判斷複雜度。
- **所有失敗重試 N 次**：rejected。確定性內容失敗會被重跑多次，浪費 LLM 成本並延後使用者得到失敗回饋。

## Decision: worker 為同 repo、獨立 non-HTTP entrypoint，預設一個、可多副本

**Rationale**:

- worker 重用既有 `SlidesModule` 的 DI（LLM adapters、`SlidesService`），故以 `NestFactory.createApplicationContext(SlidesModule)` 取得 application context 但**不** `listen` HTTP。
- 在該 context 上建立 BullMQ `Worker`，processor 載入 job 後呼叫抽出的 `preview-job-execution`（與 003 `InProcessPreviewJobRunner.run` 同邏輯）。
- 預設單一 worker；BullMQ 的 job 鎖定保證同一 job 不被多個 worker 同時消費（FR-010），故可水平增加 worker 副本。

**Alternatives considered**:

- **在 API 程序內開 BullMQ Worker**：rejected。雖少一個程序，但 worker 仍與 HTTP 服務共用同一 event loop／資源，無法達成「主程序卸載」的核心目標。
- **一開始就以多副本為設計與驗證目標**：rejected（使用者定案）。超出目前本機／內部工具需求；以 BullMQ 鎖定保留多副本正確性即可，不需先建多副本驗證基礎設施。

## Decision: 5 分鐘逾時改由 worker 外的 sweep 收斂

**Rationale**:

- 003 的逾時檢查發生在 `onStage` 回呼內（in-process runner）；但 worker 崩潰時不會再有 `onStage`，job 會永遠停在 `running`。
- 故新增 `preview-job-timeout-sweeper`：週期性掃描 active job，對 `hasPreviewJobTimedOut` 為真者以 `timeoutFailureForJob` 標記 `failed`（重用既有 `preview-job-timeout.ts`）。
- 為避免 `KEYS *` 全掃描，維護 Redis set `preview-job:active`（建立時加入、轉終態時移除）；sweep 只迭代此集合。
- 多 API 副本時，以 Redis 短期 lease（`SET sweep:lock NX PX`）確保每個 tick 僅一個副本執行 sweep。

**Alternatives considered**:

- **僅靠 worker 內逾時檢查**：rejected。worker 崩潰時失效，違反 FR-008。
- **僅靠 BullMQ stalled/lock TTL**：rejected。BullMQ 會偵測 stalled 並（若有 attempts）重排，但不會把我們的 domain job 標記為安全 `failed`、也不直接對應 5 分鐘 job 級上限。
- **`KEYS preview-job:*` 全掃描**：rejected。在大量 key 時阻塞 Redis；active-set 索引較安全。

## Decision: job 狀態以 `preview-job:{id}` JSON + TTL 保存，序列化抽成 pure domain 函式

**Rationale**:

- Redis 字串值存放 `PreviewJob` 的 JSON；`createdAt/updatedAt/expiresAt` 等 `Date` 需與 ISO 字串可逆轉換。
- 將轉換抽成 `packages/domain/src/preview-job/preview-job-serialization.ts`（pure，可來回測試），避免把 PreviewJob 形狀知識散落到 adapter。
- 對每個 job 鍵設定 TTL（對齊 `expiresAt` + 小緩衝），讓終態 job 結果（含 HTML）自動回收，不無限累積（FR-012）。

**Alternatives considered**:

- **Redis Hash 逐欄位儲存**：rejected。`evidence`、`result` 等為巢狀結構，JSON 字串較單純且與 domain 形狀一致。
- **在 store 內就地手刻 Date 轉換**：rejected。難以 pure 測試，且把 domain 形狀知識洩漏到 infra 層。

## Decision: job 狀態更新採「終態守門 + 條件寫入」避免競態覆蓋

**Rationale**:

- 同一 job 可能同時被 worker（推進階段）與 timeout sweeper（標記失敗）寫入。
- 既有 `PreviewJobService.markX` 已對終態 no-op（`isTerminalJobStatus`）；於 Redis 讀-改-寫時，以 BullMQ 單一消費保證 worker 端序列化，sweeper 端則在寫回前重讀並再次套用終態守門（必要時以 `WATCH`/樂觀鎖或小型 Lua 腳本確保「僅在非終態時更新」）。
- 採網路隔離 + TTL 控管敏感資料，應用層不加密（使用者定案）。

**Alternatives considered**:

- **每個 job 一把分散式鎖**：rejected。BullMQ 已序列化單一 job 的處理；只有 sweeper 與 worker 的少量交會，終態守門 + 條件寫入即足夠，分散式鎖屬過度設計。
- **應用層加密 Redis 內容**：rejected（使用者定案）。增加金鑰管理與複雜度，超出本機／內部工具範圍。

## Decision: 公開 HTTP 契約與前端輪詢流程不變

**Rationale**:

- 004 是底層儲存／執行替換；`POST /api/slides/preview-jobs`、`GET /api/slides/preview-jobs/:jobId` 的請求／回應形狀與 003 相同（FR-005、FR-017）。
- 前端輪詢、進度、完成／失敗呈現皆透明不變，降低 regression 風險。

**Alternatives considered**:

- **趁機調整回應形狀（如加入 queue 位置）**：rejected。會破壞 003 契約與前端，且非本功能目標；queue 內部細節不應公開（CR-004）。
