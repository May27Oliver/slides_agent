# Feature Specification: Deck 編輯頁 + 跨 deck 歷史切換器（把生成後存進 DB 的 deck 升級為可逐張編輯、可跨 deck 切換的編輯頁）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `010-deck-editor`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "每個 deck 生成後（DB 已有記錄），能進編輯頁；編輯頁是 010 的主軸。不管是產 slide 的頁面或編輯頁，都要有下拉選單能讓使用者點選並瀏覽歷史 slides，進而預覽編輯。本 spec 偏前端，用 ui-ux-pro-max 搭配開發。"

---

## 背景與目標

006（DB persistence）已建立 deck 的持久化地基：`decks` 表（`id` / `accountId` / `title` / `status` / `sourceContent` / `deckBrief` / `currentRevisionId` / `updatedAt`，並有 `decks_account_updated_idx`）與 `deck_revisions` 表（每份 deck 多版本：`revision` 遞增、`slideDeck` 結構化 JSONB 為真實來源、`designPlan`、`html` 渲染快取、`generationSummary`，以及關鍵欄位 **`origin: "generation" | "edit"`**——當初 schema 即**預留了「編輯產生新版本」的路**，但目前只會產出 `"generation"`）。API 已有 `GET /api/decks`（列表 `DeckSummary[]`）與 `GET /api/decks/:id`（詳情含 `currentRevision`），皆以 `accountId` 做 ownership 隔離。

問題是：**生成後的 deck 目前只能「唯讀預覽」，不能編輯，也無法在頁面間快速切換瀏覽歷史 deck。** 盤點現況（`apps/web`，React 19 + React Router 7 + Vite + Tailwind v4）：

- `/` 生成頁（`SlideGenerationFeature`）：填表 → 非同步 job → 預覽 HTML → 下載；worker 自動把結果存進 DB。
- `/decks`（`MyDecksView`）：列出我的 deck、點「開啟」後在 iframe **唯讀**呈現 `currentRevision.html`。**沒有**編輯能力、**沒有** revision 歷史瀏覽、**沒有**跨頁的歷史下拉切換器。

010 的範圍：**把「唯讀預覽」升級成「逐張結構化編輯頁」，並在生成頁與編輯頁都提供「跨 deck 歷史切換器」**。編輯涵蓋 **grounded 文字四欄位（標題、訊息、條列、講者備註）+ 結構編輯（增刪重排條列與整張 slide）**，儲存時以**確定性重渲染**（不重跑 LLM）產生**新 revision（`origin="edit"`）**，沿用 schema 既有的多版本能力。編輯頁是 010 的主軸；視覺由 `ui-ux-pro-max` skill 引導設計。

**已鎖定的範圍決策（2026-06-09，見 Clarifications）**：

1. **編輯粒度 = 逐張結構化編輯，可編欄位鎖定為「現行 renderer 實際會渲染的」grounded 四欄位。** 經查證現行唯一 deterministic renderer（`template-html-renderer`）只渲染：`Slide.title`、`Slide.message`、`Slide.outline[].text`（即 bullets）、`Slide.speakerNotesDraft`（嵌於 HTML 的隱藏 notes 層）。可編白名單即此四者。**`contentBlocks` 中只有 `chart_placeholder` 會影響渲染（驅動圖表），其餘 block kind（`paragraph`/`callout`/`quote`/`bullets`(block)/`table`/`timeline`/`metric`…）不被現行 renderer 讀取、編了無視覺效果，故本期不開放編輯。**
2. **結構編輯 = 可增刪/重排 outline 條列與整張 slide。** 但唯讀內容塊（`chart_placeholder` 等）與每張的非編輯欄位（`type`/`slideKind`/`layout`/`layoutIntent`）對**保留下來的 slide（id 在 base 也有）MUST 取自 base、篡改即 400 拒絕**；**新增的 slide** 只能是純文字（title/message/outline/notes，type/layout 由 server 指派預設），**夾帶結構塊即 400 拒絕**，且因不跑 LLM 無法生新圖。篡改一律**鎖定 400 拒絕、不採忽略**。**不**提供「改 brief 重生成」捷徑（延後）。
2a. **來源忠實（sourceTrace）= 改過的才清空。** outline 條列帶 `sourceTrace`（溯源）與 `emphasis`：文字**未變**的條列沿用其溯源/emphasis（依文字比對保留）；使用者**新增或改寫**的條列 MUST 清空 `sourceTrace`、`emphasis` 設中性預設——人工內容不宣稱原始出處（誠實，非捏造；CR-001）。
3. **歷史切換器 = 跨「不同 deck」、採混合式。** 下拉打開 = 搜尋框 + 最近 N 份（**N 預設 8、元件常數可調**，可直接點進編輯）+ 底部「瀏覽全部歷史 →」連到 `/decks` 完整列表。**不**做「同一份 deck 的 revision 版本瀏覽 / 切換」UI（版本資料會累積，但本期不暴露版本瀏覽器）。
4. **儲存模型 = 手動儲存 + localStorage 草稿暫存。** 每 3 分鐘把當前編輯狀態暫存 localStorage（不碰 DB、不產版本）；使用者按「儲存」才寫 DB → 產生**新 revision（`origin="edit"`，version +1）**並更新 `currentRevisionId`。重新進入若偵測到未儲存草稿則提示還原；離開頁面有未存變更時提醒。
5. **重渲染 = 純確定性重渲染（不跑 LLM）。** 用既有 deterministic renderer（`html-deck-renderer` / `template-html-renderer`）把編輯後的 `slideDeck` 配上 base revision 既有的 `designPlan` **與 `chartIntents`** 重新渲染成 HTML，**主題/圖表保持與 base 一致**（除使用者改動的文字外）。**關鍵**：renderer 畫真圖需要 `chartIntents`（source facts），但其**不在 `slideDeck` 內**且現況未持久化；010 MUST **持久化 chartIntents 於 revision**並於編輯時取回（見 FR-006a）。右欄即時預覽由 **client 端**引入同一份 renderer 本地（debounced、零網路）渲染；**save 由 server 權威**用同一份 renderer 重渲染並校正——同程式碼 + 同 designPlan + 同 chartIntents 保證 parity。
6. **局部文字強調（raw px + 色票富文本）= US4，列為 Post-MVP / Future，不在本 feature 第一批交付與驗收。** **本 feature 第一批 = US1–US3**（純文字 + 結構編輯，非富文本）；**US4 為獨立後續 story set**，其 FR-018/FR-019/SC-007 屬條件式需求（**US4 排程時才適用**），spec→tasks 時 **MUST NOT** 納入第一批 tasks 與驗收範圍。富文本（選取部分字元改 font-size px / color）含 sanitization 與對比 a11y 警告，待 US4 啟動再交付。
7. **slide 導覽 = 純文字列表（編號 + 標題）。** 不做縮圖（避免 mini 渲染成本）。
8. **視覺設計以 `ui-ux-pro-max` skill 引導**（三欄編輯器、切換器下拉、列表/面板）。

**設計原則（沿用專案憲章）**：010 是**控制台編輯層**功能。編輯與重渲染**不呼叫 LLM**（CR-004）；重渲染沿用 base revision 的 `designPlan`/styleKit 以維持設計一致性（CR-005）。**source of truth 為 `slideDeck`（結構化 JSONB）**，`html` 為可重算快取（編輯後一律重算，不手改 HTML）。編輯內容為**使用者自撰文字**，系統 MUST 忠實持久化與渲染、**不得**以 LLM 改寫（CR-001）。唯讀結構塊 MUST 原樣保留、不臆造（CR-001）。所有 deck 讀寫 MUST 維持 `accountId` ownership 隔離（沿用 006）。

---

## Clarifications

### Session 2026-06-09

