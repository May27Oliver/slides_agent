# Feature Specification: 即時預覽就地更新（取代 iframe 整頁重載）

**Feature Branch**: `016-live-preview-incremental-update`

**Created**: 2026-06-13

**Status**: Ready for planning（clarify 已定案；可進 /speckit.plan）

**Input**: User description：「目前在編輯頁更改投影片樣式會整張重新渲染，感覺效能不好，iframe 之外有沒有別的做法。」→ 量測後定為「消除 iframe 整頁重載」的效能優化。

---

## 背景與量測證據（2026-06-13）

編輯頁左側即時預覽目前的資料流（010 起）：任何編輯 → 250ms debounce → `applyDeckEdit` 重算**整份** deck 成 HTML 字串 → 設給 `<iframe srcDoc>`。`srcDoc` 一換，iframe **整份文件重載**。

**實測**（同一台機、同一份 deck）：

| 項目 | 成本 |
|------|------|
| `applyDeckEdit` 重算整份（含渲染，6 頁） | **~1 ms**（可忽略） |
| iframe 整頁重載 — 拖大小滑桿 | **225 ms** |
| iframe 整頁重載 — 換字型 | **184 ms** |
| iframe 整頁重載 — 打字 | **302 ms** |

**結論**：瓶頸 100% 在 iframe 整頁重載（~185–300ms/次），不在運算。每次停手超過 250ms 就凍/閃約 ¼ 秒（重 parse HTML、重跑 deck runtime script、重算 html/body 樣式、重繪、視情況重抓 Google Fonts、回第 0 頁再跳回）。連續拖滑桿會反覆觸發 → 即使用者體感的卡頓與閃爍。

**為何不換掉 iframe**（已評估並排除）：
- deck CSS 大量用 `100vw/100vh`、`clamp(…,6vw,…)`，**需要 iframe 自己的 viewport**；改 Shadow DOM/內嵌會讓 `vw/vh` 解析成編輯器視窗 → 尺寸全錯，且要改寫整套 deck CSS、與下載的自包含 HTML 分歧（破壞 parity）。
- 用 React 重畫預覽 = 第二套 renderer，必與 domain renderer 漂移、大量重複（違反單一 renderer 原則）。
→ **iframe 是對的容器**；要解的是「每次編輯都換 `srcDoc` → 整頁重載」。

---

## 已定案決策（4b：就地抽換）

| 決策點 | 結論 |
|--------|------|
| 方案 | **4b 就地抽換**：iframe **只載入一次**；之後每次編輯把重算好的投影片標記用 `postMessage` 丟進 iframe，由 deck runtime 就地抽換投影片區（不換 `srcDoc`、不重載文件、不跳頁），並還原目前頁。 |
| parity | **不變**：抽換進去的標記由 server 存檔用的**同一支 domain renderer** 產生；存檔仍以 server 全量渲染為權威。預覽只是用同一份輸出做即時更新。 |
| 全量重載仍保留的時機 | 切換 deck（`:id` 變）、Save 後套用 server 權威 html、以及 postMessage 通道失敗時的**降級回退**（回到現行 `srcDoc` 行為，永不卡住編輯）。 |
| 字型 | 若某次編輯**引入尚未載入的字型家族**，patch 一併更新 iframe 內 override-fonts 的 `<link>`，否則新字 fallback。 |
| 動畫 | 就地抽換進來的元素**不重播進場動畫**（直接視為 active），否則每次編輯會閃動畫。 |
| 範圍邊界 | 本 feature **不做** 4a 逐欄位 patch（拖滑桿即時跟手）；不改 domain renderer 的輸出內容；不改 PPTX/匯出路徑。 |

---

## 已定案決策（2026-06-13 clarify）

1. **抽換粒度 = 整個投影片區全換**。每次編輯把整塊 slides 區 innerHTML 換掉（最簡、一致；重建所有投影片節點但成本 ~ms）。**不做** changed-slide diff。
   → plan：runtime patch handler 直接替換投影片容器內容，不需前後比對。

