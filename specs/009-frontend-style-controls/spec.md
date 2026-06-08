# Feature Specification: Frontend Style Controls（把 007 主題 / 008 圖表能力暴露成可預覽的引導式控制台）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `009-frontend-style-controls`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "因應目前加入的樣式（007 design theme system、008 chart rendering）修改前端的設計：把這些已加進 deck 輸出的樣式能力，暴露到 apps/web 控制台。主題互動採『升級引導式提示（不 override，selectTheme 維持確定性）』；圖表只改進現有 preset + 把生成後的真圖預覽呈現好。"

---

## 背景與目標

007 把設計風格資料化（DB `themes` 目錄：~14 個 A 級 full token、B/C 級 partial/raw，分 `font` / `palette` / `style` 三 kind；`selectTheme` 依 brief 關鍵字**確定性**選出三軸組合，`composeKit` 合併成 `DesignStyleKit`）。008 把圖表意圖畫成**真正的 inline SVG/HTML 圖表**（pie/donut、line、bar，資料不足時退回表格/文字並記 review note）。

問題是：**這兩個 feature 的能力幾乎沒有暴露給使用者**。盤點現況（`apps/web`）：

- 表單只有 **6 個寫死的「風格 preset」**（前端翻譯鍵 → 關鍵字片語，如 `professional business corporate 商務`）餵進 `styleDirection` 自由文字，再進後端 `selectTheme` 評分。這 6 個 preset 與 007 灌進 DB 的具名主題目錄**脫鉤**，使用者**看不到、無法預覽、無從理解**自己在選什麼。
- 圖表只有 **4 個籠統 preset**（`none` / `comparison` / `trend` / `metric`）餵進 `chartEmphasis` 自由文字；使用者不知道這對應到 008 的哪種真圖。
- 生成**之後**只有 `DesignPlanningPanel` **唯讀**顯示 `themeName` / `visualDensity` / `chartStyle` / 第一個 pattern 四個純文字欄位——看不到實際配色、字體、結構特徵，也看不出 008 是否真的畫出了圖表、還是退回了文字。

009 的範圍：**讓使用者在生成前能「看懂並有信心地引導」設計方向，在生成後能「清楚看見 007/008 的能力確實生效並可審閱」**——但**不改動後端的設計決策邏輯**。

**已鎖定的範圍決策（2026-06-08，見 Clarifications）**：

1. **主題互動 = 升級引導式提示，不做硬 override。** `selectTheme` 維持確定性（依 brief 關鍵字）。前端把 6 個籠統 preset 升級為**可預覽的風格選擇**（顯示代表性配色色票 / 字體樣本 / 風格特徵 / 密度提示），使用者選擇仍**只發出關鍵字方向**到既有 `styleDirection` 欄位，**不新增硬指定 `themeId` 的 override 路徑**。後端改動最小化。
2. **圖表 = 只改進現有 preset + 把生成後的真圖預覽呈現好。** 不新增「圖表類型偏好」這個控制維度。保留 4 個 chart preset，但讓它們**可預覽、語意更清楚**（comparison→長條/圓餅、trend→折線、metric→指標卡）；重點放在「生成後 preview 能清楚呈現 008 畫出的真圖，並誠實標示 fallback」。

**設計原則（沿用專案憲章）**：009 是**控制台呈現層**功能，**不改變生成決策**（不碰 `selectTheme` / `composeKit` / chart-intent 規劃 / 渲染引擎的**決策邏輯**）。**request contract 不變**（不新增 `themeId` 或圖表類型偏好）；但**允許在 response 補強 readonly 結果證據** metadata（補強 `selectedTheme` token、新增 `renderedCharts`），因其僅為「已發生結果」的暴露、不影響任何決策。前端呈現必須**忠實**——生成前預覽是「代表性引導」非「保證」，生成後摘要**不得謊報**（圖表退回文字時不能宣稱畫了圖）。註：007 的 `selectTheme` 對 `support='raw'` 的 C 級資料**不會選取**，故 applied summary 只會呈現實際 `composeKit` 後的 styleKit；當某軸無命中而退回 default 時，以 `fallback` 旗標與三軸 id（null 表退回）**據實**反映，不捏造缺失特徵。

---

## Clarifications

### Session 2026-06-08