- Q: 010 主軸與「編輯」的對象/粒度？ → **A: 編輯頁為主軸；逐張結構化編輯。** 直接編輯每張 slide 的結構化欄位，存回 `slideDeck` JSONB 後重新渲染，非「改 HTML」或「只連回生成表單」。
- Q: MVP 階段「可編輯欄位」範圍？ → **A: 文字層級全部。**（**已於審查第三輪修正**：經查證文字類 block 不被現行 renderer 渲染，故可編白名單改鎖定為 grounded 四欄位 `title` / `message` / `outline[].text` / `speakerNotesDraft`，並開放條列與 slide 的結構增刪重排；見下方審查 session 與 FR-003/FR-021。）
- Q: 不可編結構塊怎麼處置？ → **A: 唯讀 + 提示（走 a）。** 顯示「本期暫不可編輯」，**不**提供「改 brief 重跑 LLM 重生成」捷徑（重生成路徑明確延後）。
- Q: 「下拉選單瀏覽歷史 slides」瀏覽的單位？ → **A: 不同份 deck。** 下拉列出「我的所有簡報」（沿用 `GET /api/decks`），選了載入該 deck 進編輯/預覽。**不**做同一份 deck 的 revision 版本瀏覽 UI。
- Q: 歷史導覽的互動形態？ → **A: 混合式切換器。** 下拉 = 搜尋框 + 最近 N 份（直接點進編輯）+ 底部「瀏覽全部歷史 →」連到 `/decks` 完整列表頁。避免「多一跳」與「子選單塞爆 200 筆」兩個痛點。切換器在**生成頁與編輯頁共用**。
- Q: 編輯儲存後資料如何落地？ → **A: 每次存新 revision。** 手動「儲存」寫 DB → 新 `deck_revision`（`origin="edit"`、version +1）、更新 `currentRevisionId`，保留完整歷史、可回溯（沿用 schema 既有多版本）。
- Q: 儲存時機與草稿？ → **A: localStorage 每 3 分鐘暫存草稿（不碰 DB、不產版本）；按「儲存」才寫 DB 記 version。** 重新進入若有「比 DB 新且未儲存」的草稿則提示還原；成功存 DB 後清掉草稿；離開頁面（beforeunload）有未存變更時提醒。
- Q: 編輯後產生新 HTML 的重渲染策略？ → **A: 純確定性重渲染（不跑 LLM）。** 用既有 deterministic renderer 把編輯後 `slideDeck` 配 base 的 `designPlan` 重渲染；快、便宜、可預期，主題/圖表與 base 一致。
- Q: 局部文字強調（一句話中幾個字變大/變色）怎麼做、何時做？ → **A: 純原始 px + 色票（PowerPoint 式），獨立 US4，US1–3 跑通後做。** 純 `<input>`/`<textarea>` 無法做部分字元樣式；US4 改用富文本 runs（`text` + marks `{type:"fontSize",value:px}` / `{type:"color",value:hex}`）與 contentEditable + 浮動工具列；renderer 吐 `<span style>` 時 MUST allowlist sanitize（僅 `font-size`px + `color`，擋其餘 CSS/script），並對低對比配色即時警告。資料模型由 `string` → `RichText`（runs），舊資料視為「單一 run 無 marks」向後相容。
- Q: slide 導覽形態？ → **A: 純文字列表（編號 + 標題）。** 不做縮圖（避免 mini 渲染成本）；含唯讀結構塊的 slide 以標記提示。
- Q: 新 UI 的視覺設計依據？ → **A: 以 `ui-ux-pro-max` skill 設計**（見 FR-016）。三欄編輯器、切換器下拉、列表/面板的排版/配色/字體配對/間距/元件樣式/互動動效皆由該 skill 引導，落在既有 React 19 + Tailwind v4 與設計語言上；最終以本 spec 的功能與無障礙要求為驗收。

### Session 2026-06-09（spec 審查：寫入安全/並發、可編範圍、結構編輯、保真、預覽路徑）

- Q: `POST /api/decks/:id/revisions` 如何防 stale/惡意 client 改唯讀塊或蓋掉別處剛存的新版本？ → **A: 鎖請求 + 後端權威合併 + 樂觀並發。** (1) request 鎖為 `{ baseRevision, slideDeck }`；(2) 後端載入 base/current revision，`baseRevision` 與目前 currentRevision 不一致回 **409 Conflict**、不覆蓋（FR-020）；(3) 後端依 slide `id` 對應 base 做白名單合併（見審查第三輪）：保留 slide 的唯讀塊/非編輯欄位取自 base、不信任 client（FR-021）；(4) 並發檢查在建立 revision 的同一交易內，避免 TOCTOU。唯讀與並發保證 MUST 在後端強制，不得僅靠前端 UI。
- Q: 偵測到版本衝突（baseRevision 落後 / 草稿 base 過舊）時 UI 怎麼處理？ → **A: 顯示最近更新的那個 version。** 前端載入並呈現目前最新（最近更新）的 revision，使用者在最新版上重做或捨棄其編輯；保留 localStorage 草稿待使用者決定，**不**靜默覆蓋、**不**靜默丟棄編輯（FR-020、US1 #7、US3 #3）。
- Q: 文字類 ContentBlock（paragraph/callout/quote）的可編 path？ → **A: 不開放——經查證現行 renderer 不渲染它們。** 現行唯一 deterministic renderer（`template-html-renderer`）只渲染 `slide.title` / `slide.message` / `slide.outline[].text`（bullets）/ `slide.speakerNotesDraft`（隱藏 notes 層），`contentBlocks` 只讀 `chart_placeholder`。故可編白名單鎖定為這 **grounded 四欄位**；其餘 block kind 編了無視覺效果，本期不開放。
- Q: outline 條列與 slide 的結構編輯（增/刪/重排）做到哪？ → **A: 條列與整張 slide 都可增/刪/重排。** 但保留 slide（id 在 base 也有）的唯讀塊/非編輯欄位取自 base、篡改即 400 拒絕；新增 slide 須純文字、夾帶結構塊即 400（FR-021）。
- Q: 唯讀欄位/結構遭篡改時，後端要拒絕還是忽略？ → **A: 鎖定 400 拒絕（不採忽略並以 base 為準）。** 拒絕整個請求較誠實、測試明確（對抗性 payload → 400、不建立 revision）。新增 slide 的 `type`/`layout` 無 base 可比對，屬 **server 指派預設**（非拒絕情境，client 值不採用）。
- Q: 結構編輯下 outline 條列的 `sourceTrace`（無 stable id）如何保真？ → **A: 文字比對保留 + 改過的清空。** 文字未變的條列沿用 `sourceTrace`/`emphasis`；新增/改寫的清空 `sourceTrace`、`emphasis` 中性預設——人工內容不宣稱原始出處（誠實，非捏造；FR-003a、CR-001）。不改 schema 加 id。
- Q: 含圖 deck 編輯重渲染如何不掉圖 / 不 drift？（renderer 畫真圖需 `chartIntents`，但 persisted revision 沒存） → **A: 持久化 `chartIntents` 於 revision（FR-006a）。** chartIntents 衍生含 LLM（segmentation）且 id 索引式，無法零-LLM 重導出，故 MUST 存：生成路徑帶 chartIntents 下去 + 新增 nullable `chart_intents jsonb` 欄位（additive migration）；編輯時 `applyDeckEdit` 取回 base chartIntents 傳 renderer → 圖表逐字一致、零 LLM。Legacy（null）退 fallback + review note，不謊報；backfill 為 future。
- Q: deck-level `title`/`subtitle` 在本批可編嗎？ → **A: 不可編，保留 base。** 本批可編白名單僅 slide-level grounded 四欄位 + slide/outline 結構操作；deck title/subtitle 由合併沿用 base（避免與白名單不一致；deck 標題編輯列 future）。
- Q: 右欄「即時預覽」的實作路徑？ → **A: client 端跨 domain renderer（路徑 A）。** 已查證 domain rendering 依賴鏈零 Node-only 依賴（browser-bundle-safe），且 `apps/web/tsconfig.json` 已配 `@slides-agent/domain` path alias。右欄由 client 引入**與 server save 同一份** deterministic renderer + base `designPlan`，編輯時 debounce 本地重渲染（零網路往返、零新增端點）；save 仍由 server 權威重渲染並回傳 `html` 刷新校正。parity 由「同 renderer + 同 designPlan + 工作副本僅含白名單文字變更」保證（FR-005a）。建置端補 `@slides-agent/domain` 的 Vite `resolve.alias`，並維持 renderer browser-safe。未選 debounced 端點（B，網路延遲 + 新端點）或結構化草稿預覽（C，非真 WYSIWYG）。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 逐張結構化編輯（文字 + 增刪重排）→ 確定性重渲染 → 存新版本 (Priority: P1)

