# Feature Specification: 編輯頁圖表編輯（換類型、編輯數據點、移除、新增圖表）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `014-chart-editing`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "編輯頁的圖表編輯：換圖表類型、編輯數據點（改數字/增刪點）、移除圖表、新增圖表（從未放置的來源圖表或手動輸入數據）"

---

## 背景與目標

008（chart rendering）建立了圖表的確定性渲染鏈：來源文字抽出 `SourceFact` → `ChartIntentPlanner` 規劃 `ChartIntent`（id、title、sourceFacts、recommendedVisuals、rationale）→ slide 以 `chart_placeholder` content block（帶 `chartIntentId`）連結 intent → `designPlan.chartTreatmentPlans` 決定每個 intent 的 `ChartTreatment` → 渲染時 `extractChartSeries` 用 `parseMetricValue` 從 fact 的**自由文字**解析出 `ChartPoint`（label / displayValue 原樣 / numericValue / unit / sourceFactId）→ series validators 守門（點數不足、單位混搭、圓餅比例不合法、時間排序失敗），不合格依既有降級鏈（真圖表 → metric group → table → text）退場並記錄 `ChartRenderingNote`，**永不畫誤導圖、永不捏造數字**。

010（deck editor）建立了編輯的安全模型：`mergeEditedDeck` 把 `contentBlocks` 與非編輯欄位設為**唯讀、篡改即 400**（FR-021 防竄改牆）；`applyDeckEdit` 把 base revision 的 `chartIntents`（jsonb，FR-006a 持久化）與 `designPlan` **原封不動沿用**，確定性重渲染、零 LLM；前端 live preview 在 client 跑**同一份** `applyDeckEdit`，與 server 存檔 byte-for-byte parity。011 在同一管線上加了確定性換主題。

問題是：**生成後使用者完全不能動圖表。** 自動選型不滿意（想把長條換成折線）、來源數字想修正或補幾個點、某頁想拿掉圖表、或想在某頁放上一張圖——目前都只能整份重新生成。盤點現況還發現一個機會：`planSlideDeck` 持久化的 `chartIntents` 是**全部**規劃出的 intents（intent 靠 sourceFact 交集對應到 slide），可能存在**已規劃但未被任何 slide 放置**的 intents——這些是現成的、有來源依據的圖表素材，可直接供「新增圖表」挑選，零 LLM。

014 的範圍：**在編輯頁開放圖表的結構化編輯**，涵蓋四類操作——換呈現類型（treatment override）、移除、從未放置的來源圖表新增、編輯數據點／手動輸入數據新增。全部走**結構化 `ChartOperation` 操作清單**（不開放 raw `contentBlocks` 編輯，FR-021 的牆不動），由 server（與 client live preview 的同一份 pure function）在白名單合併後、確定性重渲染前套用。**零 LLM、零 DB schema migration**（`chart_intents` / `design_plan` jsonb 欄位已存在，僅內容擴充）。

**已鎖定的範圍決策（2026-06-11，見 Clarifications）**：

1. **編輯通道 = 結構化 `ChartOperation` 清單，不開放 raw contentBlocks。** client 對保留 slide 仍 MUST 原樣 echo `contentBlocks`（010 唯讀牆與防竄改語意完全不變）；圖表變更只能以型別化操作（`set_treatment` / `remove_chart` / `add_chart` / `edit_data`）表達，server 驗證每個操作的引用合法性後套用，非法引用整筆 400 拒絕。
2. **編輯的單位 = 結構化「資料點」，不是事實文字。** UI 把抽取出的 `ChartPoint[]` 攤成表格（標籤／數值／單位）編輯；存回時 `SourceFact` 以新增的結構化 `metric` 欄位攜帶數據，series extractor 對帶 `metric` 的 fact **short-circuit 直接採用、跳過文字解析**——使用者輸入的點永遠解析成功，不受 `parseMetricValue` 正則能力限制。無 `metric` 的既有 fact 行為完全不變。
3. **出處誠實是紅線：改過數字的點 = 全新 `user_provided` fact、配新 id。** 原始 fact 說 25%、使用者改成 30%——沿用原 `sourceFactId` 等於偽造「文件支持 30%」。改過或新增的點一律造新 `SourceFact { kind: "user_provided" }`，原 fact 自衍生 intent 移除；`replacesFactId` 僅作稽核與還原線索，不作 provenance。未動過的點原 fact 原樣保留、lineage 不變。比照 010 outline merge 先例（人工內容不宣稱原始出處，CR-001）。
4. **既有驗證守門員一行不改、照常上班。** 使用者編輯後的數據照走 `chart-series-validator` 的全部檢查與降級鏈；降級是「被告知的結果」——`ChartRenderingNote` MUST 即時顯示於編輯 UI（live preview 同 code 同 notes），不是驚嚇。
5. **揭露：含使用者數據的圖表 MUST 在 generationSummary／review 標註**（比照既有 legacy chart note 模式），講清楚哪些數字來自來源文件、哪些由使用者提供（CR-002）。
6. **零 LLM、確定性、live preview parity 全部沿用 010。** `chartOperations` 進 `applyDeckEdit` 的同一管線：merge → 套用操作 → 確定性重渲染；client live preview 傳同一份操作清單，與 server 存檔 parity。儲存沿用 010 樂觀並發（`baseRevision` 不符 → 409）。
7. **Legacy revision（`chartIntents: null`）不可圖表編輯。** 操作清單非空而 base 無 chartIntents → 400；UI 將圖表編輯入口停用並沿用既有 legacy 提示模式，不謊報能力。
8. **顏色不可逐圖表調整。** 圖表用色仍由 theme 的 accentHues 統一管理（011 已有換主題能力），本期不開逐圖表配色（CR-005、CR-012）。
9. **封面（opening）slide 不可新增圖表。** 現行 renderer 對 cover 不渲染圖表（`useChartSplit` 排除 cover）；對 opening slide 的 `add_chart` → 400 明確拒絕，不靜默吞掉。
10. **視覺設計以 `ui-ux-pro-max` skill 引導**（圖表卡片、類型選擇器、數據表格編輯器、來源徽章、notes 呈現）。

