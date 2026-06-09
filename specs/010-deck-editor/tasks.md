---
description: "Task list — 010 Deck 編輯頁 + 跨 deck 歷史切換器（第一批 US1–US3）"
---

# Tasks: Deck 編輯頁 + 跨 deck 歷史切換器（第一批 US1–US3）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Input**: `/specs/010-deck-editor/`（plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md）

**範圍**：本批僅 **US1（P1）、US2（P2）、US3（P3）**。**US4（富文本，Post-MVP）不在本批** tasks 與驗收（spec 決策 #6）。

**Tests**: 採 TDD——先寫聚焦失敗測試，再實作最小行為。domain/contracts/api 用 vitest；web 元件用 vitest + @testing-library/react；關鍵流程補 Playwright。`ui-ux-pro-max` skill 為 US1/US2 前端視覺設計依據（FR-016）。

## 路徑慣例（本 repo）

- contracts 測試：`packages/contracts/test/*.test.ts`
- domain 測試：`packages/domain/test/{deck-edit,deck-persistence}/*.test.ts`
- api 測試：`apps/api/test/*.test.ts`
- web 元件測試：與元件同層 `apps/web/src/features/{deck-editor,deck-switcher,decks}/*.test.tsx`
- web e2e：`apps/web/tests/e2e/*.spec.ts`

**格式**：`[ID] [P?] [Story] 描述`。`[P]` = 不同檔案、無相依，可並行。

---

## Phase 1：Setup（共享）

- [x] T001 確認分支 `010-deck-editor` 與測試工具鏈（vitest / RTL / Playwright）可用。本批**新增一個 additive nullable 欄位 migration `deck_revisions.chart_intents jsonb`（C1）**、不改既有欄位語意；**唯一新增寫入端點** = `POST /api/decks/:id/revisions`。
- [x] T001a **編輯前 impact 分析（CLAUDE.md 要求）**：對本批將修改的既有 symbol 跑 `gitnexus_impact({target, direction:"upstream"})` 並回報 blast radius（**以實際 symbol 名為準**）：`DeckStore`（port）、`DrizzleDeckStore`/`saveNewDeck`（adapter）、`DecksController`、`createDeckFromPreviewResult`、`preview-job-execution`（PreviewResult 建構處）、`packages/domain/src/index.ts`、`packages/contracts/src/deck.ts`、`deck_revisions`（schema）、`App`/`GenerationRoute`（web 路由與 topbar 掛載處）、`MyDecksView`。**任一為 HIGH/CRITICAL 先向使用者警示再動工**；各 Phase 臨時新增受影響 symbol 比照補跑。
- [x] T002 於 `apps/web/vite.config.ts` 新增 `resolve.alias` `'@slides-agent/domain' → packages/domain/src/index.ts`（鏡像既有 tsconfig paths），使 client 端可 bundle domain renderer（US1 LivePreview 基礎，R1）。加一個 smoke 測試/建置確認 domain renderer 在 web bundle 可 import 且無 Node-only 依賴。

---

## Phase 2：Foundational — 後端編輯端點（plan Phase A，阻擋 US1 儲存）

**⚠️ 範圍**：此階段阻擋 **US1 的儲存**；US1 的編輯器 UI（Phase 3）可並行開工，但 US1 Independent Test 需兩者合一。US2/US3 不依賴本階段。
**不變式**：**不呼叫 LLM**；唯讀/並發/保真**後端強制**；不改既有 renderer 決策邏輯。

### Phase 2.0 — 圖表渲染輸入持久化（C1 / FR-006a，先於 edit 重渲染）

> 含圖 deck 編輯重渲染畫真圖需 base 的 `chartIntents`，現況未持久化（衍生含 LLM 不可零-LLM 重導出）。