使用者開啟一份已生成、存在 DB 的 deck，進入**編輯頁**（三欄：左 slide 文字導覽／中 結構化編輯表單／右 即時預覽）。在左欄以**純文字列表（編號 + 標題）**選取某張 slide，於中欄編輯該張的 **grounded 可編欄位**（標題 `title`、訊息 `message`、條列 `outline[].text`、講者備註 `speakerNotesDraft`——即現行 renderer 實際會渲染的四者）。使用者亦可做**結構編輯**：增/刪/重排 outline 條列、增/刪/重排整張 slide。`chart_placeholder`（驅動圖表）等唯讀塊與每張的非編輯欄位（`type`/`slideKind`/`layout`/`layoutIntent`）在中欄**唯讀顯示**並標示「本期暫不可編輯」；保留下來的 slide 其唯讀塊由 server 取自 base，新增的 slide 為純文字、不含結構塊。右欄即時預覽由 **client 端的 deterministic domain renderer（與 server save 同一份）+ base 的 `designPlan`** 在本地（debounced、零網路往返）重渲染工作副本而成，故所見即所得。按「儲存」後，server 以**同一份 deterministic renderer 權威重渲染**（沿用 base `designPlan`、不跑 LLM）並寫入 DB 成為**新 revision（`origin="edit"`、version +1）**、更新 `currentRevisionId`，保留舊版；存檔成功後右欄 iframe 以 server 回傳的權威 `html` 刷新校正。

**Why this priority**: 這是 010 的主軸，把現況「唯讀預覽」變成「可實際修改並保存」的可交付 MVP。只實作這一條，使用者就能「改掉生成結果裡的錯字/措辭並存版」，且不需動到 LLM、不需切換器即可獨立交付價值。

**Independent Test**: 給一份含多種 slide / block 的既有 deck，於編輯頁改數個文字欄位、增刪重排幾條 bullet 與一張 slide → 按儲存 → 驗證：(1) DB 新增一筆 `deck_revision`（`origin="edit"`、`revision = base+1`）、`currentRevisionId` 指向新版；(2) 新版 `slideDeck` 反映文字與結構編輯、`html` 為重渲染結果；(3) **保留下來的 slide** 其唯讀塊（chart_placeholder 等）與非編輯欄位（type/layout 等）**與 base 逐欄相同**（取自 base、零篡改）；新增 slide 為純文字、不含結構塊；(4) 文字未變的 bullet 沿用其 `sourceTrace`，改寫/新增的 bullet `sourceTrace` 為空；(5) 重渲染過程**零 LLM 呼叫**。

**Independent Demo**: 不依賴 US2/US3/US4——直接開啟某 deck 的編輯頁，改標題、加一條 bullet、刪一張 slide、把另一張往前移，按儲存，展示預覽更新且 `/decks` 詳情顯示新版本內容；展示某含圖表的 slide 其圖表區為唯讀提示且儲存後（若該張保留）圖表原樣保留。

**Acceptance Scenarios**:

1. **Given** 使用者開啟某 deck 的編輯頁，**When** 在左欄純文字列表點選第 3 張 slide，**Then** 中欄載入該張的可編輯欄位（標題/訊息/條列/講者備註）與結構操作（增刪重排條列、增刪重排 slide），右欄定位到該張預覽。
2. **Given** 使用者修改標題與一條 `outline` 文字，**When** 編輯，**Then** 右欄預覽由 client 端 domain renderer 於 debounce 後本地重渲染反映變更（無網路往返），且其餘 slide 不受影響。
2a. **Given** 使用者按「儲存」成功，**When** server 回傳新 revision 的權威 `html`，**Then** 右欄 iframe 以該 `html` 刷新，且與存檔前的 client 預覽**逐字一致**（同一份 renderer + 同 designPlan，無 parity 漂移）。
3. **Given** 某 slide 含 `chart_placeholder`（或其他非文字結構塊），**When** 檢視該張，**Then** 該塊以唯讀呈現並標示「本期暫不可編輯」，使用者無法改其內容；該張其餘 grounded 欄位仍可編。
4. **Given** 使用者按「儲存」，**When** 重渲染與寫入完成，**Then** DB 新增 `origin="edit"` 的 revision（version +1）、`currentRevisionId` 更新，且新版 `html` 為以 base `designPlan` 重渲染之結果。
5. **Given** 一份含圖表的 deck 被編輯儲存且該圖表所在 slide 被保留，**When** 比對新版與 base 該 slide，**Then** 其唯讀塊與非編輯欄位（type/layout 等）逐欄相同、取自 base、無遺失或被改寫；圖表渲染與 base 一致。
6. **Given** 編輯後的 `slideDeck` 未通過 HTML 生成驗證（如必要欄位被清空、deck 變空），**When** 按儲存，**Then** 系統據實報錯、**不**建立新 revision，並引導使用者修正。
7. **Given** client 的 `baseRevision` 落後於 DB 目前 `currentRevision`（別處剛存了新版），**When** 送出儲存，**Then** 後端回 **409 Conflict**、**不**覆蓋較新版本，前端載入並顯示**目前最新（最近更新）的 revision** 供使用者在其上重做或捨棄編輯（不靜默覆蓋、不靜默丟編輯）。
8. **Given** 一個 stale/惡意 client 在 payload 中改了**保留 slide** 的唯讀塊內容或非編輯欄位（type/layout/layoutIntent）、或對新增 slide 夾帶結構塊，**When** 送出儲存，**Then** 後端（依 slide `id` 對應 base）以 **400 Bad Request 拒絕整個請求**、**不**建立 revision（鎖定 400 拒絕，不採忽略）。
9. **Given** 使用者增/刪/重排了 outline 條列與整張 slide，**When** 儲存，**Then** 新版 `slideDeck` 反映新的條列與 slide 集合/順序；新增 slide 為純文字（title/message/outline/notes、預設 layout、無結構塊）；刪除的 slide 連其圖表一併消失。
10. **Given** 使用者改寫了某條既有 bullet 的文字、並新增了一條 bullet，**When** 儲存，**Then** 該兩條 bullet 的 `sourceTrace` 為空、`emphasis` 為中性預設（不宣稱原始出處）；同 slide 中**未改動**的 bullet 仍沿用其原 `sourceTrace`/`emphasis`。

---

### User Story 2 - 跨 deck 歷史切換器（混合式：搜尋 + 最近 + 瀏覽全部） (Priority: P2)

在**生成頁**與**編輯頁**的 topbar，使用者可開啟一個**跨 deck 歷史切換器**下拉：頂部為搜尋框（依標題即時過濾），中段為「最近 N 份」（N 預設 8、元件常數可調）可直接點選的清單（顯示標題、狀態、更新時間），底部為「📂 瀏覽全部歷史 →」連到 `/decks` 完整列表頁。點選清單中任一份 deck → 直接載入該 deck 進編輯頁（`/decks/:id/edit`）。`/decks` 列表頁升級為「全部歷史」入口（含搜尋）。切換器列出的是**不同份 deck**（沿用 `GET /api/decks`、ownership 隔離），非同一份的版本。

**Why this priority**: 讓使用者在任一工作頁面都能快速切換瀏覽自己的歷史簡報，免去「回首頁 → 進列表 → 再找」的多跳。次於 US1，因為它是「找到並載入要編的 deck」的導覽便利層，需以 US1 的編輯頁為落點。

**Independent Test**: 在生成頁與編輯頁渲染切換器，驗證：(1) 下拉含搜尋框、最近 N 份清單（標題/狀態/更新時間）、「瀏覽全部」連結；(2) 搜尋輸入即時過濾最近清單；(3) 點某份 → 路由到 `/decks/:id/edit` 並載入該 deck；(4) 「瀏覽全部」導到 `/decks`；(5) 資料來源為既有 `GET /api/decks`，無新增後端端點即可達成清單與搜尋（前端過濾）。

**Independent Demo**: 不依賴 US1 的儲存流程——在生成頁打開切換器、搜尋、點一份歷史 deck 載入編輯頁；展示「瀏覽全部」進 `/decks` 列表。

**Acceptance Scenarios**:

1. **Given** 使用者在生成頁，**When** 開啟歷史切換器，**Then** 看到搜尋框 + 最近 N 份（標題/狀態/更新時間）+「瀏覽全部歷史」連結。
2. **Given** 使用者在切換器搜尋框輸入關鍵字，**When** 輸入，**Then** 最近清單依標題即時過濾。
3. **Given** 使用者點選清單中某份 deck，**When** 點選，**Then** 路由切到該 deck 的編輯頁並載入其內容。
4. **Given** deck 數量很多（上限 200），**When** 開啟切換器，**Then** 只在下拉內顯示「最近 N 份」+ 搜尋，其餘導向「瀏覽全部」列表，下拉**不**塞入全部 200 筆。
5. **Given** 使用者在編輯頁且有未儲存變更，**When** 透過切換器切到另一份 deck，**Then** 系統先提醒未儲存變更（沿用 US3 草稿/離開提醒），避免誤丟編輯。

