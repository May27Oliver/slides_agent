# Feature Specification: Chart Rendering(把規劃的圖表意圖畫成自包含 inline SVG / HTML 真圖表)

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `008-chart-rendering`

**Created**: 2026-06-06

**Status**: Draft（clarify 已定:B-分工映射、C-chart 規劃決策層；2026-06-06 scope update:008 必須包含真圖 + 泛用 chart-intent 規劃）

**Input**: User description: "把規劃好的圖表意圖(ChartIntent / chartTreatmentPlans)在 deck 裡畫成真正的視覺,用 engine-owned 的 inline SVG/HTML(不依賴前端圖表套件;可匯出 PDF、靜態、逐值 sanitize、自包含)。整併 content-core 的 `VisualizationType` 與 design 的 `ChartTreatment` 兩個列舉。008 階段就要有圓餅圖、線圖/折線圖這些真圖。"

**Clarify 決策(2026-06-06)**:
- **B = 分工 + 單向映射**:content-core 的 `VisualizationType` 為內容規劃語意、design 的 `ChartTreatment` 為渲染決策,定義一個 `VisualizationType → ChartTreatment` 單向映射(單一真實來源)。
- **A/C scope update**:本 feature **必須包含真圖表 MVP**。除 metric card / 表格 / metric 群組外,008 必須從可可靠解析的來源 facts 建立最小 `ChartSeries`,並渲染 **pie/donut chart、line chart(折線圖/線圖)、bar chart(比較長條)**。資料不足或單位不一致時才退回表格/文字,不得捏造數列。
- **C = chart 規劃決策層(2026-06-06 補充澄清)**:「**決定哪些資料該成圖**」這層 MUST 在 008 內**真正泛用**。008 不只渲染既有 intent,還 MUST 提供一個**確定性 chart-intent 規劃器**——對 deck 已解析且可解析為數值/期間的 `SourceFact` 判斷可圖性、分組,並產出帶 `recommendedVisuals` 的 `ChartIntent`,**嚴禁寫死特定樣本值或資料集**。背景:現有 `ChartIntentPlanner` 只比對固定樣本值(`18%`/`25%`/`12 小時`/`2026-08-15`/`0.5 FTE`),對其他內容一律產 0 個 intent,使真實內容即使有可成圖數列也只會被渲染成項目/文字。008 MUST 以泛用規劃器取代此 placeholder。決策鏈為:**① chart-intent 規劃(本決策,決定可圖性)→ ② treatment 映射(決策 B)→ ③ series 抽取/驗證 → ④ 真圖 / fallback 渲染**。原文數字抽取的通用單位擴充(如任意「數字 + 短單位 token」)留待後續 extractor 強化。

---

## 背景與目標

007 把設計風格資料化。簡報的**圖表**目前「規劃了、沒畫」:

- **資料型別已有**:`ChartIntent`(`id`/`title`/`sourceFacts`/`recommendedVisuals`/`rationale`)+ `VisualizationType`(`metric_card`/`comparison`/`timeline`/`milestone`/`callout`/`table`/`none`);design 層 `ChartTreatmentPlan` + `ChartTreatment`(`chart`/`metric_card`/`table`/`timeline`/`fallback_text`/`review_note`);slide 帶 `chartIntentIds`。
- **規劃決策層實為 placeholder(必修)**:現有 `ChartIntentPlanner` 寫死範例資料的固定值(`18%`/`25%`/`12 小時`/`2026-08-15`/`0.5 FTE`),把 facts 過濾成只剩這些值、再丟掉空 intent;對**任何其他內容一律產 0 個 intent**。也就是「判斷哪些 facts 該成圖」這層**從未泛用**,真實使用者內容即使有可成圖的數列(同單位多分類、時間序列、百分比加總)也只會被渲染成項目/文字。**這是 008 真圖對真實內容形同未啟用的根因**,本 feature MUST 修正(見決策 C / US6 / FR-015~018)。
- **渲染層沒有**:`template-html-renderer` 不會把 chart intent 畫成視覺,`chartIntentIds` 最後只成一般項目/文字。
- **資料現況**:`SourceFact.value` 是**字串**(例 `"$2.3M"`、`"45%"`、`"Q3 2026"`),`SourceFactKind` 會標 `"metric"`/`"date"`;**沒有結構化數列**。

