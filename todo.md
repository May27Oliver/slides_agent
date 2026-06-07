# TODO — 後續待辦（多為 feature 009 候選）

> 整理自 2026-06-06/07 的 008 chart-rendering 開發對話。008 已完成（真圖 + US6 泛用規劃器 + chart-feature 版面）。
> 以下是過程中浮現、刻意延後的項目。

## 009 候選（三大項）

### 1. 前端主題選擇重設計

**問題**：後端 theme 空間極大（full style 20 × palette 96 × font 57 ≈ 109,440 組合），前端只有 6 個 preset 按鈕，且透過「自由文字 styleDirection → 比對種子關鍵字 → 選最高分」這條**模糊比對**鏈選擇。這條鏈是這次所有選擇 bug 的根源（EV 子字串誤判、科技/商務同化、6 個 preset 有 4 個都掉進 minimalism）。

**方向**：

- preset／gallery 改走**明確 theme ID**（確定性，按鈕不再經模糊 scorer）。
- 只有「風格方向（自訂）」文字框保留關鍵字模糊比對。
- 定義「**具名主題**」資料結構＝明確的 style+palette+font 綁定（例：企業藍／科技玻璃／溫暖陶土…，約 12–16 個）。
- 進階：20 風格 gallery（可沿用既有 `apps/api/scripts/preview-themes.ts` harness 當視覺挑選器）。
- 含子項：preset → style 差異化（目前專業商務／溫暖親切／優雅高級／簡約俐落都 fallback 到 `style-00-minimalism`）。

**立即止血（009 前可先做）**：`pnpm --filter @slides-agent/api db:seed` 套用本次新增的關鍵字；必要時補各 preset 的差異化關鍵字。

### 2. LLM 簡報品質評審關卡

**動機**：機械可判定的（對比/溢版/外部資源/sanitize/來源保真）用確定性 validator；主觀品質（視覺層次、文案、圖型是否恰當）才交給 LLM 評審。

**方向（分層）**：

- ① 確定性硬關卡先擋（可自動修就修，如對比保險）。
- ② LLM 只評**主觀品質** → 對被標記的 slide **定向重產上游輸入**（design plan / outline / chart treatment），而非直接改 HTML。
- 護欄：有界重試（每張 ≤2 次）、重產後**必過**硬關卡、不可回退（更差就丟棄）、成本/延遲上限、可關。

### 3. Palette 帶文字色 + 007 整套覆蓋（對比接縫治本）

**問題**：背景來自 007 palette、`--text` 來自 LLM designSystem，兩來源對 light/dark 認知會打架。目前在 `buildDeckStyleCss` 用對比保險（依畫布亮度校正）band-aid。

**治本**：讓 palette 種子帶 `text`/`mutedText`；007 選主題時**連文字色一起換**（全有或全無），而非只換背景。前提：`PaletteStyleKit` 目前沒有文字色欄位，需擴充 + 補所有 palette 種子。

## 較小項（順手記著，未必算「三大」）

- **前端圖表輸入提示**：在簡報內容輸入區或 chart emphasis 旁加一段 user-facing hint，避免使用者以為任意數字都會成圖。建議短版：「想產生圖表時，請把同一主題的數值放在同一段或同一小節，並保持單位一致。例：各區域營收、各季度成長、加總約 100% 的占比。無法可靠比較的數字會保留為文字。」可展開說明：同單位多筆數值 → 比較圖；有明確期間的數值 → 趨勢圖；百分比加總約 100% → 占比圖；單一重要指標 → 指標卡。
- **chart 標題「資重點」底層 bug**：chart-feature 版面目前用 CSS `.has-chart-split .chart-title{display:none}` 隱藏 figcaption，但 intent.title 來源被汙染／截斷的根因未查（正常應為 section heading）。
- **chart-feature 版面 responsive 再驗**：更窄寬度、更多洞察點、line/bar 在 split 右欄的表現。
- **legend label 進階**：`deriveLabel` 已能抽類別名／期間；可再驗各種 LLM 改寫句型。

## Review 後仍延後的清理項（2026-06-07 deep review）

> 本次已清掉：`PART_TO_WHOLE` / `FALLBACK_HUE` / `periodLabel` 重複、`metric-value-parser.ts` shim、
> `ParsedMetricValue` 雙重 re-export、`deck-style-css` 自帶的 `safeHex/safeNumber` + 3 份 hex 解析、
> 死碼 `--bg` / `chart-pie-svg` / border-bottom override、`.chart-title{display:none}` band-aid（改 `hideTitle`）、
> `groupByUnit` magic string → Symbol、`openSvg(viewBox)` 泛化、`AXIS_LABEL_MAX` 具名。
> 以下是評估後**刻意延後**（多為 pre-existing 或需動到 fixture/測試）：

- **`extractSourceFacts` 寫死 `"dashboard MVP"` / `"full CRM integration"`**（`source-fact-extractor.ts`）：早期 fixture 殘留的硬編字串，但 `planning-brief.md` 測試與 `sourceFactCount:8` 仰賴它。移除需同步改 `expected-source-facts.json` 與 `generate-preview-deck.test`。pre-existing，非本 session。
- **`extractSourceFacts` 泛用單位抽取不足**：planner 已能處理手工 `SourceFact` 的 `820 users` 這類「數字 + 短單位」資料，但端到端 extractor 目前只抽 `%`、貨幣、`小時`、`FTE`、日期等固定模式。若要支援任意英文/中文短單位，需另做低雜訊抽取規則與 fixtures。
- **`validExternalSegmentation()` 在兩個 deck orchestrator 重複**（`generate-preview-deck.ts` / `slide-deck-planner.ts`）：抽到共用。pre-existing。
- **`collectChartReviewNotes` 會再跑一次 `renderChartIntent`**（雙重渲染）且與 `buildChartContext` 各建一份 intent/plan map：應接受預建 context 或已渲染結果。deck 很小、影響小，屬架構接縫。
- **mixed-period 規模不一致**：planner 對「裸季度 + 帶年份」混合仍發 `timeline`，extractor 再降級成 bar（行為正確、僅 planner 過度自信）。可抽共用 `areSamePeriodicScale` 對齊（FR-017 polish）。

## 已知操作備忘

- 改了 seed JSON（`theme-styles.json` / `theme-palettes.json`）後必須 `db:seed` 才會進 DB。
