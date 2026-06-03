# Implementation Plan: Redis Worker Queue for Preview Jobs

**Branch**: `004-redis-worker-queue` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-redis-worker-queue/spec.md`

## Summary

把 003 的兩個程序內實作（`InMemoryPreviewJobStore`、`InProcessPreviewJobRunner`）替換成跨程序基礎建設：job 狀態持久化到 **Redis**，生成任務經由 **BullMQ** 佇列交給「獨立的 worker 程序」執行。API 端只負責驗證、入列、回傳 job id 與輪詢（讀 Redis）；worker 端以不開 HTTP 的獨立 entrypoint，透過 `NestFactory.createApplicationContext(SlidesModule)` 取得既有 `SlidesService` 跑完整 002 pipeline，並把階段／結果／失敗寫回 Redis。`PreviewJobStore` 與 `PreviewJobRunner` 兩個 domain port 不變——004 只新增 adapter 實作並刪除舊的程序內實作（不留 dead code）。

依使用者定案的四個決策：**Redis 為必要、fail-fast**（無 in-process 退路）；**佇列完全不重試**（崩潰／停滯由 5 分鐘逾時 sweep 收斂為 `failed`，使用者重送新 job）；**worker 同 repo、獨立 non-HTTP entrypoint、預設一個可多副本**；**Redis 採網路隔離 + TTL，不在應用層加密**。

**Artifact Language**: 本 plan 與相關 Spec Kit artifacts 使用繁體中文；domain model、schema keys、API field names、code identifiers 使用英文。

## Technical Context

**Language/Version**: TypeScript on Node.js `v20.19.5`

**Package Manager**: pnpm `10.30.3`，workspace 於 `apps/*` 與 `packages/*`。

**Primary Dependencies**: React + TypeScript 前端、NestJS API、共用 domain／contracts 套件、既有後端設定 LLM adapters 與 002 HTML/design/domain pipeline。**新增**：`bullmq`（佇列／worker）與 `ioredis`（BullMQ 所需 Redis client，同時供 RedisPreviewJobStore 使用）。

**Storage**: Redis（job 狀態、BullMQ 佇列）。job 狀態以 `preview-job:{id}` JSON 字串儲存，搭配 active-set 索引與 TTL 回收。無關聯式資料庫，無長期保存或 artifact 歷史。

**Testing**: TDD。Domain 層新增 pure serialization 測試；API 層新增 RedisPreviewJobStore、BullMqPreviewJobRunner、preview-job execution、timeout sweeper 的單元／整合測試（Redis 以可控 fake／記憶體替身或本機 Redis 驗證）；前端輪詢契約不變沿用 003 測試。002 的 rendering/design/content 測試仍是完成結果忠實度的權威。

**Target Platform**: 本機開發與部署皆為「API 程序 + 至少一個 worker 程序 + 一個 Redis」。生成的 self-contained HTML 仍可於瀏覽器直接開啟。

**Project Type**: 本機／可部署 web app，含 React 前端、NestJS 後端、獨立 worker 程序、共用 domain/contracts 套件。

**Performance Goals**:

- 有效 job 建立確認在 2 秒內可見（API 僅入列，預期遠快於 003）。
- **核心目標**：worker 忙於生成時，API 對輪詢／建立請求的回應延遲不被生成工作阻塞（與閒置時相近）。
- 輪詢狀態查詢在正常本機條件下於 500ms 內回傳（Redis GET + 反序列化）。
- 任一 job 自建立起 5 分鐘內未完成必須轉為 `failed`（sanitized timeout failure），即使 worker 停滯或崩潰。
- 成功完成的 job 結果仍須通過 002 schema、HTML validation、鍵盤導覽與 responsive smoke 檢查。

**Constraints**:

- Redis 為必要：不可用時 fail-fast 回安全錯誤、拒絕建立 job，無 in-process 退路。
- 佇列重試次數設為 0：任何失敗（含 worker 崩潰）→ `failed`，使用者重送新 job。
- provider/model 與 Redis/queue/worker 設定皆為後端 runtime configuration，不出現在公開 job 請求／回應欄位；錯誤訊息不得洩漏 API key、provider 原始錯誤、完整 prompt、stack trace、Redis 連線字串或 queue 內部細節。
- 非同步執行不得改變來源內容、slide 順序、title/message 語意、outline 語意、speaker-note 事實、review warnings 或 design planning 來源忠實度邊界。
- 完成結果沿用 002 成功 preview result 形狀；公開 HTTP 契約沿用 003 不變。
- 每個新增的 domain／adapter 構件都必須有 004 任務中的當前消費者；不引入未被消費的抽象。

**Scale/Scope**:

- 預設：1 個 API 程序 + 1 個 worker 程序 + 1 個 Redis；設計允許多個 API 副本與多個 worker 副本共用同一 Redis。
- 同時追蹤多個 job（Redis 持久化，受 TTL 與本機資源限制）。
- worker 併發上限以 config 控制，預設保守（建議 1）。
- 代表性輸入／輸出規模沿用 002：貼上的來源內容產出約 3–8 張 slides。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification First**: PASS。已接受來源為 [spec.md](./spec.md)。四個高影響模糊點已於 Clarifications 解決（Redis 必要 fail-fast、不重試、worker entrypoint+可多副本、網路隔離+TTL），無阻擋規劃的未解問題。
- **Behavior-Driven User Value**: PASS。三個 user story 皆有 Given/When/Then，且可獨立展示與測試（US1 主程序卸載、US2 持久化/跨重啟、US3 worker 失敗安全收斂）。
- **Source Fidelity**: PASS。004 不改變生成內容，僅改變儲存與執行位置；worker 包覆既有 002 pipeline，須保留所有來源事實與語意。
- **Reviewable Generation**: PASS。成功 job 仍回傳 002 preview result（slide deck、design planning result、preview artifact、validation summary、generation summary、review report）；失敗 job 保留 reviewer-safe evidence（stage transitions、failed stage、failure category、fallback 使用、入列／消費時間）。
- **Web-First Deliverable**: PASS。self-contained HTML slides 仍為成功產物；004 僅改變長時間生成的承載方式。
- **Backend-Configured LLM Boundary**: PASS。job API 不暴露 provider/model；Redis/queue/worker 設定同屬後端設定，內部 evidence 可記錄 runtime 類別但不公開洩漏。
- **Coherent Deck Design System**: PASS。004 不重新詮釋 style direction，原樣承載 002 `DesignPlanningResult`。
- **Semantic Titles and Data Visualization**: PASS。004 不更動語意標題或 ChartIntent 規則，完成結果驗證沿用既有 002 測試。
- **Code Quality and Simplicity**: PASS WITH JUSTIFIED COMPLEXITY。新增複雜度限於 Redis store、BullMQ runner、worker entrypoint、timeout sweeper、serialization 與兩個新相依套件，且皆替換既有 port 的實作。強力佐證：port 接縫早在 003 為此預留、003 已明文指名 Redis+BullMQ、需求已被證實（主程序競爭、重啟即失、無法水平擴展）。舊的 in-memory store 與 in-process runner 會被刪除以免 dead code。詳見 Complexity Tracking。domain 仍維持 `*.types.ts`／`*.port.ts`／`*.service.ts` 分離，Redis/BullMQ 具體細節只存在 API/worker 層。
- **TDD and DDD**: PASS。首批失敗測試針對：preview-job 序列化（pure domain）、RedisPreviewJobStore 生命週期讀寫與 active-set/TTL、BullMqPreviewJobRunner 入列、preview-job execution 成功／失敗、timeout sweeper 收斂停滯 job、Redis 不可用 fail-fast。domain 概念沿用 003（PreviewJob/JobStatus/JobStage/PreviewResult/JobFailure/JobEvidence + 兩個 port）。
- **Lean Test Scope**: PASS。004 測試聚焦「持久化／佇列／worker／逾時」的可觀察行為，不重複 002/003 的 rendering/design/content/前端輪詢測試。
- **Consistent UX and Language**: PASS。沿用 preview job、queued、running、succeeded、failed、expired、stage、retry、result，新增一致使用 worker、queue、Redis、enqueue。
- **Performance and Operational Evidence**: PASS。回應／輪詢／逾時／主程序卸載目標明確。Evidence 包含 store/runner/execution/sweeper 測試、quickstart 手動驗證、入列與階段時間記錄。
- **Manual Verification Path**: PASS。quickstart 涵蓋同時啟動 API+worker+Redis、長時間成功 job、主程序卸載觀察、重啟 API 後續輪詢、worker 失敗收斂、安全錯誤、重試建立新 job、過期回收。
- **Release Verification**: PASS。成功 job 結果保留 002 slide JSON schema、HTML rendering、鍵盤導覽與 responsive 檢查。

## Project Structure

### Documentation (this feature)

```text
specs/004-redis-worker-queue/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── preview-job-queue.md     # 內部 API↔worker 佇列／Redis 契約；公開 HTTP 契約沿用 003 不變
└── tasks.md                     # /speckit.tasks 產出（非本步驟）
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── modules/slides/
│   │   │   ├── slides.controller.ts          # 不變（入列＋輪詢已在 003 完成）
│   │   │   ├── slides.service.ts             # 不變（generatePreview + onStage）
│   │   │   ├── slides.module.ts              # 改：store→Redis、runner→BullMQ、新增 Redis 連線 provider
│   │   │   ├── slides.tokens.ts              # 新增 REDIS_CONNECTION / PREVIEW_JOB_QUEUE token
│   │   │   ├── redis-preview-job-store.ts    # 新：實作 PreviewJobStore（ioredis）
│   │   │   ├── bullmq-preview-job-runner.ts  # 新：實作 PreviewJobRunner（入列）
│   │   │   ├── preview-job-execution.ts      # 新：抽出的生成執行邏輯（worker 與測試共用）
│   │   │   ├── preview-job-timeout-sweeper.ts# 新：active-set 逾時 sweep + 多副本 lease
│   │   │   ├── queue.config.ts               # 新：Redis 連線與 queue/worker 設定
│   │   │   ├── in-memory-preview-job-store.ts    # 刪除（dead code）
│   │   │   └── in-process-preview-job-runner.ts  # 刪除（dead code）
│   │   ├── worker/
│   │   │   └── worker.main.ts                # 新：非 HTTP worker entrypoint（app context + BullMQ Worker）
│   │   └── main.ts                           # 不變（HTTP API 啟動）
│   ├── package.json                          # 新增 bullmq、ioredis 相依與 worker scripts
│   └── test/
│       ├── redis-preview-job-store.test.ts
│       ├── bullmq-preview-job-runner.test.ts
│       ├── preview-job-execution.test.ts
│       └── preview-job-timeout-sweeper.test.ts
└── web/                                       # 不變（輪詢流程透明）

packages/
├── domain/
│   ├── src/preview-job/
│   │   ├── preview-job.types.ts              # 不變
│   │   ├── preview-job-store.port.ts         # 不變
│   │   ├── preview-job-runner.port.ts        # 不變
│   │   ├── preview-job.service.ts            # 不變
│   │   ├── preview-job-timeout.ts            # 不變（sweeper 重用）
│   │   └── preview-job-serialization.ts      # 新：PreviewJob ↔ JSON（Date↔ISO）pure 函式
│   └── test/preview-job/
│       └── preview-job-serialization.test.ts
└── contracts/                                # 不變（公開 job 契約沿用 003）
```

**Structure Decision**: 維持 003 的 `preview-job` domain 邊界與兩個 port 不動，004 的具體基礎建設（Redis、BullMQ、ioredis）只落在 API/worker 層的新 adapter；domain 僅新增一個 pure serialization 模組（有當前消費者 RedisPreviewJobStore）。worker 以 `apps/api/src/worker/worker.main.ts` 作為同 repo 的獨立 non-HTTP entrypoint，重用 `SlidesModule` 的 DI 取得既有 `SlidesService`。刪除舊的程序內 store/runner 以免 dead code。

## Complexity Tracking

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------------|------------|-------------------------------------|
| 新增 `bullmq` + `ioredis` 相依 | 需要持久化佇列、鎖定／可見度、併發上限與跨程序消費，才能把生成移出 API 主程序並在重啟後存活 | 自建 DB／記憶體佇列需重造鎖定、可見度、背壓、stalled 偵測；維護成本高且易錯。003 已指名此方案 |
| `RedisPreviewJobStore`（實作既有 port） | API 建立／輪詢與 worker 更新需共享、可跨重啟與跨實例的 job 狀態 | 003 的 in-memory `Map` 重啟即失、跨實例不可見，無法滿足 US2 |
| `BullMqPreviewJobRunner`（實作既有 port） | 把生成入列交給獨立 worker，API 不再於主程序執行生成 | 003 的 `void this.run(job)` 仍佔用 API 主程序資源，正是要解決的問題 |
| 獨立 worker entrypoint（`worker.main.ts`） | 生成需在與 HTTP API 分離的程序執行；需 DI 取得帶 LLM adapters 的 SlidesService | 在 API 程序內開 BullMQ Worker 仍與 HTTP 服務共用 event loop／資源，無法達成主程序卸載 |
| `preview-job-execution.ts`（抽出執行邏輯） | worker 與測試需重用同一段「跑 pipeline＋更新階段/結果/失敗」邏輯，且要可獨立測試 | 把邏輯內嵌在 worker entrypoint 難以單元測試、且重啟 in-process 概念已刪除 |
| `preview-job-timeout-sweeper.ts` + active-set 索引 | worker 崩潰無法自報失敗；需 worker 外路徑把停滯 `running`/`queued` job 於 5 分鐘收斂 `failed`（FR-008） | 僅靠 worker 內 onStage 逾時檢查在 worker 崩潰時失效；KEYS 全掃描在大量 key 時昂貴，故用 active-set |
| 多副本 sweep lease（Redis `SET NX PX`） | 允許多個 API 副本時，避免重複 sweep | 不加 lease 在單副本可行，但多副本會重複掃描；lease 成本極小且讓 FR-018 多副本正確 |
| domain `preview-job-serialization.ts` | Redis 以 JSON 字串保存，需在 Date 與 ISO 字串間可逆轉換且維持 PreviewJob 形狀 | 在 store 內就地手刻轉換會把 domain 形狀知識散落到 adapter，且難以 pure 測試 |

## Evidence Plan

- **Automated Evidence**：domain serialization 來回測試；RedisPreviewJobStore 的 create/findById/markX/active-set/TTL/expire 測試；BullMqPreviewJobRunner 入列測試；preview-job execution 成功／失敗／逾時測試；timeout sweeper 收斂停滯 job 與 lease 測試；Redis 不可用 fail-fast 測試。
- **Manual Verification**：quickstart 步驟——啟動 Redis（docker）+ API + worker；送出長時間成功 job 並在 worker 忙碌時連續輪詢／建立以觀察 API 不被阻塞；重啟 API 後以原 job id 輪詢仍可追蹤；觸發 worker 失敗與逾時收斂；確認重試建立獨立新 job；確認過期回收；確認無敏感細節外洩。
- **Operational Evidence**：入列確認時間、輪詢回應時間、worker 消費與階段轉換時間、5 分鐘逾時路徑、完成結果驗證、active-set／TTL 回收觀察。
- **Decision Evidence**：research.md 記錄 Redis 必要 fail-fast、佇列不重試、worker entrypoint（app context）、timeout sweep + active-set、serialization、原子更新策略，以及被否決的更簡單替代方案。

## Phase 0 Research Output

See [research.md](./research.md)。

## Phase 1 Design Output

See [data-model.md](./data-model.md)、[contracts/preview-job-queue.md](./contracts/preview-job-queue.md)、[quickstart.md](./quickstart.md)。

## Post-Design Constitution Check

PASS。Phase 1 artifacts 維持規劃邊界：004 僅以 Redis store + BullMQ worker 替換 003 的 in-memory store + in-process runner，並刪除舊實作；不引入取消、多使用者權限、佇列優先序、自動擴縮、分散式追蹤、PPTX、編輯器或 publish-to-URL。所有新增構件（RedisPreviewJobStore、BullMqPreviewJobRunner、worker entrypoint、execution、timeout sweeper、serialization、兩個新套件）皆有 004 任務中的當前消費者與獨立可測路徑。公開 HTTP 契約與 002 成功結果形狀不變，來源忠實度、design planning、rendering 驗證與 review artifacts 全數保留。