**設計原則（沿用專案憲章）**：source of truth 仍為結構化資料（`slideDeck` + `chartIntents` + `designPlan`），`html` 為可重算快取。編輯與重渲染**不呼叫 LLM**（CR-004）。每個資料點 100% 有出處——原始 fact 的 `sourceFactId` 或誠實標記的 `user_provided`（CR-001）。系統永不畫誤導圖：數據不合格照降級鏈退場並揭露原因（CR-007）。所有 deck 讀寫維持 `accountId` ownership 隔離（沿用 006）。

---

## Clarifications

### Session 2026-06-11

- Q: 使用者「不滿意圖表」最常見的補救動作？編輯能力怎麼切片？ → **A: 四類結構化操作。** (1) 換呈現類型（pie/line/bar/metric/table 的 treatment override）；(2) 移除；(3) 新增（兩個來源：未放置的既有 intents／手動輸入數據）；(4) 編輯數據點（改數字、增刪點、調順序）。不做自由繪圖、不引入第三方 chart lib、不做跨 slide 搬移（移除＋新增可達成）。
- Q: 圖表編輯怎麼通過 010 的 contentBlocks 唯讀牆？拆牆還是繞道？ → **A: 不拆牆，走結構化操作清單。** 開放 raw contentBlocks 等於讓 client 可注入任意結構（FR-021 要防的事）。改為 edit request 新增 `chartOperations: ChartOperation[]`，server 在 merge 後套用：每個操作的 `slideId` / `chartIntentId` / 數值都被驗證，非法 → 400 `INVALID_EDIT`。client 的 contentBlocks echo 語意不變。
- Q: 「編輯數據」editing 的對象是 fact 的自由文字還是抽取後的點？ → **A: 結構化資料點。** 現況點是渲染時從 `SourceFact.value` 文字正則解析（`parseMetricValue`），讓使用者改文字再重 parse 極脆弱（輸入 "1,200 人" 可能 parse 失敗導致點消失）。改為：`SourceFact` 增加可選結構化 `metric` 欄位（label / displayValue / numericValue / unit），extractor 對帶 `metric` 的 fact short-circuit 直接轉 `ChartPoint`。使用者輸入永遠帶 `metric` → 永遠成功；舊資料（無 `metric`）走原解析、零行為變化。
- Q: `edit_data` 送 diff 還是完整清單？ → **A: 宣告編輯後的完整點清單（陣列序 = 顯示序）。** 每點二擇一：`{ kind: "original", sourceFactId }`（未動，lineage 原樣）或 `{ kind: "user", label, displayValue, numericValue, unit, replacesFactId? }`（改過/新增）。完整清單比 diff 簡單、可重放、順便免費取得排序能力（CR-012）。
- Q: 使用者把 25% 改成 30%，原 sourceFactId 可以沿用嗎？ → **A: 不可以——必須換新 fact。** 沿用 = 偽造出處（宣稱文件支持 30%）。改過的點配全新 `user_provided` fact + 新 id；`replacesFactId` 僅稽核/還原用。這是本 feature 的忠實度紅線。
- Q: 使用者改完數據後圓餅比例總和爆掉（>105%）怎麼辦？拒絕儲存還是降級？ → **A: 照既有降級鏈，不拒絕。** validators 照常守門：`invalid_pie_total` → 降級長條；點數 <2 → metric card；單位混搭 → table；時間排序失敗 → 降級。UI 即時顯示 notes（「比例總和 110%，已改用長條圖呈現」）。拒絕儲存會把領域知識（什麼數據能畫什麼圖）外溢到編輯流程；降級＋揭露才是既有憲章的做法（CR-007）。
- Q: 「從來源資料新增圖表」的素材哪裡來？ → **A: 持久化 chartIntents 裡未被放置的 intents。** 已驗證 `planSlideDeck` 回傳並持久化**全部**規劃 intents（非僅已放置者）；intent 靠 sourceFact 交集對應 slide，可能有 intents 未落在任何 slide。UI 列出這些（title + rationale + 來源事實預覽）供挑選。`remove_chart` 只移除 placeholder、intent 留在集合中 → 移除後可再加回。
- Q: 手動輸入數據新增圖表，與既有 intent 的關係？ → **A: 造全新 intent，sourceFacts 全為 `user_provided`。** title 由使用者輸入；treatment 由使用者選定寫入衍生 treatmentPlans；同樣過 validators（選了 pie 但數據不合格照樣降級）。
- Q: 多個 operations 之間的順序語意？ → **A: 依陣列序依序套用，確定性。** 後面的操作看得到前面操作的效果（例：同一請求先 `add_chart` 再對它 `edit_data` 合法）。引用不存在對象 → 400。
- Q: 對「本次編輯新增的純文字 slide」可以 add_chart 嗎？ → **A: 可以。** 010「新 slide 必須純文字」防的是 client 直接夾帶結構塊；本 feature 的圖表是 server 經驗證操作放上去的，威脅模型不同。操作在 merge 之後套用，新 slide 已在 merged deck 中可被引用。opening slide 除外（renderer 不渲染 cover 圖表 → 400 拒絕）。
- Q: 衍生結果怎麼持久化？要 migration 嗎？ → **A: 零 migration。** 套用操作後的衍生 `chartIntents`（含 user_provided facts）與衍生 `designPlan`（更新後的 chartTreatmentPlans）存入新 revision（`origin="edit"`）的既有 jsonb 欄位；下次編輯以新 revision 為 base，繼承自然成立。`SourceFact.metric` 是 jsonb 內容的 additive 擴充。
- Q: 圖表標題可編嗎？ → **A: 可，併入 `edit_data`（可選 `title` 欄位）。** 使用者改寫的標題不宣稱來源出處（比照 outline 改寫清空 sourceTrace 的精神，CR-006）；未提供則保留原 title。
- Q: 還原（undo）怎麼做？ → **A: 純前端、存檔前免費。** base revision 整個編輯期間都在 client 記憶體：單點還原靠 `replacesFactId` 撈回原 fact，整圖還原 = 重置回 base intent，整體放棄 = 既有草稿捨棄。不做存檔後的 revision 回滾 UI（版本鏈已保留歷史，回滾 UI 為 future）。
- Q: 時間序列手動加點要讓使用者指定排序鍵嗎？ → **A: 不用。** 沿用既有 label 解析（`detectPeriodKey`）；解析不出排序照既有 `time_sort_failed` 降級＋note。不增加 UI 複雜度（CR-012）。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 換圖表呈現類型 (Priority: P1)