- Q: 009 核心目標？ → **A: 暴露新樣式能力到控制台**——在 `apps/web` 加 UI 讓使用者理解、引導 007 主題 / 008 圖表能力，並在生成後清楚呈現結果。非「重設計前端視覺」、非「改 deck 渲染輸出」。
- Q: 使用者與「主題」的互動模式做到哪一層（影響 `selectTheme` 是否被 override、是否加 `GET /themes`）？ → **A: 升級「引導式提示」（不 override）。** 保留 `selectTheme` 確定性；6 個 preset 升級成可預覽風格選擇，仍走關鍵字。不加硬指定 `themeId` 的 override，後端改動最小。
- Q: 008 圖表能力是否讓使用者控制？ → **A: 只改進現有 preset + 預覽結果。** 不加圖表類型偏好控制維度；保留 4 個 chart preset 但讓其可預覽/語意更清楚，重點是生成後真圖呈現與誠實 fallback 標示。
- Q: US2「生成後透明度」（主題 token + 已渲染圖表類型）的 source of truth 怎麼拿？ → **A: 補強回應型別（readonly，不動 request contract、不改決策邏輯）。** 因為這是「已發生的結果證據」，不影響任何決策。具體：(1) request contract 不變，不新增 `themeId` 或圖表類型偏好；(2) response 的 `generationSummary.selectedTheme` 由現況「三軸 id + fallback」**補強**（**精確形狀見下方第二輪 clarify**）；(3) 新增 **`renderedCharts`** 結果 metadata，由 renderer/domain 在渲染時產生（**精確形狀見下方第二輪 clarify**）；(4) **前端只讀這些 metadata 呈現，嚴禁 parse HTML 或 CSS 變數**；(5) 009 仍**明確不改** `selectTheme` / chart 決策，只把已算好的結果結構化暴露。涉及 `packages/contracts` + `packages/domain`（renderer/summary）+ `apps/api`（回應組裝）+ `apps/web`（型別與呈現），但全屬唯讀結果證據。
- Q: 生成前風格預覽的資料來源（US1）？ → **A: 用前端 curated 預覽 metadata**（與既有 6 個 preset 綁定），零新後端端點、改動最小，符合「不 override / 後端動最少」。從 007 DB 主題目錄全量瀏覽、讀真資料**延後至後續 feature**。
- Q: preset 數量與涵蓋面？ → **A: 維持精簡 curated 集合（風格 6、圖表 4）**，不在 009 擴充為全量 007 主題目錄（呼應 CR-012 精簡原則）。全量主題瀏覽延後。

### Session 2026-06-08（/clarify 第二輪：契約形狀）

- Q: `renderedCharts` 每筆如何攜帶 review note？ → **A: 結構化 `{ code, message }`。** 沿用 008 既有 note `code`（`fallback_used` / `table_truncated` / `series_extracted` …）+ `message`，前端可依 `code` 做圖示/i18n/fallback 認明，最健壯。
- Q: `selectedTheme.structureFeatures` 表示法？ → **A: 結構化旗標/值（非 `string[]`）。** 此欄入 response contract 且影響前端呈現與 reduced-motion 判斷，須穩定資料形狀。鎖定**補強後 `selectedTheme` 完整形狀**：
  ```ts
  selectedTheme: {
    kitName: string;
    ids: { style: string | null; palette: string | null; font: string | null };
    fallback: boolean;
    accentHues: Array<{ name: string; base: string }>;
    fonts: { heading: string; body: string };
    visualDensity?: string;
    structureFeatures: {
      radiusPx?: number;
      shadow?: boolean;
      backdropBlurPx?: number;
      glow?: boolean;
      texture?: "grain" | "noise" | "paper";
      animation?: { preset: "aurora" | "mesh"; durationMs: number };
    };
  }
  ```
  前端以 `animation` 是否存在決定是否顯示動效預覽，並在 `prefers-reduced-motion` 下改靜態標示；其餘特徵逐項以 chip / token row 呈現。
- Q: `renderedCharts` 放在 response 何處？ → **A: 與 `selectedTheme` 同住 `generationSummary`**（單一結果證據之家，沿用 007 將 `selectedTheme` 置於 `GenerationSummary` 的既有做法）。
- Q: 生成前「可預覽風格選擇」的互動形態？ → **A: radio card gallery（卡片畫廊）。** 每張卡至少含：風格名稱、2–4 個色票、heading/body 字體樣本、2–3 個特徵 chip、密度標示；卡片為單選 radio、支援鍵盤與可見 focus；選擇後仍只寫入既有 `styleDirection` 關鍵字（不新增 `themeId`）。窄視窗改單欄或水平可掃描 grid，**不得退化成純文字清單**。
- Q: 新 UI 的視覺設計依據？ → **A: 以 `ui-ux-pro-max` skill 設計**（見 FR-014）。card gallery、透明度面板、chart preset 預覽的排版/配色/字體配對/間距/元件樣式/互動動效皆由該 skill 引導，落在既有 React 19 + Tailwind v4 與設計語言上；最終以本 spec 的功能與無障礙（FR-011/CR-016）為驗收。

