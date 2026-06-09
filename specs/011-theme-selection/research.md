# Research: 主題庫手動選擇（011）

## R1 — 套用策略：baseline + 每軸覆寫（不重寫 selectTheme）
- **決定**：`applyThemeSelection(selectTheme(brief), selection, candidates)`：以關鍵字 baseline 為底，對使用者指定的軸用 id 覆寫，再 `composeKit`。
- **理由**：① 「無指定 = 現況」最自然（直接回 baseline）；② 只覆寫想換的軸、其餘維持自動，符合「每軸各選」；③ selectTheme/composeKit 都是純函式，覆寫純確定性、零 LLM；④ 不動 selectTheme 降低既有風險（CR-005 設計一致性沿用 composeKit）。
- **拒絕**：重寫 selectTheme 接受 manualSelection（侵入既有純選擇邏輯、風險高）；整組精選卡（回到少數可選，違反 011 動機）。

## R2 — 主題在 render 後段套用 → 指定主題零額外 token
- **事實**：`generatePreview` 在 LLM（分段/大綱/設計）之後才 `themedDesignPlanningResult.styleKit = selectedTheme.styleKit`。
- **結論**：在生成頁讓使用者指定主題**不增加任何 LLM 呼叫/ token**；真正省 token 的是「避免因自動選錯而重新生成」。支持「生成頁就該能選」。

## R3 — 瀏覽讀取需 name + swatch（listSelectable 不夠）
- `SelectableTheme` 只有 id/kind/keywords/support/styleKit，**無 name/description**。瀏覽器要可讀標籤 + 輕量預覽。
- **決定**：新增 `listBrowsable()`：從 `themes` 表讀 name/description，並由各軸 styleKit **安全投影** swatch（palette→顏色 hex；font→字體家族名 + googleFontsHref；style→結構 enum 標籤）。**不回傳整包 styleKit、不含可注入 CSS**（沿用 007 的 sanitization 立場）。

## R4 — 預覽成本：swatch 為主，不對 220 做 live 全渲染
- 220 個（palette 96）若各做 live deck 渲染不可行。
- **決定**：清單用輕量 swatch；完整 WYSIWYG 只在「選定後」——生成頁 = 生成結果、編輯頁 = 010 LivePreview。palette 清單用分頁/虛擬列表。

## R5 — death-inventory 量化（動機數據，待跑）
- selectTheme 為「最高分；沒比中或平手 → 穩定排序第一個」，無多樣性機制。
- **待辦（T017）**：以一組代表性 brief 跑 selectTheme，統計 220 裡實際被選中的 distinct 主題數 / 占比，量化「死庫存」規模作為 011 動機證據。預期：可選中比例極低（長尾選不到）。

## R6 — 編輯頁 re-theme 的 baseline 來源
- 編輯既有 deck 換主題時，baseline 取 **base revision 既有三軸**（`generationSummary.selectedTheme.ids`）較穩；legacy（無三軸）退回對 base 重跑 selectTheme 或預設。
- 只換 styleKit，文字/結構/chartIntents 沿用 base（010 確定性重渲染），產生新 `origin="edit"` revision。
