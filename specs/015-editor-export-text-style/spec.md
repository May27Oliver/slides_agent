# Feature Specification: 編輯頁匯出與文字樣式覆寫

**Feature Branch**: `015-editor-export-text-style`

**Created**: 2026-06-12

**Status**: Implemented（plan / tasks / 實作完成；deep-review 後對齊現行決策：sizePx / #RRGGBB / fontFamily、PPTX milestone amendment、current-only revision、file+TTL）

**Input**: User description: "在 edit 頁面增加下載 HTML 和 PPT 兩個功能選項，並修改 edit 頁：每個 input 欄位（標題、內容）要可以點選進去修改文字大小與顏色；左側欄位要能正確顯示每張 slide 的正確比例。"

---

## 討論已定案的決策（2026-06-12）

| 決策點 | 結論 |
|--------|------|
| PPTX 產生方式 | **截圖嵌圖**：伺服器以無頭瀏覽器把每張 slide 截圖，逐頁塞入 pptx（一頁一張圖）。視覺 100% 還原主題，pptx 內文不可編輯。走 async job（沿用 003/004 既有 worker 佇列基礎設施）。 |
| 文字樣式覆寫範圍 | **標題 + message + 每條 outline 條列**。提供自由顏色選擇器（任意 `#RRGGBB`）＋任意 px 字級滑桿（8–240px，量於 1920×1080 簡報空間，WYSIWYG）＋字型家族下拉（內建字型目錄 ~90 種，由 renderer 注入 Google Fonts `<link>`，預覽與 PPTX 皆套用）。較豐富的文字編輯器 UX，刻意取代早先 token/級距方案。 |
| 左側預覽比例 | **單張預覽固定 16:9 letterbox**：維持現有單張即時預覽，但把 iframe 框成 16:9（留邊），不再被容器拉伸變形。 |
| 下載內容來源 | **必須先存檔，下載目前畫面對應且 dirty=false 的「具體 revision number」**（非模糊的「server 最新」）。PPTX 請求帶該 adopted revision number，後端驗證它仍是 deck 的 **current** revision；若已被其他 tab 推進則明確失敗並要求 reload，不退而匯出其他版本（current-only，見第三輪 clarify 1）。 |

---

## 已定案決策（2026-06-12 clarify 第二輪）

> 以下四項為 clarify 第二輪確認，作為 plan 的固定前提。

1. **outline 條列樣式綁定 = 為 outline item 加穩定 id**。本 feature 為每條 outline 加一個穩定 id，文字樣式覆寫綁該 id（非 index）。拖曳重排/編輯/刪除時樣式正確跟隨、刪除時一併移除，無錯位、無孤兒。
   → plan 需處理：`SlideOutlineItem` 新增穩定 id；編輯 UI 的 sortable id 由 index 改用該 id；既有無 id 的舊 revision 在載入/合併時補發 id（向後相容遷移）。

2. **PPTX 範圍 = 015 全做，含 PPTX**。四個 US 都納入本 feature。預設正式機 EC2 可裝/可用 chromium（或採內含 chromium 的 docker image）。**本 feature 明確 amend 當前 milestone 納入 PPTX：PPTX 為既有 HTML 渲染截圖而得的衍生匯出格式，不取代 web-first 的自包含 HTML 主交付物。**
   → plan 需含：無頭瀏覽器依賴選型與打包、worker 端逐頁截圖→pptx 組裝、以及正式機（EC2 / docker-compose）的部署驗證步驟。

3. **顏色 = 自由 `#RRGGBB`**（deep-review 後改採）：顏色採自由色彩選擇器，任意合法 `#RRGGBB`（regex `/^#[0-9a-fA-F]{6}$/`）。未設定即沿用該欄位的主題預設色（不寫入 override）。
   → contracts 的 `color` 以 hex regex 驗證（非固定列舉）。