---

### User Story 3 - localStorage 草稿自動暫存與還原 (Priority: P3)

使用者在編輯頁編輯時，系統每 **3 分鐘**把當前編輯狀態暫存到 **localStorage**（`DeckDraft = { deckId, baseRevision, slideDeck, savedAt }`，key 綁 `deckId`），**不**碰 DB、**不**產生版本。當使用者重新進入該 deck 的編輯頁，系統以**具體判定**處理草稿（`currentRevision` 為目前 DB 版本）：**(可還原草稿)** `draft.baseRevision === currentRevision.revision && draft.savedAt > currentRevision.createdAt` → 提示「發現未儲存的編輯，要還原嗎？」供還原/捨棄；**(版本衝突)** `draft.baseRevision !== currentRevision.revision` → 提示草稿基於較舊版本，載入並顯示目前最新 revision（US3 #3）。成功按「儲存」寫入 DB 後，對應草稿被清除。離開頁面（beforeunload）若有未存變更，瀏覽器層級提醒。

**Why this priority**: 防止意外關閉/重整造成編輯遺失，是編輯體驗的安全網。次於 US1/US2，因為它增強既有編輯流程的韌性，而非新增核心能力。

**Independent Test**: 於編輯頁改數欄位 → 觸發暫存（或等待 3 分鐘 timer，測試可注入 timer）→ 重整頁面 → 驗證出現還原提示且選「還原」後恢復未存編輯；按 DB「儲存」後 → 驗證草稿被清；有未存變更時觸發 beforeunload → 驗證提醒。

**Independent Demo**: 不依賴 US2——在編輯頁改幾欄、重整、展示還原提示與還原結果；存 DB 後重整不再提示。

**Acceptance Scenarios**:

1. **Given** 使用者在編輯頁有未存變更，**When** 經過暫存週期（3 分鐘）或手動觸發暫存，**Then** 編輯狀態寫入 localStorage（不產 DB 版本）。
2. **Given** localStorage 有未存草稿，**When** 使用者重新進入該 deck 編輯頁，**Then** 出現「還原未儲存編輯」提示，可選還原或捨棄。
3. **Given** 草稿的 base revision 與目前 DB `currentRevision` 不一致（DB 已被別處更新），**When** 偵測，**Then** 系統據實提示版本衝突（草稿基於較舊版本），**載入並顯示目前最新（最近更新）的 revision**，由使用者決定在最新版上還原其草稿編輯或捨棄，**不**靜默覆蓋。
4. **Given** 使用者成功按 DB「儲存」，**When** 寫入完成，**Then** 對應 localStorage 草稿被清除。
5. **Given** 使用者有未存變更，**When** 關閉/離開頁面，**Then** 觸發離開提醒。

---

### User Story 4 - 局部文字強調（raw px + 色票富文本）(Priority: Post-MVP / Future — 獨立 story set，不在本 feature 第一批 tasks 與驗收)

> **範圍註記**：US4 為 **Post-MVP / Future**。本 feature 第一批交付僅 US1–US3；下列 FR-018/FR-019 與 SC-007 為**條件式需求**，僅在 US4 正式排程時適用，spec→tasks **MUST NOT** 在第一批納入。保留於本 spec 以記錄已對齊的設計決策（資料模型、sanitization、a11y），避免日後重新討論。

使用者在編輯某文字欄位時，**反白選取部分字元** → 浮現浮動工具列 → 設定該段的 **font-size（px）** 與 **文字顏色（色票）**，使「一句話裡其中幾個字變大/變色」。底層文字由 `string` 升級為 **`RichText`（runs + marks）**，marks 含 `{type:"fontSize",value:px}` / `{type:"color",value:hex}`；渲染時每個 run 轉為 `<span>`，且 MUST **allowlist sanitize**（僅允許 `font-size` 的 px 數值與 `color` 的 hex/rgb，擋下其餘 CSS 與 script，防 XSS）。選色若對背景對比不符 WCAG，編輯器**即時警告**（不強制阻擋）。舊資料（純字串）視為「單一 run、無 marks」向後相容。

**Why this priority**: 這是 PowerPoint 式的局部視覺強調，價值高但屬富文本，比純文字 MVP（US1–3）大一階，且牽動資料模型（`string`→`RichText`）、renderer（吐 span）、sanitization 與 a11y。明確排在 US1–3 跑通**之後**，避免一次吃太大。

**Independent Test**: 於某文字欄位選取部分字元設 24px + 紅色 → 驗證：(1) 該欄位的 `RichText` runs 正確切出帶 marks 的片段、其餘片段無 marks；(2) 重渲染輸出僅含 allowlisted `font-size`/`color` 的 `<span>`，注入式 payload（如 `color: red; background:url(...)` 或 script）被 sanitize 擋下；(3) 低對比配色觸發警告；(4) 純字串舊資料渲染與 US1 行為一致（單一 run）。

**Independent Demo**: 不依賴新後端決策——在編輯頁選取一個關鍵數字設大字 + 強調色，儲存後預覽呈現該局部樣式，並展示一個惡意樣式字串被 sanitize 後不生效。

**Acceptance Scenarios**:

1. **Given** 使用者在文字欄位反白選取「30%」，**When** 於浮動工具列設 font-size 24px、color 紅，**Then** 僅「30%」該段帶對應 marks，欄位其餘文字不受影響。
2. **Given** 含 marks 的 `RichText` 被儲存重渲染，**When** 檢視輸出 HTML，**Then** 僅出現 allowlisted `font-size`(px)/`color` 的 inline span，任何其他 CSS 屬性或 script 被移除。
3. **Given** 使用者選的文字色對背景對比不足，**When** 套用，**Then** 編輯器顯示對比警告（WCAG），但不強制阻擋。
4. **Given** 一份 pre-US4 的純字串 deck，**When** 在編輯頁開啟，**Then** 視為單一 run 無 marks，編輯與渲染行為與 US1 一致、無破壞。

---

### Edge Cases

