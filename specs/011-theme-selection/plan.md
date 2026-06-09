# Implementation Plan: 主題庫手動選擇（生成頁 + 編輯頁，每軸各選，零額外 LLM）

**Branch**: `011-theme-selection`（疊在 `010-deck-editor` 上：編輯頁換主題依賴 010 的 edit-revision 基礎）| **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

## Summary

把 DB 的 220 個主題（font 57 / palette 96 / style 67，三軸分開存）從「關鍵字自動選 → 多數選不到（死庫存）」升級為**使用者每軸手動挑選**，在**生成頁**（第一次就做對、零額外 token）與**編輯頁**（WYSIWYG 換主題、確定性重渲染）皆可。

**鎖定決策（2026-06-09）**：
1. **每軸各選**：`manualThemeSelection = { fontId?, paletteId?, styleId? }`（不引入「完整主題卡」資料模型）。
2. **套用規則（純確定性、零 LLM）**：① `selectTheme(brief)` 取 baseline → ② 有指定的軸用 id 從候選取代 → ③ 三軸結果跑 `composeKit` → ④ 無任何指定時**完全維持現況**（關鍵字 selectTheme）。
3. **不重寫 `selectTheme`**：新增 wrapper `applyThemeSelection`，selectTheme 本身不動。
4. 生成頁**保留 6 張快速卡** + 新增「瀏覽全部」入口開主題瀏覽器；三軸 picker **生成頁/編輯頁共用**，顯示「目前組合摘要」。
5. 主題在 pipeline **render 後段套用**（LLM 之後）→ 指定主題**零額外 token**。

## Technical Context

**Language/Deps**：沿用既有 monorepo（TS；NestJS + Drizzle；React 19 + Vite + Tailwind v4）。**無新後端套件**；前端沿用既有元件庫（不需 dnd 等）。

**Storage**：沿用 007 `themes` 表（220 列，三軸）。**本批無 DB migration**——只新增「讀取/瀏覽」與「依 id 套用」的程式路徑。`manualThemeSelection`/結果的三軸 id 沿用既有 revision 的 `generationSummary.selectedTheme.ids` 持久化（010 已存），不需新欄位。

**整合點（已勘查）**：
- `ThemeStore.listSelectable(): SelectableTheme[]`（id/kind/keywords/support/styleKit）——**缺 name/description**，瀏覽器需要更豐富的讀取（見 data-model §browse）。
- `selectTheme(brief, candidates) → SelectedTheme{ styleKit, ids }`（純函式，007）。
- `composeKit({ style?, palette?, font? }) → DesignStyleKit`（純函式）。
- `slides.service.generatePreview`：在 render 階段把 `themedDesignPlanningResult.styleKit = selectedTheme.styleKit`——本批改成用 `applyThemeSelection` 的結果。
- 010 `applyDeckEdit`：目前沿用 base `designPlan`/styleKit；本批讓它在帶 `themeSelection` 時**重組 styleKit**（其餘文字/chartIntents 不變）。

**Performance（可驗收目標）**：
- `GET /api/themes`：單次 DB 讀 ~220 列(或依軸)。測試資料 **p95 < 150ms**;payload 估數百 KB,超過則依軸 lazy load(data-model §5)。
- `ThemeBrowserModal` 開啟初次 render **< 150ms**;軸內搜尋/篩選為 client 端,輸入到結果 **< 50ms**。
- palette 軸(96 筆)清單 **虛擬化或分頁**,同時掛載 DOM swatch **≤ 50** 個;清單**絕不**做 deck 渲染(只畫 swatch:色票方塊/字體樣本/風格標籤)。
- 完整 WYSIWYG 只在「選定後」:生成結果 / 010 LivePreview(client composeKit + 重渲染,沿用 010 的 debounce)。換主題**零額外 LLM/ token**。

## Constitution Check