4. **大小 = 任意 px（8–240）**（deep-review 後改採）：字級為任意絕對 px，範圍 8–240（`TEXT_SIZE_PX_MIN=8`、`TEXT_SIZE_PX_MAX=240`），量於 **1920×1080 簡報空間**（與即時預覽、PPTX 匯出同一空間 → px WYSIWYG）。未設定即沿用該欄位的主題預設字級（不寫入 override）。另增字型家族 `fontFamily`（內建字型目錄名稱，≤64 字、charset `/^[A-Za-z0-9][A-Za-z0-9 -]*$/`）。
   → contracts 的 `sizePx` 以數值範圍 8–240 驗證、`fontFamily` 以白名單/長度驗證（非固定級距列舉）。

---

## 已定案決策（2026-06-12 spec review 第三輪）

> 針對 spec review 六項 finding + 兩個開放問題的定案，作為 plan 的固定前提。

1. **下載目標 = 目前畫面對應且 dirty=false 的「具體 revision number」**（修正 finding 1）。下載不依賴模糊的「server 最新」：前端以目前 adopt 的 `revision`（`DeckRevisionContract.revision`）為下載對象，且僅在 `dirty=false` 時可下載。PPTX 匯出請求 MUST 帶上目前 adopted 的 `revision` number，**後端驗證它仍是 deck 的 current revision，若已被其他 tab 推進則明確失敗並要求 reload，不退而匯出其他版本**（current-only）。避免匯出到使用者沒看到的版本（含其他 tab 造成的 latest）。刻意不提供 by-revision 的歷史版本匯出路徑（YAGNI；FR-003a 的安全行為即 current-only）。

2. **HTML 下載 = 純前端，複用並擴充 `buildHtmlDownload`**（回答 open question 1）。adopted revision 本身帶 `html`，client 已握有該確切版本，直接以 data URL 下載；helper 擴充為接受 deck 標題 + revision number，檔名格式 `<sanitized-title>-rev<N>-<YYYYMMDD-HHmmss>.html`。**不為 HTML 新增 server endpoint**。PPTX 才走 server job。

3. **outline 穩定 id 遷移規則**（修正 finding 2）：
   - **id 形狀**：每條 outline 一個 slide 內唯一的不透明 id（非由 text 衍生 → 同文字重複條列不碰撞），例如 `nanoid`/隨機短碼。
   - **舊 revision**：載入時若 outline item 缺 id，於 client `EditableSlideDraft` 建構時**惰性補發**穩定 id（同一次編輯 session 內穩定）；**僅在使用者 Save 時才持久化**到新 revision（不主動改寫舊 revision）。
   - **新增條列**：產生全新 id。
   - **merge**：server 合併以 slide id → outline item id 對齊保留樣式與 id；client 提交的 id 為權威綁定鍵。
   - **schema**：`SlideOutlineItem` 新增 optional `id`（`additionalProperties:false` 維持，僅多開這一個 property）。

4. **TextStyleOverride 資料形狀鎖定**（修正 finding 4）。附掛於 slide 的 `textStyleOverrides`：
   ```
   textStyleOverrides?: {
     title?: TextStyleOverride
     message?: TextStyleOverride
     outlineById?: Record<outlineItemId, TextStyleOverride>
   }
   TextStyleOverride = { sizePx?: number; color?: string; fontFamily?: string }
   //   sizePx: 絕對 px，範圍 8–240
   //   color:  自由 hex "#RRGGBB"
   //   fontFamily: 內建字型目錄名稱，≤64 字
   ```
   - **未設定不儲存**：`sizePx`/`color`/`fontFamily` 任一缺 = 沿用該欄位的主題預設 → 不寫入該 property（省欄位、避免噪音）；三屬性皆缺時整個 entry 省略。
   - **reset 粒度**：UI 同時支援「單一屬性 reset」（清掉 size / color / fontFamily 其一）與「整欄 reset」（清掉該欄位整個 entry）。
   - **條列刪除**：刪除某 outline 時，`outlineById` 對應 key 一併清除（無孤兒）。

5. **PPTX artifact 存取與清理（補成 FR）**（修正 finding 3）：下載 endpoint 需 auth scope 綁 owner 帳號、跨帳號隔離、artifact 有 TTL 並到期清理、暫存檔在工作結束/失敗時刪除、回應 content-type 為 `application/vnd.openxmlformats-officedocument.presentationml.presentation`、失敗不留可下載檔。詳見 FR-016～FR-019。