- **deck 無 currentRevision（`status="failed"` 或從未成功渲染）**：編輯頁 MUST 據實呈現「此 deck 無可編輯版本」並禁用編輯/儲存，不得當作空 deck 處理。
- **同一 deck 於多分頁/裝置同時編輯**：採**樂觀並發**——儲存時後端比對 `baseRevision` 與目前 currentRevision，落後即回 **409 Conflict**、不覆蓋（FR-020）；前端載入並顯示目前最新 revision 供使用者重做/捨棄，**非** last-write-wins。localStorage 草稿以 base revision 標記，偵測到 base 與目前 DB 不一致時提示版本衝突（US3 #3）。
- **編輯使必要欄位變空 / `slideDeck` 不合法**：儲存前的 HTML 生成驗證 MUST 擋下並報錯，**不**建立 revision（US1 #6）。
- **重渲染失敗**：surface 錯誤、不建立 revision、保留使用者編輯（含 localStorage 草稿不清）。
- **唯讀塊所在 slide 的其他 grounded 欄位被編輯**：可正常編輯與儲存；該 slide（若保留）唯讀塊取自 base、原樣保留（US1 #5）。
- **stale/惡意 client 篡改保留 slide 的唯讀塊/非編輯欄位，或對新增 slide 夾帶結構塊**：後端 MUST 依 slide id 對應 base、以 **400 拒絕**整個請求、不建立 revision（FR-021、US1 #8）；唯讀保證不得僅靠前端。
- **使用者刪光所有 slide / 某 slide 刪光所有條列與訊息**：HTML 生成驗證 MUST 擋下空 deck / 空 slide（US1 #6），不建立 revision。
- **重排後出現重複文字的 bullet**：sourceTrace 文字比對保真為盡力而為；重複文字條列的溯源對應退化為可接受（不捏造、最差為清空）。
- **缺 `baseRevision` 或型別不符的請求**：MUST 視為無效請求據實報錯（400），不建立 revision。
- **非本人 deck id（`/decks/:id/edit` 直接打別人的 id）**：MUST 回 404 / 拒絕，沿用 006 ownership 隔離，不洩漏是否存在。
- **極長文字 / Unicode / 換行**：文字欄位 MUST 正確保存與渲染（含 CJK、emoji、長段落）。
- **切換器在大量 deck（200 上限）**：下拉只顯示「最近 N + 搜尋」，全部走「瀏覽全部」列表（US2 #4）。
- **未儲存變更時透過切換器跳 deck / 跳路由**：MUST 先提醒（US2 #5 / US3 #5）。
- **localStorage 不可用 / 已滿 / 被清**：暫存失敗 MUST 靜默降級（不影響手動儲存），並在可行時提示「自動暫存暫不可用」。
- **client 端預覽渲染失敗（renderer 拋錯 / 邊界資料）**：右欄 MUST 局部降級（錯誤佔位、不崩潰整頁），不阻斷編輯與儲存；server save 仍以權威 renderer 為準（FR-005a）。
- **(US4) 惡意/超範圍 inline 樣式**：sanitization MUST allowlist，擋下非 `font-size`(px)/`color` 的一切（US4 #2）。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 新增編輯頁路由 `/decks/:id/edit`（受既有 `ProtectedRoute` 保護），以三欄佈局呈現：左 slide 文字導覽、中 結構化文字編輯表單、右 即時預覽。
- **FR-002**: 左欄 slide 導覽 MUST 為**純文字列表**（每列：編號 + 該張 `title`；含唯讀結構塊者加標記），可鍵盤操作、具可見 focus，點選即定位中欄與右欄預覽。**MUST NOT** 引入縮圖渲染。
- **FR-003**: 中欄編輯表單 MUST 讓使用者編輯選取 slide 的 **grounded 可編欄位**：`title`、`message`、`outline[].text`、`speakerNotesDraft`（即現行 `template-html-renderer` 實際渲染的四者）。MUST 另支援**結構編輯**：增/刪/重排 `outline` 條列、增/刪/重排整張 slide。**MUST NOT** 開放編輯 `contentBlocks`（含未被 renderer 讀取的 `paragraph`/`callout`/`quote`/`bullets`(block) 等——編了無視覺效果）。
- **FR-003a（來源忠實）**: 儲存合併時，後端 MUST 對 `outline` 條列：文字未變者沿用其 `sourceTrace`/`emphasis`（依文字比對）；使用者新增或改寫者 MUST 清空 `sourceTrace`、`emphasis` 設中性預設——**MUST NOT** 為人工內容捏造或沿用不相符的來源（CR-001）。
- **FR-004**: `chart_placeholder` 等非文字結構塊與每張的非編輯欄位（`type` / `slideKind` / `layout` / `layoutIntent`）在編輯頁 MUST **唯讀呈現**並標示「本期暫不可編輯」。儲存時其唯讀保證 MUST **由後端強制**（見 FR-021）、**MUST NOT** 僅依賴前端 UI：對**保留下來的 slide**（id 在 base 也有），唯讀塊與非編輯欄位 MUST 取自 server 載入的 base；client 對其之更動 MUST 以 **400 拒絕**（FR-021）；**新增的 slide** MUST 為純文字，夾帶結構塊亦 **400 拒絕**。MUST NOT 在本期提供「改 brief 重生成」捷徑。
- **FR-005**: 按「儲存」時，server MUST 以**確定性重渲染**（沿用 base revision 的 `designPlan`/styleKit、**不呼叫 LLM**）把合併後的 `slideDeck` 渲染成 HTML，並產生對應 `generationSummary`，主題/圖表結果 MUST 與 base 一致（除使用者改動的文字外）。此 server render 為**權威輸出**，存檔成功後前端 MUST 以回傳的 `html` 刷新右欄 iframe。
- **FR-005a（右欄即時預覽路徑）**: 右欄即時預覽 MUST 由 **client 端引入的 deterministic domain renderer（即 `html-deck-renderer` / `template-html-renderer`，與 server save 同一份程式碼）** + base revision 的 `designPlan` 在**本地**渲染工作副本而成，編輯時以 **debounce** 重渲染、**零網路往返、零新增端點**。client 預覽與 server save 因使用**同一份 renderer + 同一 `designPlan` + 同一 `chartIntents` + 工作副本僅含白名單變更（唯讀塊/結構恆取自 base）**，故輸出 MUST 逐字一致（parity）。為此 `GET /api/decks/:id` 的 `currentRevision` MUST 帶出 `chartIntents`（`DeckRevisionContract` 新增欄位，legacy 為 null），供 client 預覽畫圖；client 端對 legacy（null）比照 server 退 fallback。domain renderer **MUST 維持 browser-bundle-safe（無 Node-only 依賴）**；建置端 MUST 補上 `@slides-agent/domain` 的 Vite `resolve.alias`（鏡像既有 tsconfig paths）。client 端預覽渲染若失敗 MUST 局部降級（顯示錯誤佔位、不崩潰整頁），不阻斷編輯與儲存。
- **FR-006**: 儲存 MUST 透過新增的後端能力建立**新 `deck_revision`**：`origin="edit"`、`revision = base+1`、寫入新 `slideDeck` / `html` / `designPlan`（沿用 base）/ `generationSummary` / `chartIntents`（沿用 base，FR-006a），並更新該 deck 的 `currentRevisionId` 與 `updatedAt`；舊版 MUST 保留。寫入 MUST 沿用既有交易模式（原子性：插入 revision → 更新 currentRevisionId）。
- **FR-006a（持久化並取回圖表渲染輸入）**: deterministic renderer 畫真圖需要 `chartIntents: ChartIntent[]`（source facts），其**不在 `slideDeck` 內**且現況的 persisted revision 未保存（`generatePreviewDeck` 有產出，但 `PreviewResult` 與 `createDeckFromPreviewResult` 未帶下去）。**因 chartIntents 的衍生路徑含 LLM（segmentation）且 id 為索引式，無法在編輯時零-LLM 重導出**，故 010 MUST **將 `chartIntents` 持久化於 revision**：(1) 生成路徑 MUST 把 `chartIntents` 從 `generatePreviewDeck` 帶經 `PreviewResult` → `createDeckFromPreviewResult` → revision；(2) 新增 **nullable** `deck_revisions.chart_intents jsonb` 欄位（additive migration，不改既有欄位語意）；(3) 編輯時 `applyDeckEdit` MUST 從 base revision 取回 `chartIntents` 傳給 renderer，使圖表與 base **逐字一致**、零 LLM。**Legacy revision（`chart_intents` 為 null，本欄位之前生成者）**：編輯重渲染 MUST 退回 renderer 的**確定性 fallback**（表格/文字）並以 review note **誠實標示**「無持久化圖表輸入、未重現原圖」，**MUST NOT** 靜默掉圖或謊報已畫圖；一次性 backfill 列為 future（非本批）。
- **FR-007**: 新增後端 endpoint **`POST /api/decks/:id/revisions`**（JWT、ownership 隔離至 `req.user.id`）。請求體 MUST 鎖定為 **`{ baseRevision: number, slideDeck: SlideDeck }`**。處理 MUST 切成兩層、各司其職（沿用既有 `saveNewDeck` 的「domain 產 payload、store 只持久化」分層）：
  - **domain use-case（產生 edit revision payload）**：(1) 經 `store.findByIdForAccount` 載入 base revision 的 slideDeck/designPlan（非本人 deck → 404 `DECK_NOT_FOUND`，不洩漏存在性）；(2) **白名單合併**——依 slide `id` 對應 base，套用使用者可變欄位（文字 + 條列/slide 增刪重排），保留 slide 的唯讀塊/非編輯欄位取自 base（client 篡改 → 400）、新增 slide 須純文字（夾帶結構塊 → 400）、outline 條列依 FR-003a 保真（FR-021）；(3) 對合併後 slideDeck 執行 HTML 生成驗證 + **確定性重渲染** + 組 `generationSummary`，產出**已渲染完成的 `DeckRevision` payload**（`origin="edit"`）。
  - **persistence port（只做交易）**：(4) `store.appendEditRevision(accountId, deckId, expectedBaseRevision, revisionPayload)` 於**單一交易內**做樂觀並發檢查（FR-020）+ append revision（current+1）+ 更新 `currentRevisionId`/`updatedAt`，回傳已存 revision 或 Conflict。
  - (5) controller 將結果轉為 `DeckRevisionContract`（或 409 / 400 / 404 失敗回應，皆 **top-level error shape `{code,message,fields?}`**，沿用既有 `NotFoundException({code,message})` 慣例；409 帶 `currentRevision`）。validate/render/summary **MUST NOT** 落在 persistence port 內。端點 MUST 補進 OpenAPI（`packages/contracts/src/openapi.ts` + `apps/api/src/openapi/openapi-document.ts`）。
