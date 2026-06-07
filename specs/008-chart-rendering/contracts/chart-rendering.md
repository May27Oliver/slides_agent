# Contract: Chart Rendering(內部 renderer 介面)

> 008 不新增 HTTP API。可審查 contract 為 domain rendering functions、mapping、template renderer integration、preview matrix script。

## 1. `parseMetricValue`

```ts
export function parseMetricValue(value: string): ParsedMetricValue | null;
```

契約:

- 接受貨幣、百分比、千分位、簡單量級後綴。
- `display` 必須保留原始使用者可見字串。
- 無 finite numeric value 時回 null。
- 不做單位換算;只保守解析。

## 2. `extractChartSeries`

```ts
export function extractChartSeries(input: {
  intent: ChartIntent;
  treatment: ChartTreatment;
}): ChartSeries;
```

契約:

- 只讀 `intent.sourceFacts`;不得引用非 intent 指向的 facts。
- 每個 point 必須帶 `sourceFactId`。
- 同一 series 中 unit 不相容時保留 points,但 warnings 包含 `unit_mismatch`,讓 renderer fallback。
- 無足夠資料時回 `kind="none"` 或 points 少於最低條件,並附 note。

## 3. validators

```ts
export function validatePieSeries(series: ChartSeries): ValidationResult;
export function validateLineSeries(series: ChartSeries): ValidationResult;
export function validateBarSeries(series: ChartSeries): ValidationResult;
```

`ValidationResult`:

```ts
interface ValidationResult {
  ok: boolean;
  notes: ChartRenderingNote[];
}
```

最低條件:

- pie/donut:2+ points,values non-negative,total > 0,unit compatible。
- line:2+ points,unit compatible,排序明確。
- bar:2+ points,unit compatible。

## 4. `renderChartIntent`

```ts
export function renderChartIntent(input: {
  intent: ChartIntent;
  treatmentPlan?: ChartTreatmentPlan;
  styleKit: DesignStyleKit;
  designSystem: DesignSystem;
}): RenderedChart;
```

契約:

- 優先使用 `treatmentPlan.treatment`;缺少時使用 `VisualizationType → ChartTreatment` mapping。
- `chart` treatment 在 valid categorical series 下可選 bar 或 pie/donut;`timeline` treatment 優先 line。
- validation fail 時 fallback 到 metric group/table/fallback text,不得輸出空白。
- root fragment 必含:
  - `data-chart-intent-id`
  - `data-chart-visual`
  - `data-source-fact-ids`
- 所有 text/attribute/style values 必須 sanitize。
- `RenderedChart.notes` 必須揭露 fallback 與不確定性。

## 5. Template renderer integration

`renderTemplateDeck(input)` 必須:

- 對每張 slide 的 `chartIntentIds` 找出對應 `ChartIntent`。
- 找出對應 `ChartTreatmentPlan`。
- 在 slide body 中插入 chart visual fragment,而非只把 chart intent 當 bullet。
- 若 chart rendering notes 產生,將其納入 review/report 可追溯資料或回傳 artifact metadata 的既有路徑。
- 維持 keyboard navigation、16:9 layout、responsive no-overflow。

## 6. Preview matrix script

建議 script:

```text
pnpm --filter @slides-agent/api preview:chart-matrix
```

契約:

- 讀取 007 已啟用 style registry/seeds。
- 對每個 style × 每個 chart visual 產生可預覽 artifact（palette/font 軸固定 safe/default 組合;全矩陣留待 009）。
- 產生 index HTML,列出所有組合與 output path。
- smoke fail 條件:
  - 缺任一組合。
  - artifact 空白。
  - artifact 含外部 `<script>`/`<link>` 或 remote asset。
  - chart root 缺 `data-chart-visual` 或 source lineage。
  - 基本 overflow smoke 失敗。

## 7. Self-contained output guard

任何 chart fragment/output MUST NOT contain:

- external `<script src=...>`
- external `<link href=...>` for chart runtime
- event handler attributes such as `onclick`
- unsanitized `style` values from source/LLM/DB
- remote `url(http...)` assets

Google Fonts link already used by deck styleKit remains outside chart runtime scope; chart renderer must not add new external resources.