6. **PPTX 量化指標（補成 FR/SC）**（修正 finding 5）：截圖 1920×1080（16:9，1× DPI 起，必要時 2×）、單工作逾時上限（≤30 頁目標 90 秒內）、**單使用者併發 = 1**、全域併發上限（沿用 worker 佇列設定）、最大頁數上限（建議 60 頁，超出拒絕）、進度粒度至少 `queued / processing / done / failed`（可選逐頁進度）。詳見 FR-020 與 SC-002。

7. **US4（16:9 預覽）優先級由 P4 提升至 P2**（回答 open question 2）：低成本、高頻使用的核心編輯體驗改善，提前交付；PPTX（最重、部署風險最高）改為 build 順序最後（P4）。

8. **quickstart 引用**（修正 finding 6）：原為避免引用尚不存在的檔案而暫述「待 /speckit.plan 產出」；plan 階段已產出 [quickstart.md](./quickstart.md)，本 spec 內引用已直接指向該檔。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 從編輯頁下載 HTML（Priority: P1）

使用者在編輯頁完成編修並 Save 後，想把成品下載成單一自包含 HTML 檔，離線開啟或寄給他人，不必另外回到生成頁。

**Why this priority**: 這是「下載」需求中最低成本、最高即時價值的一刀。生成頁已有 `buildHtmlDownload`，編輯頁可直接複用既有 saved html，沒有後端與資料模型風險，先交付立刻有感。

**Independent Test**: 在已有 saved revision 的 deck 編輯頁點「下載 HTML」，瀏覽器下載一個 `.html`，雙擊可離線開啟並完整呈現該 revision 全部投影片與導覽。

**Independent Demo**: 開啟任一已存 deck 編輯頁 → 點下載 HTML → 開啟下載檔案 → 與線上預覽一致。

**Acceptance Scenarios**:

1. **Given** 編輯頁已載入一個有 saved revision 的 deck，**When** 使用者點「下載 HTML」，**Then** 瀏覽器下載一個檔名含 deck 標題與時間戳的 `.html`，內容等同該 revision 的 server 渲染 html。
2. **Given** 使用者剛做了尚未 Save 的編輯（dirty），**When** 使用者點「下載 HTML」，**Then** 系統提示需先存檔（或下載按鈕在 dirty 狀態停用並說明），不會默默下載到舊版本而讓使用者誤會。
3. **Given** deck 尚無任何 revision（notReady），**When** 進入編輯頁，**Then** 下載入口不出現或為停用狀態。

---

### User Story 2 - 從編輯頁下載 PPTX（Priority: P4）

使用者想把成品轉成 PowerPoint（.pptx）檔，以便在沒有瀏覽器或需要用 PPT 軟體放映/交付的場合使用。每張投影片以高解析截圖滿版嵌入，視覺與線上一致。

**Why this priority**: 仍在本 feature 範圍內（已定案全做），但工程量最大、部署風險最高（需無頭瀏覽器、async job、pptx 組裝、EC2 chromium），故排為 build 順序最後（P4），不阻擋前三項的交付。

**Independent Test**: 在已存 deck 編輯頁點「下載 PPTX」，等待背景轉檔完成後取得 `.pptx`，用 PowerPoint/Keynote 開啟，頁數等於投影片數，每頁為對應 slide 的滿版 16:9 截圖。

**Independent Demo**: 編輯頁點下載 PPTX → 顯示轉檔進度 → 完成後自動/點擊下載 → 用 PPT 軟體開啟逐頁檢視。

**Acceptance Scenarios**:

