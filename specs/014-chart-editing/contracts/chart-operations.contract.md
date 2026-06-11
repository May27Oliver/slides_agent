# Contract: POST /api/decks/:id/revisions — `chartOperations` 擴充（014）

**用途**：在 010 的 edit revision 端點上，以結構化操作清單編輯圖表（換視覺、移除、新增、編輯數據）。**無新端點**——擴充既有 request body；文字編輯（010）、換主題（011）、圖表操作（014）可同請求並存，產生單一新 revision。

**Auth / Ownership / 並發**：全部沿用 010（JWT、`accountId` 隔離、`baseRevision` 樂觀並發 409）。

## Request

`Content-Type: application/json`

```ts
{
  baseRevision: number;
  slideDeck: SlideDeck;                  // 010：client 仍原樣 echo contentBlocks（唯讀牆不變）
  themeSelection?: ThemeSelectionContract;   // 011，不變
  chartOperations?: ChartOperation[];        // 014 新增，缺/[] = 現行行為
}
```

`ChartOperation`（完整型別見 data-model §3）：

```ts
  | { op: "set_visual";  chartIntentId: string; visual: "auto"|"pie_donut"|"line"|"bar"|"metric_card"|"table" }
  | { op: "remove_chart"; slideId: string; chartIntentId: string }
  | { op: "add_chart";   slideId: string; source:
        | { kind: "existing_intent"; chartIntentId: string }
        | { kind: "user_data"; title: string; visual: ChartVisualOverride;
            points: Array<{ label: string; valueText: string; unit: string | null }> } }
  | { op: "edit_data";   chartIntentId: string; title?: string; points: Array<
        | { kind: "original"; sourceFactId: string }
        | { kind: "user"; point: { label: string; valueText: string; unit: string | null };
            replacesFactId?: string } > }
```

## 驗證（依序，全在後端）

1. **contracts 形狀驗證**（`validateEditRevisionRequest`）：`chartOperations` 為陣列、長度 ≤ 50、每項 `op` 為四值之一、各 op 必要欄位型別正確 → 否則 **400 `INVALID_EDIT`**。
2. deck 存在且屬 `req.user.id` → 否則 **404 `DECK_NOT_FOUND`**（010，不變）。
3. 白名單合併（010 `mergeEditedDeck`，不變）→ 篡改 **400 `INVALID_EDIT`**。
4. **`applyChartOperations` 語意驗證**（014，domain；任一違規 → **400 `INVALID_EDIT`**、零部分套用、`message` 指明第幾個 op）：
   - base `chartIntents` 為 null 且 operations 非空（legacy 防護）
   - 引用的 `slideId` 不在 merged deck／`chartIntentId` 不在（前序套用後）intents 集合
   - `add_chart` 對 `slideKind === "opening"`；目標 slide 已有 `chart_placeholder`（每頁上限 1）
   - `remove_chart` 該 slide 無此 placeholder
   - `edit_data` 的 `original.sourceFactId` 不屬該 intent（前序操作套用後）的 sourceFacts／同清單重複引用
   - user 點：label trim 空、`valueText` 不符 `/^-?\d+(\.\d+)?$/`、解析非有限、欄位超長（label/title 120、unit 16、valueText 32）、點數 > 12、`title` trim 空
5. HTML 生成驗證（010，不變）→ **400**。
6. 樂觀並發（010，不變）→ **409 `REVISION_CONFLICT`**。

## Responses

### 201 Created（成功，010 shape 不變＋summary 擴充）

```ts
{
  deck: DeckSummary,
  revision: DeckRevisionContract   // origin: "edit"
  // revision.designPlan.chartTreatmentPlans[].visualOverride?  ← 014 衍生
  // revision.chartIntents ← 衍生 intents（含 user_provided facts）
  // revision.generationSummary.userDataDisclosures: UserDataDisclosure[]  ← 014 新欄位（always present）
}
```

### 400 `INVALID_EDIT` ／ 404 ／ 409（shape 沿用 010）

## 不變式（contract 測試錨點）

- `chartOperations` 缺席或 `[]` → response 與 010/011 現行逐欄位相同，**唯一例外**為新增的 always-present 欄位 `generationSummary.userDataDisclosures: []`；`reviewReport`/`html` 零 delta。
- contracts 公開面（`GenerationSummaryContract`／`openapi.ts`／`slide-generation.schema.json`）與 domain 型別同步擴充（`visualOverride`、`userDataDisclosures`、`SourceFact.metric`/`replacesFactId`/`user_provided`）——schema 各物件 `additionalProperties: false`，漏加即測試失敗。
- 同一 body 在 client（`renderLivePreview`）與 server 各跑一次 → `html` 與所有衍生 id **byte-for-byte 一致**。
- 對抗性矩陣（spec SC-007 全清單）→ 100% 400 且 DB 無新 revision。
