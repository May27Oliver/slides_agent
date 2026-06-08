# Phase 1 Data Model：Frontend Style Controls

009 不新增 DB 實體。本檔定義**新增/變更的型別**（response 結果證據 + 前端 curated metadata）與**投影映射**。

## 1. SelectedThemeSummary（response，取代既有 flat `selectedTheme`）

位置：`packages/domain/src/design/selected-theme-summary.types.ts`，置於 `GenerationSummary.selectedTheme`。

```ts
export interface SelectedThemeSummary {
  kitName: string;
  ids: { style: string | null; palette: string | null; font: string | null };
  fallback: boolean;
  accentHues: Array<{ name: string; base: string }>;
  fonts: { heading: string; body: string };
  visualDensity?: string;
  structureFeatures: {
    radiusPx: number;
    shadow: boolean;
    backdropBlurPx?: number;
    glow?: boolean;
    texture?: "grain" | "noise" | "paper";
    animation?: { preset: "aurora" | "mesh"; durationMs: number };
  };
}
```

**取代**現況 `{ style, palette, font, fallback }`（`deck.types.ts:152`）；三軸 id 移入 `ids`，無 flat alias。

### 投影映射（`selected-theme-summary.ts` 純函式）

輸入：`styleKit: DesignStyleKit`、`visualDensity?: string`、`ids`、`fallback`。

| 目標欄位 | 來源 | 規則 |
|---|---|---|
| `kitName` | `styleKit.kitName` | 直取 |
| `ids` / `fallback` | `selectTheme()` 既有輸出 | 直取 |
| `accentHues[]` | `styleKit.accentHues[]` | 投 `{name, base}`（丟 `gradient`） |
| `fonts` | `styleKit.fonts` | 投 `{heading, body}`（丟 `googleFontsHref`） |
| `visualDensity` | `designSystem.visualDensity` | optional 直取 |
| `structureFeatures.radiusPx` | `styleKit.effects.cardRadiusPx` | 直取 |
| `structureFeatures.shadow` | `styleKit.effects.cardShadow` | `Boolean(非空且非 "none")` |
| `structureFeatures.backdropBlurPx` | `styleKit.effects.cardBackdropBlurPx?` | 存在才帶 |
| `structureFeatures.glow` | `styleKit.effects.glow?` | `Boolean(存在)` |
| `structureFeatures.texture` | `styleKit.background.textureOverlay?` | 存在才帶 |
| `structureFeatures.animation` | `styleKit.background.gradientAnimation?` | 存在才帶 `{preset,durationMs}` |

**保值原則**：投影不新增資訊、不改寫值；缺值即 optional 省略（前端據以據實呈現/留白）。

## 2. 單一來源 render：`RenderedTemplateDeck` + `RenderedChartSummary`

**架構決策（D12，見 research.md）**：圖表只 render 一次。`renderTemplateDeck` 回傳由 `string` 改為結構化結果，**同一次 render 同時產出 html 與圖表證據**；review notes 與 `generationSummary.renderedCharts` 皆由此單一結果衍生 → 三者不可能 drift。這是**有意識接受 CRITICAL blast radius** 的架構修正（被拒替代：新增第三次走訪的加法 collector，見 research.md D12）。

### `RenderedTemplateDeck`（`packages/domain/src/rendering/template-html-renderer.ts`）

```ts
export interface RenderedTemplateDeck {
  html: string;
  renderedCharts: RenderedChartSummary[];
}

export function renderTemplateDeck(input: TemplateDeckInput): RenderedTemplateDeck;
```

### `RenderedChartSummary`（`packages/domain/src/rendering/chart-rendering.types.ts`，與 `ChartVisualKind` 同檔）

> **命名注意**：同檔已有既有型別 `RenderedChart`（`{ visualKind, html, sourceFactIds, notes }`，單張「已渲染 fragment」，**`renderChartIntent` 的回傳，維持不動**），語意不同、**勿覆寫**。009 的逐圖證據型別命名為 **`RenderedChartSummary`**。

