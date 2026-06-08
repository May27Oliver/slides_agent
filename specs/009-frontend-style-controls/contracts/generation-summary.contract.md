# Contract Delta：generationSummary 結果證據（009）

範圍：**僅 response**。公開 request contract **不變**（FR-013，無新增 `themeId` / 圖表類型偏好）。

變更點：`packages/contracts/src/index.ts`（`GenerationSummaryContract`）+ `packages/contracts/src/openapi.ts`（`GENERATION_SUMMARY_SCHEMA`），並與 `packages/domain/src/deck/deck.types.ts` 的 `GenerationSummary` 同步。

## Before（現況）

```ts
interface GenerationSummary {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
  selectedTheme?: { style: string | null; palette: string | null; font: string | null; fallback: boolean };
}
```

## After（009）

```ts
interface GenerationSummary {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;

  // 取代 flat shape（三軸入 ids，無 alias）；**required**（rendered pipeline 恆存在）
  selectedTheme: SelectedThemeSummary;

  // 新增：已渲染圖表結果證據（空陣列＝無圖表；buildGenerationSummary 必填參數 → 恆存在）
  renderedCharts: RenderedChartSummary[];
}
```

**plan A（no-drift）**：public `GenerationSummary` 的 `selectedTheme`/`renderedCharts` 皆 **required**。planning 階段（`generate-preview-deck`）改用獨立窄型別 **`PreRenderSummary`**（僅 4 個 counts），不再共用 `GenerationSummary` 而弱化對外契約。`structureFeatures.radiusPx`/`shadow` 為 required；`notes[].code` 為 8 值 enum（非任意 string）。token 值在投影邊界經 `safeHex`/`safeCssValue` sanitize。

`SelectedThemeSummary` / `RenderedChartSummary` 形狀見 [data-model.md](../data-model.md)。
（`RenderedChartSummary` ≠ 既有 `RenderedChart` fragment 型別，勿混用。）

**單一來源（D12）**：`renderedCharts` 與 slide html、review notes 同源於 `renderTemplateDeck` 回傳的 `RenderedTemplateDeck{ html, renderedCharts }`（單一 render pass）。`notes[].code` 型別為 `ChartRenderingNote["code"]`（enum），非任意字串。

## OpenAPI schema 要點

- `selectedTheme`：object，含 `kitName`(string)、`ids`(object: style/palette/font nullable string)、`fallback`(boolean)、`accentHues`(array of {name,base})、`fonts`({heading,body})、`visualDensity`(string, optional)、`structureFeatures`(object: radiusPx?/shadow?/backdropBlurPx?/glow?/texture? enum/animation?{preset enum,durationMs})。
- `renderedCharts`：array of object（型別 `RenderedChartSummary`，**恆存在**，無圖表為 `[]`），含 `slideId`(string)、`chartIntentId`(string)、`visualKind`(enum: pie_donut|line|bar|metric_card|metric_group|table|fallback_text)、`fallback`(boolean，**僅真實降級＝含 `fallback_used` note 時為 true**；`table`/`table_truncated` 不算)、`notes`(array of {code(enum: ChartRenderingNote code),message})。
- 兩者皆 optional/nullable，向後相容（舊消費者忽略新欄位；本 repo 內 web 為唯一消費者，同步更新）。

## 遷移與測試

- 既有引用 `selectedTheme.style/palette/font` 之處（api 組裝、web 型別、測試）→ 改 `selectedTheme.ids.*`。
- 新增 contracts schema 有效性測試（CR-016）。
- 不保留 flat alias（D4）。