008 範圍:把 chart intent 在 deck 裡畫成**真正可視化**。本 feature 不只做 metric card / 表格,也要把可可靠解析的多筆 facts 組成最小 `ChartSeries`,渲染成 **圓餅/環圈圖、折線/線圖、長條比較圖**。若資料不足以形成某種真圖(例如少於 2 個點、單位不一致、時間排序不明、pie 總和不可用),系統才安全退回表格或文字並記 review note。

**技術定調(已確認)**:**engine-owned inline SVG / HTML**,**不引入前端圖表套件**(Chart.js 需 canvas+JS/CDN 破壞自包含;Recharts 是 React、deck 非 React;canvas 類在 PDF/無 JS 匯出會消失)。inline SVG/HTML 靜態、PDF 也在、零第三方依賴、可逐值 sanitize,沿用既有渲染器調性與 sanitize 防線(`safeNumber`/`safeHex`/`safeCssValue`/HTML escape)。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 可解析數列渲染成真圖(Priority: P1)

把 `comparison` / `timeline` / `chart` 類意圖渲染成真正的 inline SVG 圖表:多分類占比用 pie/donut chart、時間序列用 line chart(折線圖/線圖)、同單位比較用 bar chart。圖表資料必須來自 chart intent 指向的 source facts,不得補值或外推。

**Why this priority**:使用者明確希望 008 階段就看到真圖,而不是只看到 metric card / 表格;這是本 feature 的核心可展示價值。

**Independent Test**:給帶 4 筆同單位 category facts 的 `comparison` intent,渲染輸出含 inline SVG bar/pie chart;給帶 4 筆可排序期間 facts 的 `timeline` intent,渲染輸出含 line chart;所有 labels/values 可追溯到 source facts。

**Independent Demo**:`preview` 一份含「收入占比 pie/donut」、「月營收 line chart」、「區域營收 bar chart」的範例 deck,看到真正圖表而非項目符號。

**Acceptance Scenarios**:

1. **Given** `comparison` intent 帶 4 筆同單位 metric facts,**When** 渲染,**Then** slide 出現 inline SVG 長條圖或圓餅/環圈圖,每個 label/value 來自 source fact 並保留溯源。
2. **Given** `timeline` intent 帶 4 筆可排序期間與同單位 metric values,**When** 渲染,**Then** slide 出現折線/線圖,軸標籤保留原始期間文字,數值保留原單位與精度。
3. **Given** pie/donut intent 的資料總和不可用或含負值,**When** 渲染,**Then** 不畫錯誤圓餅,退回表格並記 review note。
4. **Given** series fact 含惡意 HTML/SVG/CSS 片段,**When** 渲染,**Then** 圖表仍只輸出 sanitized inline SVG/HTML,不得逸出 `<svg>`/`<style>`。

---

### User Story 2 - Metric card / 單值視覺(Priority: P2)

把 `metric_card` / `callout` / `milestone` 類意圖渲染成**有設計感的數據區塊**(大數字 + 標籤 + 脈絡),數字取自 `kind="metric"` 的 source fact。**用現有資料就能做**,涵蓋簡報最常見的「重點數字」——單獨完成即可用 MVP。

**Why this priority**:單值數字仍是簡報高頻視覺,且可作為 series 不足時的清楚降級形式。

**Independent Test**:給帶 `metric_card` intent + metric fact 的 deck,渲染輸出含 metric 區塊(大數字、標籤、來源溯源),套主題 token;數字無法解析時退回純文字且不報錯、記 review note。

**Independent Demo**:`preview` 一份含「營收 $2.3M(↑18% YoY)」的範例 deck,看到 metric card 而非項目符號。

**Acceptance Scenarios**:

1. **Given** `metric_card` intent 指向 metric fact `"$2.3M"`,**When** 渲染,**Then** slide 出現大數字 `$2.3M` + 標籤 + 來源溯源,套主題色。
2. **Given** metric fact 的 `value` 不含可解析數字(例 `"顯著成長"`),**When** 渲染,**Then** 退回原文文字,不產生空白/壞圖,review note 記「資料不足以成圖」。
3. **Given** 同一 metric 在多 slide 重複,**When** 渲染,**Then** 樣式一致(共用引擎,不逐張漂移)。

