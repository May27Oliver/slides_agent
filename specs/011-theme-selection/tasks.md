---
description: "Task list — 011 主題庫手動選擇（生成頁 + 編輯頁，每軸各選）"
---

# Tasks: 主題庫手動選擇

<!-- Spec Kit artifacts in Traditional Chinese. -->

**Input**: `/specs/011-theme-selection/`（spec / plan / data-model / contracts）

**範圍**：每軸手動選主題（font/palette/style），生成頁 + 編輯頁共用 picker，確定性套用、零額外 LLM。**無 DB migration**。不重寫 `selectTheme`，不引入「完整主題卡」資料模型。

**Tests**: TDD；domain/contracts/api 用 vitest；web 用 vitest + RTL；關鍵流程補 Playwright（CI 已就緒）。

---

## Phase 1：Setup
- [ ] T001 確認分支 `011-theme-selection`（疊在 010 上）；待 010 merge 後 rebase 到 main。本批**無 migration**。
- [ ] T001a 編輯前 impact（CLAUDE.md）：對將動的既有 symbol 跑 `gitnexus_impact`：`selectTheme`、`composeKit`、`ThemeStore`/`DrizzleThemeStore`、`SlidesService.generatePreview`、`applyDeckEdit`、`GeneratePreviewRequestContract`、`SlideGenerationForm`。HIGH/CRITICAL 先警示。

## Phase 2：Domain — 依 id 套用（純函式，先寫）
- [ ] T002 [P] 型別：`ManualThemeSelection`、`ApplyThemeResult`（`{ selectedTheme, warnings }`，data-model §2）、`BrowsableTheme`（含完整 partial `styleKit`，§5）、`ThemeCatalogResponseContract`、`ThemeSelectionWarning`（reason: `invalid_id`|`base_unresolved`）+ `GenerationSummary.themeSelectionWarnings`（§8）。
- [ ] T003 失敗測試 `packages/domain/test/design/apply-theme-selection.test.ts`（回 `{selectedTheme, warnings}`）：只覆寫 palette→font/style 由 baselineIds 解析保留 / 三軸全覆寫→ids 全為所選+warnings=[] / 覆寫無效 id→退預設+`invalid_id` warning / baseIds 某軸不可解析→`base_unresolved` / 無 selection 且 baseline 可解析→等同 baseline / 純函式零外呼。
- [ ] T004 實作 `packages/domain/src/design/apply-theme-selection.ts`：**輸入 `(baselineIds, selection, candidates)`,每軸 effectiveId(覆寫優先)→由 candidates 依 id 解析 partial→composeKit,回 `{selectedTheme, warnings}`**（data-model §2，**不反解 composed kit**）；`index.ts` 匯出。**先跑 `gitnexus_impact({target:"selectTheme"})`**（確認不動 selectTheme）。

## Phase 3：Backend — 瀏覽讀取 + 套用串接
- [ ] T005 `ThemeStore` 加 `listBrowsable()`（name/description/keywords + **完整 partial `styleKit`**，data-model §5）；`DrizzleThemeStore` 從 `themes` 讀。**先跑 `gitnexus_impact({target:"ThemeStore"})`**。
- [ ] T006 `GET /api/themes`（JWT）回完整 `ThemeCatalogResponseContract`（依 kind 分組，含完整 partial styleKit；**本批無 `?kind=`**）；contract + endpoint 測試：① 回 partial kit 可被 `composeKit` 直接接受（無 shim）；② **escape 邊界（F6）**：含類 CSS/特殊字元的字體名/顏色值經 render 後不破版/不注入（驗證 use-boundary escaping，非端點 sanitize）。
- [ ] T007 生成路徑：`GeneratePreviewRequestContract` 加 `themeSelection?`；`slides.service.generatePreview` 取 `selectTheme(brief).ids` 當 baselineIds → `const { selectedTheme, warnings } = applyThemeSelection(baselineIds, themeSelection, candidates)`（§3），styleKit 套用、`generationSummary.themeSelectionWarnings = warnings`（§8）。**先跑 `gitnexus_impact({target:"generatePreview"})`**。測試：帶 selection→套用、不帶→現況不變、無效 id→該軸退預設+`invalid_id` warning、零額外 LLM。
- [ ] T008 編輯路徑：edit-revision request 加 `themeSelection?`；`applyDeckEdit`（010）**呼叫同一個 `applyThemeSelection`**，baselineIds = `base.generationSummary.selectedTheme.ids`（§4），只換 styleKit、其餘沿用 base、帶 `themeSelectionWarnings`；端點載入 `listBrowsable()` 供 candidates。**先跑 `gitnexus_impact({target:"applyDeckEdit"})`**。測試：只換 palette→font/style 保留、base id 不可 resolve→退預設+`base_unresolved`、文字/chartIntents 不變、零 LLM。
- [ ] T009 OpenAPI 補登 `GET /api/themes` + request `themeSelection`（contracts §4）+ smoke。