### Session 2026-06-08（第三輪：契約精修，對齊既有 domain 型別）

- Q: `renderedCharts.visualKind` 的型別？ → **A: 直接 reuse 008 `ChartVisualKind` enum**（`pie_donut|line|bar|metric_card|metric_group|table|fallback_text`，定義於 `packages/domain/src/rendering/chart-rendering.types.ts`），contract **不得**寫成顯示文案；UI label 另行 i18n（見 FR-006）。spec/prose 中「pie/donut、line、bar」僅為人類可讀示例，非 enum 值。
- Q: `selectedTheme` 由 flat 改 nested 的相容性？ → **A: 取代舊 flat shape，不留 alias。** 現況 `{ style, palette, font, fallback }` 改為 nested（三軸 id 移入 `ids`），MUST 同步更新 `packages/contracts` + `packages/domain` + `apps/api` + `apps/web` + 既有測試。因屬 readonly 結果證據、無外部公開消費者，單形狀遷移、避免雙形狀分歧（見 FR-005 相容性）。
- Q: 動效預覽 reduced-motion 的 gate 在生成前後是否相同？ → **A: 兩階段不同來源。** 生成前 card gallery 以 `StylePreset.preview.structureFeatures.animation`（curated metadata）gate；生成後面板以 `selectedTheme.structureFeatures.animation` gate；兩者在 `prefers-reduced-motion` 下皆降級靜態（見 FR-011）。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 可預覽的引導式風格選擇 (Priority: P1)

使用者在生成前，看到一個**可預覽的風格選擇**（取代現有 6 個純文字 preset 的籠統清單）。每個風格選項以視覺呈現其代表性特徵：配色色票、字體樣本、風格標籤（如「專業商務 / 簡約俐落 / 科技新創」）與視覺密度提示。使用者點選後，系統仍**僅發出對應的關鍵字方向**到既有 `styleDirection` 欄位（合約不變），最終主題由後端 `selectTheme` 確定性選定。使用者因此「看得懂自己在引導什麼」，而非盲選一個翻譯標籤。

**Why this priority**: 這是 009 對使用者最直接的價值，也修掉現況最大的認知缺口（風格選擇是黑盒）。只實作這一條，就能讓「使用者有信心地引導設計方向」成為可交付的 MVP，且不需動到任何後端決策邏輯。

**Independent Test**: 渲染風格選擇 UI，驗證每個選項顯示其預覽（色票/字體/特徵/密度）；點選某風格後送出表單，驗證請求帶有該 preset 對應的 `styleDirection` 關鍵字片語（與現行合約一致）；驗證未選時行為與現況相同（自由文字 / 空）。

**Independent Demo**: 不依賴 US2/US3——直接展示「切換不同風格選項 → 預覽即時變化 → 送出後 brief 帶對應關鍵字」，並示範切換 UI 語言（zh-TW/en/ja）時標籤翻譯但所選關鍵字方向不變（沿用現行 preset 與語言解耦的設計）。

**Acceptance Scenarios**:

1. **Given** 使用者在生成表單，**When** 檢視風格選擇區，**Then** 每個風格選項都顯示代表性配色色票、字體樣本與風格/密度標籤，而非單一純文字標籤。
2. **Given** 使用者點選「科技新創」風格，**When** 送出表單，**Then** 請求的 `styleDirection` 帶該 preset 既定的關鍵字片語，且不含任何 `themeId` 硬指定欄位。
3. **Given** 使用者切換介面語言，**When** 重新檢視風格選擇，**Then** 標籤依語言翻譯，但同一風格對應的後端關鍵字方向不變。
4. **Given** 使用者未選任何風格，**When** 送出，**Then** 行為與現況一致（`styleDirection` 為使用者自由文字或空），後端 `selectTheme` 照常依 brief 選主題。

---

### User Story 2 - 生成後的設計與圖表透明度 (Priority: P2)