- [x] T002c [US1] migration：`apps/api/src/infra/db/schema.ts` 的 `deckRevisions` 加 **nullable** `chartIntents: jsonb("chart_intents")`；產生對應 Drizzle migration。
- [x] T002d [US1] 型別：`packages/domain/src/deck-persistence/deck.types.ts` 的 `DeckRevision` 加 `chartIntents: unknown | null`；`DeckDetail.currentRevision` 帶出；`Deck.revision` 亦含（生成寫入）。
- [x] T002e [US1] 生成路徑帶下 chartIntents：`packages/domain/src/preview-job/preview-job.types.ts` `PreviewResult` 加 `chartIntents`；`packages/domain/src/deck-persistence/create-deck-from-preview.ts` 寫入 `result.chartIntents`；`apps/api/src/modules/preview-jobs/preview-job-execution.ts` 帶上 `generatePreviewDeck(...).chartIntents`。**先跑 `gitnexus_impact({target:"createDeckFromPreviewResult"})`**。測試：persist 後 revision 含 chartIntents。
- [x] T002f [US1] drizzle store 讀寫 `chart_intents`：`saveNewDeck`/`appendEditRevision` 寫入、`findByIdForAccount` 讀出（`drizzle-deck-store.ts`）。
- [x] T002g [US1] 寫測試（圖表保真，SC-002a）：(a) 有 chartIntents 的 base → `applyDeckEdit` 重渲染 `renderedCharts`（visualKind/資料/fallback）與 base **逐字一致**、零 LLM；(b) legacy base（`chartIntents` null）→ 圖表退 renderer fallback + review note「無持久化圖表輸入」、**不**謊報。

### 契約 + 型別（先定形狀）

- [x] T003 [P] [US1] 於 `packages/contracts/src/deck.ts`：新增 `EditRevisionRequestContract = { baseRevision: number; slideDeck: SlideDeck }`；失敗碼 `REVISION_CONFLICT`(409)/`INVALID_EDIT`(400)/沿用 `DECK_NOT_FOUND`(404)，**top-level error shape**（I1）；`DeckRevisionContract` **新增 `chartIntents: ChartIntent[] | null`**（C1，同時供 `GET /api/decks/:id` 的 currentRevision 與本端點回應，legacy=null）。形狀見 contracts/edit-revision.contract.md、data-model §1/§8。
- [x] T004 [P] [US1] 新增 `packages/domain/src/deck-edit/apply-deck-edit.types.ts`：`EditRevisionPayload`、`ApplyDeckEditResult`（data-model §5）。
- [x] T005 [US1] 修改 `packages/domain/src/deck-persistence/deck-store.port.ts` + `deck.types.ts`：新增 `appendEditRevision(accountId, deckId, expectedBaseRevision, payload) → AppendEditResult`，`EditRevisionInput` / `AppendEditResult`（Conflict）型別（data-model §6）。**先跑 `gitnexus_impact({target:"DeckStore"})`**。

### slide-merge 純函式（TDD — 唯讀強制 + outline 保真的核心）

- [x] T006 [US1] 寫失敗測試 `packages/domain/test/deck-edit/slide-merge.test.ts`：(a) 保留 slide 套用白名單文字、唯讀塊/`type`/`layout` 取自 base；(b) **篡改保留 slide 的 contentBlocks/非編輯欄位 → 回 REJECT(INVALID_EDIT)**；(c) 新增 slide 純文字（預設 type/layout、sourceTrace `[]`）、**夾帶 contentBlocks → REJECT**；(d) slide 增/刪/重排依 id 與順序正確落地；(e) outline 保真：未改條列沿用 `sourceTrace`/`emphasis`、改寫/新增清空+中性 emphasis、重複文字 FIFO（data-model §3/§4）。
- [x] T007 [US1] 實作 `packages/domain/src/deck-edit/slide-merge.ts`（依 id 白名單合併 + `mergeOutline` 文字比對保真 + `DEFAULT_*` 常數），使 T006 通過。

### applyDeckEdit use-case（TDD — merge→validate→render→summary→payload）