使用者在編輯頁選取一張帶圖表的 slide，中欄圖表卡片顯示目前的呈現類型；從類型選擇器改選另一種（例：長條 → 折線），右欄 live preview 即時（本地、零網路）重渲染。若所選類型與數據不相容（例：選圓餅但比例總和不合法），preview 直接呈現降級結果並顯示原因 note。按「儲存」後 server 以同一管線權威重渲染，存為新 revision（`origin="edit"`）。

**Why this priority**: 「自動選型不滿意」是最常見的不滿，而 treatment override 是純現有資料的重組——不碰數據、不碰 lineage、渲染器零修改，是風險最低、價值立現的 MVP 切片。

**Independent Test**: 給一份含長條圖的 deck，於編輯頁把該圖表改為折線並儲存 → 驗證：(1) 新 revision 的 `designPlan.chartTreatmentPlans` 中該 intent 的 treatment 已更新，其餘 plans 原樣；(2) `html` 內該圖表以折線渲染；(3) `chartIntents` 與 base 逐欄相同（US1 不動數據）；(4) 引用不存在 `chartIntentId` 的請求 → 400、不建立 revision；(5) 零 LLM 呼叫。

**Independent Demo**: 開啟既有 deck → 換類型 → 即時預覽變化 → 儲存 → 重新載入後維持新類型。

