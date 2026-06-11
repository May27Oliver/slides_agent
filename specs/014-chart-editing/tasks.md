---
description: "Task list — 014 編輯頁圖表編輯（US1–US4）"
---

# Tasks: 編輯頁圖表編輯（換視覺、編輯數據點、移除、新增）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Input**: `/specs/014-chart-editing/`（plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md）

**範圍**：US1（P1 換視覺）、US2（P2 移除/從來源新增）、US3（P3 編輯數據點）、US4（P3 手動輸入新增）。交付批次依 clarify 決議：**第一批 = US1→US2、第二批 = US3/US4**。

**Tests**: TDD——先寫聚焦失敗測試再實作最小行為。domain/contracts/api 用 vitest；web 元件用 vitest + RTL；關鍵流程 Playwright。`ui-ux-pro-max` skill 為前端視覺依據（FR-016）。

## 路徑慣例（本 repo）

- domain 測試：`packages/domain/test/{deck-edit,rendering}/*.test.ts`
- contracts 測試：`packages/contracts/test/*.test.ts`
- api 測試：`apps/api/test/*.test.ts`
- web 元件測試：與元件同層 `apps/web/src/features/deck-editor/*.test.tsx`
- web e2e：`apps/web/tests/e2e/*.spec.ts`

**格式**：`[ID] [P?] [Story] 描述`。`[P]` = 不同檔案、無相依，可並行。

---

## Phase 1：Setup（共享）

- [ ] T001 確認分支 `014-chart-editing`、`pnpm test` 基線全綠。本 feature **零 migration、零新端點、零新依賴**（plan Technical Context）——`pnpm db:generate` 應無 diff，任務中若出現 schema diff 即停下重審。
- [ ] T001a **編輯前 impact 分析（CLAUDE.md 要求）**：對將修改的既有 symbol 跑 `gitnexus_impact({target, direction:"upstream"})` 並回報 blast radius（以實際 symbol 名為準）：`applyDeckEdit`、`mergeEditedDeck`、`renderChartIntent`／`selectVisual`／`isChartFallback`、`extractChartSeries`／`toChartPoint`、`validateEditRevisionRequest`、`DecksController`（revisions handler）、`EditableSlideDraft`（draft model）、`renderLivePreview`、`SlideEditPanel`、`GenerationSummary` 型別消費端。**任一 HIGH/CRITICAL 先向使用者警示再動工**；後續 phase 臨時新增受影響 symbol 比照補跑。

---

## Phase 2：Foundational — Domain 地基＋儲存通路（plan Phase A/B，阻擋所有 US）

**⚠️**：US1–US4 全部依賴本階段（operations 管線是唯一編輯通道）。**不變式**：零 LLM；`operations: []` 時輸出與 010/011 逐欄位相同——**唯一例外** `generationSummary.userDataDisclosures: []`，`reviewReport`/html 零 delta（data-model §10-1）；語意驗證全在 domain。

### 型別（先定形狀，data-model §1/§2/§3/§6）

- [ ] T002 [P] `packages/domain/src/design/design.types.ts`：新增 `ChartVisualOverride`、`ChartTreatmentPlan.visualOverride?`（§1）。
- [ ] T003 [P] `packages/domain/src/deck/deck.types.ts`：`SourceFactKind` 加 `"user_provided"`、`SourceFact.metric?`/`replacesFactId?`（§2）、`UserDataDisclosure` ＋ `GenerationSummary.userDataDisclosures`（§6）。
- [ ] T004 [P] 新檔 `packages/domain/src/deck-edit/chart-operation.types.ts`：`UserPointInput`/`EditDataPoint`/`ChartOperation`/`CHART_EDIT_LIMITS`（§3）；自 `packages/domain/src/index.ts` 匯出。

### 渲染層接點（TDD，R1/R6）