- [x] T008 [US1] 寫失敗測試 `packages/domain/test/deck-edit/apply-deck-edit.test.ts`：given base `DeckRevision`（含 `chartIntents`）+ edited `SlideDeck` → (a) 合法 → `{ok:true, payload}`，payload `origin="edit"`、`designPlan`/`chartIntents` 沿用 base、`html` 為重渲染、`generationSummary` 重算；(b) 合併拒絕 → `{ok:false, rejection:"INVALID_EDIT"}`；(c) 合併後空 deck/必要欄位缺 → `{ok:false, rejection:"VALIDATION_FAILED"}`；(d) **過程零 LLM 呼叫**（以可注入/無外呼渲染器斷言）。
- [x] T009 [US1] 實作 `packages/domain/src/deck-edit/apply-deck-edit.ts`：串 `slide-merge` → **`renderTemplateDeckArtifact`**（傳 base `designPlan` + base `chartIntents`；其內部順序為 **render → `validateGeneratedHtml` → `buildGenerationSummary(deck, renderedCharts, selectedTheme)`**，I3）→ 組 `EditRevisionPayload`（`chartIntents` 沿用 base）；於 `packages/domain/src/index.ts` 匯出 `applyDeckEdit` 與新型別。使 T008 通過。

### store adapter（TDD — 交易/並發/副作用）

- [x] T010 [US1] 寫失敗測試 `apps/api/test/deck-store.append-edit-revision.test.ts`：(a) `expectedBaseRevision === current` → append revision(current+1) + 更新 `currentRevisionId`/`updatedAt`、舊版保留；(b) `expectedBaseRevision !== current` → `{ok:false, conflict, currentRevision}`、**不寫入**；(c) 非本人/不存在 → 由 caller 轉 404；(d) 並發檢查與 append 於**同一交易**（模擬交易中途 current 改變仍不誤寫）。
- [x] T011 [US1] 實作 `apps/api/src/modules/decks/drizzle-deck-store.ts` 的 `appendEditRevision`（單一交易：load→比對→insert(含 `chart_intents`)+update）。**MUST NOT** 含 validate/render/summary。**先跑 `gitnexus_impact({target:"DrizzleDeckStore"})`**。使 T010 通過。

### endpoint（TDD — 狀態碼/副作用）

- [x] T012 [US1] 寫失敗測試 `apps/api/test/decks-controller.edit-revision.test.ts`：合法 → 201 + revision=base+1 + currentRevisionId 更新；`baseRevision` 落後 → 409 + `currentRevision`；篡改保留 slide 唯讀塊 / 新增 slide 夾帶 chart_placeholder → 400、無 revision；缺 `baseRevision` → 400；別人 deck → 404；合併後空 deck → 400。**錯誤皆 top-level `{code,message,fields?}`**（I1）。
- [x] T013 [US1] 實作 `POST /api/decks/:id/revisions`（`apps/api/src/modules/decks/decks.controller.ts`）：JWT + ownership；解析 `{baseRevision, slideDeck}` → `findByIdForAccount` 載 base（404）→ `applyDeckEdit`（400 rejection/validation）→ `appendEditRevision`（409 conflict）→ 201 `DeckRevisionContract`。**錯誤一律 top-level shape `{code,message,fields?}`**（I1，沿用 `NotFoundException({code,message})` 慣例；409 帶 `currentRevision`）。**先跑 `gitnexus_impact({target:"DecksController"})`**。使 T012 通過。
- [x] T013b [US1] **OpenAPI（C2，手動補）**：`packages/contracts/src/openapi.ts` 加 `EditRevisionRequest` schema + 以 `errorSchema(...)` 定義 409/400/404；`apps/api/src/openapi/openapi-document.ts` 的 `paths` 加 `"/api/decks/{id}/revisions": { post }`（tag `decks`，201/400/401/404/409）。加 OpenAPI smoke/schema 測試（document 可建且含新 path）。
- [x] T014 [P] [US1] 寫契約測試 `packages/contracts/test/edit-revision.test.ts`：request/response 形狀 + **top-level error shape `{code,message,fields?}`**（contracts/edit-revision.contract.md、data-model §1）。

**✅ Checkpoint A**：後端編輯端點可用（含並發/篡改/保真強制）——US1 儲存路徑就緒。

---

## Phase 3：US1 編輯器前端（plan Phase B，P1，主軸）

**目標**：三欄編輯器 + client 端 WYSIWYG 預覽 + 結構編輯 + 存版本（串 Phase 2 端點）。
**依賴**：T002（Vite alias）、Checkpoint A（儲存）。

