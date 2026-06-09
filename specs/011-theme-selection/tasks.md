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
- [ ] T002 [P] 型別：`ManualThemeSelection`（contracts + domain 對應）；`BrowsableTheme` / `ThemeCatalogResponseContract`（data-model §1/§5）。
- [ ] T003 失敗測試 `packages/domain/test/design/apply-theme-selection.test.ts`：只覆寫一軸 / 全覆寫 / 無效 id 退 baseline+fallback / 無 selection===baseline / 純函式零外呼。
- [ ] T004 實作 `packages/domain/src/design/apply-theme-selection.ts`（baseline→override→composeKit，data-model §2）；`index.ts` 匯出。**先跑 `gitnexus_impact({target:"selectTheme"})`**（確認不動 selectTheme）。

## Phase 3：Backend — 瀏覽讀取 + 套用串接
- [ ] T005 `ThemeStore` 加 `listBrowsable()`（含 name/description + swatch 投影）；`DrizzleThemeStore` 實作（從 `themes` 讀 name/description，由 styleKit 安全萃取 swatch）。**先跑 `gitnexus_impact({target:"ThemeStore"})`**。
- [ ] T006 `GET /api/themes`（JWT）回 `ThemeCatalogResponseContract`（依 kind 分組）；contract + endpoint 測試。
- [ ] T007 生成路徑：`GeneratePreviewRequestContract` 加 `themeSelection?`；`slides.service.generatePreview` 改用 `applyThemeSelection(selectTheme(...), themeSelection, candidates)`（data-model §3）。**先跑 `gitnexus_impact({target:"generatePreview"})`**。測試：帶 selection→套用、不帶→現況不變、零額外 LLM 呼叫。
- [ ] T008 編輯路徑：edit-revision request 加 `themeSelection?`；`applyDeckEdit`（010）帶 selection 時重組 styleKit（data-model §4），其餘沿用 base；端點載入 themes 供 candidates。**先跑 `gitnexus_impact({target:"applyDeckEdit"})`**。測試：換主題→新 revision styleKit 改、文字/chartIntents 不變、零 LLM。
- [ ] T009 OpenAPI 補登 `GET /api/themes` + request `themeSelection`（contracts §4）+ smoke。

**✅ Checkpoint A**：後端可瀏覽主題 + 兩入口依 id 套用，零額外 LLM。

## Phase 4：Frontend — 共用 ThemePicker + 兩入口
- [ ] T010 [P] `themes-client`（GET /api/themes）+ 測試。
- [ ] T011 `ThemeBrowserModal`（共用彈窗）：三軸分頁 + swatch + 頂部組合摘要 + 搜尋/篩選/分頁（palette 96 用虛擬列表/分頁）+ 套用；a11y：focus trap、Esc 關閉、鍵盤/focus。輸出 `ManualThemeSelection`。＋ `ThemeSummary`（常駐摘要，未選=「自動」，含「瀏覽全部 →」開 modal）。元件測試。
- [ ] T012 生成頁：保留 6 張快速卡；表單側邊欄掛 `ThemeSummary` → 開 `ThemeBrowserModal` 選定 → 送出帶 request `themeSelection`。**先跑 `gitnexus_impact({target:"SlideGenerationForm"})`**。測試：選三軸→request 帶正確 ids；未開 modal→現況。
- [ ] T013 編輯頁：右側版面掛 `ThemeSummary`（沿用 010 版面）→ 開 `ThemeBrowserModal` → 套用 → 經 `createEditRevision` 帶 `themeSelection` → 即時預覽 + 存新版本。測試：換主題→預覽變、存後版本+1。
- [ ] T014 [P] i18n（zh-TW/en/ja）：picker 標籤、三軸名、組合摘要、瀏覽全部、swatch 提示。

**✅ Checkpoint B**：生成頁/編輯頁皆可瀏覽 220 主題、每軸挑選、即時看到效果。

## Phase 5：驗證收尾
- [ ] T015 [P] a11y（picker 鍵盤/focus/aria）+ RWD（窄視窗三軸可堆疊）+ reduced-motion。
- [ ] T016 client↔server 套用一致：同一 themeSelection，前端預覽與後端 render 的 styleKit/kitName 一致。
- [ ] T017 [P] **death-inventory 量化**（research）：跑 selectTheme 統計 220 裡實際可選中比例，記錄 011 動機數據。
- [ ] T018 e2e `apps/web/tests/e2e/theme-selection.spec.ts`：生成頁開瀏覽器→選主題→送出（mock /api）；編輯頁換主題→預覽變。
- [ ] T019 `gitnexus_detect_changes()` 確認影響範圍；三語無缺鍵。

## 明確不在本批
- 編輯主題庫本身（新增/改/刪 themes）、自訂主題、AI 推薦主題。
- 改寫 `selectTheme` 關鍵字演算法（多樣性/輪替）。
- 「完整主題卡」資料模型。
- 編輯頁圖表型別/顯隱控制（之前延後，另排）。