- [ ] T005 `packages/domain/test/rendering/` extractor 既有測試擴充——先寫失敗測試：(a) 帶 `metric` 的 fact short-circuit 直接成點（含 parse 不出的 displayValue 也成點）；(b) 無 `metric` 的 fact 與現行輸出深等值（回歸）。再實作 `chart-series-extractor.ts` 的 `toChartPoint` short-circuit。
- [ ] T006 新檔 `packages/domain/test/rendering/chart-visual-override.test.ts`——先寫失敗矩陣：每個 override 值 ×（合格 series → 該視覺；不合格 series → 既有降級鏈＋note＋`fallback` 旗標正確）；`auto`/缺欄位 → 與現行自動選型輸出深等值。再實作 `chart-renderer.ts` 的 `selectVisual` override 分支＋`isChartFallback` 擴充。

### applyChartOperations 純函式（TDD，data-model §4，本 feature 核心）

- [ ] T007 新檔 `packages/domain/test/deck-edit/apply-chart-operations.test.ts`——先寫失敗測試（§4 規則矩陣＋§10 不變式）：
  - 四操作各自的成功效果（immutable：輸入物件不被改動）
  - 驗證矩陣（每條 → INVALID_EDIT＋detail 指明 op index）：legacy null＋非空 ops；slideId/chartIntentId 不存在；opening slide 放圖；已有圖頁放圖；remove 無此 placeholder；original fact 不屬該 intent**（前序操作套用後）**的 sourceFacts／清單內重複；valueText 非法（"abc"/""/"1/3"/Infinity 字面）；label/title 空白；各長度上限；點數 >12；operations >50
  - 確定性 id：同輸入兩次呼叫 byte-for-byte 相同；id 符合 `fact_user_r\d+_\d+_\d+`／`chart_user_r\d+_\d+`；與 base id 零碰撞
  - 鏡像：user fact `value === metric.displayValue`；displayValue = valueText+unit 保留精度
  - 陣列序語意：`add_chart(user_data)`→同請求 `edit_data` 該新 intent（original 引用其 user facts、追加新點）合法且 id 不碰撞；錯序引用 → 400
  - 零部分套用：第 3 個 op 違規時前 2 個不生效
- [ ] T008 實作 `packages/domain/src/deck-edit/apply-chart-operations.ts` 使 T007 轉綠（§4/§4a/§4b 規則）。

### applyDeckEdit 整合（TDD，data-model §5/§6）

- [ ] T009 `packages/domain/test/deck-edit/` 既有 apply-deck-edit 測試擴充——先寫失敗測試：(a) `chartOperations` 缺/`[]` → payload 與現行逐欄位深等值，**唯一例外** `generationSummary.userDataDisclosures: []`，`reviewReport`/html 零 delta（回歸不變式 §10-1）；(b) 有 operations → payload 的 `chartIntents`/`designPlan` 為衍生值、html 含新視覺；(c) `userDataDisclosures` 計算正確（含多頁共享每頁一筆、無 user 數據時 `[]`）；(d) **reviewReport 同步（§6a，FR-010／spec US3 場景 5）**：含 user 數據 → `humanReviewNotes` 揭露行＋`add_chart(user_data)` 的 `chartingDecisions` 條目；無 user 數據 → reviewReport 零變化；(e) 繼承封閉性：衍生 revision 作為新 base 再編輯，行為一致（§10-6）；(f) 與 011 themeSelection 同請求並存。再實作 `apply-deck-edit.ts` 整合。

### Contracts ＋ API（plan Phase B）

- [ ] T010 [P] contracts **全公開面**更新（§7「公開面同步」，plan 審查 MEDIUM-3）——先寫失敗測試再實作：
  - `packages/contracts/src/deck.ts`：`EditRevisionRequestContract.chartOperations` ＋ validator（四 op 種類、欄位型別、陣列 ≤ 50、巢狀 points 形狀）＋對抗性形狀測試（非陣列、未知 op、缺欄位）
  - `packages/contracts/src/index.ts`：`GenerationSummaryContract.userDataDisclosures`、treatment plan contract 的 `visualOverride?`
  - `packages/contracts/src/openapi.ts`：同步上述欄位
  - `packages/contracts/schemas/slide-generation.schema.json`：`ChartTreatmentPlan.visualOverride`（enum 六值）、summary `userDataDisclosures`、`SourceFact` 的 `metric`/`replacesFactId`/`kind` enum 加 `user_provided`（各物件 `additionalProperties: false`，漏加即既有 schema 測試失敗）
  - `packages/contracts/test/slide-generation-schema.test.ts` 等 schema 測試樣本同步
