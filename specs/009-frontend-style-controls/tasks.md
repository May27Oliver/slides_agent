---
description: "Task list — 009 Frontend Style Controls"
---

# Tasks: Frontend Style Controls（暴露 007/008 樣式能力到控制台）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Input**: `/specs/009-frontend-style-controls/`（plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md）

**Tests**: 採 TDD——先寫聚焦的失敗測試，再實作最小行為。前端元件以 vitest + @testing-library/react；domain/contracts 以 vitest；關鍵流程補 Playwright。`ui-ux-pro-max` skill 為 US1/US2/US3 前端視覺設計依據（FR-014）。

## 路徑慣例（本 repo）

- domain 測試：`packages/domain/test/{design,rendering,deck}/*.test.ts`
- contracts 測試：`packages/contracts/test/*.test.ts`
- api 測試：`apps/api/test/*.test.ts`
- web 元件測試：與元件同層 `apps/web/src/features/slide-generation/*.test.tsx`
- web e2e：`apps/web/tests/e2e/*.spec.ts`

**格式**：`[ID] [P?] [Story] 描述`。`[P]` = 不同檔案、無相依，可並行。

---

## Phase 1：Setup（共享）

- [ ] T001 確認分支 `009-frontend-style-controls` 與既有測試工具鏈（vitest / RTL / Playwright）可用；本 feature **不新增** runtime 套件、不新增 DB migration、不新增 API 端點。
- [ ] T001a **編輯前 impact 分析（CLAUDE.md 要求）**：對本 feature 將修改的既有 symbol 跑 `gitnexus_impact({target, direction:"upstream"})` 並回報 blast radius：`renderChartIntent`、`renderTemplateDeck`、`renderTemplateDeckArtifact`、`buildGenerationSummary`、`GenerationSummary`（型別）、`slides.service` 之 generate/preview 路徑、`DesignPlanningPanel`、`SlideGenerationForm`。**若任一為 HIGH/CRITICAL 風險，先向使用者警示再動工**。各 Phase 內若臨時新增受影響 symbol，編輯前比照補跑 impact。

---

## Phase 2：Foundational — 後端結果證據契約（plan Phase A）

**目的**：建立 US2 所需的 readonly response 結果證據（`selectedTheme` 補強 + `renderedCharts`）。
**⚠️ 範圍**：此階段**只阻擋 US2**；**US1、US3 不依賴本階段**，可於 Setup 後立即開工。
**不變式**：不改任何決策邏輯（`selectTheme`/`composeKit`/chart 決策）；request contract 不變。

### 型別（先定形狀）

- [ ] T002 [P] 新增 `packages/domain/src/design/selected-theme-summary.types.ts`：`SelectedThemeSummary`（形狀見 data-model.md §1）。
- [ ] T003 [P] 於 `packages/domain/src/rendering/chart-rendering.types.ts` **新增** `RenderedChartSummary`（`{ slideId, chartIntentId, visualKind, fallback, notes: { code: ChartRenderingNote["code"]; message: string }[] }`）；**勿覆寫**既有 `RenderedChart` fragment 型別。
- [ ] T004 修改 `packages/domain/src/deck/deck.types.ts`：`GenerationSummary.selectedTheme` flat→`SelectedThemeSummary`（三軸入 `ids`，**不留 flat alias**）；新增 `renderedCharts?: RenderedChartSummary[]`。

### 投影純函式（TDD）

- [ ] T005 [US2] 寫失敗測試 `packages/domain/test/design/selected-theme-summary.test.ts`：given `styleKit + visualDensity + ids + fallback` → 期望 `SelectedThemeSummary`（涵蓋：accentHues 投 `{name,base}`、fonts 投 `{heading,body}`、`effects.cardShadow`→`shadow:boolean`、`background.gradientAnimation`→`animation`、缺值 optional 省略、某軸 null/`fallback=true`）。
- [ ] T006 [US2] 實作 `packages/domain/src/design/selected-theme-summary.ts` 純函式投影（映射表見 data-model.md §1），使 T005 通過。`packages/domain/src/index.ts` 匯出新型別/函式。