- **Backend-Configured LLM Boundary（CR-004）**：本批**完全不呼叫 LLM**；主題在 render 後段確定性套用，指定主題零額外 token。
- **Coherent Deck Design System（CR-005）**：沿用 `composeKit` 三軸合成，設計一致性不變。
- **Source Fidelity / Reviewable**：換主題只改 styleKit，**不改文字/結構/chartIntents**；編輯頁換主題沿用 010 的確定性重渲染與 reviewReport。
- **Code Quality**：picker 為共用元件（生成頁/編輯頁不重複）；`applyThemeSelection` 為 selectTheme 的薄 wrapper（不重寫）；瀏覽讀取與選擇套用分離。
- **Backward Compatible**：無 `themeSelection` 時行為與現況 100% 相同（关键字 selectTheme）。

## 實作階段（供 /tasks 展開）

### Phase A — Domain：依 id 套用主題（純函式）
- `applyThemeSelection(baseline: SelectedTheme, manualSelection, candidates): SelectedTheme`：以 baseline 為底，對有指定的軸用候選的 styleKit 取代 → `composeKit` → 新 ids/kitName。無指定軸沿用 baseline。
- 失敗安全：指定 id 不在候選（停用/不存在）→ 該軸退回 baseline + 標記（見 spec edge cases）。
- 匯出於 `packages/domain/src/index.ts`。

### Phase B — Backend：瀏覽讀取 + 兩個入口套用
- `ThemeStore` 加瀏覽讀取（含 name/description + swatch 欄位；見 data-model §browse）；`DrizzleThemeStore` 實作。
- `GET /api/themes`（JWT）：回傳依 kind 分組的 browsable themes。
- 生成路徑：`GeneratePreviewRequestContract` 加 `themeSelection?`；`slides.service` 以 `applyThemeSelection` 取代 selectTheme 輸出。
- 編輯路徑：edit-revision request 加 `themeSelection?`；`applyDeckEdit`（010）帶 selection 時重組 styleKit。
- OpenAPI 補登 `GET /api/themes` + request 欄位。

### Phase C — Frontend：共用 ThemePicker（modal）+ 常駐組合摘要
- `themes-client`（GET /api/themes）。
- **`ThemeBrowserModal`（彈窗，共用）**：三軸分頁（font/palette/style）+ swatch + 搜尋/篩選/分頁（96 palette 需虛擬列表/分頁）+ 頂部「目前組合」摘要 + 套用。a11y：focus trap、Esc 關閉、鍵盤可操作。
- **`ThemeSummary`（常駐摘要，共用）**：顯示三軸目前選擇（未選=「自動」），帶「瀏覽全部主題 →」按鈕開 modal。**生成頁掛在表單側邊欄**（設計區）、**編輯頁掛在右側版面**（沿用 010）。
- 生成頁：保留 6 張快速卡；`ThemeSummary` 顯示組合、開 modal 選定 → request.themeSelection。
- 編輯頁：`ThemeSummary` 顯示組合、開 modal、套用 → 經 edit revision 重渲染、即時預覽。
- i18n（zh-TW/en/ja）、a11y（modal focus trap / 鍵盤 / focus / RWD / reduced-motion）。

### Phase D — 驗證
- domain `applyThemeSelection` 測試（override/缺軸/無效 id 退回）；contract 測試；endpoint 測試；picker 元件測試；生成/編輯兩入口整合測試；client↔server 套用一致；death-inventory 量化（research）。

## Complexity Tracking

| Added complexity | Why | Rejected alternative |
|---|---|---|
| 三軸 picker UI + swatch | 解鎖 220 組合、即時可辨識 | 整組精選卡：回到少數可選，違反 011 動機 |
| `GET /api/themes` 新讀取端點 | 瀏覽需 name + swatch 欄位（listSelectable 不夠） | 重用 listSelectable：缺 name/swatch，無法呈現 |
| 編輯頁 re-theme（applyDeckEdit 重組 styleKit） | WYSIWYG 換主題、確定性 | 只在生成頁：無法對既有 deck 換主題 |

## Evidence Plan
- 自動：`applyThemeSelection` 單元（含失敗安全）、contract、endpoint、picker、兩入口整合、套用一致。
- 量化：跑 selectTheme 統計 220 裡實際可選中的比例（death-inventory，當動機數據）。
- 手動：quickstart（生成頁挑主題→第一次即套用；編輯頁換主題→即時預覽→存新版本；無指定→現況）。