生成完成後，使用者在結果面板**清楚看見** 007/008 實際生效的內容：套用的具名主題（名稱 + 代表性配色色票 + 字體 + 視覺密度 + 結構特徵），以及這份簡報實際**畫出了哪些圖表類型**（pie/donut、line、bar）。當某圖表因資料不足而**退回表格/文字**時，面板**據實標示**為 fallback（連同 review note），不得呈現為「已畫圖」。使用者因此能審閱「設計與圖表決策是否合理」。

**Why this priority**: 把現況唯讀的四欄純文字升級為「看得見的設計與圖表結果」，讓使用者真正感受到 007/008 的價值，並符合憲章的可審閱 / 來源忠實要求。次於 US1，因為它呈現的是既有生成輸出，而 US1 改變的是生成前的引導體驗。

**Independent Test**: 給一份含 `designSystem` 與帶圖表 slide 的生成 artifact，驗證面板呈現主題 token（配色色票 / 字體 / 密度 / 結構特徵）與「已渲染圖表類型」標記；給一份圖表退回文字的 artifact，驗證面板標示為 fallback 並顯示對應 review note，且不出現「已畫圖」字樣。

**Independent Demo**: 不依賴 US1/US3——對既有生成結果展示「主題摘要 + 圖表類型晶片 + fallback 誠實標示」即可，無需新的生成流程。

**Acceptance Scenarios**:

1. **Given** 生成結果含套用主題，**When** 檢視設計面板，**Then** 顯示主題名稱、代表性配色色票、字體、視覺密度與結構特徵（圓角/陰影/特效），而非僅 `themeName` 純文字。
2. **Given** 簡報含已渲染的真圖（如 bar + line），**When** 檢視，**Then** 面板/預覽標出實際出現的圖表類型，且可追溯到對應 slide。
3. **Given** 某圖表因資料不足退回表格/文字，**When** 檢視，**Then** 面板標示其為 fallback 並顯示對應 review note，**不**呈現為已畫圖。
4. **Given** 某主題軸無命中而退回 default（`selectedTheme.fallback` 為 true），**When** 檢視，**Then** 面板據 `selectedTheme` 的三軸 id（null 表退回）與實際 token 據實呈現，並標示有退回，不捏造缺失的特徵。

---

### User Story 3 - 圖表偏好提示更清楚（可預覽） (Priority: P3)

使用者檢視 4 個 chart preset（`none` / `comparison` / `trend` / `metric`）時，每個都附**簡短的可預覽說明**，讓人理解這個提示傾向引導出哪種 008 真圖：comparison→長條/圓餅、trend→折線、metric→指標卡。選擇仍**只發出關鍵字傾向**到既有 `chartEmphasis`，且最終是否成圖仍由後端**依資料可圖性**決定（不足則 fallback）。

**Why this priority**: 純屬體驗清晰化的加值，價值低於 US1/US2，且不改變任何控制維度或後端行為，可獨立後做。

**Independent Test**: 渲染 chart preset 區，驗證每個 preset 顯示其代表圖型的簡短預覽/說明；選擇後送出，驗證 `chartEmphasis` 帶對應傾向關鍵字（合約不變）。

**Independent Demo**: 展示「滑過/選取各 chart preset → 顯示代表圖型示意與一句說明」，並說明「成圖與否仍由資料決定」。

**Acceptance Scenarios**:

1. **Given** 使用者檢視 chart preset，**When** 聚焦某 preset，**Then** 顯示其代表圖型示意與一句話說明（且不暗示一定會成圖）。
2. **Given** 使用者選「趨勢」，**When** 送出，**Then** `chartEmphasis` 帶對應傾向關鍵字，後端流程不變。

---

### Edge Cases