### 單一來源 render（TDD，D12 — CRITICAL blast radius，已於 research.md/plan Complexity Tracking 記錄並接受）

- [ ] T007 [US2] 寫失敗測試 `packages/domain/test/rendering/rendered-chart-summary.test.ts`：`renderTemplateDeck` 回傳 `{ html, renderedCharts }`，且 (a) 畫得出真圖→`fallback:false` + 正確 `visualKind` + 正確 `slideId`/`chartIntentId`；(b) 降級到 `metric_group` 與 `fallback_text` 皆 `fallback:true`（notes 含 `fallback_used`）；(c) 正常 `table`/`table_truncated`/`series_extracted` **皆 `fallback:false`**；(d) 無圖表 deck → `renderedCharts: []`。
- [ ] T008 [US2] 修改 `packages/domain/src/rendering/template-html-renderer.ts`：**`renderChartIntent` 不動**；在既有 `renderChartFragments`/`renderSlide` 的那一次 `renderChartIntent` 呼叫處，順手收集 `RenderedChartSummary`（附 `slideId`/`chartIntentId`；`fallback = notes.some(n => n.code === "fallback_used")`，**不以 visualKind 判定**）；新增 `export interface RenderedTemplateDeck { html: string; renderedCharts: RenderedChartSummary[] }`，**`renderTemplateDeck` 回傳 `string` → `RenderedTemplateDeck`**。先跑 `gitnexus_impact({target:"renderTemplateDeck"})`（已知 CRITICAL）。使 T007 通過。
- [ ] T009 [US2] **`collectChartReviewNotes` 降為純投影**（`packages/domain/src/rendering/chart-renderer.ts`）：簽章改為 `({ renderedCharts: RenderedChartSummary[]; chartIntents: ChartIntent[] }): string[]`，**移除自身的 `renderChartIntent` 走訪**，改對 `renderedCharts[].notes` filter `REVIEWABLE_NOTE_CODES` + 以 `chartIntentId→title` map 格式化 `「title」：message`。更新其 test `packages/domain/test/rendering/chart-renderer.review-notes.test.ts`。先跑 `gitnexus_impact({target:"collectChartReviewNotes"})`。
- [ ] T010 [US2] 修改 `packages/domain/src/deck/generation-summary.ts`：`buildGenerationSummary(deck, selectedTheme, renderedCharts)` 加**必填** `renderedCharts` 參數並寫入 `GenerationSummary`（恆存在、無圖為 `[]`）。
- [ ] T009a [US2] 修改 `packages/domain/src/rendering/html-deck-renderer.ts`：`renderTemplateDeckArtifact` 取 `renderTemplateDeck` 的 `{ html, renderedCharts }`，html 走驗證/artifact、`renderedCharts` 傳入 `buildGenerationSummary`；更新 `HtmlDeckGenerationInput.selectedTheme` 型別為 `SelectedThemeSummary`。**測試**：HTML 仍通過 `validateGeneratedHtml`，`generationSummary.renderedCharts` 收到 summaries（含 fallback 情境）。先跑 `gitnexus_impact({target:"renderTemplateDeckArtifact"})`。
- [ ] T009b [US2] **call-site 遷移（無 shim）**：更新 dev scripts `apps/api/scripts/preview-themes.ts`、`apps/api/scripts/preview-chart-matrix.ts` 取 `renderTemplateDeck(...).html`；確認 `tsc`/腳本可跑。

### slides.service 串接 + 契約同步