**Acceptance Scenarios**:

1. **Given** 一張帶長條圖的 slide，**When** 使用者將類型改為折線並儲存，**Then** 新 revision 的該圖表以折線渲染，數據點與 base 完全一致（同 sourceFactIds、同 displayValue）。
2. **Given** 一組比例總和 130% 的數據，**When** 使用者選擇圓餅圖，**Then** live preview 與存檔結果都呈現降級後的視覺（依既有降級鏈），且 UI 顯示 `invalid_pie_total` 的可讀說明；系統不畫誤導的圓餅。
3. **Given** 編輯請求引用不存在的 `chartIntentId`，**When** 送出儲存，**Then** server 回 400 `INVALID_EDIT`、不建立 revision。
4. **Given** 使用者只換了類型未動其他欄位，**When** 比對 live preview 與儲存後 server 回傳的 html，**Then** 兩者 byte-for-byte 一致（parity 沿用 010）。

---

### User Story 2 - 移除圖表 + 從未放置的來源圖表新增 (Priority: P2)

使用者可把某頁的圖表移除（該頁版面自動回到無圖表布局）；也可在任一內容頁（含本次新增的純文字頁）點「新增圖表」，從「來源資料中已規劃但未放置的圖表」清單（顯示 title、rationale、來源事實預覽）挑一個放上去（版面自動切為圖文布局）。被移除的圖表回到「未放置」狀態，之後可再加回。

**Why this priority**: 兩者都是純現有資料的重組（placeholder 的增刪），共享同一套操作驗證機制；合在一起交付「調整圖表位置與有無」的完整能力。依賴 US1 建立的 operations 管線。

**Independent Test**: 給一份 chartIntents 含未放置 intent 的 deck → (a) 移除某頁圖表並儲存：新 revision 該 slide 無 `chart_placeholder`、版面為無圖布局、intent 仍在 `chartIntents` 集合；(b) 將未放置 intent 加到另一頁並儲存：該 slide 多一個 `chart_placeholder`、圖表以該 intent 的來源事實渲染；(c) 對 opening slide add_chart → 400；(d) 同一 intent 重複加到同一 slide → 400。

**Independent Demo**: 移除一頁的圖表 → 預覽版面變化 → 把同一張圖加到另一頁 → 儲存後重載驗證。

**Acceptance Scenarios**:

1. **Given** 一張帶圖表的 slide，**When** 使用者移除圖表並儲存，**Then** 新 revision 該 slide 無該 `chart_placeholder`、版面為無圖表布局；該 intent 仍保留於 `chartIntents`（未放置狀態）。
2. **Given** chartIntents 中存在未放置的 intent，**When** 使用者在新增圖表面板挑選它加到某內容頁並儲存，**Then** 該頁渲染出此圖表，每個點的 `sourceFactId` 都指向原始來源事實。
3. **Given** 同一編輯請求內先移除某 slide 的圖表、再把同一 intent 加到另一 slide，**When** 儲存，**Then** 兩個操作依序生效（圖表完成搬移）。
4. **Given** 對 opening（封面）slide 的 add_chart 操作，**When** 送出，**Then** 400 `INVALID_EDIT`、錯誤訊息明確說明封面不支援圖表。

---

### User Story 3 - 編輯既有圖表的數據點（改數字、增刪點、調順序、改標題） (Priority: P3)

使用者展開圖表卡片的「編輯數據」表格：每列 = 一個資料點（標籤／數值／單位）＋來源徽章（「來源資料」或「使用者提供」）。可改任一格（該列徽章即時轉為「使用者提供」，並提供單列還原）、可新增列、可刪除列、可拖曳排序、可改圖表標題。live preview 即時重渲染；數據變動觸發的降級（比例爆掉、點數不足、單位混搭）即時以可讀 note 呈現。儲存後新 revision 的 `chartIntents` 持久化衍生 intent：未動的點保留原 fact 與 lineage，動過/新增的點為 `user_provided` 新 fact；generationSummary 標註該圖表含使用者數據（n/m 點）。

**Why this priority**: 價值最高但機制最深的切片——引入 `user_provided` fact、結構化 `metric` short-circuit 與揭露機制。依賴 US1 的管線，且其忠實度設計需要最謹慎的測試覆蓋，故排最後。