- **預覽與實際主題不一致**：因不做 override，使用者所選風格的「預覽」只是代表性引導，後端 `selectTheme` 仍可能依整體 brief 選到不同具名主題。UI 必須把預覽定位為「引導 / 代表性」，**不得**宣稱「你會得到這個主題」。生成後（US2）呈現的才是**實際**套用主題。
- **圖表 fallback**：008 對資料不足會退回表格/文字。US2 必須依 `renderedCharts[].fallback` 誠實標示，嚴禁把 fallback 呈現為已畫圖。
- **主題軸退回 default**：某軸無命中時 `composeKit` 以 default 補齊、`fallback=true`、該軸 id 為 null。US2 只呈現實際 composed token 並標示退回，不補值。C 級（`support='raw'`）不會被 `selectTheme` 選取，不會出現在 applied summary。
- **i18n**：所有新標籤需支援既有 zh-TW / en / ja 三語；風格/圖表選擇的「所選關鍵字方向」與語言解耦（沿用現行設計）。
- **無障礙 / reduced-motion**：任何預覽動效（如 007 B 級 animated gradient 示意）需尊重 `prefers-reduced-motion`，並確保色票/文字對比達 WCAG AA。
- **空狀態 / 生成失敗**：生成尚未完成或失敗時，設計/圖表透明度面板需有明確空狀態或錯誤態，不可顯示殘缺或誤導資訊。
- **鍵盤操作**：風格/圖表選擇需可鍵盤操作並有可見 focus 樣式。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在生成表單以 **radio card gallery（可預覽風格卡片畫廊）** 取代現有 6 個純文字 preset 清單。每張卡 MUST 至少含：風格名稱、2–4 個配色色票、heading/body 字體樣本、2–3 個特徵 chip、視覺密度標示；卡片為**單選 radio**、支援鍵盤操作與可見 focus。窄視窗 MUST 改為單欄或水平可掃描 grid，**MUST NOT** 退化成純文字清單。
- **FR-002**: 使用者選擇某風格時，系統 MUST **僅**透過既有 `styleDirection` 欄位發出該 preset 既定的關鍵字片語；MUST NOT 新增任何硬指定主題（`themeId`）的 override 欄位或路徑。
- **FR-003**: 系統 MUST 保留「未選風格 / 自由文字 `styleDirection`」的既有行為，後端 `selectTheme` 的確定性選擇不受 009 影響。
- **FR-004**: 風格選擇的標籤 MUST 依介面語言（zh-TW/en/ja）翻譯，但同一風格對應的後端關鍵字方向 MUST 與語言解耦、保持不變。
- **FR-005**: 系統 MUST 在生成後的設計面板呈現**實際套用主題**的可視摘要，其 **source of truth 為補強後的 response `generationSummary.selectedTheme`**，形狀鎖定為 Clarifications（第二輪）所定之結構化型別（`kitName` / `ids` / `fallback` / `accentHues: {name,base}[]` / `fonts: {heading,body}` / `visualDensity?` / `structureFeatures: {radiusPx?,shadow?,backdropBlurPx?,glow?,texture?,animation?}`）。面板據此呈現主題名稱、配色色票（`accentHues`）、字體樣本（`fonts`）、視覺密度、結構特徵 chip，取代現有僅四欄純文字。前端 **MUST NOT** 透過 parse HTML / CSS 變數取得這些 token。
  - **相容性**：009 **取代**現況 `generationSummary.selectedTheme` 的 flat shape `{ style, palette, font, fallback }`（定義於 `packages/domain/src/deck/deck.types.ts`），改為上述 nested 結構（三軸 id 移入 `ids`）。此為 readonly 結果證據、無外部公開消費者，MUST **同步更新** `packages/contracts` + `packages/domain` + `apps/api`（回應組裝）+ `apps/web`（型別與呈現）+ 既有測試，**不**保留 flat alias（避免雙形狀分歧）。