- [x] T015 [US1] 寫失敗測試 + 實作 `apps/web/src/features/deck-editor/editable-slide-draft.ts`：不可變工作模型 + immutable 結構操作（`setTitle/setMessage/setNotes/setOutlineText/addBullet/removeBullet/moveBullet/addSlide/removeSlide/moveSlide`）；攜帶唯讀 `contentBlocks`/非編輯欄位；轉 `EditRevisionRequestContract`（data-model §7）。
- [x] T016 [P] [US1] 寫失敗測試 + 實作 `apps/web/src/features/deck-editor/deck-editor-client.ts`：`createEditRevision(deckId, {baseRevision, slideDeck})` → 201/409/400/404 對應；沿用既有 `decks-client` 的 fetch/auth 慣例。
- [x] T017 [US1] 寫失敗測試 + 實作 `apps/web/src/features/deck-editor/LivePreview.tsx`：引入 client domain renderer + base `designPlan` **+ base `chartIntents`（從 `getDeck` 的 currentRevision 取得，畫圖必需；legacy null → 比照 server 退 fallback）**，**debounced 本地重渲染**工作副本 → iframe；渲染失敗局部降級（錯誤佔位、不崩潰）。**parity 測試**：同工作副本 client render 與 server save html 逐字一致（與後端共用斷言夾具）。
- [x] T018 [P] [US1] 寫失敗測試 + 實作 `apps/web/src/features/deck-editor/SlideNavigator.tsx`：純文字列表（編號 + 標題；含唯讀塊者加標記），鍵盤可操作、focus 可見，點選定位中欄/右欄；支援 slide 增/刪/重排觸發。
- [x] T019 [US1] 寫失敗測試 + 實作 `apps/web/src/features/deck-editor/SlideEditPanel.tsx`：grounded 四欄位編輯 + 條列增/刪/重排 + 唯讀塊（chart/table…）以「本期暫不可編輯」呈現（不可改）。視覺以 `ui-ux-pro-max` 引導。
- [x] T020 [US1] 寫失敗測試 + 實作 `apps/web/src/features/deck-editor/DeckEditorView.tsx`：載入 deck（`getDeck`）→ 三欄組裝 → 儲存（呼 T016）→ 成功以 server `html` 刷新 iframe；**409 → 載入並顯示目前最新 revision**（US1 #7）、保留草稿待決定（接 US3）。
- [x] T021 [US1] 修改 `apps/web/src/App.tsx`：新增受保護路由 `/decks/:id/edit → DeckEditorView`。**先跑 `gitnexus_impact({target:"App"})`**（路由與 `GenerationRoute` 同檔，預期低風險）。
- [x] T022 [P] [US1] 新增編輯器 i18n 鍵（zh-TW/en/ja）：欄位標籤、唯讀提示、儲存/衝突訊息、結構操作。

**✅ Checkpoint US1**：可開啟 deck → 編輯文字+結構 → 即時預覽 → 存版本（含 409 顯示最新版）。可獨立展示/驗收。

---

## Phase 4：US2 跨 deck 切換器（plan Phase C，P2）

**依賴**：US1 編輯頁（作為點選載點）；可在 US1 完成後並行 US3。

- [x] T023 [P] [US2] 寫失敗測試 + 實作 `apps/web/src/features/deck-switcher/recent-decks.ts`：`RECENT_DECKS_LIMIT = 8`（元件常數）；最近清單 = `listDecks()` 依 `updatedAt` desc 取前 8；搜尋 = 前端 `title` 過濾全量（≤200）。
- [x] T024 [US2] 寫失敗測試 + 實作 `apps/web/src/features/deck-switcher/DeckSwitcher.tsx`：混合下拉（搜尋框 + 最近 8 清單[標題/狀態/時間] + 「瀏覽全部歷史 →」連 `/decks`）；點選 → 路由 `/decks/:id/edit`；鍵盤/focus；窄視窗不退化成純清單。視覺以 `ui-ux-pro-max` 引導。
- [x] T025 [US2] 掛載切換器到**生成頁 topbar（`App.tsx` 的 `GenerationRoute`）**與**編輯頁 topbar（`DeckEditorView`）**。注意：topbar 在 `App.tsx`/`GenerationRoute`，**非** `SlideGenerationFeature` 內部。**先跑 `gitnexus_impact({target:"GenerationRoute"})`**。
- [x] T026 [US2] 升級 `apps/web/src/features/decks/MyDecksView.tsx` 為「全部歷史」：加標題搜尋、每筆提供「進編輯」動作（→ `/decks/:id/edit`）。**先跑 `gitnexus_impact({target:"MyDecksView"})`**。測試：搜尋過濾、進編輯路由。
- [x] T027 [P] [US2] 切換器/全部歷史 i18n 鍵（zh-TW/en/ja）。