**Independent Test**: 給一張 5 點長條圖 → 改其中 1 點數值、新增 1 點、刪 1 點、改標題並儲存 → 驗證：(1) 新 revision 衍生 intent 共 5 點：3 點原 fact（id 與 base 相同）、2 點 `user_provided` 新 fact（id 不與任何 base fact 重複，被改的那點帶 `replacesFactId`）；(2) html 中各點 displayValue 原樣呈現（含使用者輸入的格式）；(3) generationSummary 含「使用者提供數據 2/5 點」揭露；(4) `numericValue` 非有限數字或 label 空白的請求 → 400；(5) 引用不存在 sourceFactId 的 original 點 → 400。

**Independent Demo**: 改一個數字 → 徽章變「使用者提供」→ 預覽即時更新 → 單列還原回來源值 → 再改並儲存 → 重載後揭露註記可見。

**Acceptance Scenarios**:

1. **Given** 一個 5 點圖表，**When** 使用者把其中一點 25% 改為 30% 並儲存，**Then** 該點渲染為 30%、其 fact 為 `user_provided` 新 id（帶 `replacesFactId` 指向原 fact）；其餘 4 點 fact 與 base 完全相同；原 25% fact 不在衍生 intent 的 sourceFacts 中。
2. **Given** 使用者新增一點「Q4: 4.0M」，**When** 儲存，**Then** 該點以 `user_provided` fact 持久化、displayValue 原樣渲染為「4.0M」，系統未對其做任何改寫或單位換算。
3. **Given** 編輯後某圓餅圖比例總和變為 112%，**When** live preview 重渲染，**Then** 即時呈現降級後視覺與「比例總和不合法已降級」note；儲存結果與 preview 一致。
4. **Given** 使用者刪到只剩 1 點，**When** preview 重渲染，**Then** 依既有鏈降級為 metric card 並顯示 `series_insufficient` note。
5. **Given** 含使用者數據的圖表，**When** 檢視儲存後的 generationSummary 與 review 輸出，**Then** 明確標註該圖表含使用者提供的數據點（n/m），與來源文件數據可區分。
6. **Given** `numericValue: Infinity` 或 label 為空白的 user 點，**When** 送出儲存，**Then** 400 `INVALID_EDIT`、不建立 revision。

---

### User Story 4 - 手動輸入數據新增全新圖表 (Priority: P3)

使用者在「新增圖表」面板切到「手動輸入」：填圖表標題、選呈現類型、在資料表格輸入若干點（標籤／數值／單位），加到指定內容頁。系統造一個全新 intent（sourceFacts 全為 `user_provided`）、treatment 寫入衍生 plans，照常過 validators 與降級鏈。

**Why this priority**: 與 US3 共用全部機制（user_provided fact、結構化 metric、揭露），是 US3 之上的薄組合層（`add_chart` 的 `user_data` 來源），排同批最後交付。

**Independent Test**: 在某內容頁手動輸入 3 點數據新增長條圖並儲存 → 驗證：(1) 新 revision `chartIntents` 多一個 intent，其 sourceFacts 全為 `user_provided`；(2) 該頁渲染出此圖表、displayValue 原樣；(3) generationSummary 揭露「使用者提供數據 3/3 點」；(4) 數據不滿足所選類型時照降級鏈呈現＋note。

**Independent Demo**: 手動建一張 3 點長條圖 → 即時預覽 → 儲存重載後圖表與揭露註記俱在。

**Acceptance Scenarios**:

1. **Given** 一張無圖表的內容頁，**When** 使用者手動輸入 3 點數據選長條圖並儲存，**Then** 該頁渲染 3 點長條圖、新 intent 的 sourceFacts 全為 `user_provided`、揭露註記為 3/3。
2. **Given** 使用者輸入的 3 點單位互不相容且選了折線，**When** preview 重渲染，**Then** 依既有鏈降級（table）並顯示 `unit_mismatch` note；不畫誤導折線。

---

### Edge Cases