- **FR-006**: 系統 MUST 在生成後標示這份簡報**實際渲染出的圖表類型**，其 **source of truth 為新增的 response `generationSummary.renderedCharts` 結果 metadata**（由 renderer/domain 於渲染時產生，每筆 `{ slideId, chartIntentId, visualKind, fallback, notes: { code, message }[] }`）。`visualKind` MUST **直接 reuse 008 既有 `ChartVisualKind` enum**（`pie_donut | line | bar | metric_card | metric_group | table | fallback_text`，定義於 `packages/domain/src/rendering/chart-rendering.types.ts`），**不得**在 contract 寫成顯示文案；UI 顯示用 label 另行於 i18n 翻譯。面板據此標出實際圖型並可追溯到對應 slide。前端 **MUST NOT** parse `previewArtifact.html` 的 data attributes 來推導。
- **FR-007**: 當圖表**真實降級**（`renderedCharts[].fallback === true`）時，系統 MUST 在面板據實標示為 fallback 並顯示對應 review note；MUST NOT 呈現為已畫圖。`fallback` 由 `renderChartIntent` canonical 計算：含 `fallback_used` note，**或** `chart`/`timeline` 意圖未落在真圖（`pie_donut`/`line`/`bar`）。註：planned `table`/`metric_card`、`table_truncated`/`series_extracted` 註記、`timeline`→`bar`（仍真圖）**皆不算 fallback**。
- **FR-008**: 當某主題軸無命中而退回 default（`selectedTheme.fallback` 為 true 或對應 id 為 null）時，系統 MUST 據實反映實際 `composeKit` 後可用的 token，MUST NOT 捏造或補值缺失的設計特徵。C 級（`support='raw'`）資料不會被 `selectTheme` 選取，故不應出現在 applied summary。
- **FR-009**: 系統 MUST 把生成前的風格預覽明確定位為「代表性引導，非保證」；實際套用主題以生成後（FR-005）的呈現為準。
- **FR-010**: 系統 MUST 讓 4 個 chart preset 可預覽/語意更清楚（對應 008 的代表圖型），且選擇仍僅透過既有 `chartEmphasis` 發出傾向關鍵字、不新增圖表類型控制維度。
- **FR-011**: 所有新 UI MUST 可鍵盤操作、具可見 focus 樣式。動效預覽的 gate 分兩階段：**生成前**（card gallery 預覽）以 `StylePreset.preview.structureFeatures.animation`（或等價 curated metadata）決定是否顯示動效——此時尚無 `selectedTheme`；**生成後**（透明度面板）以 `selectedTheme.structureFeatures.animation` 是否存在決定。兩者在 `prefers-reduced-motion` 下 MUST 一律降級為靜態標示。
- **FR-012**: 009 MUST NOT 修改 `selectTheme` / `composeKit` / chart-intent 規劃 / 渲染引擎等後端設計**決策邏輯**。允許的後端改動**僅限唯讀結果證據的暴露**：補強 `selectedTheme` token、由 renderer 產生 `renderedCharts` metadata、及對應的 contracts/api/web 型別。這些改動不得改變任何「選什麼主題 / 哪些資料成圖 / 怎麼渲染」的既有行為。
- **FR-013**: 009 MUST 維持**公開 request contract 不變**（不新增 `themeId`、不新增圖表類型偏好欄位；風格/圖表選擇仍僅透過既有 `styleDirection` / `chartEmphasis` 發出關鍵字）。**response contract 僅得新增 readonly 結果 metadata**（FR-005/FR-006 所述），且該 metadata 為「已發生結果」之證據、不參與任何決策。
- **FR-014**: 009 新增/調整的 `apps/web` UI（風格 card gallery、生成後設計/圖表透明度面板、chart preset 預覽）MUST 以 **`ui-ux-pro-max` skill 進行設計**（排版、配色、字體配對、間距、元件樣式、互動與動效），並在既有 React 19 + Tailwind v4 基礎與設計語言上落地。產出 MUST 符合 FR-011（鍵盤/focus/reduced-motion）與 CR-016（RWD）等既有約束；skill 為設計引導，最終仍以本 spec 的功能與無障礙要求為驗收準繩。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: 009 不改變生成，不直接處理 source facts；但生成後透明度面板（US2）MUST 忠實反映實際套用的主題 token 與實際渲染的圖表，數字/標籤一律沿用既有生成輸出，不得在呈現層改寫或強化。
- **CR-002 Review Report**: 圖表 fallback 與 partial 主題 MUST 以 review note / 誠實標示呈現為可見輸出（FR-007、FR-008）；面板呈現 reuse 既有 `consistencyValidation` / review 資訊，不新增隱藏假設。
- **CR-003 Web-First Output**: 本 feature 即作用於 web 控制台，主要交付物為 `apps/web` 的可預覽控制與透明度面板。
- **CR-004 Backend-Configured LLM Boundary**: 風格/圖表選擇僅為 brief 引導關鍵字（既有 `styleDirection` / `chartEmphasis`），非 provider/model 選擇；009 不引入任何使用者可選的 LLM provider/model 欄位。主題選擇維持後端確定性 domain 邏輯。**request/response 邊界**：009 維持 request contract 不變，僅在 response 新增 readonly 結果證據 metadata（`selectedTheme` token 投影、`renderedCharts`），符合「結果證據可入 response、決策輸入不入 request」之原則（沿用 007 將 `selectedTheme` 置於 `generationSummary` 的既有做法）。
- **CR-005 Design System**: 009 的核心即「把 deck 層設計約束（palette、typography、視覺密度、結構特徵、可重用 pattern）暴露為可預覽 UI」；生成前引導與生成後摘要皆環繞此五軸。
- **CR-006 Semantic Titles**: N/A — 009 不改變標題生成。
- **CR-007 Data Visualization**: 009 不改變「何時成圖」的決策（仍由 008 依資料可圖性決定）；僅讓 chart preset 可預覽（US3）並誠實呈現成圖/ fallback 結果（US2）。
- **CR-008 TDD Coverage**: 每個 user story MUST 有對應前端測試：US1 風格選擇渲染 + 送出關鍵字映射；US2 主題摘要 / 圖表類型 / fallback 誠實標示;US3 chart preset 預覽 + 傾向關鍵字。沿用既有 vitest + Testing Library（並視需要 Playwright e2e）。
- **CR-009 Domain Model**: 主要前端概念：`StylePreset`（key + 關鍵字片語 + 預覽 metadata）、`ChartPreset`（key + 傾向關鍵字 + 代表圖型）、`AppliedDesignSummary`（前端唯讀讀模型）。後端 domain 僅新增**唯讀結果 metadata**——`renderedCharts`（renderer 產生）與 `selectedTheme` 的 token 投影；**決策模型（`selectTheme`/`composeKit`/chart-intent）不變**。
- **CR-010 Lean Test Scope**: 測試 MUST 聚焦可觀察行為（選項顯示、選擇→請求欄位映射、面板據實呈現），避免重複測後端既有的 `selectTheme` / 渲染邏輯。
- **CR-011 Behavior-Driven Value**: 三個 user story 均附 Given/When/Then 且可獨立展示 / 測試（見上）。
- **CR-012 Code Simplicity**: 範圍邊界明確——不 override、不加圖表控制維度、不改後端決策；風格預覽預設用 curated 前端 metadata（避免投機性新增端點）。全量主題瀏覽 / 硬指定主題 / 圖表類型控制皆**明確延後**。
- **CR-013 Consistent Language**: 「風格 / 主題 / 視覺密度 / 結構特徵 / 圖表類型 / fallback」等關鍵詞 MUST 在 UI、review、文件間一致，並與 007/008 既有術語對齊。
- **CR-014 Performance and Evidence**: 預覽 UI MUST 不引入明顯渲染負擔（色票/字體樣本為輕量呈現，動效尊重 reduced-motion）；審查證據為前端測試 + 截圖。效能目標其餘 N/A。
- **CR-015 Manual Verification**: 視覺正確性（色票對比、字體樣本、預覽動效觀感、面板與實際 deck 一致）MUST 有手動檢查路徑（見 Review and Safety Notes）。
- **CR-016 Verification**: 驗收 MUST 涵蓋：生成請求 JSON 合約不變（無新增 override 欄位）、新增 response 結果 metadata（`selectedTheme` 補強欄位、`renderedCharts`）之 schema 有效性、新 UI 之 HTML 渲染、鍵盤導覽、基本 RWD（窄視窗下風格選擇與面板可用）。