2. **投影片區標記來源 = 新增 domain 函式只渲染投影片區**。抽出 `renderSlide` 組成的 `<section>` 區，與全量渲染**共用同一邏輯**（parity 保證、可單測、無解析成本）。**不**在 iframe 內解析整份 html。
   → plan：新增類似 `renderTemplateDeckSlides()`（或讓 `renderTemplateDeck` 額外回傳 slides 區字串），LivePreview 取該字串經 postMessage 傳入。

3. **接受 4b 的「編輯中那張節點重建」**（次幀級，遠優於現在 250ms 重載 + 字型重抓 + 跳頁）。**本 feature 不做 4a**（逐欄位零閃 patch）；若日後要「拖滑桿原生打字體驗」再另開 4a。
   → SC-003/SC-004 以「無文件重載、無字型重抓、不跳頁」為驗收，不要求編輯中那張零節點重建。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 編輯時預覽即時更新、不重載不閃爍（Priority: P1）

使用者在編輯頁調整文字（樣式/內容）時，左側預覽即時反映變更，**不再整頁重載、不閃爍、不跳回第一張**，操作順暢。

**Why this priority**: 這是本 feature 的唯一核心價值；量測證明每次編輯有 ~¼ 秒的整頁重載凍結，直接影響編輯體驗。

**Independent Test**: 在多頁 deck 編輯頁，於第 N 張編輯標題/樣式，觀察預覽：內容即時更新、停留在第 N 張、無白屏/閃爍/動畫重播；以 instrumentation 確認該次編輯**未觸發 iframe 文件重載**（無 `load` 事件、無字型重抓）。

**Independent Demo**: 打開含字型/顏色覆寫的編輯頁，連續拖大小滑桿與打字 → 預覽流暢跟隨、無閃爍。

**Acceptance Scenarios**:

1. **Given** 已載入的多頁 deck 停在第 N 張，**When** 使用者編輯該張的文字或樣式，**Then** 預覽就地更新、仍停在第 N 張，且**不發生 iframe 文件重載**。
2. **Given** 預覽已載入字型 A，**When** 使用者做一個不引入新字型的編輯，**Then** **不重新抓任何字型**（無新的 Google Fonts 請求）。
3. **Given** 使用者把某欄位字型改成尚未載入的家族 B，**When** 套用，**Then** patch 更新 iframe 內字型 `<link>`，預覽以家族 B 呈現（載入後），仍不整頁重載。
4. **Given** 使用者連續拖大小滑桿，**When** 數值連續變動，**Then** 預覽連續就地更新、無逐次白屏閃爍。
5. **Given** 就地更新通道因故失敗（例如 runtime 未就緒），**When** 發生編輯，**Then** 系統**降級**為現行整頁渲染，編輯與預覽仍可用（永不卡死）。

---

### User Story 2 - 切換投影片/換主題/存檔仍正確（Priority: P2）

不屬於「同一份 deck 的就地編輯」的情境（切 deck、換主題、存檔）仍以全量渲染/權威 html 正確呈現，不因就地更新而退化。

**Why this priority**: 確保優化不破壞既有正確性（parity 與權威渲染）。

**Independent Test**: 換主題 → 預覽整體重渲染正確；Save → 套用 server 權威 html；切換到另一個 deck → 重新載入該 deck。

**Acceptance Scenarios**:

1. **Given** 使用者換主題，**When** 套用，**Then** 預覽以重算後的全份結果呈現（主題影響全域樣式，允許整體更新）。
2. **Given** 使用者 Save 成功，**When** 取得 server 回傳的權威 html，**Then** 預覽顯示該權威 html（與下載/匯出一致）。
3. **Given** 使用者切換到另一個 deck（`:id` 變），**When** 載入，**Then** 預覽重新初始化為新 deck。
4. **Given** 任一情境，**When** 比較就地更新後的預覽與「全量重載」會產生的結果，**Then** 兩者投影片標記**等價**（parity，無漂移）。

