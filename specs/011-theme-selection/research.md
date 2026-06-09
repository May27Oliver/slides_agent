# Research: 主題庫手動選擇（011）

## R1 — 套用策略：baseline + 每軸覆寫（不重寫 selectTheme）
- **決定**：baseline ids 取自 `selectTheme(brief, candidates).ids`，再 `applyThemeSelection(baselineIds, selection, candidates)`：每軸 effectiveId（覆寫優先，否則 baseline）→ **由 candidates 依 id 解析 partial**（不反解 composed kit）→ `composeKit`；回 `{ selectedTheme, warnings }`。
- **理由**：① 「無指定 = 現況」最自然（直接回 baseline）；② 只覆寫想換的軸、其餘維持自動，符合「每軸各選」；③ selectTheme/composeKit 都是純函式，覆寫純確定性、零 LLM；④ 不動 selectTheme 降低既有風險（CR-005 設計一致性沿用 composeKit）。
- **拒絕**：重寫 selectTheme 接受 manualSelection（侵入既有純選擇邏輯、風險高）；整組精選卡（回到少數可選，違反 011 動機）。

## R2 — 主題在 render 後段套用 → 指定主題零額外 token
- **事實**：`generatePreview` 在 LLM（分段/大綱/設計）之後才 `themedDesignPlanningResult.styleKit = selectedTheme.styleKit`。
- **結論**：在生成頁讓使用者指定主題**不增加任何 LLM 呼叫/ token**；真正省 token 的是「避免因自動選錯而重新生成」。支持「生成頁就該能選」。

## R3 — 瀏覽讀取需 name + **完整 partial styleKit**（修正:原本「只回 swatch」已推翻）
- `SelectableTheme` 只有 id/kind/keywords/support/styleKit，**無 name/description**。瀏覽器要可讀標籤;編輯頁要 client `composeKit` 即時重渲染,**需要完整 partial styleKit**。
- **決定（最終）**：`listBrowsable()` 回 name/description/keywords + **完整 partial `styleKit`**（= SelectableTheme.styleKit）。**swatch 由 client 從該 partial kit 萃取**（顏色 hex / 字體家族名 / 風格標籤），不在後端做縮減投影。安全性:trusted builtin（007 seed 已驗證），render/client 在使用邊界 escape——**不在端點再做 sanitize**。
- **被推翻的舊案**:「只回 swatch、不回 styleKit」——會讓編輯頁 client 無法 compose/render（與 010 client-renderer parity 衝突），故改回傳完整 partial kit。

## R4 — 預覽成本：清單用 swatch，不對 220 做 live 全渲染
- 220 個（palette 96）若各做 live deck 渲染不可行。
- **決定**：清單用**從 partial kit 萃取的輕量 swatch**（非 live deck）；palette 清單虛擬化/分頁、DOM swatch 上限。完整 WYSIWYG 只在「選定後」——生成頁 = 生成結果、編輯頁 = 010 LivePreview（client composeKit 完整 partial kit 重渲染）。

## R5 — death-inventory 量化（動機數據，待跑）
- selectTheme 為「最高分；沒比中或平手 → 穩定排序第一個」，無多樣性機制。
- **待辦（T017）**：以一組代表性 brief 跑 selectTheme，統計 220 裡實際被選中的 distinct 主題數 / 占比，量化「死庫存」規模作為 011 動機證據。預期：可選中比例極低（長尾選不到）。

## R6 — 編輯頁 re-theme 的 baseline 來源
- 編輯既有 deck 換主題時，baselineIds 取 **base revision 既有三軸**（`generationSummary.selectedTheme.ids`），交同一個 `applyThemeSelection`；某軸為 null 或解析不到（legacy/已刪/已停用）→ 該軸用**預設 + `base_unresolved` warning**（不另跑 selectTheme）。
- 只換 styleKit，文字/結構/chartIntents 沿用 base（010 確定性重渲染），產生新 `origin="edit"` revision。
