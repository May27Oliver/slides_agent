# Data Model: 008 chart-rendering

## 概念關係

```
SlideDeck
  ├─ sourceFacts: SourceFact[]           # 既有,來源事實
  ├─ chartIntents: ChartIntent[]         # 既有,內容規劃語意
  └─ slides[].chartIntentIds             # 既有,slide references

DesignPlanningResult
  ├─ chartTreatmentPlans: ChartTreatmentPlan[]  # 既有,design/rendering decision
  └─ styleKit?: DesignStyleKit                  # 007,theme tokens

ChartIntent + SourceFact[]
  └─ extractChartSeries()
       └─ ChartSeries
            ├─ validatePie/Line/Bar()
            └─ renderPie/Line/Bar/Metric/Table/Fallback()
```

## 既有 entity

### `SourceFact`

來源: `packages/domain/src/deck/deck.types.ts`。

重要欄位:

| 欄位 | 說明 |
|---|---|
| `id` | chart point lineage 的來源 |
| `kind` | `metric` / `date` 等,series extraction 優先使用 `metric` |
| `value` | 原始顯示值,例如 `$2.3M`、`45%`、`Q3 2026` |
| `sourceText` | label/context fallback 來源 |

規則:renderer 不改寫來源數字與單位;`displayValue` 保留原始精度。

### `ChartIntent`

來源: `packages/domain/src/content-core/chart-intent.types.ts`。

| 欄位 | 說明 |
|---|---|
| `id` | `ChartTreatmentPlan.chartIntentId` 與 slide `chartIntentIds` 對應 |
| `title` | chart title/aria label 來源 |
| `sourceFacts` | series extraction 的唯一資料來源 |
| `recommendedVisuals` | content-core 語意,透過 mapping 轉 treatment |
| `rationale` | fallback/review context |

### `ChartTreatmentPlan`

來源: `packages/domain/src/design/design.types.ts`。

| 欄位 | 說明 |
|---|---|
| `chartIntentId` | 對應 `ChartIntent.id` |
| `treatment` | `chart` / `metric_card` / `table` / `timeline` / `fallback_text` / `review_note` |
| `labelingNotes` | label/legend/axis hints |
| `preservedContext` | 必須保留的 source context |
| `fallbackRationale` | design 階段已知 fallback 理由 |

## 新增 entity / value objects

### `ParsedMetricValue`

```ts
interface ParsedMetricValue {
  display: string;        // 原始顯示值,保留精度與符號
  numericValue: number;   // safe finite number
  unit: string | null;    // "$", "%", "M", "users" 等可保守推得的單位/後綴
  prefix: string | null;  // "$" 等
  suffix: string | null;  // "%", "M", "YoY" 等
}
```

Validation:

- `numericValue` 必須 finite。
- 不支援 ambiguous text-only value;回傳 null。
- 千分位、貨幣、百分比可解析但 display 不重算。
- 解析不確定時不得強行成 chart;回 fallback note。

### `ChartPoint`

```ts
interface ChartPoint {
  label: string;
  displayValue: string;
  value: number;
  unit: string | null;
  sourceFactId: string;
  sourceText: string;
  sortKey?: number | string;
}
```

Validation:

- `label` 來自 source fact context、source text 或可保守抽出的 period/category。
- `sourceFactId` 必填,用於 review/report lineage。
- renderer 使用 `displayValue` 顯示,使用 `value` 計算比例/座標。

### `ChartSeries`

```ts
type ChartSeriesKind = "categorical" | "time" | "single" | "table" | "none";

interface ChartSeries {
  kind: ChartSeriesKind;
  title: string;
  points: ChartPoint[];
  unit: string | null;
  sourceFactIds: string[];
  warnings: ChartRenderingNote[];
}
```

Validation:

- `sourceFactIds` 必須等於 points lineage 的集合。
- 同軸 chart(bar/line)必須 unit compatible。
- `kind="time"` 必須有可排序 x axis。

### `ChartVisualKind`

```ts
type ChartVisualKind =
  | "pie_donut"
  | "line"
  | "bar"
  | "metric_card"
  | "metric_group"
  | "table"
  | "fallback_text";
```

### `ChartRenderingNote`

```ts
interface ChartRenderingNote {
  code:
    | "series_extracted"
    | "series_insufficient"
    | "unit_mismatch"
    | "invalid_pie_total"
    | "time_sort_failed"
    | "table_truncated"
    | "fallback_used"
    | "value_parse_uncertain";
  message: string;
  chartIntentId: string;
  sourceFactIds: string[];
}
```

Notes feed review report/manual evidence. They must not include secrets or provider/model details.

### `RenderedChart`

```ts
interface RenderedChart {
  visualKind: ChartVisualKind;
  html: string;                 // sanitized inline SVG/HTML fragment
  sourceFactIds: string[];
  notes: ChartRenderingNote[];
}
```

HTML contract:

- Root element includes `data-chart-intent-id`, `data-chart-visual`, and `data-source-fact-ids`.
- SVG includes `<title>` / accessible label.
- No `<script>`, external `<link>`, remote `url()`, event handler attributes, or unsanitized style fragments.

## Mapping

`VisualizationType → ChartTreatment`:

| VisualizationType | ChartTreatment | Renderer default |
|---|---|---|
| `metric_card` | `metric_card` | metric card |
| `comparison` | `chart` | bar or pie/donut when series valid; metric group/table fallback |
| `timeline` | `timeline` | line when time series valid; bar/table fallback |
| `milestone` | `metric_card` | metric card or fallback text |
| `callout` | `metric_card` | metric card |
| `table` | `table` | table |
| `none` | `fallback_text` | fallback text/review note |

## Preview Matrix Artifact

```ts
interface ChartPreviewMatrixCase {
  styleThemeId: string;
  chartVisual: ChartVisualKind;
  outputFile: string;
  ok: boolean;
  notes: string[];
}
```

Completeness:

- style set = 007 已啟用 registry/seeds 中可渲染 presentation styles（palette/font 軸固定 safe/default 組合;全矩陣留待 009）。
- chart visual set = `pie_donut`, `line`, `bar`, `metric_card`, `metric_group`, `table`, `fallback_text`。
- Missing style × visual combination fails the matrix smoke.