---

### User Story 3 - 表格處理(Priority: P3)

把 `table` 意圖把相關 facts 渲染成**乾淨的 HTML 表格**(套主題 token)。不需要數列,純用現有 facts,低風險高價值。

**Why this priority**:表格是資料不足以成真圖時的主要 fallback,也補上「多筆結構化文字」的呈現。

**Independent Test**:給 `table` intent + 多筆 facts,渲染輸出含 `<table>`(表頭/列),文字經 escape,套主題;facts 過多時截斷並記 note。

**Acceptance Scenarios**:

1. **Given** `table` intent 帶多筆 facts,**When** 渲染,**Then** 出現主題化表格、文字 escape、保留來源溯源。
2. **Given** 列數超過版面上限,**When** 渲染,**Then** 截斷顯示前 N 並記「省略 M 列」review note。

---

### User Story 4 - Metric 群組 + 列舉整併(Priority: P4)

把 `comparison` 意圖在資料不足以形成 bar/pie 時渲染成**多個 metric 並列(metric 群組 / stat grid)**。並落實 **`VisualizationType → ChartTreatment` 單向映射**(決策 B),作為單一渲染決策來源;不支援或不適合的型別**安全退回** `table` 或 `fallback_text`。

**Why this priority**:完善度與一致性;相依 US1。

**Independent Test**:`comparison` intent 多個 metric facts → 優先嘗試 bar/pie,不符合真圖條件時並列 metric 群組;映射表把每個 `VisualizationType` 對到一個 `ChartTreatment`,測試覆蓋每條對應。

**Acceptance Scenarios**:

1. **Given** `comparison` intent 帶 3 個 metric facts 但單位混合,**When** 渲染,**Then** 出現 3 個並列 metric(共用樣式)或表格,不畫誤導性的同軸圖。
2. **Given** intent 的 `VisualizationType` 對映到 chart treatment,**When** 資料符合 series 條件,**Then** 優先輸出真圖;資料不符合時依映射退回 `table`/`fallback_text` 並記 review note。

---

### User Story 5 - 每種 chart 在每個風格內可 script 預覽(Priority: P2)

維護者需要一個可重複執行的 preview script/test,把 008 支援的每種 chart 視覺放進 007 的每個已啟用 style 內預覽,避免某個風格下圖表顏色、標籤、軸線、legend 或版面壞掉卻沒有被發現。palette/font 軸的全組合覆蓋留待 009。

**Why this priority**:chart 可用不只取決於渲染函式,也取決於每個 design style 的 palette、density、typography、background。008 必須在「所有風格都看得到」才算完成。

**Independent Test**:執行 preview matrix script/test 後,產生或檢查 `每個已啟用 style × 每個支援 chart visual` 的預覽組合；缺少任何組合、輸出空白、含外部資源、或 chart 溢出版面時測試失敗。

**Independent Demo**:維護者可用一個 script 預覽全部 chart/style matrix,逐一肉眼檢查 pie/donut、line、bar、metric card、table、metric group、fallback 在每個風格中的呈現。

**Acceptance Scenarios**:

1. **Given** 007 已啟用 N 個 deck styles,且 008 支援 M 種 chart visuals,**When** 執行 preview matrix script/test,**Then** 產生或驗證 N × M 個可預覽案例。
2. **Given** 新增一個 style 或 chart visual,**When** 未補對應 preview fixture/case,**Then** script/test 失敗並指出缺少的 style × chart 組合。
3. **Given** 任一 style 下 chart label、legend、軸線或圖形溢出版面,**When** 執行 preview matrix smoke,**Then** 該組合被標記為需要修正,不得被視為通過。

---

### User Story 6 - 從已解析 facts 判斷可圖性(chart-intent 規劃)(Priority: P1)

系統 MUST 從 deck 已解析、且含可解析數值/期間的 `SourceFact` 自動判斷哪些資料可以成圖,並分組產生帶 `recommendedVisuals` 的 `ChartIntent`——而非比對寫死的樣本值。這是 US1 在真實內容上生效的**前提**:沒有這層,真圖渲染永遠不會被觸發(整個 008 對真實內容形同未啟用)。

