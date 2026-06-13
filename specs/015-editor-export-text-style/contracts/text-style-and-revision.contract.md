# Contract: edit revision 攜帶 `outline.id` + `textStyleOverrides`（015）

**用途**：在 010 的 edit revision 端點上，讓投影片文字欄位攜帶穩定 id 與文字樣式覆寫。**無新端點、無新 request 欄位**——`outline.id` 與 `slide.textStyleOverrides` 隨既有 `slideDeck` 一起送，由白名單合併權威驗證。文字編輯（010）、換主題（011）、圖表操作（014）、文字樣式（015）可同請求並存，產生單一新 revision。

**Auth / Ownership / 並發**：全部沿用 010（JWT、`accountId` 隔離、`baseRevision` 樂觀並發 409）。

## Request（`POST /api/decks/:id/revisions`）

`Content-Type: application/json`

```ts
{
  baseRevision: number;
  slideDeck: SlideDeck;          // 015：slide.outline[].id 與 slide.textStyleOverrides 隨此送
  themeSelection?: ThemeSelectionContract;   // 011，不變
  chartOperations?: ChartOperation[];        // 014，不變
}
```

新增的 `SlideDeck` 內部 optional 欄位（型別見 data-model §1/§2）：

```ts
SlideOutlineItem.id?: string                 // slide 內唯一、不透明
Slide.textStyleOverrides?: {
  title?:   { sizePx?: number; color?: string; fontFamily?: string }
  message?: { sizePx?: number; color?: string; fontFamily?: string }
  outlineById?: Record<outlineItemId, { sizePx?: number; color?: string; fontFamily?: string }>
}
//   sizePx: 絕對 px，範圍 8–240
//   color:  自由 hex "#RRGGBB"
//   fontFamily: 內建字型目錄名稱，≤64 字
```

## 驗證（依序，全在後端）

1. **contracts 形狀驗證**（`validateEditRevisionRequest` / schema / `validateOverrideShape`）：
   - `outline[].id` 若存在，為非空字串；
   - `textStyleOverrides` 若存在，每個 `TextStyleOverride`：`sizePx` 為 8–240 數值、`color` 符合 `/^#[0-9a-fA-F]{6}$/`、`fontFamily` 符合 charset `/^[A-Za-z0-9][A-Za-z0-9 -]*$/` 且 ≤64 字；`outlineById` 為物件、至多 100 entries、值為合法 `TextStyleOverride`；
   - 越界（數值超範圍 / hex 不合 / 字型不合或過長 / entries 超量）→ **400 `INVALID_EDIT`**。（數值範圍 + hex regex + 字型白名單/長度 + entries 上限封住 DoS）
2. deck 存在且屬 `req.user.id` → 否則 **404 `DECK_NOT_FOUND`**（010，不變）。
3. **白名單合併**（`mergeEditedDeck`，015 擴充）：
   - `outline` 經 `mergeOutline`：**id 走 edited 權威帶入**、`sourceTrace/emphasis` 仍走 text-FIFO 還原（fidelity 不變）；
   - `textStyleOverrides` 納入可編輯白名單，經 `normalizeTextStyleOverrides`（以相同 sizePx/color/fontFamily 規則重驗，不信任跨層輸入）：丟棄空 / 越界 property、丟棄不對應現存 outline id 的孤兒 key；
   - `contentBlocks/type/slideKind/layout/layoutIntent` 唯讀牆**不變**（篡改 → 400 `INVALID_EDIT`）。
4. 圖表操作（014 `applyChartOperations`）→ 不變。

## Response

沿用 010：成功 **201** 回新的 `DeckRevisionContract`（含 `revision`、`html`、`slideDeck`…）。`html` 已套用文字樣式覆寫（domain renderer 注入，與 client LivePreview parity）。

## 不變式

- **parity**：client `renderLivePreview`（`applyDeckEdit`）與 server 存檔同一 renderer → 樣式呈現結構上一致。
- **immutability**：舊 revision 不被回寫；id 僅在「下一次 Save 產生的新 revision」中持久化。
- **向後相容**：缺 `id`/`textStyleOverrides` 的舊 revision 照 010/011/014 行為運作，零退化。