- [ ] T011 [US2] 修改 `apps/api/src/modules/slides/slides.service.ts`：改為**先 render 一次** `renderTemplateDeckArtifact` 取得 `renderedCharts` → 以 `collectChartReviewNotes({ renderedCharts, chartIntents })` 純投影 → 併進 `reviewReport.humanReviewNotes`；用 `selected-theme-summary` 投影**取代** line ~166 手拼的 `{...ids, fallback}`（傳入 `selectedTheme.styleKit` + `designSystem.visualDensity`）。確認 review notes 不嵌入 slide html（順序安全）。先跑 `gitnexus_impact` 於 `generatePreview`。
- [ ] T012 [P] [US2] 修改 `packages/contracts/src/index.ts`（`GenerationSummaryContract`）與 `packages/contracts/src/openapi.ts`（`GENERATION_SUMMARY_SCHEMA`），對齊 contracts/generation-summary.contract.md（selectedTheme nested + renderedCharts，含 visualKind enum）。
- [ ] T013 [US2] 寫/更新 contracts schema 測試 `packages/contracts/test/slide-generation-schema.test.ts`（或新增專檔）：驗證 `selectedTheme`（nested）與 `renderedCharts`（visualKind enum、fallback、notes）schema 有效（CR-016）。
- [ ] T014 [US2] 遷移既有 flat 引用：`apps/api/test/slides-service.theme-selection.test.ts` 等對 `selectedTheme.style/palette/font` 的引用改為 `selectedTheme.ids.*`；跑 domain/contracts/api 測試全綠。

**Checkpoint**：response 已穩定提供 `selectedTheme`（nested token）與 `renderedCharts`，US2 可開工。

---

## Phase 3：User Story 1 — 生成前可預覽風格選擇（P1）🎯 MVP

**Goal**：radio card gallery 取代 6 個純文字 preset；選擇只發既有 `styleDirection`，不 override。
**Independent Test**：渲染卡片畫廊、選風格→請求帶對應 `styleDirection`、無 `themeId`；不依賴 Phase 2。

### Tests（先寫）⚠️

- [ ] T015 [P] [US1] 寫失敗測試 `apps/web/src/features/slide-generation/StyleCardGallery.test.tsx`：每個風格卡顯示 名稱/2–4 色票/heading+body 字體樣本/2–3 特徵 chip/密度；單選 radio + 鍵盤可選 + 可見 focus；選取後回呼帶該 preset 的 `styleDirection`、不含 `themeId`。
- [ ] T016 [P] [US1] 寫失敗測試（同檔或 `SlideGenerationForm.test.tsx`）：切換 zh-TW/en/ja 標籤翻譯但 `styleDirection` 關鍵字不變；reduced-motion 下卡片動效降為靜態（依 `preview.structureFeatures.animation` gate）；窄視窗不退化為純文字。

### Implementation（`ui-ux-pro-max` 設計）

- [ ] T017 [P] [US1] 新增 `apps/web/src/features/slide-generation/style-presets.ts`：6 風格 curated metadata（沿用既有 `styleDirection` 關鍵字 + `preview`：swatches/fontSample/traits/density/optional animation；形狀見 data-model.md §3）。
- [ ] T018 [US1] 新增 `apps/web/src/features/slide-generation/StyleCardGallery.tsx`（radio card gallery，`ui-ux-pro-max` 設計；鍵盤/focus；窄視窗單欄/水平 grid），使 T015 通過。
- [ ] T019 [US1] 修改 `apps/web/src/features/slide-generation/SlideGenerationForm.tsx`：以 `StyleCardGallery` 取代現有純文字 preset 清單，選取仍寫既有 `styleDirection`，使 T016 通過。
- [ ] T020 [P] [US1] 修改 `apps/web/src/i18n/translations.ts`：新增風格卡 三語文案（名稱/特徵 chip/密度標籤），關鍵字方向與語言解耦。
- [ ] T021 [US1] 新增/更新 Playwright `apps/web/tests/e2e/style-card-gallery.spec.ts`：選風格→送出→請求 `styleDirection` 帶對應關鍵字、無 `themeId`。

**Checkpoint**：US1 可獨立展示（生成前引導體驗），不依賴後端改動。

---

## Phase 4：User Story 2 — 生成後設計/圖表透明度（P2）

**Goal**：依 response metadata 呈現實際套用主題 token 與已渲染圖表類型，誠實標示 fallback。
**Independent Test**：給含 `selectedTheme`+`renderedCharts` 的 artifact，面板據實呈現；fallback 項不謊報已畫圖。
**依賴**：Phase 2 完成。

### Tests（先寫）⚠️