- [ ] T011 `apps/api/test/` decks controller 既有測試擴充——先寫失敗測試：透傳 `chartOperations` 至 `applyDeckEdit`；201 response 含 `userDataDisclosures`；SC-007 對抗性矩陣 → 400 且 DB 零新 revision；409 並發不變。再實作 `decks.controller.ts`/`deck-request.parser.ts` 透傳。

**Checkpoint**：`pnpm test:domain && pnpm test:contracts && pnpm test:api` 全綠——US 前端可開工。

---

## Phase 3：US1 — 換視覺類型（P1）🎯 MVP（plan Phase C）

**Goal**: 編輯頁圖表卡片＋視覺選擇器，preview 即時、儲存落 revision。
**Independent Test**: spec US1——改長條為折線儲存後 `visualOverride: "line"`、html 為折線、`auto` 回復自動選型、parity byte 一致。

- [ ] T012 `apps/web/src/features/deck-editor/editable-slide-draft.test.ts` 擴充——先寫失敗測試：draft `chartOperations` 欄位＋`setChartVisual` mutator（immutable、同 intent 後者取代前者、`resetChartEdits` 清除）；localStorage 草稿序列化涵蓋 operations。再實作 `editable-slide-draft.ts`（§9）。
- [ ] T013 [P] `live-preview-render.ts`＋測試：`ApplyDeckEditOptions.chartOperations` 透傳；parity 測試——同 draft 在 preview 與（mock store 的）save 路徑產出 html ＋衍生 id byte-for-byte 一致（FR-014）。
- [ ] T014 新元件 `ChartEditorCard.tsx`＋`ChartEditorCard.test.tsx`（先測後做）：顯示現渲染視覺（取自 preview summary `renderedCharts`）、視覺選擇器（auto/圓餅/折線/長條/指標卡/表格，CR-013 用語）、降級 notes 即時呈現、共享提示「此圖表也用於第 N 頁」（draft 掃 contentBlocks 導出，R10）。視覺依 `ui-ux-pro-max`。
- [ ] T015 `SlideEditPanel.tsx`＋測試擴充：圖表區塊接入 `ChartEditorCard`（有圖頁）；`DeckEditorView.tsx` save body 帶 `chartOperations`。
- [ ] T016 [US1 驗收] 走查 spec US1 Independent Test 全項＋quickstart US1 段（含 DevTools 零網路驗證）；`pnpm test:web` 綠。

**Checkpoint**：US1 可獨立 demo——第一批 MVP 可交付。

---

## Phase 4：US2 — 移除／從來源新增（P2）（plan Phase D）

**Goal**: 移除圖表、自 intents 清單（全列＋已用標註）放置到無圖內容頁。
**Independent Test**: spec US2——(a)–(e) 含共享放置；對 opening/已有圖頁 400。

- [ ] T017 draft mutators `removeChart`/`addChartFromIntent`＋測試（含「移除後同 intent 可再加回」「同請求搬移」場景）。
- [ ] T018 新元件 `AddChartPanel.tsx`＋測試（先測後做）：「從來源資料」tab——全部 intents 列出（title/rationale/來源事實預覽）、已放置者標註「已用於第 N 頁」、`chartIntents` 集合空 → 空狀態；入口僅無圖內容頁顯示（封面/已有圖頁不顯示，FR-016）。
- [ ] T019 `ChartEditorCard` 移除鈕＋`SlideEditPanel`/`DeckEditorView` 接入；US2 驗收走查（spec US2 場景 1–5＋quickstart US2 段）。

