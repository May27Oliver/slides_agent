# Feature Specification: Chart Rendering(把規劃的圖表意圖畫成自包含 inline SVG / HTML 視覺 — metric-first MVP)

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `008-chart-rendering`

**Created**: 2026-06-06

**Status**: Draft（clarify 已定:A1 / B-分工映射）

**Input**: User description: "把規劃好的圖表意圖(ChartIntent / chartTreatmentPlans)在 deck 裡畫成真正的視覺,用 engine-owned 的 inline SVG/HTML(不依賴前端圖表套件;可匯出 PDF、靜態、逐值 sanitize、自包含)。整併 content-core 的 `VisualizationType` 與 design 的 `ChartTreatment` 兩個列舉。"

**Clarify 決策(2026-06-06)**:
- **A = A1**:本 feature **只用現有文字 `SourceFact` 資料**做得到的視覺(metric card / 表格 / metric 群組),**不引入結構化數列管線**;價值縮放的真圖(長條/折線/圓餅)**延到後續 feature**。
- **B = 分工 + 單向映射**:content-core 的 `VisualizationType` 為內容規劃語意、design 的 `ChartTreatment` 為渲染決策,定義一個 `VisualizationType → ChartTreatment` 單向映射(單一真實來源)。
- **C**:US「真圖」延後(見「明確延後」)。

---

## 背景與目標

007 把設計風格資料化。簡報的**圖表**目前「規劃了、沒畫」:

- **規劃層已有**:`ChartIntent`(`id`/`title`/`sourceFacts`/`recommendedVisuals`/`rationale`)+ `VisualizationType`(`metric_card`/`comparison`/`timeline`/`milestone`/`callout`/`table`/`none`);design 層 `ChartTreatmentPlan` + `ChartTreatment`(`chart`/`metric_card`/`table`/`timeline`/`fallback_text`/`review_note`);slide 帶 `chartIntentIds`。
- **渲染層沒有**:`template-html-renderer` 不會把 chart intent 畫成視覺,`chartIntentIds` 最後只成一般項目/文字。
- **資料現況**:`SourceFact.value` 是**字串**(例 `"$2.3M"`、`"45%"`、`"Q3 2026"`),`SourceFactKind` 會標 `"metric"`/`"date"`;**沒有結構化數列**。

008(A1 範圍):把**用現有文字 fact 就能做的視覺**畫出來——**metric card(大數字)、metric 群組(多個關鍵數字並列)、表格**——讓「圖表渲染」這條路在 deck 裡走通(intent → 視覺 + 溯源 + 安全退回)。價值縮放、需要數列的真圖(長條/折線/圓餅)在本 feature **明確不做**,留待後續。

**技術定調(已確認)**:**engine-owned inline SVG / HTML**,**不引入前端圖表套件**(Chart.js 需 canvas+JS/CDN 破壞自包含;Recharts 是 React、deck 非 React;canvas 類在 PDF/無 JS 匯出會消失)。inline SVG/HTML 靜態、PDF 也在、零第三方依賴、可逐值 sanitize,沿用既有渲染器調性與 sanitize 防線(`safeNumber`/`safeHex`/`safeCssValue`/HTML escape)。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Metric card / 單值視覺(Priority: P1)

把 `metric_card` / `callout` / `milestone` 類意圖渲染成**有設計感的數據區塊**(大數字 + 標籤 + 脈絡),數字取自 `kind="metric"` 的 source fact。**用現有資料就能做**,涵蓋簡報最常見的「重點數字」——單獨完成即可用 MVP。

**Why this priority**:價值最高、相依最低;先讓 intent → 視覺 → 溯源 → fallback 這條路走通。

**Independent Test**:給帶 `metric_card` intent + metric fact 的 deck,渲染輸出含 metric 區塊(大數字、標籤、來源溯源),套主題 token;數字無法解析時退回純文字且不報錯、記 review note。

**Independent Demo**:`preview` 一份含「營收 $2.3M(↑18% YoY)」的範例 deck,看到 metric card 而非項目符號。

**Acceptance Scenarios**:

1. **Given** `metric_card` intent 指向 metric fact `"$2.3M"`,**When** 渲染,**Then** slide 出現大數字 `$2.3M` + 標籤 + 來源溯源,套主題色。
2. **Given** metric fact 的 `value` 不含可解析數字(例 `"顯著成長"`),**When** 渲染,**Then** 退回原文文字,不產生空白/壞圖,review note 記「資料不足以成圖」。
3. **Given** 同一 metric 在多 slide 重複,**When** 渲染,**Then** 樣式一致(共用引擎,不逐張漂移)。

---

### User Story 2 - 表格處理(Priority: P2)

把 `table` 意圖把相關 facts 渲染成**乾淨的 HTML 表格**(套主題 token)。不需要數列,純用現有 facts,低風險高價值。