1. **Given** 編輯頁已載入有 saved revision 的 deck，**When** 使用者點「下載 PPTX」，**Then** 系統建立一個匯出工作並顯示進行中狀態（不阻塞編輯）。
2. **Given** 匯出工作完成，**When** 前端取得結果，**Then** 使用者可下載一個 `.pptx`，頁數 = 投影片數，每頁為對應 slide 的 16:9 滿版截圖，視覺與線上預覽一致（含主題、圖表、文字樣式覆寫）。
3. **Given** 匯出工作逾時或失敗，**When** 前端輪詢到失敗狀態，**Then** 顯示可理解的錯誤訊息並允許重試，不殘留半成品檔。
4. **Given** 使用者有未存編輯（dirty），**When** 點「下載 PPTX」，**Then** 與 HTML 一致地要求先存檔。
5. **Given** 同一 deck 連點多次下載 PPTX，**When** 重複請求，**Then** 系統需有併發/重複請求的合理上限（避免無頭瀏覽器資源被單一使用者放大）。

---

### User Story 3 - 逐欄位文字大小與顏色覆寫（Priority: P3）

使用者在編輯頁想針對個別 slide 的標題、message、或某一條 outline 條列，微調文字大小與顏色（例如把關鍵句放大、改成強調色），讓重點更突出，而不影響其他 slide 或整體主題。

**Why this priority**: 提升編修表達力的加值功能。需新增 per-field 文字樣式覆寫的領域模型、渲染與編輯 UI，工程量中等，且非「下載」核心訴求，故排第三。因 PPTX 採截圖方案，樣式覆寫會自動反映到 PPTX，無需額外處理。

**Independent Test**: 在編輯頁點某欄位（標題/message/某條列）開啟樣式面板，調整 px 字級、顏色與字型，即時預覽更新；Save 後重載，覆寫保留並反映在 server 渲染 html。

**Independent Demo**: 點標題 → 拉大字級 px + 選一個顏色 + 換字型 → 預覽即時變化 → Save → 重新整理仍在。

**Acceptance Scenarios**:

1. **Given** 編輯頁選定一張 slide，**When** 使用者點擊標題欄位的樣式控制，調整 px 字級（8–240）、選擇一個顏色與字型，**Then** 左側即時預覽中該 slide 的標題以對應大小、顏色與字型呈現。
2. **Given** 已對某條 outline 條列設定覆寫，**When** 使用者拖曳重排或編輯該條文字，**Then** 該條的樣式覆寫跟著對應的條列移動/保留，不會錯位到別條。
3. **Given** 已設定覆寫，**When** 使用者點「重設樣式」，**Then** 該欄位回到主題預設大小與顏色。
4. **Given** 已設定覆寫並 Save，**When** 重新載入編輯頁或下載 HTML/PPTX，**Then** 覆寫被持久化並一致呈現。
5. **Given** 顏色採自由色彩選擇器，**When** 使用者操作顏色控制，**Then** 介面提供自由 `#RRGGBB` 選色；輸入經 hex regex 驗證，非法值被拒絕。

---

### User Story 4 - 左側預覽固定 16:9 比例（Priority: P2）

使用者希望左側即時預覽呈現的是投影片真正的 16:9 比例（如同實際放映），而非被編輯頁版面拉伸後的變形畫面，所見即所得。

**Why this priority**: 純前端版面修正、低風險、低成本，且每天編修都會用到——「所見即所得」直接影響核心編輯體驗，故提升至 P2 提前交付（僅次於 HTML 下載）。

**Independent Test**: 在不同寬度的編輯頁視窗下檢視左側預覽，slide 內容始終維持 16:9（以留邊 letterbox 達成），不出現水平或垂直方向的內容被壓扁/拉長。

**Independent Demo**: 拉動瀏覽器視窗寬度 → 左側預覽 slide 始終 16:9 並置中留邊。

**Acceptance Scenarios**:

1. **Given** 編輯頁載入，**When** 左側預覽渲染，**Then** slide 內容以 16:9 呈現，多餘空間以留邊（letterbox/pillarbox）填補，內容不變形。
2. **Given** 使用者調整瀏覽器視窗大小，**When** 版面重排，**Then** 預覽持續維持 16:9 並盡量放大填滿可用空間。
3. **Given** 進入全螢幕預覽（既有 `F` 快捷），**When** 全螢幕呈現，**Then** 仍維持正確比例不變形。

---