**✅ Checkpoint US2**：生成頁/編輯頁可搜尋+最近8切換、瀏覽全部歷史並進編輯。

---

## Phase 5：US3 localStorage 草稿（plan Phase D，P3）

**依賴**：US1 編輯頁（草稿掛在編輯狀態上）。

- [x] T028 [US3] 寫失敗測試 + 實作 `apps/web/src/features/deck-editor/deck-draft-storage.ts`：`DeckDraft = {deckId, baseRevision, slideDeck, savedAt}`（key `deck-draft:{deckId}`）；3 分鐘暫存（可注入 timer）；還原判定 `baseRevision === current.revision && savedAt > current.createdAt`；衝突判定 `baseRevision !== current.revision`；localStorage 不可用 → 靜默降級。
- [x] T029 [US3] 寫失敗測試 + 串接 `DeckEditorView`：定時暫存；重入時依判定提示「還原/捨棄」或「版本衝突 → 載入顯示最新 revision」；成功存 DB 後清草稿。
- [x] T030 [US3] 寫失敗測試 + 實作 beforeunload 守衛：有未存變更（含透過切換器跳轉、US2 #5）時提醒。
- [x] T031 [P] [US3] 草稿/衝突/離開提醒 i18n 鍵（zh-TW/en/ja）。

**✅ Checkpoint US3**：草稿自動暫存、還原、版本衝突顯示最新版、離開提醒。

---

## Phase 6：驗證收尾（plan Phase E）

- [x] T032 [P] a11y：編輯器三欄 + 切換器鍵盤導覽、可見 focus、aria（沿用既有慣例）。
- [x] T033 [P] RWD（窄視窗三欄可堆疊/切換、不退化成純文字）+ `prefers-reduced-motion` 降級。
- [x] T034 client↔server **parity** 交叉測試（同一批工作副本：client render === server save html）固化為回歸測試。
- [x] T035 e2e `apps/web/tests/e2e/deck-editor.spec.ts`：登入 → 開編輯頁 → 改文字+結構 → 存 → 版本+1/預覽一致；切換器搜尋+載入；草稿還原；（對抗性 409/400 以 api 測試覆蓋，不必 e2e）。
- [x] T036 跑 `gitnexus_detect_changes()` 確認改動範圍僅落在預期 symbol/flow（CLAUDE.md 提交前要求）。
- [x] T037 [P] 三語文案完整性檢查（無缺鍵）；術語一致（編輯頁/版本/草稿/切換器/唯讀塊/確定性重渲染/樂觀並發）。

---

## 依賴與並行摘要

- **Setup**（T001–T002）→ 全部前置。
- **Phase 2 後端**（T003–T014）與 **Phase 3 前端 UI**（T015、T017–T019、T022）可並行；但 US1 存版本（T016、T020）需 Checkpoint A。
- **US2**（Phase 4）依 US1 編輯頁；**US3**（Phase 5）依 US1 編輯頁；US2 與 US3 之間可並行。
- `[P]` 任務 = 不同檔案無相依（如各 i18n、各純函式測試、契約測試）。
- **Phase 2.0**（T002c–T002g，chart 持久化）阻擋 T009/T011 的圖表保真，但與契約/型別（T003–T005）可並行。
- 每個觸及既有 symbol 的任務（T002c/T002e/T002f/T005/T011/T013/T021/T025/T026）**動工前先跑 `gitnexus_impact`**；HIGH/CRITICAL 先警示。

## 明確不在本批（Post-MVP / Future）

- **US4**（局部文字強調 raw px+色票富文本、FR-018/019、SC-007）：獨立 story set，US1–US3 跑通後另排。
- 同一 deck 的 revision 版本瀏覽/還原/diff UI；「改 brief 重生成」（LLM）；table/chart/timeline/metric 結構編輯；slide 縮圖導覽。
