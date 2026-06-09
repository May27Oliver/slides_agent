# Contract: POST /api/decks/:id/revisions（建立 edit revision）

**用途**：對既有 deck 套用編輯（文字 + 結構），以確定性重渲染建立新 revision（`origin="edit"`）。第一批 US1。

**Auth**：JWT（沿用既有 middleware）。Ownership 隔離至 `req.user.id`。

## Request

`Content-Type: application/json`

```ts
// body
{
  baseRevision: number;   // client 編輯所基於的版本號
  slideDeck: SlideDeck;   // 編輯後 slideDeck（含結構變更）
}
```

驗證（依序，全在後端）：
1. body schema（`baseRevision` 為非負整數、`slideDeck` 結構合法）— 否則 **400 `INVALID_EDIT`**。
2. deck 存在且屬 `req.user.id` — 否則 **404 `DECK_NOT_FOUND`**（不洩漏存在性）。
3. **白名單合併**（`applyDeckEdit` → `slide-merge`，data-model §3/§4）：保留 slide 唯讀塊/非編輯欄位篡改、新增 slide 夾帶結構塊 → **400 `INVALID_EDIT`**。
4. **HTML 生成驗證**（合併後）失敗（空 deck、必要欄位缺）→ **400 `INVALID_EDIT`**。
5. **樂觀並發**（`appendEditRevision` 交易內）：`baseRevision !== currentRevision.revision` → **409 `REVISION_CONFLICT`**。

## Responses

### 201 Created（成功）

```ts
// = 既有 DeckRevisionContract
{
  revision: number;            // base + 1
  slideDeck: unknown;          // 合併後
  designPlan: unknown | null;  // 沿用 base
  html: string;                // 重渲染
  generationSummary: unknown | null;
  origin: "edit";
  sourceJobId: null;
  createdAt: string;
}
```
副作用：deck `currentRevisionId` 指向新版、`updatedAt` 更新；舊版保留。

> 註：`DeckRevisionContract` 本批新增 `chartIntents: ChartIntent[] | null`（FR-006a/C1），同時用於 **`GET /api/decks/:id` 的 `currentRevision`**（供 client 預覽畫圖）與本端點回應。legacy revision 為 null。

> 錯誤回應採**既有 top-level error shape**（對齊 `NotFoundException({code,message})` 與 `openapi.ts` 的 `errorSchema = { code, message, fields? }`）。**不**用巢狀 `{ error: {...} }`（I1）。

### 409 Conflict

```ts
{ code: "REVISION_CONFLICT", message: string, currentRevision: number }
```
前端據此載入並顯示目前最新 revision（US1 #7 / US3 #3），不靜默覆蓋。

### 400 Bad Request

```ts
{ code: "INVALID_EDIT", message: string, fields?: string[] }
```
篡改唯讀塊/結構、新增 slide 夾帶結構塊、缺 `baseRevision`、驗證失敗。**不建立 revision**。

### 404 Not Found

```ts
{ code: "DECK_NOT_FOUND", message: string }
```

## OpenAPI 註冊（C2，本 repo 慣例：手動補）

此端點 MUST 手動補進 OpenAPI：
- `packages/contracts/src/openapi.ts`：新增 request schema（`EditRevisionRequest`）、沿用 `DeckRevisionContract` response schema、以 `errorSchema([...], example)` 定義 409/400/404 error schema。
- `apps/api/src/openapi/openapi-document.ts`：在 `paths` 加 `"/api/decks/{id}/revisions": { post: {...} }`（tag `decks`，含 201/400/401/404/409 回應）。
- 加 OpenAPI smoke/schema 測試確認 document 可建且含新 path。

## 不變式

- 端點**不呼叫 LLM**；重渲染為 deterministic（沿用 base `designPlan`）。
- 唯讀/並發/保真保證**全在後端**，對抗性 payload 亦擋下。
- request 之 `slideDeck` 中的唯讀塊/結構**不被信任**——保留 slide 一律以 base 為準（id 對應）。

## 契約測試（`packages/contracts/test/edit-revision.test.ts` + `apps/api/test/decks-controller.edit-revision.test.ts`）

- 合法編輯 → 201 + revision=base+1 + currentRevisionId 更新。
- `baseRevision` 落後 → 409 + currentRevision 號。
- 篡改保留 slide 唯讀塊 / 新增 slide 夾帶 chart_placeholder → 400、無 revision。
- 缺 `baseRevision` → 400。
- 別人 deck id → 404。
- 合併後空 deck → 400。