### Edge Cases

- **未存就下載**：dirty 狀態下載入口停用並提示先 Save（避免下載到與畫面不符的舊 revision）。
- **空 deck / 無 revision**：下載與匯出入口不出現或停用。
- **PPTX 轉檔逾時/瀏覽器崩潰**：工作標記失敗、回收暫存資源、允許重試；不產生殘檔。
- **超大 deck（多頁）**：匯出時間與資源需有頁數上限或逐頁串流，避免單一工作吃滿 worker。
- **樣式覆寫指向的條列被刪除**：刪除條列時其覆寫一併移除，不殘留孤兒樣式。
- **未設定欄位**：`sizePx`/`color`/`fontFamily` 任一缺即沿用該欄位的主題預設（不寫入 override），換主題後該欄位呈現自動跟隨新主題的預設。
- **覆寫值越界**：以「數值範圍（sizePx 8–240）＋ hex regex（color）＋ 字型白名單/長度（fontFamily ≤64 字）」為邊界封住 DoS——`validateOverrideShape` 在 contracts 邊界驗證、`outlineById` 至多 100 entries；domain `normalizeTextStyleOverrides` 再次以相同規則重驗（不信任跨層輸入）。超界一律拒絕。
- **下載檔名**：含 deck 標題與本地時間戳，避免冒號/空白等不合法字元。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 編輯頁 MUST 在已存在 saved revision 時提供「下載 HTML」入口，下載對象為**目前 adopt 且 dirty=false 的具體 `revision` number** 的 server 渲染 html（複用並擴充 `buildHtmlDownload`，純前端 data URL，不新增 server endpoint），檔名格式 `<sanitized-deck-title>-rev<N>-<本地時間戳>.html`。
- **FR-002**: 當 deck 處於 dirty（有未存編輯）狀態時，系統 MUST 停用 HTML/PPTX 下載入口並提示先 Save；下載對象一律為某個**明確的 revision number**，不使用模糊的「server 最新」。
- **FR-003**: 編輯頁 MUST 提供「下載 PPTX」入口；請求 MUST 帶上目標 `revision` number、以背景工作方式進行、回傳工作狀態，且不阻塞編輯互動。
- **FR-003a**: 後端 MUST 以請求帶入的 `revision` number 驗證它**仍是 deck 的 current revision**；若已被其他 tab 推進（非 current）或不屬於該帳號的 deck，回明確錯誤並要求 reload，不退而匯出其他版本（current-only；無 by-revision 歷史匯出路徑）。
- **FR-004**: PPTX MUST 為每張 slide 一頁，內容為該 slide 的 **1920×1080（16:9）截圖**滿版置入，視覺需與線上預覽一致（含主題、圖表與文字樣式覆寫）。
- **FR-005**: PPTX 匯出工作 MUST 處理逾時與失敗，對前端回報可理解的狀態並允許重試，失敗時不留下可下載的半成品（暫存與部分檔一併清除）。
- **FR-006**: 系統 MUST 對 PPTX 匯出設**單使用者併發 = 1**、並沿用既有 worker 佇列的全域併發上限，避免無頭瀏覽器資源被放大（資源保護）。
- **FR-007**: 編輯頁 MUST 允許針對選定 slide 的標題、message、以及每一條 outline 條列，各自設定文字大小覆寫，大小為任意絕對 px（範圍 8–240，量於 1920×1080 簡報空間，與預覽/PPTX 同一空間故 WYSIWYG）；未設定即沿用該欄位的主題預設字級。並允許設定字型家族 `fontFamily`（內建字型目錄名稱，~90 種，由 renderer 注入 Google Fonts `<link>` 使預覽與 PPTX 皆套用）。
- **FR-008**: 編輯頁 MUST 允許上述同範圍欄位設定文字顏色覆寫，顏色為自由色彩選擇器、任意合法 `#RRGGBB`（regex `/^#[0-9a-fA-F]{6}$/`）；未設定即沿用該欄位的主題預設色。
- **FR-015**: 系統 MUST 為每條 outline 條列維持一個 slide 內唯一、不透明（非由 text 衍生）的穩定 id，作為文字樣式覆寫的綁定鍵：
  - 舊 revision 缺 id 時於 client `EditableSlideDraft` 建構時惰性補發，session 內穩定，**僅在 Save 時持久化**到新 revision，不主動改寫舊 revision；
  - 新增條列產生全新 id；同文字的重複條列各自獨立 id 不碰撞；
  - server 合併以 slide id → outline id 對齊保留 id 與其樣式；
  - schema `SlideOutlineItem` 新增 optional `id`（維持 `additionalProperties:false`）。