- **FR-008**: 編輯後 `slideDeck` 若未通過既有 HTML 生成驗證（必要欄位缺失等），系統 MUST 拒絕儲存、**不**建立 revision，並回據實錯誤（FR-007 的請求驗證 + UI 呈現）。
- **FR-009**: 系統 MUST 在生成頁與編輯頁的 topbar 提供**跨 deck 歷史切換器**：下拉含 (a) 標題搜尋框、(b) **最近 N 份**可點選清單（標題 / 狀態 / 更新時間），**N 預設 = 8**，MUST 以元件常數（如 `RECENT_DECKS_LIMIT`）定義、可單點調整、不得各處硬編不同值；(c)「瀏覽全部歷史 →」連到 `/decks`。清單與搜尋 MUST 以既有 `GET /api/decks` 為資料源（前端過濾），**不**新增後端列表端點。
- **FR-010**: 切換器點選某份 deck MUST 路由至該 deck 的 `/decks/:id/edit` 並載入內容（沿用既有 `GET /api/decks/:id`）。下拉 **MUST NOT** 一次塞入全部 deck（上限 200）；超出最近 N 的瀏覽 MUST 由「瀏覽全部」列表承載。
- **FR-011**: `/decks` 列表頁 MUST 升級為「全部歷史」入口，至少含標題搜尋；每筆 MUST 提供進入該 deck 編輯頁的動作（取代/補強現有唯讀「開啟」）。
- **FR-012**: 切換器列出的單位 MUST 為**不同份 deck**；010 **MUST NOT** 提供同一份 deck 的 revision 版本瀏覽 / 切換 / diff UI（版本資料累積但本期不暴露瀏覽器）。
- **FR-013**: 編輯頁 MUST 每 3 分鐘（或可注入之週期）把當前編輯狀態暫存 localStorage（key 綁 `deckId` + base revision），**不**碰 DB、**不**產版本；localStorage 不可用時 MUST 靜默降級且不阻斷手動儲存。
- **FR-014**: 重新進入編輯頁時，系統 MUST 以具體判定處理 localStorage 草稿：當 `draft.baseRevision === currentRevision.revision && draft.savedAt > currentRevision.createdAt` MUST 提示還原（還原 / 捨棄）；當 `draft.baseRevision !== currentRevision.revision` MUST 視為版本衝突——提示並載入/顯示目前最新 revision、不靜默覆蓋；成功存 DB 後 MUST 清除對應草稿；有未存變更而離開頁面時 MUST 觸發離開提醒。
- **FR-015**: 編輯內容為使用者自撰文字，系統 **MUST NOT** 以 LLM 改寫或「潤飾」編輯結果；重渲染為純確定性轉換。010 **MUST NOT** 引入任何使用者可選的 LLM provider/model 欄位。
- **FR-016**: 010 新增/調整的 `apps/web` UI（三欄編輯器、slide 文字導覽、文字編輯表單、唯讀塊提示、跨 deck 切換器下拉、`/decks` 全部歷史列表）MUST 以 **`ui-ux-pro-max` skill 進行設計**（排版、配色、字體配對、間距、元件樣式、互動與動效），落在既有 React 19 + Tailwind v4 與設計語言上；產出 MUST 符合鍵盤/focus/RWD/reduced-motion 等既有 a11y 約束（FR-017），最終以本 spec 功能與無障礙要求為驗收。
- **FR-017**: 所有新 UI MUST 可鍵盤操作、具可見 focus 樣式、支援既有 i18n（zh-TW/en/ja，文案無缺鍵）、於窄視窗有可用 RWD 降級（三欄可堆疊 / 可切換），動效尊重 `prefers-reduced-motion`。
- **FR-018**（US4 · **Post-MVP / Future**，不在第一批驗收；US4 排程時才適用）: 系統 MUST 支援文字欄位的**局部強調**：選取部分字元設 `font-size`(px) 與 `color`；底層由 `string` 升級為 `RichText`（runs + marks `{type:"fontSize",value:px}` / `{type:"color",value:hex}`），舊純字串視為單一 run 無 marks（向後相容）。
- **FR-019**（US4 · **Post-MVP / Future**，不在第一批驗收；US4 排程時才適用）: 富文本重渲染輸出 inline span 時 MUST **allowlist sanitize**：僅允許 `font-size`(px 數值) 與 `color`(hex/rgb)，移除其餘 CSS 屬性與任何 script/url，防 XSS；低對比配色 MUST 即時對比警告（WCAG，不強制阻擋）。
- **FR-020（樂觀並發控制）**: `POST /api/decks/:id/revisions` 請求 MUST 攜帶 `baseRevision`；後端 MUST 將其與該 deck 目前 `currentRevision.revision` 比對，**不一致** MUST 回 **409 Conflict**（明確 conflict code，回應 MUST 攜帶目前最新 revision 號以利前端定位），並 **MUST NOT** 覆蓋較新版本（防 stale client 蓋掉別處剛存的版本）。前端收到 409 MUST **載入並顯示目前最新（最近更新）的 revision**，由使用者在最新版上重做或捨棄其編輯，**不**靜默覆蓋、**不**靜默丟棄使用者編輯（同時保留 localStorage 草稿待使用者決定）。並發檢查 MUST 在 `DeckStore.appendEditRevision` 的同一交易內進行（傳入 `expectedBaseRevision`，與當下 current revision 比對；避免 read-merge-write 的 TOCTOU 窗口），屬 persistence 責任、非 domain use-case 責任。
- **FR-021（後端白名單合併 / 唯讀與保真強制）**: 後端 MUST 以 server 載入的 base revision 為權威，依 slide `id` 對應後合併出新 slideDeck，規則：
  - **使用者可變（白名單）**：slide 集合（依 `id` 增/刪/重排）、每張 `title` / `message` / `speakerNotesDraft`、`outline` 條列（增/刪/重排 + `text`）。
  - **保留 slide（id 在 base 也有）的伺服器權威欄位**：`contentBlocks`（含 `chart_placeholder` 等唯讀塊）、`type` / `slideKind` / `layout` / `layoutIntent` MUST 取自 base。client payload 若對其有任何更動（與 base 不符）MUST 以 **400 Bad Request 拒絕**整個請求（**鎖定為 400 拒絕，不採「忽略並以 base 為準」**——拒絕較誠實、測試明確）。
  - **新增 slide（id 不在 base）**：MUST 為純文字 slide。payload 若夾帶任何 `contentBlocks`（尤其 `chart_placeholder`）MUST 以 **400 拒絕**（防注入圖表）。其 `type` / `layout` / `layoutIntent` 為 server 權威、無 base 可比對，故由 **server 指派預設值**（client 值不採用，非拒絕情境）；不得引用既有 chartIntent 或生成新圖（不跑 LLM）。
  - **`outline` 條列保真（FR-003a）**：文字未變者沿用 `sourceTrace` / `emphasis`；新增/改寫者清空 `sourceTrace`、`emphasis` 設中性預設。
  如此即使 stale/惡意 client 繞過前端 UI 篡改保留 slide 的唯讀塊/非編輯欄位、或對新增 slide 夾帶圖表，後端亦 MUST NOT 接受。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: 編輯內容為使用者自撰文字，系統 MUST 忠實持久化與渲染、**不得** LLM 改寫；保留 slide 的唯讀結構塊與非編輯欄位 MUST 取自 base、不臆造或補值；新增 slide 為純文字、不夾帶圖表。**溯源忠實**：使用者新增/改寫的 outline 條列 MUST 清空 `sourceTrace`（不宣稱原始出處），未改動者沿用——MUST NOT 捏造或錯掛來源（FR-003a）。重渲染 MUST 忠實反映合併後 `slideDeck`。