- **同一請求內操作互相依賴**：先 `add_chart` 再對其 `edit_data` → 依陣列序套用、合法；先 `remove_chart` 再 `edit_data` 引用該 intent → intent 仍在集合中（remove 只拆 placeholder）→ 合法，效果待再次放置時可見。
- **引用被同請求刪除的 slide**：操作引用的 `slideId` 不在 merged deck（該 slide 已於同請求被刪）→ 400。
- **樂觀並發**：兩個分頁同時編輯圖表 → 後存者 `baseRevision` 落後 → 409（沿用 010，無新機制）。
- **legacy base（`chartIntents: null`）**：`chartOperations` 非空 → 400；UI 預先停用入口並顯示既有 legacy 說明。空操作清單的純文字編輯照 010 正常運作。
- **點數/圖表數上限**：單一圖表超過點數上限、單一 slide 超過圖表數上限 → 400（上限見 Assumptions）。
- **使用者輸入極長 label** → 沿用既有 `MAX_LABEL_LENGTH` 截斷顯示規則，不另設規則。
- **displayValue 與 numericValue 不一致**（如 display "30%"、numeric 99）：server 以提交的 `numericValue` 計算幾何、`displayValue` 原樣顯示——UI MUST 由數值輸入自動帶出兩者以避免不一致；display 本就允許 "~30%" 等自由格式，幾何一律以 numericValue 為準。
- **時間序列加點 label 解析不出排序** → 既有 `time_sort_failed` 降級＋note，不提供手動排序鍵。
- **重複放置**：同一 intent 在同一 slide 出現兩次 → 400；同一 intent 放到兩張不同 slide → 允許（資料共享、各自渲染）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001（操作通道）**: 編輯儲存請求 MUST 支援可選的 `chartOperations` 清單，操作類型限定 `set_treatment` / `remove_chart` / `add_chart` / `edit_data`。server MUST 在白名單合併（010 `mergeEditedDeck`，語意不變）之後、確定性重渲染之前依**陣列序**套用操作。client 對保留 slide 的 `contentBlocks` echo 義務與篡改即 400 的語意 MUST 維持不變。
- **FR-002（操作驗證）**: 每個操作引用的 `slideId` MUST 存在於 merged deck、`chartIntentId` MUST 存在於（套用前序操作後的）intents 集合；違反 → 400 `INVALID_EDIT`、不建立 revision、錯誤訊息指明違規操作。`add_chart` 對 opening slide → 400；同一 intent 於同一 slide 重複放置 → 400。
- **FR-003（set_treatment）**: 換類型 MUST 僅更新衍生 `designPlan.chartTreatmentPlans` 中對應 intent 的 treatment（immutable 衍生新物件），不動數據、不動其他 plans；treatment 值域沿用既有 `ChartTreatment` 詞彙。
- **FR-004（remove_chart）**: 移除 MUST 僅自指定 slide 的 `contentBlocks` 移除對應 `chart_placeholder`；intent 本身 MUST 保留於衍生 `chartIntents`（成為未放置，可再放置）。
- **FR-005（add_chart / existing_intent）**: MUST 可將 intents 集合中任一 intent（含未放置者與本請求 `remove_chart` 後者）以新 `chart_placeholder` 放置到任一非 opening slide（含本次編輯新增的純文字 slide）。
- **FR-006（add_chart / user_data 與 edit_data 的數據契約）**: 使用者數據點 MUST 以結構化欄位提交（label、displayValue、numericValue、unit）；`edit_data` MUST 宣告編輯後完整點清單，每點為 `original`（引用 base fact id）或 `user`（完整結構化數據，可選 `replacesFactId`）；陣列序即顯示序。可選 `title` 覆寫圖表標題。
- **FR-007（結構化 metric short-circuit）**: `SourceFact` MUST 增加可選結構化 `metric` 欄位；series 抽取對帶 `metric` 的 fact MUST 直接採用其值建點（displayValue 原樣、numericValue 作幾何），跳過文字解析；無 `metric` 的 fact 行為 MUST 與現行完全一致。
- **FR-008（出處誠實）**: 改過或新增的點 MUST 持久化為 `kind: "user_provided"` 的**新** fact（新 id，不得沿用任何 base fact id 作為其出處）；未動的點 MUST 原樣保留 base fact（id、lineage 不變）；被取代的原 fact MUST 自衍生 intent 移除；`replacesFactId` 僅供稽核/還原，MUST NOT 作為 provenance 呈現。
- **FR-009（驗證與降級不變）**: 編輯後的 intents MUST 通過與生成路徑完全相同的 series 驗證與降級鏈；系統 MUST NOT 因數據不滿足所選類型而拒絕儲存，MUST 降級並產生既有 `ChartRenderingNote`；編輯 UI MUST 即時顯示這些 notes。
- **FR-010（揭露）**: 任何含 `user_provided` fact 的圖表，新 revision 的 generationSummary MUST 含可讀標註（圖表所在 slide、使用者數據點數 n/m）；review 輸出同步反映（CR-002）。
- **FR-011（輸入驗證）**: user 點的 label 去空白後 MUST 非空、`numericValue` MUST 為有限數字；單圖表點數與單 slide 圖表數 MUST 設上限（見 Assumptions），超出 → 400。所有驗證 MUST 在 server（domain 層）強制，前端驗證僅為 UX。
- **FR-012（零 LLM）**: 圖表編輯的套用與重渲染全程 MUST NOT 呼叫 LLM（CR-004）。
- **FR-013（持久化、零 migration）**: 衍生 `chartIntents` 與衍生 `designPlan` MUST 隨新 revision（`origin="edit"`）寫入既有 jsonb 欄位；MUST NOT 需要 DB schema migration；下次編輯以新 revision 為 base 時，先前的圖表編輯（含 user_provided facts）MUST 完整繼承。
- **FR-014（live preview parity）**: client live preview MUST 以同一份 domain use-case + 同一 `chartOperations` 本地重渲染，與 server 儲存結果 byte-for-byte parity（沿用 010 FR-005a 機制）；操作變動觸發的 preview 更新維持 debounced、零網路。
- **FR-015（legacy 防護）**: base revision `chartIntents` 為 null 時，非空 `chartOperations` → 400；UI MUST 停用圖表編輯入口並沿用既有 legacy 提示。
- **FR-016（編輯 UI）**: 編輯頁 MUST 提供：圖表卡片（現類型、類型選擇器）、數據表格（label/數值/單位、來源徽章、單列還原、增刪列、拖曳排序）、整圖還原、移除、無圖頁的新增入口（「從來源資料」清單含 title/rationale/來源事實預覽 ＋「手動輸入」表單）、notes 即時呈現。視覺由 `ui-ux-pro-max` 引導，落於既有 React 19 + Tailwind v4 設計語言。
- **FR-017（並發）**: 圖表編輯儲存 MUST 沿用 010 樂觀並發（`baseRevision` 比對、409、不靜默覆蓋）。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: 未編輯的點保留原 fact 與 `sourceFactId` lineage、displayValue 原樣；使用者數據誠實標記 `user_provided` 且不沿用原 fact id（FR-008）；系統不改寫、不換算、不四捨五入使用者輸入的 displayValue。
- **CR-002 Review Report**: 含使用者數據的圖表在 generationSummary／review 揭露（FR-010）；降級決策以 `ChartRenderingNote` 留痕並呈現於 UI（FR-009）。
- **CR-003 Web-First Output**: 輸出仍為 self-contained HTML、inline SVG；本 feature 不引入外部資源或第三方 chart lib。
- **CR-004 Backend-Configured LLM Boundary**: 全程零 LLM（FR-012）；無新增 provider/model 設定面。
- **CR-005 Design System**: 圖表用色、字型、間距全由現行 theme styleKit（accentHues）統御；不開逐圖表配色；換主題（011）後使用者編輯過的圖表隨主題一致重渲染。
- **CR-006 Semantic Titles**: 圖表標題可由使用者改寫；改寫後的標題為使用者文字、不宣稱來源出處（比照 outline 改寫慣例）。
- **CR-007 Data Visualization**: 「什麼數據能畫什麼圖」的守門權完全保留在既有 validators；編輯不能迫使系統畫出數據不支持的圖（FR-009）。
- **CR-008 TDD Coverage**: domain（操作套用、fact 衍生、short-circuit、驗證/降級、揭露）、contracts（operations schema）、web（表格編輯器、徽章、還原、notes 呈現）、整合（儲存→新 revision→繼承）各層測試先行；驗收場景即測試藍本。
- **CR-009 Domain Model**: 新增領域概念：`ChartOperation`（四操作的 union）、`user_provided` fact kind、`SourceFact.metric`（結構化數值）、衍生 intent（操作套用結果）。套用邏輯為純函式（無 I/O、無 LLM）。
- **CR-010 Lean Test Scope**: 測試聚焦可觀察行為（操作 → 衍生資料 → 渲染結果 → 揭露），不重複測既有 validators 內部（僅測「編輯路徑有接上守門」）。
- **CR-011 Behavior-Driven Value**: 每個 US 獨立可測可示範（US1 僅換類型即成 MVP）；G/W/T 場景見各 US。
- **CR-012 Code Simplicity**: 不做 diff-based 操作、不做逐點樣式、不做手動排序鍵、不做 revision 回滾 UI、不引入 chart lib；operations 為唯一新抽象。
- **CR-013 Consistent Language**: 「圖表類型」「來源資料／使用者提供」「降級」「資料點」等詞彙 MUST 於 UI、notes、揭露註記、文件一致；圖表類型的中文標籤與既有 008/009 控制台用語一致。
- **CR-014 Performance and Evidence**: live preview 更新沿用 010 debounce 與本地渲染（零網路）；確定性渲染無新增效能風險。證據：generationSummary 揭露、ChartRenderingNote、`replacesFactId` 稽核線索。
- **CR-015 Manual Verification**: 圖表視覺合理性（配色對比、label 不重疊、降級視覺可讀）需人工於 preview 抽查；路徑：編輯 → 即時預覽 → 儲存 → 下載 HTML 開檔複驗。
- **CR-016 Verification**: 驗收含：衍生 `slideDeck`/`chartIntents` 結構有效（contracts 驗證通過）、HTML 渲染含編輯後圖表、鍵盤導覽不退化（沿用既有 deck runtime）、16:9 響應行為不退化。