### Key Entities *(include if feature involves data)*

- **StylePreset（前端）**: 既有 `key`（翻譯鍵）+ `styleDirection`（後端關鍵字片語）+ 新增**預覽 metadata** `preview`（代表性配色色票、字體樣本、風格特徵、視覺密度提示，及 optional `structureFeatures.animation` 供生成前動效預覽 gate）。關鍵字片語與語言解耦。
- **ChartPreset（前端）**: 既有 4 個 key + 傾向關鍵字 + 新增**代表圖型示意**（comparison→bar/pie、trend→line、metric→metric card）。
- **SelectedThemeSummary（response，補強既有 `generationSummary.selectedTheme`）**: 由現況 `{ style, palette, font, fallback }`（三軸 id）**補強**為結構化型別 `{ kitName, ids:{style,palette,font}, fallback, accentHues:{name,base}[], fonts:{heading,body}, visualDensity?, structureFeatures:{ radiusPx?, shadow?, backdropBlurPx?, glow?, texture?:"grain"|"noise"|"paper", animation?:{preset:"aurora"|"mesh",durationMs} } }`。**唯讀結果證據**，由 api 從已算好的 `selectedTheme.styleKit` 投影產生，不改變後端決策。
- **RenderedCharts（response，新增 `generationSummary.renderedCharts`）**: 由 renderer/domain 於渲染時產生的陣列，每筆 `{ slideId, chartIntentId, visualKind, fallback:boolean, notes:{ code, message }[] }`。`visualKind` **reuse 008 `ChartVisualKind` enum**（`pie_donut|line|bar|metric_card|metric_group|table|fallback_text`，非顯示文案），`fallback === true` 表 **renderer 真實降級**（含 `fallback_used` note，或 `chart`/`timeline` 未落在 `pie_donut`/`line`/`bar`）；planned `table`/`metric_card`、`timeline`→`bar` 不算。`notes` 沿用 008 既有 review note `code`（enum）+`message`。**唯讀結果證據**，為「哪些圖實際畫出 / 哪些退回」的單一真實來源，取代前端 parse HTML。
- **AppliedDesignSummary（前端唯讀讀模型）**: 直接讀取上述兩個 response metadata 呈現於設計面板；**不** parse HTML/CSS，**不**改變後端輸出。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用者在生成前無需閱讀程式碼或文件，即可從預覽辨識每個風格選項的配色與調性（手動可用性檢查：受測者能正確配對「風格標籤 ↔ 其配色預覽」）。
- **SC-002**: 100% 的風格 / 圖表選擇，其送出的 `styleDirection` / `chartEmphasis` 關鍵字與選項既定映射一致（自動測試覆蓋）；且生成請求合約**零新增** override 欄位。
- **SC-003**: 生成後設計面板呈現的「實際套用主題」與「圖表類型 / fallback 標示」**完全來自 response 結果 metadata**（`selectedTheme` / `renderedCharts`，非 parse HTML），且與該次 deck 的真實渲染**一致**（無謊報；自動測試驗證面板輸入即 metadata + 抽樣手動比對）。
- **SC-004**: 所有新 UI 文案在 zh-TW/en/ja 三語皆完整、無缺漏鍵；新 UI 通過鍵盤導覽與 WCAG AA 對比檢查。