**Checkpoint**：第一批（US1＋US2）完整可交付。

---

## Phase 5：US3 — 編輯數據點（P3）（plan Phase E 前半）

**Goal**: 數據表格編輯（改值/增刪列/排序/改標題）＋徽章＋還原＋揭露。
**Independent Test**: spec US3——3 原樣＋2 user fact、確定性 id、鏡像、揭露 2/5、對抗性 400、parity。

- [ ] T020 draft mutator `editChartData`＋測試：以 base intent 導出表格列（original 引用）、編輯時轉 user 點、單列還原（`replacesFactId` 撈回）、整圖還原（清除該 intent ops）。
- [ ] T021 新元件 `ChartDataTable.tsx`＋測試（先測後做）：label/數值/單位三欄＋「來源資料／使用者提供」徽章即時切換、增刪列、拖曳排序（沿用 `sortable-helpers`）、標題編輯、client 端 valueText 格式即時驗證（UX 層，server 仍權威）。
- [ ] T022 揭露呈現：編輯器卡片＋decks summary 面板顯示 `userDataDisclosures`（「本圖表含使用者提供的數據點（n/m）」，CR-013 文案統一）＋測試。
- [ ] T023 [US3 驗收] spec US3 場景 1–7 走查（含降級 table 顯示正確、共享連動）＋quickstart US3 段。

---

## Phase 6：US4 — 手動輸入新增（P3）（plan Phase E 後半）

**Goal**: 手動輸入面板——標題＋視覺＋數據點 → 全 user intent。
**Independent Test**: spec US4——`chart_user_r*` intent、facts 全 `user_provided`、揭露 3/3、降級＋note。

- [ ] T024 draft mutator `addChartFromUserData`＋測試；`AddChartPanel` 手動輸入 tab（復用 `ChartDataTable` 的列編輯）＋測試。
- [ ] T025 [US4 驗收] spec US4 場景 1–2 走查＋quickstart US4 段。

---

## Phase 7：驗證收尾（plan Phase F）

- [ ] T026 [P] e2e `apps/web/tests/e2e/chart-editing.spec.ts`：US1 happy path（開編輯頁→換視覺→preview 變化→儲存→重載維持）＋一條降級 note 呈現；artifacts（截圖/trace）。
- [ ] T027 [P] 全量驗證：`pnpm test` 四包綠、`pnpm lint`/`pnpm format` 過、`pnpm db:generate` 零 diff（零 migration 證據）。
- [ ] T028 quickstart「手動驗證」走查：split 版面可讀性、降級對比、鍵盤導覽/16:9 不退化（CR-015/CR-016）；結果記錄回 quickstart 勾選。
- [ ] T029 **commit 前 `gitnexus_detect_changes()`（CLAUDE.md 要求）**：確認變更只落在預期 symbol/flow；README（功能清單）補 014 一行。

---

## 依賴與並行摘要

```
T001/T001a → T002/T003/T004 [P] → T005/T006 [P]（T005 依 T003；T006 依 T002）
            → T007→T008（依 T002–T004）→ T009（依 T005/T006/T008）
            → T010 [P]（依 T004）、T011（依 T009/T010）
Phase 3（US1）依 Phase 2 checkpoint；T013 與 T014 可並行
Phase 4（US2）依 T012（draft 基礎）；可與 Phase 3 後段並行
Phase 5（US3）依 Phase 4 的 draft 模式；T021/T022 可並行
Phase 6（US4）依 T021（復用 ChartDataTable）
Phase 7 依全部
```

## 明確不在本批（Post-MVP / Future）

- 逐圖表配色／樣式（CR-005：theme 統御）
- per-placement 數據分叉（clarify：連動所有放置處）
- 存檔後 revision 回滾 UI（版本鏈已留歷史）
- 時間序列手動排序鍵（clarify：label 解析）
- "~30%" 等自由格式顯示值（審查修正：valueText 單源）
- pie/line/bar 以外的新視覺種類、第三方 chart lib
