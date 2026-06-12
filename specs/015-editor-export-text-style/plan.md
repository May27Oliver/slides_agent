# Implementation Plan: 015 編輯頁匯出與文字樣式覆寫

**Branch**: `015-editor-export-text-style` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-editor-export-text-style/spec.md`

## Summary

在既有編輯頁（010/011/014）上加四件事：US1 下載 HTML（純前端複用 helper）、US4 左側預覽固定 16:9（純前端 CSS）、US3 逐欄位文字大小/顏色覆寫（domain 型別 + 單一 renderer 套用 + 編輯 UI）、US2 下載 PPTX（鏡射 preview-jobs 的非同步工作 + worker 無頭 chromium 截圖 + pptxgenjs）。技術路線見 [research.md](./research.md)、型別見 [data-model.md](./data-model.md)、契約見 [contracts/](./contracts/)。

**Artifact Language**: 本 plan 與相關 Spec Kit 產物以繁體中文撰寫。

## 三個 plan 鎖定點（使用者指定，全程貫穿）

1. **`SlideOutlineItem.id` 相容路徑**：client 惰性補發 → Save 才持久化 → server `mergeOutline` 「id 走 edited、`sourceTrace/emphasis` 走 text-FIFO」雙軌；schema 對缺 id 舊 revision 放行。詳 research R1 / data-model §1,§3。
2. **PPTX 三段式工作 contract**：建立 / 查狀態 / 下載 artifact 三端點，明確 owner scope、`revision` 驗證、TTL、timeout、單人併發=1。詳 contracts/pptx-export-job.contract.md。
3. **`textStyleOverrides` 單一真實來源**：型別與套用邏輯只在 domain；renderer 與 client LivePreview 走同一條 `applyDeckEdit` → 結構上不可能 parity 漂移。詳 research R3 / data-model §6。

## Technical Context

**Language/Version**: TypeScript（Node + React），monorepo（pnpm workspaces）。

**Primary Dependencies**: 既有 NestJS（api）、React + Vite（web）、BullMQ + Redis（worker）、@slides-agent/domain｜contracts。**新增**：`playwright`（worker chromium，研究 R2）、`pptxgenjs`（worker，pptx 組裝）、`nanoid`（或等價短碼，outline id）。

**Storage**: 既有 Postgres（deck/revision）、Redis（job 狀態）。PPTX artifact：檔案（容器 volume）+ TTL 清理（research R5）。

**Testing**: 既有 vitest（domain/contracts/api/web 單元 + 整合）、Playwright（web e2e）。

**Target Platform**: Linux server（EC2 / docker-compose，012）；瀏覽器前端。

**Project Type**: Web application（apps/api + apps/web + packages/*）。

**Performance Goals**: HTML 下載與樣式覆寫即時；PPTX ≤30 頁 90s 內、單人併發=1、最大 60 頁。

**Constraints**: 樣式覆寫值為列舉（天然 DoS 邊界）；PPTX 跨帳號隔離、無殘檔、TTL 清理。

**Scale/Scope**: 既有單機部署規模；PPTX 為資源密集但受併發/頁數上限保護。

## Constitution Check

*GATE：Phase 0 前、設計後各檢一次。*

- **Specification First**：spec 已 accepted（兩輪 clarify + 一輪 review，Ready for planning）；無阻擋 plan 的未解問題。
- **Behavior-Driven User Value**：四個 US 各有 Given/When/Then 且可獨立交付（US1/US4 可單獨 ship、US3 可單獨 ship、US2 為最後重切片）。
- **Source Fidelity**：樣式覆寫只動「呈現」，不改任何來源文字/數字；`mergeOutline` 的 `sourceTrace/emphasis` fidelity 邏輯**完全不動**（R1）。匯出為既有 revision 忠實再現。
- **Reviewable Generation**：無新生成內容，沿用既有 revision 的 review report；無新增需揭露的假設/省略/不確定宣稱。
- **Web-First Deliverable**：自包含 HTML 仍為主交付；PPTX 為**衍生匯出**（由既有 html 截圖），明確記錄為衍生輸出。
- **Backend-Configured LLM Boundary**：本 feature **不涉及任何 LLM**；樣式覆寫與 PPTX 皆確定性。無 provider/model 請求欄位。
- **Coherent Deck Design System**：大小為主題基準字級相對級距、顏色為主題色盤 token（4 角色）→ 套用走 `var(--type-*)`/`var(--text|accent|muted)`，換主題自動跟隨，不破壞 palette/typography/spacing。
- **Semantic Titles & Data Visualization**：標題語意與圖表轉換規則不變，僅允許調整呈現樣式；PPTX 截圖忠實反映既有圖表。
- **Code Quality & Simplicity**：最小可讀路徑——HTML 純前端複用 helper、16:9 純 CSS、樣式為有限列舉、PPTX 鏡射既有 preview-jobs（不發明新機制）、merge 沿用既有白名單擴一欄。**No dead code / shims**：merge 直接擴充（不保留 text-only 舊路徑的 shim）；`mergeOutline` 改寫取代舊版（同一改動內完成，不並存兩形狀）；`buildHtmlDownload` 直接擴參數（呼叫點同步更新，不留舊簽名）。型別分檔：domain `*.types.ts`、套用 `text-style-override.ts`（純函式）、job 的 `*.service.ts`/`*.port.ts`/`*-store.ts`/`*.runtime.ts` 鏡射 preview-jobs 命名。每個新型別/欄位皆有近期消費者（見 data-model §6 流向）。
- **TDD & DDD**：先寫 failing 測試（見 Phase）。主領域概念：`TextStyleOverride`（呈現覆寫）、`SlideOutlineItem.id`（綁定鍵）、`PptxExportJob`（匯出工作）。domain 行為落在 `deck-edit/slide-merge.ts`、`rendering/text-style-override.ts`、`pptx-export-job/*`。
- **Lean Test Scope**：聚焦可觀察行為（合併保 id+清孤兒、renderer 套用、job 狀態機與 scope、16:9、下載對應版本）；不重測 014/011 既有合併/主題路徑。
- **Consistent UX & Language**：固定詞彙——下載 HTML、下載 PPTX、文字樣式（大小/顏色）、重設樣式、匯出工作、16:9 預覽（CR-013）。
- **Performance & Operational Evidence**：PPTX 非同步 + timeout + 併發/頁數上限；證據 = job 狀態紀錄、schema 驗證測試、預覽比例快照、正式機一次實匯出。
- **Manual Verification Path**：見 [quickstart.md](./quickstart.md)（PPTX 開啟比對、16:9 縮放、樣式持久化、跨帳號隔離、EC2 實匯出）。
- **Release Verification**：slide JSON schema 對 `outline.id`/`textStyleOverrides` 有效性測試、HTML 渲染套用覆寫、既有鍵盤導覽不受影響、預覽 responsive（比例維持）。

**結論**：通過，無違規需記入 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/015-editor-export-text-style/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── text-style-and-revision.contract.md
│   └── pptx-export-job.contract.md
└── tasks.md            # /speckit.tasks 產出（本指令不建立）
```

### Source Code（受影響的真實路徑）

```text
packages/domain/src/
├── deck/deck.types.ts                       # +SlideOutlineItem.id +TextStyleOverride +Slide.textStyleOverrides
├── deck-edit/slide-merge.ts                 # mergeOutline 改寫 + textStyleOverrides 白名單 + normalize
├── deck-edit/text-style-normalize.ts        # (新) 去預設值/清孤兒
├── rendering/text-style-override.ts         # (新) 唯一套用邏輯：override → inline style
├── rendering/template-html-renderer.ts      # title/message/bullet 注入 style
└── pptx-export-job/                          # (新, 鏡射 preview-job)
    ├── pptx-export-job.types.ts
    ├── pptx-export-job.service.ts
    ├── pptx-export-job-serialization.ts
    ├── pptx-export-job-timeout.ts
    ├── pptx-export-job-store.port.ts
    └── pptx-export-job-runner.port.ts

packages/contracts/src/
├── deck.ts                                   # validateEditRevisionRequest：outline.id/textStyleOverrides 形狀
├── pptx-export-job.ts                        # (新) 對外 job 型別/驗證
└── pptx-export-request.ts                    # (新) 建立工作 request
packages/contracts/schemas/slide-generation.schema.json  # outline.id / textStyleOverrides optional

apps/api/src/modules/
├── decks/decks.controller.ts                 # edit 端點沿用（merge 已含新欄位）
└── pptx-export-jobs/                          # (新, 鏡射 preview-jobs 全套；見 research/Explore 清單)
    ├── pptx-export-jobs.controller.ts        # POST/GET/GET file 三端點
    ├── redis-pptx-export-job-store.ts
    ├── bullmq-pptx-export-job-runner.ts
    ├── pptx-export-job-queue.service.ts
    ├── pptx-export-job-execution.ts          # worker：chromium 截圖 + pptxgenjs 組裝
    ├── pptx-export-worker.runtime.ts
    ├── pptx-export-jobs-api.runtime.ts
    ├── pptx-export-job-timeout-sweeper.ts
    ├── pptx-export-request.parser.ts
    ├── pptx-export-jobs.module.ts / .providers.ts / .tokens.ts / queue.config.ts
apps/api/src/app/app.module.ts                 # 掛 PptxExportJobsModule（API 側）
apps/api/src/app/worker.module.ts              # 掛 PptxExportWorkerRuntime（worker 側）

apps/web/src/features/deck-editor/
├── DeckEditorView.tsx                         # 下載入口（HTML/PPTX）、dirty 守門、PPTX 輪詢
├── LivePreview.tsx                            # 16:9 letterbox 框
├── SlideEditPanel.tsx                         # 欄位樣式工具列（S/M/L/XL + 4 色 + reset）
├── editable-slide-draft.ts                    # 惰性補 id、寫 override、刪條列清孤兒
├── text-style-toolbar.tsx (新) / pptx-export-client.ts (新) / pptx-export-polling.ts (新)
apps/web/src/features/slide-generation/download-html.ts   # buildHtmlDownload 擴參（title+revision）
```

**Structure Decision**：沿用既有 Web application 三層（apps/api、apps/web、packages/domain｜contracts）。PPTX 工作完整鏡射 `preview-jobs` 子系統（API + worker 兩端），不發明新非同步機制。

## 實作階段（phase 切分，供 /speckit.tasks 展開）

> 交付順序依 spec 優先級：US1(P1) → US4(P2) → US3(P3) → US2(P4)。每階段 TDD 先行。

### Phase A — US1 下載 HTML（P1，最小可交付）
- 測試先行：`download-html` 擴參後檔名格式；DeckEditorView dirty 時入口停用。
- 改 `buildHtmlDownload(html, { deckTitle, revision })` → 檔名 `<sanitized>-rev<N>-<ts>.html`；同步更新生成頁呼叫點（無 shim）。
- DeckEditorView 加「下載 HTML」按鈕，來源 = adopted revision html，dirty/ notReady 停用。

### Phase B — US4 左側預覽 16:9（P2，純前端）
- 測試先行：LivePreview 容器在不同寬度維持 16:9（aspect 盒）。
- 在 iframe 外包一層 `aspect-[16/9]` + 置中留邊容器；全螢幕路徑維持比例。

### Phase C — US3 文字樣式覆寫（P3）
- **C1 domain（TDD 先行）**：型別（data-model §1,§2）；`text-style-override.ts` 純函式（倍率/token→inline style）；`template-html-renderer.ts` 三點注入；renderer 測試（套用後 html 含正確 `font-size: calc(var(--type-*)*k)` / `color: var(--token)`）。
- **C2 合併（TDD 先行）**：`mergeOutline` 改寫（id 雙軌）；`text-style-normalize.ts`（去預設、清孤兒）；`slide-merge` 白名單納入 `textStyleOverrides`；測試涵蓋「base 無 id + edited 有 id」「text 改寫不誤保 trace」「刪條列清孤兒」「篡改唯讀仍 400」。
- **C3 contracts/schema**：`validateEditRevisionRequest` + schema 對 `outline.id`/`textStyleOverrides` 形狀驗證（越界 400）；舊無 id revision 放行測試。
- **C4 web**：`editable-slide-draft` 惰性補 id + setTitleStyle/setMessageStyle/setOutlineStyle/reset + 刪條列清孤兒；`SlideEditPanel` 欄位樣式工具列（S/M/L/XL stepper + 4 色 swatch + 單屬性/整欄 reset）；i18n 詞彙。
- **C5 e2e/整合**：設樣式→預覽即時→Save→重載保留→下載 HTML 一致。

### Phase D — US2 下載 PPTX（P4，最重）
- **D1 contracts/domain（TDD 先行）**：`pptx-export-job.ts`/`pptx-export-request.ts` 型別與驗證；domain `pptx-export-job/*`（service 狀態機、serialization、timeout、ports）；狀態機與 scope 單元測試。
- **D2 API 側**：`pptx-export-jobs` module 鏡射 preview-jobs（store/runner/queue/controller/parser/sweeper/runtime/tokens/providers/module）；三端點 + 建立驗證（revision 存在、頁數≤60、單人併發=1、owner scope）；掛 `app.module.ts`。
- **D3 worker 側**：`pptx-export-job-execution.ts`——Playwright 載入該 revision html、逐頁截圖 1920×1080、pptxgenjs 組裝、artifact 寫檔 + 失敗清理；`pptx-export-worker.runtime.ts`；掛 `worker.module.ts`。
- **D4 web**：`pptx-export-client.ts` + `pptx-export-polling.ts`；DeckEditorView「下載 PPTX」入口 + 進度狀態 + 完成下載 + 失敗重試；dirty 守門。
- **D5 部署/驗證（高風險）**：worker image 內含 chromium（research R2）；正式機跑一次實匯出至 done 並開啟比對；確認 TTL 清理、無殘檔、跨帳號 404。

### Phase E — 收尾
- OpenAPI 文件補三端點；README（pptx-export-jobs 子系統）；`gitnexus_detect_changes` 核對影響面；quickstart 全程人工驗證。

## Complexity Tracking

無 Constitution 違規需記錄。PPTX 雖新增依賴（chromium/pptxgenjs），但屬「截圖方案」的必要且最小成本，且鏡射既有 preview-jobs 模式，未引入新抽象機制。

## Evidence Plan

- **Automated Evidence**：domain merge/renderer 單元測試、contracts schema 驗證測試、job 狀態機/ scope 測試、web e2e（樣式持久化、下載對應版本）。
- **Manual Verification**：quickstart（PPTX 開啟比對、16:9 縮放、跨帳號隔離、EC2 實匯出）。
- **Operational Evidence**：PPTX job 狀態紀錄、artifact TTL 清理驗證、預覽比例快照。
- **Decision Evidence**：research.md（無頭瀏覽器選型、outline id 雙軌、parity 單一來源的被否決替代）。