## Assumptions

- **預覽資料來源**: 可預覽風格選擇使用**前端 curated 預覽 metadata**（與既有 6 個 preset 綁定），不新增唯讀 themes 端點，後端改動最小（呼應「不 override / 後端動最少」決策）。從 DB 主題目錄讀真資料、全量瀏覽留待後續 feature。（已於 Clarifications 鎖定，非待決項。）
- **preset 集合**: 維持精簡 curated 集合（風格 6、圖表 4），不在 009 擴充為全量 007 主題目錄。
- **合約邊界**: 公開 **request contract 不變**（`styleDirection` / `chartEmphasis` 沿用；不新增 `themeId` 或圖表類型偏好）；**response contract 僅新增 readonly 結果 metadata**（`selectedTheme` token 投影、`renderedCharts`），屬已發生結果之證據。
- **沿用既有前端基礎**: React 19 + Vite + Tailwind v4 + 既有 i18n（zh-TW/en/ja）+ 既有面板元件（`PanelCard` 等）+ 既有預覽 job 流程；不引入新前端框架或圖表套件。
- **不改後端決策**: `selectTheme` / `composeKit` / chart-intent 規劃 / 渲染引擎維持原狀；009 為純呈現層加值。
- **認證不變**: 沿用既有登入 / `ProtectedRoute`，009 不涉及權限或帳號範圍變更。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: 生成前的風格預覽 MUST 標示為「代表性引導，非保證」；實際套用主題以生成後面板為準（FR-009）。
- **Omitted or Compressed Content Policy**: 009 不壓縮 / 省略 source 內容；沿用 008/既有 review report 對 fallback 與省略的既有處置，僅在面板**據實呈現**。
- **Uncertain Claims Policy**: 面板 MUST NOT 宣稱未發生的事（圖表 fallback 不可標為已畫圖；partial 主題不可補值）。不確定 / 缺失一律據實或留白，不臆測。
- **Sensitive Content Handling**: 009 不新增送往 backend-configured LLM 的內容；風格/圖表選擇僅為既有 brief 引導關鍵字。不改變既有送出邊界。
- **Evidence and Traceability**: 審查證據 = 前端自動測試（選項顯示、選擇→請求映射、面板據實呈現、fallback 誠實標示）+ 三語文案檢查 + 截圖 / 抽樣手動比對「面板呈現 vs 實際 deck」。
- **Manual Verification Path**: 手動開啟控制台，切換各風格 / 圖表選項觀察預覽；實際生成一份含真圖與一份觸發 fallback 的內容，比對生成後面板是否與 deck 真實渲染一致、fallback 是否誠實標示；於 zh-TW/en/ja 與窄視窗、reduced-motion 下各檢一輪。