- **FR-016**: 文字樣式覆寫 MUST 以鎖定結構儲存：slide 上的 `textStyleOverrides?: { title?, message?, outlineById?: Record<outlineItemId, TextStyleOverride> }`，`TextStyleOverride = { sizePx?: number(8–240); color?: string(#RRGGBB); fontFamily?: string(≤64) }`。`sizePx`/`color`/`fontFamily` 任一缺視為「沿用主題預設」不寫入該 property；三屬性皆缺時整個 entry 省略。
- **FR-017**: PPTX artifact 的下載 MUST 經 auth 並 scope 綁 owner 帳號（跨帳號隔離，沿用 006 deck 讀取 scope 語意）；下載回應 content-type MUST 為 `application/vnd.openxmlformats-officedocument.presentationml.presentation`。
- **FR-018**: PPTX artifact MUST 有 TTL 並於到期後清理；工作完成、失敗或逾時時，無頭瀏覽器暫存與中間檔 MUST 一併刪除，不殘留可下載的失敗檔。
- **FR-019**: 系統 MUST 限制單一 PPTX 工作的最大頁數（建議 60 頁），超出則拒絕並回明確錯誤，避免單一工作吃滿 worker。
- **FR-020**: PPTX 工作 MUST 對前端揭露至少 `queued / processing / done / failed` 四態（可選逐頁進度）；單工作逾時上限需設定（≤30 頁以 90 秒內完成為目標）。
- **FR-009**: 文字樣式覆寫 MUST 能即時反映在左側預覽，並在 Save 後持久化、於重載與下載（HTML/PPTX）中一致呈現。
- **FR-010**: 文字樣式覆寫 MUST 與其所屬欄位綁定；outline 條列的覆寫需隨條列重排/刪除正確跟隨或一併移除，不錯位、不殘留孤兒。
- **FR-011**: 系統 MUST 提供「重設樣式」將某欄位的覆寫清空，回到主題預設。
- **FR-012**: 左側即時預覽 MUST 以 16:9 呈現 slide 內容，透過留邊維持比例不變形，並在視窗縮放與全螢幕下維持正確比例。
- **FR-013**: 文字樣式覆寫的所有輸入 MUST 在 contracts 邊界以 bounded 規則驗證——`sizePx` 數值範圍 8–240、`color` 以 hex regex `/^#[0-9a-fA-F]{6}$/`、`fontFamily` 以字型白名單/長度（≤64 字、charset 規則），`outlineById` 至多 100 entries（`validateOverrideShape`）；domain `normalizeTextStyleOverrides` 再次以相同規則重驗（不信任跨層輸入），越界值一律拒絕；server 端 edit 合併 MUST 將覆寫納入既有 revision 合併白名單，且不破壞 contentBlocks 既有唯讀規則。
- **FR-014**: 文字樣式覆寫與 PPTX 匯出皆為**確定性**處理，MUST NOT 涉及任何 LLM 呼叫。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: 本功能不改寫來源內容；文字樣式覆寫只調整既有 grounded 欄位（標題/message/outline）的「呈現」大小與顏色，不新增、刪改或重述事實。匯出（HTML/PPTX）為既有 revision 的忠實再現，數字、日期、實體、決策等一律原樣保留。
- **CR-002 Review Report**: 本功能不產生新的生成內容，沿用既有 revision 的 review report；無新增的假設/省略/不確定宣稱需揭露。
- **CR-003 Web-First Output**: 自包含 HTML 仍為主要交付物；PPTX 為**衍生匯出格式**，由既有 HTML 渲染截圖而得，屬於明確記錄的衍生輸出而非取代 web-first。
- **CR-004 Backend-Configured LLM Boundary**: 本功能不涉及 LLM；provider/model 設定無關。匯出與樣式覆寫皆為使用者觸發的確定性處理，無 LLM 請求/回應欄位。
- **CR-005 Design System**: 文字樣式覆寫 MUST 在既有 design system 邊界內運作——大小為量於 1920×1080 簡報空間的絕對 px（WYSIWYG）、顏色為自由 `#RRGGBB`、字型取自內建字型目錄；未設定即沿用該欄位主題預設，避免破壞既有 palette / typography / spacing / 視覺密度與可重用版型。
- **CR-006 Semantic Titles**: 不改變標題的語意產生規則，僅允許調整標題呈現樣式；標題仍維持既有 grounded 來源。
- **CR-007 Data Visualization**: 不改變圖表/數據的轉換規則；PPTX 截圖忠實反映既有圖表渲染。
- **CR-008 TDD Coverage**: 每一 user story 對應的測試需涵蓋：HTML 下載對應正確 revision 與 dirty 守門、PPTX 工作狀態機（建立/完成/逾時/失敗/上限）、樣式覆寫的合併與渲染與條列跟隨/移除、16:9 版面比例。
- **CR-009 Domain Model**: 新增領域概念「文字樣式覆寫（TextStyleOverride：sizePx 數值 + color hex + fontFamily 字型名稱）」附掛於 slide 的標題/message/outline 條列；以及「PPTX 匯出工作」狀態（沿用既有 preview-job 佇列模型語彙）。
- **CR-010 Lean Test Scope**: 測試聚焦可觀察行為（下載對應正確版本、覆寫呈現與持久化、工作狀態轉移、比例不變形），避免重複既有 014/011 已覆蓋的合併路徑。
- **CR-011 Behavior-Driven Value**: 四個 user story 各自具備獨立可展示/可測的 Given/When/Then，且可獨立交付為 MVP 切片。
- **CR-012 Code Simplicity**: 範圍邊界明確——大小為任意 px（8–240）、顏色為自由 hex、字型取自內建目錄，輸入以「數值範圍＋hex regex＋字型白名單/長度」為 bounded DoS 邊界；PPTX 採截圖（不做原生形狀對映）、預覽比例為純前端 letterbox、下載只對已存 revision；避免投機抽象。
- **CR-013 Consistent Language**: 關鍵詞需跨 UI/報告/文件一致：下載 HTML、下載 PPTX、文字樣式（大小/顏色/字型）、重設樣式、匯出工作、16:9 預覽。
- **CR-014 Performance and Evidence**: PPTX 匯出為非同步、有逾時與並發上限；HTML 下載與樣式覆寫為即時。需保留的評審證據：匯出工作狀態紀錄、樣式覆寫經 contracts schema 驗證的測試、預覽比例的視覺/快照證據。
- **CR-015 Manual Verification**: PPTX 在實際 PowerPoint/Keynote 開啟的視覺一致性、以及 16:9 在不同視窗大小的呈現，列為人工驗證路徑（見 [quickstart.md](./quickstart.md)）。
- **CR-016 Verification**: 驗收需含 slide JSON schema 對新增樣式欄位的有效性、HTML 渲染套用覆寫、既有鍵盤導覽不受影響、以及預覽的基本 responsive（比例維持）行為。