**Why this priority**:US1–US4 的渲染全相依於「先有 chart intent」。規劃決策層若不泛用,渲染引擎再好也畫不到真實資料。屬基礎優先級,與 US1 同列 P1。

**Independent Test**:給一份已抽成 `SourceFact`、且含「4 區域同單位 `$M`」「Q1–Q4 同單位時間序列」「3 裝置百分比加總≈100」的內容,規劃器產出對應的 comparison(類別比較)/ timeline / comparison(部分對全體)intent,且各 intent 的 sourceFacts 只含真實對應 facts;另給一份不含可成圖數列的內容,產出 0 個 intent(不強迫成圖)。**測試資料 MUST 為非範例資料集**,以證明規劃器不依賴寫死樣本值。端到端原文抽取支援的單位集合仍以 `extractSourceFacts` 為準。

**Independent Demo**:`preview` 一份全新內容(非內建範例)的 deck,看到區域營收成 bar、季度趨勢成 line、裝置占比成 pie,而非全部項目符號。

**Acceptance Scenarios**:

1. **Given** 同一語意群有 2+ 筆同單位 metric facts,**When** 規劃,**Then** 產生 `comparison` intent(或含可排序期間時 `timeline`),sourceFacts 指向那些真實 facts。
2. **Given** 一組 facts 皆為百分比且可加總成部分對全體,**When** 規劃,**Then** `recommendedVisuals` 含部分對全體語意(經決策 B 對映到 pie/donut)。
3. **Given** facts 含可排序期間(年/季/月)且同單位,**When** 規劃,**Then** 產生 `timeline` intent(經映射對映到 line)。
4. **Given** 內容沒有可靠成圖的數列(無同單位多點、無百分比群、無時間序列),**When** 規劃,**Then** 產生 0 個 chart intent,內容維持文字呈現,不捏造分組。
5. **Given** 任意非範例資料集,**When** 規劃,**Then** 規劃器照樣依資料特徵判斷可圖性,**不得**因 value 不在某固定清單就略過。
6. **Given** 規劃判定「可成圖」,**When** 進入 series 抽取/渲染,**Then** 兩者用同一套數值/單位/時間判斷,規劃可圖性與渲染可畫性一致(不得規劃說可圖、渲染卻退回)。

---

### Edge Cases

