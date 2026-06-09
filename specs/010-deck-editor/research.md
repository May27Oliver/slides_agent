# Research: Deck 編輯頁（010，第一批 US1–US3）

關鍵技術抉擇與查證結果（細節決策見 spec Clarifications）。

## R1 右欄即時預覽 = client 端跨 domain renderer（路徑 A）

**查證**：`packages/domain/src/rendering`/`design`/`content-core`/`shared` 依賴鏈 **零 Node-only 依賴**（無 `fs`/`path`/`crypto`/`node:`/`Buffer`/`process`），renderer 為純函式（`slideDeck` + `designPlan` → HTML/SVG 字串）→ **browser-bundle-safe**。`apps/web/tsconfig.json` 已配 `@slides-agent/domain` path alias。

**決策**：右欄用 client 端引入**同一份** `html-deck-renderer`/`template-html-renderer` + base `designPlan` 本地 debounced 重渲染（零網路、零新端點）；save 由 server 用同一份 renderer 權威重渲染並回傳 `html` 刷新校正。**parity** 由「同 renderer + 同 designPlan + 工作副本只含白名單變更」保證。建置需補 Vite `resolve.alias`。

**拒絕**：debounced 端點（每次編輯網路延遲 + 新端點）；結構化草稿預覽（非真 WYSIWYG）。

**風險**：日後 renderer 依賴鏈若引入 Node-only 依賴會破壞 client bundle → 視為破壞性變更（CR-014），以 parity 測試 + bundle 守門。

## R2 渲染面：renderer 只渲染 grounded 四欄位

**查證**：`renderSlide`（`template-html-renderer.ts`）只渲染 `slide.title`/`slide.message`/`slide.outline[].text`（bullets，chart-split 時濾掉與圖表重複的條列）/`slide.speakerNotesDraft`（隱藏 notes 層，`html-generation-validator` 強制 html 含 notes）；`contentBlocks` **只讀 `chart_placeholder`**（其餘 kind `continue` 跳過）。compiler 只產 `bullets`(來自 outline)+`chart_placeholder`。

**決策**：可編白名單 = 該四欄位；其他 contentBlocks kind 不開放編輯（編了無效果）。

## R3 寫入分層 = 沿用 `saveNewDeck` 的「domain 產 payload、store 持久化」

**查證**：`DeckStore` 為 persistence port，`saveNewDeck(deck: Deck)` 收**已備妥**的 payload（含已渲染 revision），store 只持久化；payload 在 port 邊界為 opaque `unknown`（`deck.types.ts`）。

**決策**：新增 **domain use-case `applyDeckEdit`**（merge→validate→render→summary→payload）+ **port `appendEditRevision`**（交易內並發 + append + 更新 currentRevisionId）。port 不含 render/validate。

## R4 並發 = 樂觀鎖（baseRevision → 409），不採 last-write-wins

**決策**：request 帶 `baseRevision`；`appendEditRevision` 在**同一交易內**比對目前 currentRevision，落後 → 409（避免 read-merge-write 的 TOCTOU）。前端收 409 → 顯示最近更新的 revision。

## R5 結構編輯下的篡改處置 = 鎖 400 拒絕

**決策**：保留 slide 唯讀塊/非編輯欄位被改、新增 slide 夾帶結構塊 → **400 拒絕整個請求**（誠實、測試明確），不採「忽略並以 base 為準」。新增 slide 的 type/layout 無 base 可比對 → server 指派預設（非拒絕情境）。

## R6 outline 保真 = 文字比對保留 + 改過清空（不加 schema id）

**決策**：未改動條列依文字比對沿用 `sourceTrace`/`emphasis`；新增/改寫清空 `sourceTrace`、`emphasis` 中性。不為 `SlideOutlineItem` 加 id（避免動 schema/planner/compiler）。重複文字 FIFO 對應、退化可接受。

## R7 切換器 = 復用 GET /api/decks，最近 8 + 前端搜尋

**決策**：零新後端端點；`RECENT_DECKS_LIMIT=8`（元件常數）；搜尋為前端 `title` 過濾全量（≤200）；超出走「瀏覽全部」`/decks`。