**Why this priority**:用現有資料即可、補上「多筆結構化文字」的呈現;相依 US1 的渲染骨架與溯源。

**Independent Test**:給 `table` intent + 多筆 facts,渲染輸出含 `<table>`(表頭/列),文字經 escape,套主題;facts 過多時截斷並記 note。

**Acceptance Scenarios**:

1. **Given** `table` intent 帶多筆 facts,**When** 渲染,**Then** 出現主題化表格、文字 escape、保留來源溯源。
2. **Given** 列數超過版面上限,**When** 渲染,**Then** 截斷顯示前 N 並記「省略 M 列」review note。

---

### User Story 3 - Metric 群組(comparison 的 MVP 形式)+ 列舉整併(Priority: P3)

把 `comparison` 意圖在 MVP 階段渲染成**多個 metric 並列(metric 群組 / stat grid)**——多個關鍵數字一排,不做價值縮放長條。並落實 **`VisualizationType → ChartTreatment` 單向映射**(決策 B),作為單一渲染決策來源;不支援/需數列的型別**安全退回** `table` 或 `fallback_text`。

**Why this priority**:完善度與一致性;相依 US1。

**Independent Test**:`comparison` intent 多個 metric facts → 並列 metric 群組;映射表把每個 `VisualizationType` 對到一個 `ChartTreatment`,測試覆蓋每條對應;value-scaled 型別(`chart`/真 timeline)走 fallback。

**Acceptance Scenarios**:

1. **Given** `comparison` intent 帶 3 個 metric facts,**When** 渲染,**Then** 出現 3 個並列 metric(共用樣式),非單一長條圖。
2. **Given** intent 的 `VisualizationType` 對映到需數列的 treatment,**When** 渲染,**Then** 依映射退回 `table`/`fallback_text` 並記 review note。

---

### Edge Cases

- chart intent 指向的 fact 已被壓縮/省略 → 退回 fallback,review report 揭露。
- metric fact 值含貨幣/百分比/千分位/混合單位 → 解析保留原單位與精度(CR-001);無法解析 → 退回文字。
- 0 筆 fact → `fallback_text`;1 筆 → 單一 metric card。
- 表格/群組過量 → 截斷 + 省略提示,不溢出版面。
- 任何需要價值縮放數列的型別(長條/折線/圓餅/真 timeline)→ **本 feature 一律退回**(table/text)並記 note。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**:渲染時,系統 MUST 把 slide `chartIntentIds` 對應的 chart intent **依映射後的 treatment 渲染成 inline SVG/HTML 視覺**(metric card / 表格 / metric 群組),而非一律降為項目符號。
- **FR-002**:系統 MUST 用 **engine-owned inline SVG/HTML**(不引入前端圖表套件),輸出自包含、靜態(無需 client JS 即可顯示)、可匯出 PDF。
- **FR-003**:系統 MUST 對所有內插值逐值 sanitize——數值 `safeNumber`、顏色 `safeHex`、文字 HTML escape / `safeCssValue`;任何 LLM/DB 來源字串不得逸出 SVG/`<style>`。
- **FR-004**:資料不足以成視覺時,系統 MUST **退回**(`fallback_text`/`table`),不得空白/壞圖,並於 review report 揭露。
- **FR-005**:視覺配色 MUST 取自當前主題(`accentHues`/design token),與風格一致。
- **FR-006**:系統 MUST 定義並實作 **`VisualizationType → ChartTreatment` 單向映射**(單一真實來源),作為渲染決策依據。
- **FR-007**:系統 MUST 保留視覺到來源 fact 的**溯源**,供 review 檢視。
- **FR-008**:系統 MUST **不引入結構化數列管線**;價值縮放的真圖(長條/折線/圓餅/真 timeline)**不在本 feature 範圍**,一律退回(留待後續 feature)。
- **FR-009**:視覺 MUST 在 16:9 與較窄寬度下不溢出(基本 responsive),不影響鍵盤導航。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**:metric/表格 MUST 忠實呈現來源數字/日期/單位,保留原精度,不捏造或外推。
- **CR-002 Review Report**:「資料不足以成圖而退回」「表格/群組省略了哪些」「不確定的數值解析」MUST 為可見 review note。
- **CR-003 Web-First Output**:維持自包含 HTML;視覺為 inline SVG/HTML,無外部資源。
- **CR-004 Backend-Configured LLM Boundary**:N/A——008 為**純引擎渲染**,不呼叫 LLM(沿用既有 intent/fact 資料)。
- **CR-005 Design System**:視覺 MUST 套 deck 級設計約束(palette/accentHues、字級、間距、密度)。
- **CR-006 Semantic Titles**:metric/表格標題沿用 intent `title`,扣回來源語意,不誇大。
- **CR-007 Data Visualization**:本 feature 即 CR-007 落實——明定:可解析單值 → metric card;多筆結構文字 → 表格/metric 群組;資料不足 / 需數列 → 退回文字/表格。
- **CR-008 TDD Coverage**:每個 user story 以 vitest 覆蓋——渲染輸出含預期結構與數值、sanitize 守衛、fallback、映射對應。
- **CR-009 Domain Model**:主要概念——`ChartIntent`、`VisualizationType`/`ChartTreatment`(映射)、metric 解析純函式、chart 渲染純函式(domain,純淨無 SQL、無第三方圖表庫)。
- **CR-010 Lean Test Scope**:測試聚焦可觀察行為(輸出含某元素/數值/退回),不逐像素比對。
- **CR-011 Behavior-Driven Value**:見各 US 的 Given/When/Then;US1 可獨立 demo/測試。
- **CR-012 Code Simplicity**:範圍僅 metric card / 表格 / metric 群組;價值縮放真圖與複雜型別(Sankey/network/geo/3D)**明確不做**。
- **CR-013 Consistent Language**:`metric card`/`table`/`fallback`/treatment 名稱於 UI/review/程式/文件一致;映射為單一真實來源。
- **CR-014 Performance and Evidence**:inline SVG/HTML 靜態、零執行成本;證據為渲染輸出快照 + 預覽截圖;截斷策略須記錄。
- **CR-015 Manual Verification**:視覺好不好看需肉眼驗收;沿用 `preview` harness 範例 deck 截圖。
- **CR-016 Verification**:acceptance 含 slide JSON 結構有效、HTML 渲染、鍵盤導航、基本 responsive(視覺不溢出)。