### Key Entities

- **TextStyleOverride（文字樣式覆寫）**: 附掛於某 slide 之某欄位（標題 / message / 某 outline 條列「以穩定 id 綁定」）的呈現覆寫。屬性：`sizePx`（絕對 px，範圍 8–240，量於 1920×1080 簡報空間）、`color`（自由 hex `#RRGGBB`）、`fontFamily`（內建字型目錄名稱，≤64 字）。皆為選填；任一缺即沿用該欄位的主題預設（不寫入該 property）。隸屬於既有 Slide 領域模型，隨 slideDeck 經 edit revision 持久化。
- **PptxExportJob（PPTX 匯出工作）**: 對某 deck 之某**具體 revision number** 觸發的非同步匯出工作。屬性：所屬 deck/owner 帳號/revision number、狀態（`queued / processing / done / failed`，含逾時歸於 failed）、結果 artifact（可下載的 .pptx，scope 綁 owner、有 TTL）、錯誤資訊、頁數。生命週期：建立 → 逐頁截圖組裝 → 完成可下載 / 失敗清理暫存。沿用 003/004 既有預覽工作佇列基礎設施的語彙與生命週期；併發上限見 FR-006、頁數上限見 FR-019、清理見 FR-018。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用者可在編輯頁於 3 秒內下載到目前 adopted 且 `dirty=false` 的 revision 的 HTML 檔，開啟後與線上預覽一致。
- **SC-002**: 使用者可從編輯頁產生 PPTX，頁數 100% 等於投影片數，每頁為對應 slide 的 1920×1080（16:9）截圖，視覺與線上一致；常見規模（≤ 30 頁）的轉檔在 90 秒內完成並回報 `queued/processing/done/failed` 進度；超過 60 頁的請求被明確拒絕。
- **SC-003**: 使用者可對標題/message/任一 outline 條列獨立調整大小、顏色與字型，調整即時反映於預覽，Save 後重載 100% 保留。
- **SC-004**: 左側預覽在常見桌面視窗寬度範圍內，slide 內容皆維持 16:9 不變形（以留邊達成）。
- **SC-005**: 所有樣式覆寫與匯出參數皆通過 contracts 邊界的 bounded 驗證（sizePx 8–240、color hex regex、fontFamily 白名單/長度、outlineById ≤100 entries）；越界輸入 100% 被拒絕，無 DoS 放大路徑。