### Key Entities

- **ChartOperation**: 圖表編輯的結構化指令（union：`set_treatment` / `remove_chart` / `add_chart` / `edit_data`），edit request 的可選欄位，server 驗證後依序套用。
- **SourceFact.metric**（新增可選欄位）: 結構化數值（label / displayValue / numericValue / unit）；存在時 series 抽取直接採用。使用者數據點的載體。
- **user_provided SourceFact**: `kind: "user_provided"` 的事實，代表使用者於編輯器輸入的數據；`sourceText` 標明來源為編輯器輸入；可帶 `replacesFactId` 稽核線索。
- **衍生 ChartIntent / 衍生 ChartTreatmentPlan**: 操作套用後 immutable 產生的 intent 集合與 treatment plans，隨新 revision 持久化，成為後續編輯的 base。
- **EditDataPoint**: `edit_data` 清單中的一點——`original`（引用 base fact）或 `user`（結構化數據）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用者完成「換圖表類型並看到更新後預覽」無需任何網路請求，操作到預覽更新 ≤ 1 秒（本地確定性渲染）。
- **SC-002**: 編輯後 live preview 與 server 儲存的 html byte-for-byte 一致率 100%（同 010 parity 標準，含 chartOperations 路徑）。
- **SC-003**: 任一儲存後 revision 中，圖表每個資料點 100% 可溯源——指向原始來源 fact，或明確標記 `user_provided`；不存在第三種狀態。
- **SC-004**: 數據不滿足所選圖表類型的案例 100% 降級呈現且 100% 伴隨可讀 note（編輯 UI 與 review 皆可見）；0 張誤導圖表。
- **SC-005**: 圖表編輯全流程 0 次 LLM 呼叫、0 個 DB schema migration。
- **SC-006**: 含使用者數據的圖表 100% 在 generationSummary 帶揭露註記（n/m 點）。
- **SC-007**: 對抗性 payload（不存在的 id、非有限數值、空 label、opening slide 放圖、重複放置、legacy base 帶操作）100% 被 400 拒絕且不建立 revision。