**✅ Checkpoint A**：後端可瀏覽主題 + 兩入口依 id 套用，零額外 LLM。

## Phase 4：Frontend — 共用 ThemePicker + 兩入口
- [ ] T010 [P] `themes-client`（GET /api/themes）+ 測試。
- [ ] T011 `ThemeBrowserModal`（共用彈窗）：三軸分頁 + swatch + 頂部組合摘要 + 搜尋/篩選/分頁（palette 96 用虛擬列表/分頁）+ 套用；a11y：focus trap、Esc 關閉、鍵盤/focus。輸出 `ManualThemeSelection`。＋ `ThemeSummary`（常駐摘要，未選=「自動」，含「瀏覽全部 →」開 modal）。元件測試。
- [ ] T012 生成頁：保留 6 張快速卡；表單側邊欄掛 `ThemeSummary` → 開 `ThemeBrowserModal` 選定 → 送出帶 request `themeSelection`。**先跑 `gitnexus_impact({target:"SlideGenerationForm"})`**。測試：選三軸→request 帶正確 ids；未開 modal→現況。
- [ ] T013 編輯頁：右側版面掛 `ThemeSummary`（沿用 010 版面）→ 開 `ThemeBrowserModal` → 套用 → **client 端用 catalog 的 partial kits composeKit + 即時重渲染**（§4/§5，與 server parity）→ `createEditRevision` 帶 `themeSelection` 存新版本。測試：換主題→預覽即時變、存後版本+1。
- [ ] T013a 前端誠實提示：`themeSelectionWarnings`（§8）→ 顯示「你選的主題已無法使用，該軸已改用**預設**主題」（**不可寫「自動/baseline」**——fallback 是退預設）於生成結果與編輯頁。
- [ ] T014 [P] i18n（zh-TW/en/ja）：picker 標籤、三軸名、組合摘要、瀏覽全部、swatch、warning 提示。

**✅ Checkpoint B**：生成頁/編輯頁皆可瀏覽 220 主題、每軸挑選、即時看到效果。

## Phase 5：驗證收尾
- [ ] T015 [P] a11y（picker 鍵盤/focus/aria）+ RWD（窄視窗三軸可堆疊）+ reduced-motion。
- [ ] T016 client↔server 套用一致：同一 themeSelection，前端預覽與後端 render 的 styleKit/kitName 一致。
- [ ] T017 [P] **death-inventory 量化**（research）：跑 selectTheme 統計 220 裡實際可選中比例，記錄 011 動機數據。
- [ ] T018 e2e `apps/web/tests/e2e/theme-selection.spec.ts`：生成頁開瀏覽器→選主題→送出（mock /api）；編輯頁換主題→預覽變。
- [ ] T019 `gitnexus_detect_changes()` 確認影響範圍；三語無缺鍵。
- [ ] T020 **反模式稽核（legacy / dead code / drift / shim — 對齊 plan Constitution Check）**：
  - **drift**：確認 `applyThemeSelection` 只有一份且前端預覽與後端 render 都呼叫它（grep 前端無自寫套用邏輯）；`ManualThemeSelection`/`ThemeSelectionWarning`/styleKit 形狀無平行宣告；picker 為單一共用元件。
  - **dead code**：逐一核對每個新型別/欄位/函式都有消費者（`ManualThemeSelection`、`BrowsableTheme`/`ThemeCatalog`、`themeSelectionWarnings`、`listBrowsable`、`applyThemeSelection`、`ThemeBrowserModal`/`ThemeSummary`、`themes-client`）；確認**未新增**獨立 swatch 投影型別/欄位。(可選)跑 `npx ts-prune` / `npx knip` 抓孤兒 export。
  - **shim**：確認 `composeKit` 直接吃 `BrowsableTheme.styleKit`、無 kit↔swatch / contract↔domain 的 load-bearing 轉換層。
  - **legacy**：確認關鍵字 `selectTheme` + 6 卡僅作「無手動選擇」路徑且已標 intentional；無「以防萬一」相容碼；無「完整主題卡」平行模型。
  - 產出：稽核 checklist 結果記於 PR 描述。

## 明確不在本批
- 編輯主題庫本身（新增/改/刪 themes）、自訂主題、AI 推薦主題。
- 改寫 `selectTheme` 關鍵字演算法（多樣性/輪替）。
- 「完整主題卡」資料模型。
- 編輯頁圖表型別/顯隱控制（之前延後，另排）。