### Key Entities *(include if feature involves data)*

- **ChartIntent**(已存在):渲染輸入。
- **VisualizationType → ChartTreatment 映射**(新增):單向映射表,渲染決策的單一真實來源。
- **Metric 解析純函式**(新增,domain):從 `SourceFact.value` 字串解析出 `{ display, numericValue?, unit? }`;無法解析回 null → 觸發 fallback。
- **視覺渲染純函式**(新增,domain `rendering/`):`renderMetricCard` / `renderMetricGroup` / `renderFactTable` → 回傳 sanitize 過的 inline SVG/HTML 片段。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**:帶 `metric_card` intent + 可解析 metric fact 的 deck,渲染 100% 出現 metric 區塊(非降級為項目)。
- **SC-002**:所有視覺輸出自包含(無外部 `<script>`/`<link>`/`url()`),停用 JS 仍正確顯示(靜態)。
- **SC-003**:資料不足 / 需數列的 intent 100% 安全退回,無空白/壞圖,review report 揭露。
- **SC-004**:`VisualizationType → ChartTreatment` 映射有單一真實來源,測試覆蓋每條對應。
- **SC-005**:全部數值/文字經 sanitize,惡意輸入無法逸出 SVG(對應測試綠)。

## Assumptions

- 沿用 007 渲染架構與 `preview:themes` 風格 harness 做肉眼驗收。
- domain 維持純淨(渲染為純函式,無 SQL、無第三方圖表庫);輸出為 inline SVG/HTML 字串。
- MVP 視覺限 metric card / 表格 / metric 群組;價值縮放真圖與複雜型別退回。
- 主題配色(accentHues)由 007 提供,直接取用。
- 視覺為**靜態**(預設不加入場動畫,保持簡單;若加則受既有 reduced-motion 守衛)。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**:對來源數值做單位正規化/四捨五入/截斷,須在 review note 揭露。
- **Omitted or Compressed Content Policy**:表格/群組截斷時記「顯示前 N、省略 M」,不靜默丟資料。
- **Uncertain Claims Policy**:無法可靠解析為數值的 fact 不強行成圖,標記不確定並退回文字。
- **Sensitive Content Handling**:008 純引擎、不送 LLM;不外洩任何內容。
- **Evidence and Traceability**:每個視覺保留到來源 fact 溯源;渲染輸出快照 + 預覽截圖為審查證據。
- **Manual Verification Path**:`preview` 範例 deck 涵蓋 metric card / 表格 / metric 群組 / 退回,肉眼確認。

---

## 明確延後(本 feature 不做,留待後續)

- **價值縮放真圖**:長條圖、折線/面積圖、圓餅/環圈、真 timeline——需要結構化數列 `{label,value}[]`。後續 feature 再決定數列來源(LLM 產 series 的 A3 路或引擎解析的 A2 路)。
- **複雜型別**:Sankey / network graph / 地理 / 3D / candlestick 等——超出簡報核心,長期可能也只做 fallback。
- 本 feature 為這些奠定基礎:渲染骨架(intent→treatment→視覺/fallback)、映射、sanitize 防線、溯源,後續加數列即可長出真圖。
