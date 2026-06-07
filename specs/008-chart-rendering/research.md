# Research: 008 chart-rendering

## DR-001: chart renderer 採 engine-owned inline SVG/HTML

**Decision**: pie/donut、line、bar 由 `packages/domain/src/rendering` 產生 inline SVG;metric card、table、metric group、fallback 由 sanitized HTML 產生。不得使用 Chart.js、Recharts、D3 runtime、canvas 或外部 CDN。

**Rationale**: self-contained HTML slides、PDF export、無 JS 靜態顯示與逐值 sanitize 是核心要求。inline SVG 可直接進 HTML artifact,可被 snapshot 測試,也能和 deck CSS/theme token 整合。

**Alternatives considered**:

- Chart.js/canvas:需要 client JS/canvas;PDF/static export 風險高。
- Recharts/React:deck artifact 不是 React app;會引入 runtime/打包複雜度。
- D3 runtime:強大但過度;008 只需 pie/line/bar 的小資料靜態輸出。

## DR-002: 008 引入最小 `ChartSeries`,但不讓 LLM 產 structured series

**Decision**: 從既有 `ChartIntent.sourceFacts` / `SourceFact` 抽出 `ChartSeries`。每點包含 label、numeric value、display value、unit、sourceFactId、optional sort key。無法可靠抽取時 fallback 並記 note。

**Rationale**: 真圖需要結構化點位,但 spec 明確要求不得捏造、補點或外推。由 deterministic extractor 產生最小 series,比讓 LLM 直接產數列更容易保證 source fidelity。

**Alternatives considered**:

- LLM 直接輸出 `{label,value}[]`:可處理更多形式,但會引入 unsupported data/fabrication risk,需另開 feature。
- Renderer 直接吃 raw `SourceFact.value`:無法集中驗證單位、排序、fallback reason。

## DR-003: pie/line/bar 的最低資料條件

**Decision**:

- pie/donut:2+ non-negative values,總和 > 0,同一比較基準/同單位;含負值/全 0/不可加總 fallback table。
- line:2+ points,同單位 numeric values,可排序 x labels/time labels;缺點不補。
- bar:2+同單位 numeric values;label 可讀且可截斷;單位混合 fallback metric group/table。

**Rationale**: 簡報圖表要快速理解,錯誤的軸或比例比 fallback 更糟。最低條件讓 renderer 有穩定 contract。

**Alternatives considered**:

- 寬鬆解析所有數字並畫圖:高誤導風險。
- 所有多點都畫 bar:無法滿足 pie/line 需求,也會錯過 trend semantics。

## DR-004: `VisualizationType → ChartTreatment` mapping 為單一真實來源

**Decision**: 新增 mapping 純函式或常數表,由 content-core 的 `VisualizationType` 映射到 design 的 `ChartTreatment`,並由 tests 覆蓋每個 enum。`comparison`/`timeline` 仍是內容語意;renderer 根據 treatment + series validation 決定具體 visual kind。

**Rationale**: spec 決策 B 要分工而不是合併 enum。單向 mapping 可避免 design planner 與 renderer 各自 switch 導致漂移。

**Alternatives considered**:

- 合併兩個 enum:會混淆「內容規劃語意」和「渲染決策」。
- renderer 直接看 `recommendedVisuals`:可行但會繞過 design `ChartTreatmentPlan`,使 design layer 失去單一決策來源。

## DR-005: preview matrix 使用 007 已啟用 style registry

**Decision**: 新增 dev/test script `preview:chart-matrix` 或等價,讀取 007 已啟用 style registry/seeds,對每個 style × chart visual 產生 HTML/截圖或等價 artifact。palette/font 軸固定 safe/default 組合,全組合覆蓋留待 009。缺任一組合、空白、外部資源或基本 overflow smoke fail。

**Rationale**: chart 是否可用取決於 palette、typography、density、背景和 chart labels。矩陣比抽樣更能抓 style-specific regression,也滿足使用者要求「每種 chart 在每個風格內都要有 script 測試可以預覽」。

**Alternatives considered**:

- 只跑 renderer unit tests:看不到 style 互動。
- 只產一份 demo deck:無法覆蓋新增 style。

## DR-006: tests 採 structural/smoke,不做逐像素比對

**Decision**: 自動測試檢查 SVG/HTML 結構、data attributes、labels/values、sourceFactIds、sanitize、自包含、no blank、matrix completeness。肉眼 QA 檢查美感與細節。

**Rationale**: pixel snapshots 對字體/rendering platform 太脆弱。008 的可測 contract 是「有正確 chart、資料忠實、安全、自包含、不明顯溢出」。

**Alternatives considered**:

- 全量 Playwright screenshot diff:維護成本高,容易因 platform/font 產生 false positive。
- 完全手動:無法保證 coverage。