- **CR-002 Review Report**: edit revision 沿用 base 的 `reviewReport`（本期不重跑 LLM 審查）；MUST 標示其為 base（pre-edit）審查、不冒充為對編輯後內容的重新審查。HTML 生成驗證（deterministic）MUST 對重渲染結果重跑，渲染層問題 MUST 可見呈現。
- **CR-003 Web-First Output**: 主要交付物為 `apps/web` 的編輯頁與切換器；輸出仍為 web HTML deck。
- **CR-004 Backend-Configured LLM Boundary**: 編輯與重渲染**完全不呼叫 LLM**；無 provider/model 選擇。新增 `POST /api/decks/:id/revisions` 僅做 deterministic 驗證 + 渲染 + 持久化。
- **CR-005 Design System**: 重渲染 MUST 沿用 base revision 的 `designPlan`/styleKit，確保編輯前後**主題一致**；010 不改變設計決策邏輯。
- **CR-006 Semantic Titles**: 標題改為使用者可直接編輯；010 不做自動標題生成（編輯為手動行為），編輯後標題以使用者輸入為準。
- **CR-007 Data Visualization**: 010 不改變「何時成圖」決策；圖表本期唯讀。重渲染畫真圖需 `chartIntents`，故 010 **持久化 chartIntents 於 revision 並於編輯時取回**（FR-006a），使含圖 deck 編輯後圖表與 base 一致；legacy（無持久化）退 fallback + 誠實 review note。
- **CR-008 TDD Coverage**: 每個 user story MUST 有對應測試：US1 編輯→重渲染→存版本（domain + api + web）、唯讀塊保留、驗證擋存、**圖表保真（持久化 chartIntents → 同圖；legacy → fallback+note）**、**client 預覽 vs server save 之 parity（同輸入 → 逐字相同 HTML）**、**錯誤 top-level shape + OpenAPI path**；US2 切換器渲染/搜尋/路由；US3 草稿暫存/還原/衝突/清除；**（Post-MVP）** US4 RichText runs + sanitization + 對比警告。第一批測試僅涵蓋 US1–US3。沿用既有 vitest + Testing Library（+ 視需要 Playwright e2e）。
- **CR-009 Domain Model**: 責任分層 MUST 清楚：(a) **domain use-case `applyDeckEdit`**——白名單合併（依 slide id 對應 base）+ outline 保真 + validate + 確定性 render + summary，產出已渲染的 revision payload（不碰 DB、不跑 LLM）；(b) **persistence port `DeckStore.appendEditRevision`**——只做交易內並發檢查 + append + 更新 `currentRevisionId`（payload opaque、無 render/validate 邏輯，沿用 `saveNewDeck` 慣例）。前端 `EditableSlideDraft`（編輯工作模型）、`DeckDraft`（localStorage 草稿）、`DeckSwitcherItem`（下拉項）；US4 新增 `RichText`/`TextRun`/`TextMark`。**MUST NOT** 改變 `selectTheme`/`composeKit`/chart-intent/規劃等生成決策邏輯。
- **CR-010 Lean Test Scope**: 測試 MUST 聚焦可觀察行為（編輯→欄位映射→重渲染輸出、存版本副作用、切換器互動、草稿生命週期），避免重複測既有 renderer / selectTheme 內部。
- **CR-011 Behavior-Driven Value**: 四個 user story 均附 Given/When/Then 且可獨立展示 / 測試（見上）。
- **CR-012 Code Simplicity**: 範圍邊界明確——可編鎖 grounded 四欄位 + 條列/slide 結構增刪重排、`contentBlocks`（含 chart_placeholder）不開放編輯且 server 權威、確定性重渲染（不跑 LLM）、不做 revision 版本瀏覽器、不做「改 brief 重生成」。富文本（US4）獨立延後。**避免**投機性新增端點（切換器復用既有 list/get）。
- **CR-013 Consistent Language**: 「編輯頁 / 版本(revision) / 草稿 / 切換器 / 唯讀塊 / 確定性重渲染」等關鍵詞 MUST 在 UI、文件、測試間一致，並與 006/007/008/009 術語對齊。
- **CR-014 Performance and Evidence**: 重渲染 MUST 為確定性、低延遲（無 LLM 往返）；右欄 client 端預覽 MUST debounce、本地渲染、不阻塞輸入（零網路往返）；localStorage 暫存 MUST 輕量、不阻塞輸入。client 端 bundle 引入 domain renderer MUST 維持 renderer browser-safe（無 Node-only 依賴）。審查證據 = 自動測試 + 截圖。
- **CR-015 Manual Verification**: 編輯正確性（編輯→預覽→存版本→重開一致、唯讀塊保留、草稿還原、切換器導覽）MUST 有手動檢查路徑（見 Review and Safety Notes）。
- **CR-016 Verification**: 驗收 MUST 涵蓋：新 endpoint 之 ownership 與請求驗證（含 `baseRevision` 必填）、**樂觀並發（baseRevision 落後回 409、不覆蓋）**、**後端白名單合併（依 slide id 對應：保留 slide 唯讀塊/非編輯欄位取自 base、新增 slide 須純文字、對抗性 payload 篡改一律 400 拒絕，保證不依賴前端）**、**結構編輯（條列/slide 增刪重排正確落地）**、**outline 溯源保真（改寫/新增清空 sourceTrace、未改沿用）**、edit revision 之 schema/副作用（version +1 / currentRevisionId / 舊版保留）、重渲染零 LLM、**圖表保真（持久化 chartIntents → 含圖 edit 同圖；legacy → fallback + note）**、**錯誤回應 top-level shape `{code,message,fields?}`**、**OpenAPI 新 path/schema 已補**、切換器渲染/搜尋/路由、草稿生命週期（含衝突時顯示最新版）、**右欄 client 預覽與 server save 之 parity**、新 UI 之鍵盤導覽與基本 RWD。第一批驗收僅 US1–US3；**（Post-MVP）** US4 另含 sanitization 與對比警告，US4 排程時才驗收。

### Key Entities *(include if feature involves data)*