---

### Edge Cases

- **新增/刪除/重排投影片**：投影片集合改變時，就地抽換需正確反映新集合並維持/校正目前頁索引（刪到比目前頁少時夾到合法範圍）。
- **引入新字型家族**：patch 必須先確保字型 `<link>` 就緒再套用，否則短暫 fallback（可接受，但不得整頁重載）。
- **runtime 尚未就緒**（iframe 剛載入、script 還沒掛上 message handler）：編輯需排隊或降級，不得丟失更新。
- **本地渲染失敗**（`applyDeckEdit` 回 rejection）：維持現行「軟性錯誤訊息、不阻擋編輯」行為。
- **全螢幕預覽**（`F`）：就地更新在全螢幕下同樣生效。
- **快速連續編輯**：debounce 後的就地更新不得彼此覆蓋成錯誤狀態（最後一次為準）。
- **惡意/異常 postMessage**：runtime 只接受來自父視窗、且 type 在白名單內的訊息（沿用既有 `event.source` 檢查精神）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 編輯頁預覽 MUST 在「同一份 deck 的編輯」情境下，以 `postMessage` 將重算後的投影片標記就地套進已載入的 iframe，**不更換 `srcDoc`、不重載文件**。
- **FR-002**: 就地更新 MUST 維持目前檢視的投影片索引（不跳回第 0 張）。
- **FR-003**: 就地更新 MUST NOT 觸發既有 Google Fonts `<link>` 的重新抓取；當編輯**引入新字型家族**時，MUST 以 patch 更新/新增字型 `<link>` 後再套用樣式。
- **FR-004**: 就地抽換進來的元素 MUST NOT 重播進場動畫（直接呈現為 active 狀態）。
- **FR-005**: 就地更新產生的投影片標記 MUST 與「全量渲染同一份 deck」**等價**（parity）；由同一支 domain renderer 產生，無第二套渲染邏輯。
- **FR-006**: 以下情境 MUST 仍走全量更新/權威 html：deck 切換（`:id` 變）、Save 後的 server 權威 html、換主題（全域樣式變動）。
- **FR-007**: 當就地更新通道無法使用（runtime 未就緒/錯誤）時，系統 MUST 降級為現行整頁渲染行為，**永不阻擋編輯或預覽**。
- **FR-008**: deck runtime 接收的 patch 訊息 MUST 驗證來源（父視窗）與型別（白名單），忽略其他訊息（沿用既有反向同步的安全精神）。
- **FR-009**: 投影片集合變動（增/刪/重排）時，就地更新 MUST 反映新集合並把目前頁索引夾到合法範圍。
- **FR-010**: 本 feature MUST NOT 改變 domain renderer 的輸出內容、PPTX/HTML 匯出路徑、或既有鍵盤導覽行為。

### HTML Slides Agent Constitution Requirements *(本 feature 為前端效能/渲染傳輸優化，多數 CR 不適用，逐項標註)*