- [ ] T022 [P] [US2] 寫失敗測試 `apps/web/src/features/slide-generation/DesignPlanningPanel.test.tsx`：依 `generationSummary.selectedTheme` 呈現 kitName/色票(accentHues)/字體樣本(fonts)/視覺密度/結構特徵 chip；某軸 `ids=null`/`fallback=true` 時誠實標示退回、不捏造缺失特徵。
- [ ] T023 [P] [US2] 寫失敗測試 `apps/web/src/features/slide-generation/RenderedChartsPanel.test.tsx`：依 `generationSummary.renderedCharts` 標出 visualKind（i18n label）+ 可追溯 slideId；`fallback===true` 標示為 fallback + 顯示 `notes`；**`fallback===false` 不得**標為 fallback（即使 visualKind=table）。
- [ ] T024 [P] [US2] 寫失敗測試：reduced-motion 下，生成後動效標示依 `selectedTheme.structureFeatures.animation` gate 並降為靜態。

### Implementation

- [ ] T025 [US2] 修改 `apps/web/src/features/slide-generation/slide-generation.types.ts`：`generationSummary` 讀型別新增 nested `selectedTheme` 與 `renderedCharts`（對齊 contract）。舊 `designPlanningResult.designSystem` 型別**僅保留在仍實際使用之處**（如 `slidePatternAssignments` / pattern）；**不**作為主題 token 來源。
- [ ] T026 [US2] 增強 `apps/web/src/features/slide-generation/DesignPlanningPanel.tsx`（`ui-ux-pro-max`）：主題 token 摘要（kitName/色票/字體樣本/密度/結構 chip）**MUST 來自 `generationSummary.selectedTheme`**（由 `ResultsPanel` 傳入），**不得**改用舊 `designPlanningResult.designSystem` 之 themeName/visualDensity/chartStyle 當 token 來源；舊 `designSystem` 僅在「無 `selectedTheme`」時作為 fallback/空狀態（若明確需要）。對應 spec FR-005 source of truth。
- [ ] T027 [US2] 新增 `apps/web/src/features/slide-generation/RenderedChartsPanel.tsx`（`ui-ux-pro-max`）：依 `renderedCharts` 呈現圖表類型 + fallback 誠實標示，使 T023 通過。
- [ ] T028 [US2] 修改 `apps/web/src/features/slide-generation/ResultsPanel.tsx`：把 `preview.previewArtifact.generationSummary`（含 selectedTheme/renderedCharts）傳入 `DesignPlanningPanel` 與新 `RenderedChartsPanel`。
- [ ] T029 [P] [US2] 修改 `apps/web/src/i18n/translations.ts`：新增 `ChartVisualKind` 顯示 label（pie_donut/line/bar/metric_card/metric_group/table/fallback_text）、結構特徵與 fallback 文案，三語。
- [ ] T030 [US2] 新增 Playwright `apps/web/tests/e2e/design-transparency.spec.ts`：生成含真圖與觸發 fallback 兩情境，驗證面板據 metadata 呈現且 fallback 誠實（對照 quickstart.md US2）。

**Checkpoint**：US1 + US2 皆可獨立運作。

---

## Phase 5：User Story 3 — 圖表 preset 預覽（P3）

**Goal**：4 個 chart preset 可預覽、語意更清楚；選擇仍只寫 `chartEmphasis`。
**Independent Test**：渲染 preset 預覽（含 `exampleVisualKinds`）、選取→請求帶 `chartEmphasis`。不依賴 Phase 2。

### Tests（先寫）⚠️

- [x] T031 [P] [US3] 寫失敗測試 `apps/web/src/features/slide-generation/ChartPresetPreview.test.tsx`：每個 preset 顯示代表圖型示意（comparison→`["bar","pie_donut"]`、trend→`["line"]`、metric→`["metric_card"]`、none→`[]`）+ 一句說明（不暗示必成圖）；選取→回呼帶 `chartEmphasis`。

### Implementation（`ui-ux-pro-max` 設計）