- **EditRevisionRequest（contract，新增）**: `POST /api/decks/:id/revisions` 的請求體，鎖定為 **`{ baseRevision: number, slideDeck: SlideDeck }`**。`baseRevision` 為 client 編輯所基於的版本號（樂觀並發，FR-020）；`slideDeck` 為編輯後內容（含結構變更）。後端**不信任** client 送的保留 slide 唯讀塊/非編輯欄位與新增 slide 的結構塊，依 slide `id` 對應 base 做白名單合併 + outline 保真（FR-021）後再驗證 + 重渲染 + 建立 edit revision。
- **DeckRevisionContract（既有，沿用為回應）**: edit revision 建立後回傳 `{ revision, slideDeck, designPlan, html, generationSummary, origin:"edit", sourceJobId, createdAt }`。
- **applyDeckEdit（domain use-case，新增）**: 純函式/服務，`(base: DeckRevision, edited: SlideDeck) → EditRevisionPayload`——做白名單合併（FR-021）+ outline 保真（FR-003a）+ HTML 生成驗證 + 確定性重渲染（base `designPlan`）+ 組 `generationSummary`，產出**已渲染完成**的 revision payload（`{ slideDeck, designPlan, html, generationSummary, origin:"edit", sourceJobId:null }`）。**不**碰 DB、**不**呼叫 LLM。驗證失敗 → 回錯誤、不產 payload。
- **DeckStore.appendEditRevision（persistence port，新增方法）**: `(accountId, deckId, expectedBaseRevision, revisionPayload) → { revision: DeckRevision } | Conflict`；**只負責持久化**——於**單一交易內**做樂觀並發檢查（current revision 須等於 `expectedBaseRevision`，否則 Conflict，FR-020）+ append revision（current+1）+ 更新 `currentRevisionId`/`updatedAt`，沿用既有 ownership 與原子性。`revisionPayload` 為 use-case 產好的 opaque payload（port 邊界維持 `unknown`，沿用 `saveNewDeck` 慣例）；port **MUST NOT** 含 validate/render/summary 邏輯。
- **EditableSlideDraft（前端工作模型）**: 編輯頁載入 deck 後的可變工作副本——含可編 grounded 欄位、條列與 slide 集合（支援增刪重排），以及原樣攜帶（唯讀呈現）的 `contentBlocks` 與非編輯欄位（保留 slide 用，送回後端供 id 對應）。右欄預覽與儲存皆讀此。
- **DeckDraft（localStorage 草稿）**: `{ deckId, baseRevision: number, slideDeck, savedAt: string }`，每 3 分鐘暫存。還原判定（FR-014）：`baseRevision === currentRevision.revision && savedAt > currentRevision.createdAt` → 可還原；`baseRevision !== currentRevision.revision` → 版本衝突。存 DB 後清除。
- **DeckSwitcherItem（前端）**: 來自 `DeckSummaryContract` 的下拉項（`id` / `title` / `status` / `updatedAt`），供切換器最近清單與搜尋過濾。
- **RichText / TextRun / TextMark（US4，新增）**: 文字欄位由 `string` 升級為 `TextRun[]`，`TextRun = { text, marks?: TextMark[] }`，`TextMark = { type:"fontSize", value:number(px) } | { type:"color", value:string(hex) }`；舊純字串 = 單一 run 無 marks。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用者在編輯頁修改文字並按儲存後，DB 100% 出現一筆 `origin="edit"`、`revision=base+1` 的新版本，`currentRevisionId` 指向新版，新版 `html` 為以 base `designPlan` 重渲染、含編輯後文字之結果（自動測試覆蓋 domain + api）。
- **SC-002**: 經編輯儲存後，**保留 slide** 的唯讀塊與非編輯欄位（type/layout 等）與 base **逐欄相同**（取自 base、零篡改）；新增 slide 不含結構塊；改寫/新增的 outline 條列 `sourceTrace` 為空、未改動者沿用——以自動測試（含對抗性 payload）+ 抽樣手動比對驗證。
- **SC-002a（圖表保真）**: 對**有持久化 `chartIntents`** 的 revision，含圖 slide 經編輯儲存後重渲染的圖表（visualKind / 資料 / fallback）與 base **逐字一致**、過程零 LLM；legacy（`chart_intents` null）則據實退回 fallback 並標 review note，不謊報（自動測試：含圖 deck edit → 同圖；legacy → fallback + note）。
- **SC-003**: 編輯與重渲染流程**零 LLM 呼叫**（以無外呼/可注入渲染器驗證），確定性可重現（相同編輯輸入 → 相同 HTML）；**client 端右欄預覽與 server save 輸出對同一工作副本逐字一致**（parity 測試），右欄即時預覽**零網路往返、零新增端點**。
- **SC-004**: 跨 deck 切換器在生成頁與編輯頁皆可用：顯示最近 N + 搜尋 + 瀏覽全部；搜尋即時過濾；點選載入對應編輯頁；資料源為既有 `GET /api/decks`、**零新增列表端點**（自動測試 + 手動）。
- **SC-005**: localStorage 草稿每 3 分鐘暫存且不產 DB 版本；重新進入能還原未存編輯、偵測版本衝突、存 DB 後清除草稿（自動測試 + 手動）。
- **SC-006**: 所有新 UI 文案於 zh-TW/en/ja 三語完整無缺鍵；編輯器與切換器通過鍵盤導覽與 WCAG AA 對比檢查；窄視窗有可用 RWD 降級。
- **SC-007**（US4 · **Post-MVP / Future**，不在 MVP 第一批驗收）: 局部強調僅輸出 allowlisted `font-size`(px)/`color` 的 inline span，注入式樣式/script 100% 被 sanitize 擋下；低對比配色觸發警告；pre-US4 純字串 deck 行為不變（自動測試）。
- **SC-008（後端強制）**: 後端對 `POST /api/decks/:id/revisions` 100% 強制：(a) `baseRevision` 落後回 **409**、不覆蓋較新版本；(b) client 篡改保留 slide 唯讀塊/非編輯欄位或對新增 slide 夾帶結構塊時，回 **400**、不建立 revision；二者皆以自動測試（含對抗性 payload）驗證，唯讀與並發保證不依賴前端。

## Assumptions

- **持久化地基沿用 006**: `decks` / `deck_revisions` schema（含 `origin` 欄位、多版本、`currentRevisionId`、ownership index）與既有 `DeckStore`（`saveNewDeck` / `listByAccount` / `findByIdForAccount`）為基礎。010 **新增 domain use-case `applyDeckEdit`（產 payload）+ persistence port 方法 `appendEditRevision`（只持久化）+ 一個 endpoint**，沿用 `saveNewDeck` 既有「domain 產 payload、store 持久化」分層（payload opaque）。**唯一 schema 變更為一個 additive nullable 欄位 `deck_revisions.chart_intents jsonb`（FR-006a）**，不改既有欄位語意。
- **重渲染復用既有 renderer**: 以 `html-deck-renderer` / `template-html-renderer` 對編輯後 `slideDeck` + base `designPlan` 做確定性渲染；不新增渲染引擎、不改渲染決策邏輯。**同一份 renderer 同時供 client 端右欄預覽與 server save 使用**（單一渲染真實來源、保證 parity）。
- **domain renderer 為 browser-safe**: 已查證 rendering/design/content-core/shared 依賴鏈零 Node-only 依賴，`apps/web/tsconfig.json` 已配 `@slides-agent/domain` path alias。client 端引入僅需補 Vite `resolve.alias`；後續若有人在 renderer 依賴鏈引入 Node-only 依賴，MUST 視為破壞性變更（CR-014）。
- **切換器零新後端端點**: 最近清單與搜尋以既有 `GET /api/decks`（≤200 筆）前端過濾達成；載入以既有 `GET /api/decks/:id`。
- **合約邊界**: 新增**唯一**寫入端點 `POST /api/decks/:id/revisions`（edit revision）；request 鎖定為 `{ baseRevision, slideDeck }`（樂觀並發 + 後端白名單合併，唯讀塊/結構不信任 client），response 沿用 `DeckRevisionContract`（**新增 `chartIntents` 欄位**，亦用於 `GET /api/decks/:id`），失敗為 **top-level error shape**：**409**（base 落後，帶 currentRevision）/ **400**（缺 baseRevision / 篡改 / 驗證失敗）/ **404**。新端點 MUST 補 OpenAPI（contracts schema + openapi-document path）。既有 request/response 合約其餘不變。
- **不跑 LLM**: 編輯、重渲染、存版本全程不呼叫 LLM；無 provider/model 選擇；`reviewReport` 沿用 base（標示 pre-edit）。
- **沿用既有前端基礎**: React 19 + React Router 7 + Vite + Tailwind v4 + 既有 i18n + 既有 `ProtectedRoute` / `decks-client` / 預覽 iframe 呈現；新引入 **client 端 domain renderer**（右欄預覽，路徑 A）需補 Vite `resolve.alias`，但不引入新前端框架或圖表套件。US4 之富文本編輯器（如 contentEditable 方案）於該階段再評估具體實作，不在 US1–3 引入。
- **認證/權限不變**: 沿用既有登入與 `accountId` ownership 隔離；010 不變更帳號範圍或權限模型。
- **版本瀏覽延後**: edit revision 會累積歷史，但本期**不**提供 revision 版本瀏覽/還原/diff UI；「改 brief 重跑 LLM 重生成」亦延後。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: edit revision 的 `reviewReport` 為 base（pre-edit）審查、非對編輯後內容的重新 LLM 審查，MUST 對使用者/審查者誠實標示。
- **Omitted or Compressed Content Policy**: 010 不壓縮/省略內容；唯讀結構塊原樣保留，不在編輯層改寫或刪減。
- **Uncertain Claims Policy**: 重渲染 MUST 忠實反映編輯後 `slideDeck`，不臆造唯讀塊資料、不冒稱已重新 LLM 審查；驗證失敗時據實報錯、不建立版本。
- **Sensitive Content Handling**: 010 **不**把編輯內容送往 backend-configured LLM（無 LLM 往返）；編輯內容僅在使用者帳號範圍內持久化（ownership 隔離），localStorage 草稿僅存於使用者本機。
- **Evidence and Traceability**: 審查證據 = 自動測試（編輯→重渲染→存版本副作用、唯讀塊保真、零 LLM、切換器互動、草稿生命週期；**（Post-MVP）** US4 sanitization）+ 三語文案檢查 + 截圖 / 抽樣手動比對「編輯後預覽 vs 重開後 deck」。
- **Manual Verification Path**: 手動開啟某 deck 編輯頁，改標題/訊息/條列/講者備註、增刪重排幾條 bullet 與一張 slide，存檔後重開驗證一致且版本 +1、舊版仍在；**比對存檔前右欄 client 預覽與存檔後 server 回傳 iframe 是否逐字一致（parity）**；驗證含圖表的 slide 其圖表區唯讀、該張若保留則圖表原樣保留、新增 slide 為純文字無圖；抽查改寫過的 bullet 其溯源已清空、未改的仍在；重整觸發草稿還原與版本衝突提示；於生成頁與編輯頁開切換器搜尋並載入另一份 deck；在 zh-TW/en/ja、窄視窗、reduced-motion 下各檢一輪；（US4 階段）驗證局部 px/色票強調與惡意樣式被 sanitize。