- **CR-001 Source Fidelity**：N/A — 不產生/改寫任何內容；只改「同一份渲染輸出」的傳輸與套用方式。
- **CR-002 Review Report**：N/A — 無新生成內容。
- **CR-003 Web-First Output**：不變 — 自包含 HTML 仍為主交付；本優化只改編輯頁預覽的更新機制，**不影響下載/匯出的 HTML**。
- **CR-004 Backend LLM Boundary**：N/A — 純前端 + deck runtime；零 LLM、零後端契約變動。
- **CR-005 Design System**：不變 — 套用的標記由既有 renderer 產生，主題/版型/字型一致。
- **CR-006 Semantic Titles / CR-007 Data Viz**：N/A。
- **CR-008 TDD Coverage**：測試需涵蓋——就地更新不觸發文件重載（instrumented）、維持目前頁、引入新字型才更新 link、降級回退、parity（就地結果 == 全量結果）。
- **CR-009 Domain Model**：主要新增「投影片區標記的取得方式（供就地套用）」與「deck runtime 的 patch 訊息協議」；不新增業務領域概念。
- **CR-010 Lean Test Scope**：聚焦可觀察行為（無重載、停留頁、字型、降級、parity），避免重測既有渲染內容。
- **CR-011 Behavior-Driven Value**：兩個 US 各有 Given/When/Then、可獨立展示/測試。
- **CR-012 Code Simplicity**：就地更新與既有全量渲染**共用同一份 renderer 輸出**（無第二套渲染）；降級回退即現行行為（不留並存死碼）；範圍排除 4a/Shadow DOM/換技術。
- **CR-013 Consistent Language**：固定詞彙——就地更新（in-place update）、整頁重載（full reload）、patch 訊息、降級回退、parity。
- **CR-014 Performance and Evidence**：核心目標。基準已量（重載 ~185–302ms）；驗收以 instrumentation 證明編輯不再觸發文件重載、且就地更新落在低成本區間（見 SC）。
- **CR-015 Manual Verification**：以 DevTools 觀察編輯時 iframe 無 `load`/無字型重抓、無閃爍/跳頁（見 quickstart，plan 階段補）。
- **CR-016 Verification**：保留既有 slide schema / HTML 渲染 / 鍵盤導覽 / responsive 驗證不退化。

### Key Entities

- **預覽 patch 訊息（PreviewPatchMessage）**：父視窗 → iframe 的 `postMessage`，攜帶就地更新所需資訊（新投影片區標記、目前頁索引、必要時新增的字型 `<link>` 來源）。型別白名單、來源受限。
- **deck runtime patch handler**：iframe 內既有 runtime 新增的訊息處理，負責就地抽換投影片區、還原索引、抑制進場動畫、必要時注入字型 link。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在「同一份 deck 編輯」情境，單次編輯**不再觸發 iframe 文件重載**（0 次 `load` 事件），相較現行 ~185–302ms/次的整頁重載。
- **SC-002**: 不引入新字型的編輯**不產生任何新的 Google Fonts 請求**。
- **SC-003**: 單次就地更新的主執行緒成本顯著低於現行整頁重載（目標 ≤ ~30ms 量級；以 instrumentation 量測為準）。
- **SC-004**: 編輯時預覽**停留在目前投影片**、無白屏/動畫重播閃爍。
- **SC-005**: 就地更新後的投影片標記與「全量重載同一份 deck」等價（parity 測試通過）；Save / 換主題 / 切 deck 仍正確。

## Assumptions

- deck runtime（`deck-runtime-script`）可擴充訊息處理且已具備父視窗來源檢查的既有模式。
- `applyDeckEdit` 重算成本可忽略（已量 ~1ms），故就地更新仍可用「重算整份 → 取投影片標記就地套用」的簡單模型，無需 4a 的逐欄位 diff。
- 既有的 16:9 stage、selectedIndex 同步、全螢幕、debounce 機制沿用。
- 降級回退路徑即現行 `srcDoc` 行為，永遠可用。

## Review and Safety Notes

- **Sensitive Content Handling**：N/A — 不送任何內容至 LLM/第三方；patch 僅在父視窗與本地 iframe 間傳遞既有已渲染標記。
- **Evidence and Traceability**：保留量測基準（本 spec 的表格）與驗收 instrumentation（無重載/無字型重抓/parity 測試）作為審查證據。
- **Manual Verification Path**：DevTools Network（編輯時無字型/css2 重抓）+ 自訂 instrumentation（編輯時 iframe 無 `load`）+ 目視無閃爍/跳頁；詳見 plan 階段的 quickstart。
- **安全**：patch 訊息沿用 `event.source === iframe.contentWindow` 與型別白名單，避免接收外部訊息。