- chart intent 指向的 fact 已被壓縮/省略 → 退回 fallback,review report 揭露。
- metric fact 值含貨幣/百分比/千分位/混合單位 → 解析保留原單位與精度(CR-001);無法解析 → 退回文字。
- 0 筆 fact → `fallback_text`;1 筆 → 單一 metric card。
- 表格/群組過量 → 截斷 + 省略提示,不溢出版面。
- 真圖 series 少於最低點數:bar/pie 少於 2 類、line 少於 2 點 → 退回 metric card / table 並記 note。
- 同一 series 單位混合或無法判定比較基準 → 不畫同軸 chart,退回 metric 群組/table。
- pie/donut 含負值、全 0、總和不可解析 → 退回 table。
- line chart 時間/順序無法可靠排序 → 退回 bar/table,不自行推測日期。
- 新增 chart visual 或 style 時,preview matrix 未更新 → 測試失敗,避免未覆蓋組合靜默進入 release。
- **內容含可成圖數列,但規劃器未產 intent** → 視為缺陷(回歸):規劃器 MUST 泛用、不得綁樣本值,否則真實內容靜默退回項目符號。
- **規劃判定與渲染可畫性分歧**(規劃說可成圖、渲染卻退回,或反之)→ 兩層 MUST 共用同一套 parse/unit/time 判斷以對齊。
- **規劃器把不相干的 facts 硬湊成一組** → 不允許;分組 MUST 有明確基準(同單位、同百分比群、可排序期間),否則不產 intent。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**:渲染時,系統 MUST 把 slide `chartIntentIds` 對應的 chart intent **依映射後的 treatment 渲染成 inline SVG/HTML 視覺**(pie/donut chart、line chart、bar chart、metric card、表格、metric 群組),而非一律降為項目符號。
- **FR-002**:系統 MUST 用 **engine-owned inline SVG/HTML**(不引入前端圖表套件),輸出自包含、靜態(無需 client JS 即可顯示)、可匯出 PDF。
- **FR-003**:系統 MUST 對所有內插值逐值 sanitize——數值 `safeNumber`、顏色 `safeHex`、文字 HTML escape / `safeCssValue`;任何 LLM/DB 來源字串不得逸出 SVG/`<style>`。
- **FR-004**:資料不足以成指定真圖時,系統 MUST **退回**(`metric_card`/`metric_group`/`table`/`fallback_text`),不得空白/壞圖,並於 review report 揭露。
- **FR-005**:視覺配色 MUST 取自當前主題(`accentHues`/design token),與風格一致。
- **FR-006**:系統 MUST 定義並實作 **`VisualizationType → ChartTreatment` 單向映射**(單一真實來源),作為渲染決策依據。
- **FR-007**:系統 MUST 保留視覺到來源 fact 的**溯源**,供 review 檢視。
- **FR-008**:系統 MUST 引入最小 `ChartSeries` 抽取/驗證管線,從 chart intent 指向的 `SourceFact` 可靠抽出 `{ label, value, unit?, sourceFactId }[]`;不得由引擎捏造、補點或外推。
- **FR-009**:視覺 MUST 在 16:9 與較窄寬度下不溢出(基本 responsive),不影響鍵盤導航。
- **FR-010**:系統 MUST 支援 pie/donut chart:僅在 2+ 個非負、可加總、同基準 numeric values 時渲染;保留 label、value、比例顯示與來源溯源。
- **FR-011**:系統 MUST 支援 line chart(折線圖/線圖):僅在 2+ 個可排序 x labels/time labels 與同單位 numeric values 時渲染;不得推測缺漏點。
- **FR-012**:系統 MUST 支援 bar chart:僅在 2+ 個同單位 numeric values 時渲染;軸/標籤/數值必須可讀且不溢出。
- **FR-013**:系統 MUST 提供可重複執行的 preview matrix script/test,覆蓋 **每個已啟用 style × 每個支援 chart visual**(pie/donut、line、bar、metric card、table、metric group、fallback),並能產生可肉眼預覽的 HTML/截圖或等價預覽 artifact。palette/font 軸完整矩陣留待 009。
- **FR-014**:preview matrix script/test MUST 在缺少任一 style × chart 組合、輸出空白、出現外部資源、或基本版面溢出時失敗,並指出問題組合。
- **FR-015**:系統 MUST 提供**確定性 chart-intent 規劃器**,從 deck 已解析的 `SourceFact` 對可解析數值/期間判斷可圖性、分組,並產出帶 `recommendedVisuals` 的 `ChartIntent`;**嚴禁寫死特定樣本值或資料集**(取代現有只認固定值的 placeholder)。
- **FR-016**:規劃器分組規則 MUST 至少涵蓋:① 同單位多分類 → 類別比較(`comparison`);② 同單位 + 可排序期間(年/季/月)→ 時間序列(`timeline`);③ 一組皆百分比且可加總成部分對全體 → 部分對全體(`comparison`,經映射 → pie/donut);④ 單一可解析數值 → 單值(`metric_card`);⑤ 無法可靠分組/解析 → **不產 intent**(不強迫成圖、不捏造分組)。
- **FR-017**:規劃器 MUST 與 series 抽取/驗證(FR-008)**共用同一套數值/單位/時間判斷**,使「規劃判定可成圖」與「渲染實際可畫」對齊,避免規劃說可圖、渲染卻退回。
- **FR-018**:規劃器 MUST 維持來源保真(只用真實 facts、保留 `sourceFactId`、不捏造/補點/外推)、為**確定性**(無 LLM,沿用 CR-004 邊界),且輸出在相同輸入下可重現。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**:metric/表格/真圖 MUST 忠實呈現來源數字/日期/單位,保留原精度,不捏造、補值或外推。
- **CR-002 Review Report**:「資料不足以成圖而退回」「series 抽取失敗原因」「表格/群組省略了哪些」「不確定的數值解析」MUST 為可見 review note。
- **CR-003 Web-First Output**:維持自包含 HTML;視覺為 inline SVG/HTML,無外部資源。
- **CR-004 Backend-Configured LLM Boundary**:N/A——008 為**純引擎**,chart-intent 規劃器與渲染器**皆為確定性、不呼叫 LLM**(只用已解析的 fact 資料判斷與渲染)。若日後要讓 LLM 直接產 structured series,另開 feature。
- **CR-005 Design System**:視覺 MUST 套 deck 級設計約束(palette/accentHues、字級、間距、密度)。
- **CR-006 Semantic Titles**:真圖/metric/表格標題沿用 intent `title`,扣回來源語意,不誇大。
- **CR-007 Data Visualization**:本 feature 即 CR-007 落實——明定:可解析多點數列 → pie/donut、line、bar 真圖;可解析單值 → metric card;多筆結構文字 → 表格/metric 群組;資料不足 → 退回文字/表格。
- **CR-008 TDD Coverage**:每個 user story 以 vitest/preview smoke 覆蓋——渲染輸出含預期 SVG/HTML 結構與數值、sanitize 守衛、series validation、fallback、映射對應、chart × style matrix。
- **CR-009 Domain Model**:主要概念——`ChartIntent`、**chart-intent 規劃純函式(從已解析 facts 判可圖性/分組)**、`VisualizationType`/`ChartTreatment`(映射)、`ChartSeries`、metric/series 解析純函式、chart 渲染純函式(domain,純淨無 SQL、無第三方圖表庫)。
- **CR-010 Lean Test Scope**:測試聚焦可觀察行為(輸出含某元素/數值/退回),不逐像素比對。
- **CR-011 Behavior-Driven Value**:見各 US 的 Given/When/Then;US1 可獨立 demo/測試。
- **CR-012 Code Simplicity**:範圍限 pie/donut、line、bar、metric card、表格、metric 群組;複雜型別(Sankey/network/geo/3D/candlestick)**明確不做**。
- **CR-013 Consistent Language**:`pie/donut chart`/`line chart`/`bar chart`/`metric card`/`table`/`fallback`/treatment 名稱於 UI/review/程式/文件一致;映射為單一真實來源。
- **CR-014 Performance and Evidence**:inline SVG/HTML 靜態、零執行成本;證據為渲染輸出快照 + chart × style preview matrix 截圖/artifacts;截斷策略須記錄。
- **CR-015 Manual Verification**:視覺好不好看需肉眼驗收;沿用 `preview` harness 範例 deck 截圖,且每個支援 chart visual 在每個已啟用風格內都可由 script 預覽。
- **CR-016 Verification**:acceptance 含 slide JSON 結構有效、HTML 渲染、鍵盤導航、基本 responsive(視覺不溢出)。