```ts
export interface RenderedChartSummary {
  slideId: string;
  chartIntentId: string;
  visualKind: ChartVisualKind;          // pie_donut|line|bar|metric_card|metric_group|table|fallback_text
  fallback: boolean;                    // true = 真實降級（見下方判定）
  notes: Array<{ code: ChartRenderingNote["code"]; message: string }>;  // reuse 008 note code（enum）+message
}
```

- **單一來源**：`renderChartIntent()` **不動**（仍回傳 `RenderedChart{visualKind,html,sourceFactIds,notes}`，單張 canonical output）。`renderChartFragments`/`renderSlide` 在**既有的那一次** `renderChartIntent` 呼叫處，順手把 `RenderedChart` + `slideId` + `chartIntentId` 收成 `RenderedChartSummary`，向上聚合進 `RenderedTemplateDeck.renderedCharts`。
- **`fallback` 判定（重要，treatment-based）**：由 `renderChartIntent`（canonical）算一次，存進 `RenderedChart.fallback`，template renderer 直接讀（單一來源、無 inline 重複）。規則 `isChartFallback(treatment, visualKind, notes)`：
  - notes 含 `fallback_used` → **true**（涵蓋 `metric_card`→text、comparison 降級 metric_group/text 等）；
  - 或 `treatment ∈ {chart, timeline}` 且 `visualKind ∉ {pie_donut, line, bar}` → **true**（**修掉 chart→table 降級漏報**：一個想成圖卻退成 table 的 intent 現在正確標 fallback）。
  - **planned `table`/`metric_card`**（treatment 本就非 chart/timeline）、`table_truncated`/`series_extracted` 註記 **皆不算 fallback**。
  - `timeline`→`bar`（仍是真圖）**不算** fallback。
- `slideId` 由 `template-html-renderer` 在收集時附上（renderer 內部，非前端 parse）。
- 空陣列＝該 deck 無圖表。

### `collectChartReviewNotes`（降級為純投影）

```ts
export function collectChartReviewNotes(input: {
  renderedCharts: RenderedChartSummary[];
  chartIntents: ChartIntent[];           // 內部建 chartIntentId -> title map 供格式化
}): string[];
```

- **不再自己 render**（移除既有第二次 `renderChartIntent` 走訪）。純投影：對 `renderedCharts[].notes` filter `REVIEWABLE_NOTE_CODES`，以 `「${title}」：${message}` 格式化。
- 與 `generationSummary.renderedCharts`、slide html 同源於那一次 render → 無 drift。

## 3. 前端 curated metadata（apps/web，非 contract）

### StylePreset（`apps/web/.../style-presets.ts`）

```ts
interface StylePreset {
  key: TranslationKey;          // 既有翻譯鍵
  styleDirection: string;       // 既有後端關鍵字片語（語言解耦）
  preview: {
    swatches: string[];                 // 2–4 色
    fontSample: { heading: string; body: string };
    traits: string[];                   // 2–3 特徵 chip（i18n key 或文字）
    density: string;                    // 密度標示
    structureFeatures?: {               // 生成前動效預覽 gate 用
      animation?: { preset: "aurora" | "mesh"; durationMs: number };
    };
  };
}
```

### ChartPreset（`apps/web/.../chart-presets.ts`）

```ts
interface ChartPreset {
  key: TranslationKey;          // none | comparison | trend | metric（既有）
  chartEmphasis: string;        // 既有傾向關鍵字
  exampleVisualKinds: ChartVisualKind[];  // 代表圖型示意（可多個）：comparison→["bar","pie_donut"], trend→["line"], metric→["metric_card"], none→[]
}
```

## 4. 前端讀模型（AppliedDesignSummary）

`apps/web/.../slide-generation.types.ts` 更新為讀 nested `selectedTheme` + `renderedCharts`；面板**只讀**，不 parse HTML/CSS。

## 不變式

- 公開 request contract 不新增欄位（無 `themeId`、無圖表類型偏好）。
- response 僅新增 readonly 結果證據；不參與任何決策。
- `visualKind` 永遠是 `ChartVisualKind` enum 值，非顯示文案。
