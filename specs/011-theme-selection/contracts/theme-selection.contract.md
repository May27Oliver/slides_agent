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
- 每筆 `BrowsableTheme = { id, kind, name, description?, keywords[], swatch }`。
- `swatch` 僅含安全投影（colors hex / fontFamilies / googleFontsHref / styleLabel）——**不回傳整包 styleKit、不含可注入 CSS**。
- 排序沿用 `listSelectable` 的穩定 id 排序（`00`-前綴安全預設排前）。

**不變式**：不呼叫 LLM；不依帳號過濾；資料源為既有 `themes` 表（active=true、applies_to in presentation/universal、style 排除 raw）。

## 2. `POST /api/slides/preview-jobs`（與 sync `/preview`）— 加 themeSelection

**Request**（既有 + 新增頂層 optional 欄位）：
```ts
{
  sourceContent: string;
  deckBrief: DeckBriefContract;
  themeSelection?: { fontId?: string; paletteId?: string; styleId?: string };
}
```
- 後端 render 階段：`applyThemeSelection(selectTheme(brief), themeSelection, candidates)`（data-model §2/§3）。
- **無 themeSelection → 行為與現況 100% 相同**（關鍵字 selectTheme）。
- 指定主題**不增加 LLM 呼叫**（render 後段套用）。
- 驗證：`themeSelection` 若提供，三個欄位皆 optional string；非法型別 → 既有 400 路徑。

## 3. `POST /api/decks/:id/revisions`（010 編輯端點）— 加 themeSelection

**Request**（010 既有 + 新增 optional）：
```ts
{
  baseRevision: number;
  slideDeck: SlideDeck;
  themeSelection?: { fontId?: string; paletteId?: string; styleId?: string };
}
```
- 帶 `themeSelection` → `applyDeckEdit` 重組 styleKit（data-model §4）：只換 styleKit，文字/結構/chartIntents 沿用 base。
- 無 `themeSelection` → 010 現況（沿用 base designPlan/styleKit）。
- 回應沿用 `DeckRevisionContract`（新版 `selectedTheme` 三軸 id 反映換後主題）。
- 不變式：**不呼叫 LLM**；唯讀塊/並發/保真保證沿用 010。

## 4. OpenAPI

- `packages/contracts/src/openapi.ts`：新增 `THEME_CATALOG_RESPONSE_SCHEMA`、`THEME_SELECTION_SCHEMA`（三 optional id），request schema 補 `themeSelection`。
- `apps/api/src/openapi/openapi-document.ts`：加 `"/api/themes": { get }`；preview/edit request body 補 `themeSelection`。
- 加 smoke 測試（document 可建 + 含 `/api/themes`）。

## 契約 / 單元測試

- `applyThemeSelection`：① 只覆寫 palette → 其餘軸沿用 baseline；② 三軸全覆寫 → ids 全為所選；③ 指定不存在 id → 該軸退 baseline + fallback；④ 無 selection → === baseline；⑤ 零 LLM（純函式）。
- `GET /api/themes`：回三軸、各筆含 name + swatch、不含整包 styleKit、JWT 保護。
- preview/edit request 帶 themeSelection → 套用正確；不帶 → 現況不變。