### Key Entities *(include if feature involves data)*

- **ChartIntent**(型別已存在):規劃器輸出 / 渲染輸入。
- **Chart-intent 規劃純函式**(新增,domain content-core):**取代寫死 stub**。輸入已解析的 `SourceFact[]`,依可解析資料特徵(同單位多分類 / 可排序期間 / 百分比加總 / 單值)判斷可圖性與分組,輸出 `ChartIntent[]`(含 `recommendedVisuals` 與 `sourceFactId` 溯源);無可成圖數列時回空陣列。與 series 抽取共用解析判斷。
- **VisualizationType → ChartTreatment 映射**(新增):單向映射表,渲染決策的單一真實來源。
- **Metric 解析純函式**(新增,domain):從 `SourceFact.value` 字串解析出 `{ display, numericValue?, unit? }`;無法解析回 null → 觸發 fallback。
- **ChartSeries 抽取/驗證純函式**(新增,domain):從 chart intent + source facts 產生 `{ kind, points, unit?, sourceFactIds, warnings }`,並驗證 pie/bar/line 的最低資料條件。
- **視覺渲染純函式**(新增,domain `rendering/`):`renderPieChart` / `renderLineChart` / `renderBarChart` / `renderMetricCard` / `renderMetricGroup` / `renderFactTable` → 回傳 sanitize 過的 inline SVG/HTML 片段。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**:帶 pie/donut、line、bar chart intent 且 facts 符合最低 series 條件的 deck,渲染 100% 出現對應真圖(非降級為項目)。
- **SC-002**:所有視覺輸出自包含(無外部 `<script>`/`<link>`/`url()`),停用 JS 仍正確顯示(靜態)。
- **SC-003**:資料不足 / 不符合 series 條件的 intent 100% 安全退回,無空白/壞圖,review report 揭露。
- **SC-004**:`VisualizationType → ChartTreatment` 映射有單一真實來源,測試覆蓋每條對應。
- **SC-005**:全部數值/文字經 sanitize,惡意輸入無法逸出 SVG(對應測試綠)。
- **SC-006**:帶 `metric_card` intent + 可解析 metric fact 的 deck,渲染 100% 出現 metric 區塊(非降級為項目)。
- **SC-007**:preview matrix script/test 覆蓋 100% 已啟用 style × 支援 chart visual 組合,且每個組合都有可預覽 artifact。
- **SC-008**:對**非範例**且已抽成可解析 `SourceFact` 的可成圖數列,chart-intent 規劃器產出對應 intent(同單位多分類→比較、時間序列→趨勢、百分比加總→部分對全體、單值→metric);不含可成圖數列時產 0 個 intent。以一組全新資料的測試證明規劃器不依賴寫死樣本值。
- **SC-009**:規劃判定可成圖的 intent,進入渲染後實際畫出對應真圖(規劃可圖性與渲染可畫性一致),不因兩層判斷分歧而退回。