## Assumptions

- 使用者已登入且對該 deck 有編修權限（沿用既有 auth/scope）。
- 下載對象一律為目前 adopted 且 `dirty=false` 的「具體 revision number」（current-only；PPTX 建立時後端再驗證它仍為 deck current，非則明確失敗要求 reload，不退而匯出他版）；未存編輯需先 Save（已定案決策）。
- PPTX 採截圖嵌圖，pptx 內文不可編輯為可接受取捨（已定案決策）。
- PPTX 轉檔在伺服器端以無頭瀏覽器執行，沿用既有 003/004 的 Redis/BullMQ worker 佇列基礎設施作為非同步工作載體（實作細節待 plan 階段定）。
- 文字顏色採自由 `#RRGGBB`、大小為任意 px（8–240）、字型取自內建字型目錄為可接受表達範圍（deep-review 後改採的較豐富文字編輯器 UX）。
- 投影片標準比例為 16:9（既有 deck CSS 以 16:9 為設計基準）。
- 行動裝置版面非本功能 v1 重點（沿用既有 responsive 行為，不退化即可）。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: 本功能不產生新生成內容；無新增需揭露的假設。下載/匯出皆為既有 revision 的忠實再現。
- **Omitted or Compressed Content Policy**: 不適用（無新內容壓縮）；樣式覆寫不刪改任何來源文字。
- **Uncertain Claims Policy**: 不適用（無 LLM、無新宣稱）。
- **Sensitive Content Handling**: 不送任何內容至 LLM provider；PPTX 截圖在伺服器端以無頭瀏覽器渲染既有 deck html，過程不外送第三方。需確認無頭瀏覽器以 sandbox 載入既有受信任的 server 渲染 html（與前端 iframe sandbox 政策一致的安全考量）。
- **Evidence and Traceability**: 匯出工作的狀態紀錄、樣式覆寫經 schema 驗證的單元測試、預覽比例快照，皆可在不重跑 demo 的情況下供評審檢視。
- **Manual Verification Path**: (1) 下載 PPTX 後以 PowerPoint/Keynote 開啟逐頁比對視覺；(2) 不同視窗寬度下檢視左側 16:9 預覽；(3) 設定樣式覆寫後下載 HTML 比對呈現。具體步驟見 [quickstart.md](./quickstart.md)。
