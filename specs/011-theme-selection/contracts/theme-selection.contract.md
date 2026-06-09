# Contracts: 主題庫手動選擇（011）

## 1. `GET /api/themes` — 瀏覽主題庫

**Auth**：JWT（沿用既有 middleware）。唯讀；非帳號相關（builtin 主題庫，全使用者共用）。

**Response 200** = `ThemeCatalogResponseContract`（data-model §5）：
```ts
{
  font: BrowsableTheme[];      // 57
  palette: BrowsableTheme[];   // 96
  style: BrowsableTheme[];     // 67（排除 support='raw'）
}
```
- 每筆 `BrowsableTheme = { id, kind, name, description?, keywords[], styleKit }`。
- `styleKit` = 該軸**完整 partial DesignStyleKit**（= `SelectableTheme.styleKit`）。**回傳完整 partial（非 swatch 縮減）**,因為編輯頁需 client `composeKit` + 即時重渲染（data-model §5 裁決）;swatch 由 client 從 styleKit 萃取。
- **安全（F6 措辭）**：此為 **trusted builtin partial kit**（007 `seedThemes` 已驗證），端點**不另做執行期 sanitize**;render/client 在**使用邊界 escape**（與 007/008 同路徑）。
- 排序沿用 `listSelectable` 的穩定 id 排序。**本批回完整 `{font,palette,style}`,不做 `?kind=`**（YAGNI；future 若 payload 過大再加，維持同回應物件、非請求軸回 `[]`）。

**不變式**：不呼叫 LLM；不依帳號過濾；資料源為既有 `themes` 表（active=true、applies_to in presentation/universal、style 排除 raw）。回傳的是 builtin、已驗證、伺服器自身 render 用的同一份 tokens。

## 2. `POST /api/slides/preview-jobs`（與 sync `/preview`）— 加 themeSelection

**Request**（既有 + 新增頂層 optional 欄位）：
```ts
{
  sourceContent: string;
  deckBrief: DeckBriefContract;
  themeSelection?: { fontId?: string; paletteId?: string; styleId?: string };
}
```
- 後端 render 階段：`const baseline = selectTheme(brief, candidates); const { selectedTheme, warnings } = applyThemeSelection(baseline.ids, themeSelection, candidates)`（data-model §2/§3）。
- **無 themeSelection → 行為與現況 100% 相同**（關鍵字 selectTheme）。
- 指定主題**不增加 LLM 呼叫**（render 後段套用）。
- 驗證：`themeSelection` 若提供，三個欄位皆 optional string；**非法型別 → 既有 400**；型別合法但 id 解析不到 → **該軸退預設**（非 baseline）+ `themeSelectionWarnings`（下方）。

**Response**：沿用既有 `GeneratePreviewResponseContract`，其 `generationSummary` **新增** `themeSelectionWarnings: ThemeSelectionWarning[]`（data-model §8；`[]` = 全照指定套用）。前端據此誠實提示「指定主題已停用,退回自動」。

## 3. `POST /api/decks/:id/revisions`（010 編輯端點）— 加 themeSelection

**Request**（010 既有 + 新增 optional）：
```ts
{
  baseRevision: number;
  slideDeck: SlideDeck;
  themeSelection?: { fontId?: string; paletteId?: string; styleId?: string };
}
```
- 帶 `themeSelection` → `applyDeckEdit` 依 **data-model §4 演算法**重組 styleKit：base 三軸用 catalog 還原 + 使用者覆寫指定軸 + composeKit;只換 styleKit,文字/結構/chartIntents 沿用 base。
- 無 `themeSelection` → 010 現況（沿用 base designPlan/styleKit）。
- 回應沿用 `DeckRevisionContract`（新版 `selectedTheme` 三軸 id 反映換後主題）;其 `generationSummary.themeSelectionWarnings` 帶 base 軸無法 resolve / 指定 id 無效的證據（§8）。
- 不變式：**不呼叫 LLM**；唯讀塊/並發/保真保證沿用 010。

## 4. OpenAPI

- `packages/contracts/src/openapi.ts`：新增 `THEME_CATALOG_RESPONSE_SCHEMA`、`THEME_SELECTION_SCHEMA`（三 optional id），request schema 補 `themeSelection`。
- `apps/api/src/openapi/openapi-document.ts`：加 `"/api/themes": { get }`；preview/edit request body 補 `themeSelection`。
- 加 smoke 測試（document 可建 + 含 `/api/themes`）。

## 契約 / 單元測試

- `applyThemeSelection`（回 `{ selectedTheme, warnings }`）：① 只覆寫 palette → font/style 由 baselineIds 從 candidates 解析保留；② 三軸全覆寫 → ids 全為所選、warnings=[]；③ 覆寫不存在 id → 該軸退預設 + `warnings:[{axis,requestedId,reason:"invalid_id"}]`；④ baseIds 某軸不可解析（編輯）→ `base_unresolved`；⑤ 無 selection 且 baseline 全可解析 → 等同 baseline、warnings=[]；⑥ 零 LLM（純函式）。
- `GET /api/themes`：回三軸、各筆含 **name + 完整 partial `styleKit`**、JWT 保護；回傳的 partial kit **可被 `composeKit` 直接接受**（無需 shim）。
- preview/edit request 帶 themeSelection → 套用正確 + `generationSummary.themeSelectionWarnings` 反映 fallback；不帶 → 現況不變。