## Assumptions

- 沿用 007 渲染架構與 `preview:themes` 風格 harness 做肉眼驗收。
- domain 維持純淨(渲染為純函式,無 SQL、無第三方圖表庫);輸出為 inline SVG/HTML 字串。
- MVP 視覺包含 pie/donut、line、bar、metric card、表格、metric 群組;複雜型別退回。
- style 清單以 007 的已啟用 registry 為準;008 不另行定義風格集合。palette/font 全組合覆蓋留待 009。
- 008 不新增 LLM 產生數列流程。chart intent 由**確定性規劃器從 deck 已解析的 `SourceFact` 推導**(決策 C / US6),series 再從 intent 指向的 facts 可靠抽取;兩者皆不捏造、不外推。若後續要讓 LLM 在 planning 階段直接產 structured series,另開 feature。
- **相依**:規劃器以 deck 的 `SourceFact`(value 字串如 `$1.1M`/`52%`/`Q1 2026`,加 `sourceText` 提供分類/期間語意)為輸入。若來源解析未把可成圖數字抽成 `SourceFact`,規劃器就無料可分組。008 覆蓋既有 extractor 支援的 `%`、貨幣、時間/期間與常見既有單位;更泛用的「數字 + 短單位 token」抽取留待後續強化。
- 主題配色(accentHues)由 007 提供,直接取用。
- 視覺為**靜態**(預設不加入場動畫,保持簡單;若加則受既有 reduced-motion 守衛)。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**:對來源數值做單位正規化/四捨五入/截斷、series 排序、chart type fallback,須在 review note 揭露。
- **Omitted or Compressed Content Policy**:表格/群組截斷時記「顯示前 N、省略 M」,不靜默丟資料。
- **Uncertain Claims Policy**:無法可靠解析為數值的 fact 不強行成圖,標記不確定並退回文字。
- **Sensitive Content Handling**:008 純引擎、不送 LLM;不外洩任何內容。
- **Evidence and Traceability**:每個視覺保留到來源 fact 溯源;渲染輸出快照 + chart × style preview matrix artifacts 為審查證據。
- **Manual Verification Path**:`preview` 範例 deck 與 matrix script 涵蓋 pie/donut / line / bar / metric card / 表格 / metric 群組 / 退回在每個已啟用風格內的呈現,肉眼確認。

---

## 明確延後(本 feature 不做,留待後續)

- **LLM 直接產 structured series**:008 的 series 只從既有 facts 可靠抽取;若要讓 LLM 在 planning 階段輸出完整 `{label,value}[]`,另開後續 feature。
- **進階圖表**:area chart、stacked chart、多軸圖、scatter plot、heatmap、真 timeline swimlane 等,留待 pie/line/bar 基礎穩定後再做。
- **複雜型別**:Sankey / network graph / 地理 / 3D / candlestick 等——超出簡報核心,長期可能也只做 fallback。
- 本 feature 為這些奠定基礎:渲染骨架(intent→treatment→series→真圖/fallback)、映射、sanitize 防線、溯源。