- [x] T032 [P] [US3] 新增 `apps/web/src/features/slide-generation/chart-presets.ts`：4 preset metadata（`chartEmphasis` + `exampleVisualKinds: ChartVisualKind[]`；見 data-model.md §3）。
- [x] T033 [US3] 新增 `apps/web/src/features/slide-generation/ChartPresetPreview.tsx`，使 T031 通過。
- [x] T034 [US3] 修改 `apps/web/src/features/slide-generation/SlideGenerationForm.tsx`：以 `ChartPresetPreview` 呈現 4 個 chart preset，選取仍寫既有 `chartEmphasis`。
- [x] T035 [P] [US3] 修改 `apps/web/src/i18n/translations.ts`：preset 說明文案三語。

**Checkpoint**：三條 user story 皆可獨立運作。

---

## Phase 6：Polish & 跨切面

- [ ] T036 [P] a11y 稽核：所有新 UI 之色票/文字/按鈕/卡片對比達 WCAG AA；鍵盤導覽與可見 focus（FR-011/CR-016）。
- [ ] T037 [P] RWD 檢查：card gallery 與透明度面板於窄視窗（<768px）可用、不退化純文字。
- [ ] T038 [P] 三語完整性檢查（zh-TW/en/ja）：新文案無缺漏鍵；`visualKind` 一律 enum、label 才翻譯（CR-013）。
- [ ] T039 [P] 移除冗餘/重疊測試；補未覆蓋的 domain 規則單元測試（投影邊界值）。
- [ ] T040 依 quickstart.md 跑完整手動驗證（US1/US2/US3 + reduced-motion + 三語 + 窄視窗），擷取截圖證據（card gallery / 設計面板 / 圖表面板含 fallback / reduced-motion 靜態）。
- [ ] T041 跑 `gitnexus_detect_changes()` 確認改動範圍符合預期後再 commit（依專案 CLAUDE.md）。

---

## Dependencies & Execution Order

- **Phase 1 Setup**：無相依，先做。
- **Phase 2 Foundational**：依賴 Setup；**僅阻擋 US2（Phase 4）**。
- **US1（Phase 3）/ US3（Phase 5）**：Setup 後即可開工，**不依賴 Phase 2**；彼此獨立、可並行。
- **US2（Phase 4）**：依賴 Phase 2 完成。
- **Phase 6 Polish**：所有目標 story 完成後。

### 並行機會

- T002、T003 [P]（不同檔型別）可並行；T012 [P] 與 domain 投影/收集獨立。
- US1（T015–T021）與 US3（T031–T035）兩條 story 可由不同人並行。
- 各 story 內標 [P] 的測試/常數檔可並行；同檔修改（如 `SlideGenerationForm.tsx` T019/T034、`translations.ts` 多筆）需序列化或合併。

### Story 內 TDD 順序

- 先測試（必須先失敗）→ 型別/常數 → 元件/服務 → 串接 → e2e → 重構。

---

## Implementation Strategy

- **MVP**：Setup → US1（Phase 3）即可獨立展示「生成前可預覽引導」，不需後端改動 → 可先 demo。
- **增量**：再做 Phase 2 + US2（生成後透明度）→ demo；最後 US3。
- **平行**：一人推 Phase 2→US2，另一人並行 US1 / US3。

## Notes

- request contract 全程不變（無 `themeId`/圖表類型偏好）；response 僅加 readonly 結果證據。
- `fallback` 一律以 `fallback_used` note 判定，`table`/`table_truncated`/`series_extracted` 不算（見 data-model.md §2、spec FR-007）。
- 前端只讀 metadata，**不** parse HTML/CSS。
- **編輯任何既有 function/class/method 前先跑 `gitnexus_impact`（CLAUDE.md 強制；見 T001a），HIGH/CRITICAL 先警示**；commit 前跑 `gitnexus_detect_changes()`（T041）。
- **單一來源 render（D12）串接鏈**：T008（`renderChartFragments`/`renderSlide` 收集 + `renderTemplateDeck` 回傳 `RenderedTemplateDeck`）→ T010（`buildGenerationSummary` 必填 `renderedCharts`）→ T009a（`html-deck-renderer` 串進 summary）→ T009b（dev scripts 取 `.html`）→ T009（`collectChartReviewNotes` 降純投影）→ T011（`slides.service` render 一次 + 投影 review notes + selectedTheme 投影）。`renderChartIntent` 全程不動。