## Assumptions

- **單一圖表點數上限預設 12、單一 slide 圖表數上限預設 2**——元件/domain 常數可調；確值於 plan 階段以實際版面驗證後定案（table 既有 8 列截斷規則不變）。
- 使用者數據的 `numericValue` 由前端自數值輸入解析帶出；前端確保 displayValue 與 numericValue 同步產生，server 不負責兩者語意一致性校驗（幾何一律以 numericValue 為準）。
- `@slides-agent/domain` 維持 browser-bundle-safe（010 已建立），新增的操作套用邏輯同樣零 Node-only 依賴。
- 編輯入口沿用 010 編輯頁；本 feature 不新增路由或頁面，僅擴充 `SlideEditPanel` 與儲存請求。
- 持久化 `chartIntents` 含未放置 intents 的行為（已驗證於 `planSlideDeck`）為本 feature「從來源資料新增」的素材來源；若特定 deck 無未放置 intents，該清單顯示空狀態（仍可手動輸入）。
- 圖表編輯不影響 010 的文字編輯與 011 的換主題——三者可在同一儲存請求並存，各走各的衍生步驟。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: 含使用者數據的圖表必須讓「報告讀者」可辨識：generationSummary 標註圖表位置與使用者數據點比例（n/m）。
- **Omitted or Compressed Content Policy**: 被使用者取代的原始 fact 不再呈現於圖表，但原值仍可由 revision 歷史（base revision 不可變）與 `replacesFactId` 稽核取回；無靜默丟失。
- **Uncertain Claims Policy**: 使用者輸入的數據不被系統背書為來源事實——`user_provided` 標記 + 揭露註記即為「此數字非來源文件抽取」的明示。
- **Sensitive Content Handling**: 圖表編輯全程零 LLM，使用者數據不送往任何外部 provider；資料僅落於自有 DB 的 revision jsonb。
- **Evidence and Traceability**: 每點的 `sourceFactId`/`user_provided` kind、`replacesFactId`、`ChartRenderingNote`、generationSummary 揭露、不可變 revision 鏈——全部不需重跑 demo 即可審查。
- **Manual Verification Path**: 編輯頁即時預覽抽查圖表視覺（對比、label、降級可讀性）→ 儲存 → 「我的簡報」重開複驗 → 下載 self-contained HTML 以瀏覽器開啟做最終目視確認。
