# Implementation Plan: Chart Rendering(自包含 inline SVG / HTML 真圖表)

**Branch**: `008-chart-rendering` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-chart-rendering/spec.md`

## Summary

把已規劃的 `ChartIntent` / `ChartTreatmentPlan` 從「只留在 planning metadata」推進到 renderer 可見的自包含視覺輸出。008 必須支援 engine-owned inline SVG/HTML 的 pie/donut、line、bar 真圖表,並保留 metric card、metric group、table、fallback text。資料只從既有 `SourceFact` / `ChartIntent.sourceFacts` 可靠抽取成最小 `ChartSeries`;不得呼叫 LLM 補數列、不得捏造缺點、不得引入前端圖表套件。所有 chart visual 套用 007 的 deck-level `DesignStyleKit` / `accentHues`,並提供 `style × chart visual` preview matrix script/test,確保每個已啟用風格下都可預覽;palette/font 全矩陣留待 009。

**Artifact Language**: 本 plan 與相關 Spec Kit artifacts 使用繁體中文;domain model、schema keys、API field names、code identifiers 使用 English。

## Technical Context

**Language/Version**: TypeScript 5 on Node.js 20.19.x;API 端 tsx runtime,domain package 純 TypeScript。

**Primary Dependencies**: 既有 pnpm workspace、NestJS API、React/Vite web、`@slides-agent/domain`、`@slides-agent/contracts`、Vitest。008 不新增 Chart.js/Recharts/D3/canvas 依賴;chart rendering 為 engine-owned inline SVG/HTML 字串。

**Storage**: N/A。008 不新增 DB schema 或 persistence;使用既有 `SlideDeck`、`ChartIntent`、`SourceFact`、`DesignPlanningResult`、007 themes/`DesignStyleKit`。

**Testing**: Vitest。domain 單元測試覆蓋 metric parsing、series extraction/validation、`VisualizationType → ChartTreatment` mapping、renderer HTML/SVG output、sanitize/fallback;renderer integration 測 `renderTemplateDeck`;API dev harness 測 `preview:chart-matrix` 或等價 script;必要時用 generated HTML artifact 做 smoke。

**Target Platform**: 本機開發與部署環境中的 API/worker 生成流程;輸出為 self-contained HTML slides,可在 browser/PDF export/static preview 中呈現。

**Project Type**: pnpm monorepo: `packages/domain` 純 domain/rendering core + `apps/api` dev script/harness + `packages/contracts` shared schemas if needed。

**Performance Goals**:

- 單 deck chart rendering 不應對生成造成可感知延遲;目標每張 slide chart rendering p95 < 10ms(純字串/SVG 計算)。
- `ChartSeries` extraction 對每個 chart intent 為 O(facts),預期 facts 小量(<100)。
- preview matrix 為 dev/test harness,可接受秒級執行;輸出 artifact 數 = 已啟用 styles × chart visuals。

**Constraints**:

- 不引入前端圖表套件、CDN、canvas 或 client-side chart JS。
- 輸出必須自包含;chart SVG/HTML 不可依賴外部 script/link/url asset。
- 所有 DB/LLM/source 字串逐值 sanitize:文字 HTML escape,attribute escape,數字 safe parse,顏色取 `DesignStyleKit.accentHues` 並 safeHex。
- 不呼叫 LLM 產 structured series;008 僅從既有 `SourceFact` / chart intent facts 可靠抽取。
- source fidelity 優先於漂亮圖;資料不足、單位不一致、時間排序不明或 pie 不可加總時 fallback 並寫 review note。
- domain 維持無 SQL、無 Nest、無 filesystem。
- preview matrix 的 style 清單以 007 已啟用 registry/seeds 為準,008 不另定風格集合;palette/font 軸固定 safe/default 組合。

**Scale/Scope**:

- 支援 chart visual: pie/donut、line、bar、metric card、table、metric group、fallback text。
- 不做:LLM direct structured series、area/stacked/multi-axis/scatter/heatmap、Sankey/network/geo/3D/candlestick。
- 初期 chart intent/fact 數量為簡報級小資料;非分析儀表板大資料渲染。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification First**: PASS。Accepted source 為 [spec.md](./spec.md)。scope update 已明確:008 必須包含 pie/donut、line、bar 真圖與 chart × style preview matrix。無未解 clarification marker。
- **Behavior-Driven User Value**: PASS。五個 user story 均含 Given/When/Then;US1 真圖可獨立 demo,US5 preview matrix 可獨立測試。
- **Source Fidelity**: PASS。`ChartSeries` 每個 point 必須含 `sourceFactId`/原 display 值;不得補點/外推/改單位。fallback reasons 進 review notes。
- **Reviewable Generation**: PASS。新增 chart rendering notes:series 抽取失敗、fallback、表格截斷、數值解析不確定、chart type fallback、style × chart artifact。
- **Web-First Deliverable**: PASS。self-contained HTML slides 仍是主產物;chart 為 inline SVG/HTML。
- **Backend-Configured LLM Boundary**: PASS。008 純 deterministic rendering,不呼叫 LLM;provider/model 無新增公開 contract。
- **Coherent Deck Design System**: PASS。chart palette/typography/density 取自 007 `DesignStyleKit` / `DesignSystem`;preview matrix 覆蓋每個已啟用 style。
- **Semantic Titles and Data Visualization**: PASS。chart title 沿用 `ChartIntent.title`;numeric content 依 series conditions 轉 pie/donut、line、bar、metric card、table 或 fallback。
- **Code Quality and Simplicity**: PASS WITH JUSTIFIED COMPLEXITY。新增 `ChartSeries`/renderer 純函式是目前真圖輸出的直接消費者;不引入圖表框架。複雜度與替代方案見 Complexity Tracking。
- **TDD and DDD**: PASS。首批 failing tests:metric parser、series extractor、pie/bar/line validators、renderPieChart/renderLineChart/renderBarChart sanitize、renderTemplateDeck consumes chart intents、preview matrix completeness。
- **Lean Test Scope**: PASS。測可觀察 HTML/SVG 結構、data attributes、labels、values、fallback notes、matrix completeness;不做逐像素截圖比對。
- **Consistent UX and Language**: PASS。統一詞彙:`ChartSeries`、`chart visual`、`pie/donut chart`、`line chart`、`bar chart`、`metric card`、`metric group`、`fallback`、`preview matrix`。
- **Performance and Operational Evidence**: PASS。目標見 Technical Context;證據包括 renderer snapshots、matrix artifacts、quickstart manual screenshots。
- **Manual Verification Path**: PASS。[quickstart.md](./quickstart.md) 會列出 chart matrix script、artifact 位置、肉眼檢查 checklist。
- **Release Verification**: PASS。驗證 slide JSON contract、HTML rendering、keyboard navigation、responsive no-overflow、self-contained output、review report notes。

## Project Structure

### Documentation (this feature)

```text
specs/008-chart-rendering/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── chart-rendering.md
└── tasks.md              # /speckit-tasks 產出
```

### Source Code (repository root)

```text
packages/domain/
├── src/
│   ├── content-core/
│   │   └── chart-intent.types.ts            # VisualizationType 保留內容語意;視需要新增 "chart"
│   ├── design/
│   │   ├── design.types.ts                  # ChartTreatment 保留渲染 treatment
│   │   └── chart-treatment-mapping.ts       # 新增:VisualizationType → ChartTreatment 單向映射
│   ├── rendering/
│   │   ├── chart-rendering.types.ts         # 新增:ChartSeries, ChartPoint, ChartVisualKind, RenderedChart
│   │   ├── metric-value-parser.ts           # 新增:parseMetricValue()
│   │   ├── chart-series-extractor.ts        # 新增:extractChartSeries()
│   │   ├── chart-series-validator.ts        # 新增:validatePie/Line/BarSeries()
│   │   ├── chart-svg-renderer.ts            # 新增:renderPieChart/renderLineChart/renderBarChart
│   │   ├── chart-html-renderer.ts           # 新增:metric/table/group/fallback HTML
│   │   ├── chart-renderer.ts                # 新增:renderChartIntent()
│   │   ├── template-html-renderer.ts        # 修改:在 slide content 中插入 chart visuals
│   │   └── deck-style-css.ts                # 修改:chart/table/metric CSS classes + responsive rules
│   └── deck/
│       └── deck.types.ts                    # 視需要擴充 ReviewReport chart rendering notes
└── test/
    ├── design/
    │   └── chart-treatment-mapping.test.ts
    └── rendering/
        ├── metric-value-parser.test.ts
        ├── chart-series-extractor.test.ts
        ├── chart-series-validator.test.ts
        ├── chart-svg-renderer.test.ts
        ├── chart-html-renderer.test.ts
        └── template-chart-rendering.test.ts

apps/api/
├── package.json                             # 新增 script:preview:chart-matrix
├── scripts/
│   └── preview-chart-matrix.ts              # 新增:style × chart visual preview artifacts
└── test/
    └── preview-chart-matrix.test.ts         # 新增:matrix completeness / no blank / self-contained smoke
```

**Structure Decision**: charting 是 rendering/domain 行為,放在 `packages/domain/src/rendering`。`VisualizationType → ChartTreatment` mapping 放 `packages/domain/src/design`,因它承接 design planning 的 treatment 決策。API 只放 dev-only preview matrix script,重用 committed theme seeds 或 007 registry,不讓 runtime 依賴 filesystem preview artifacts。

### 新增物件的消費者(避免投機抽象)

| 新增 | 當下消費者 |
|---|---|
| `ChartSeries` / `ChartPoint` | `renderChartIntent`、pie/line/bar validators、tests |
| `parseMetricValue()` | `extractChartSeries`、metric card renderer |
| `extractChartSeries()` | `renderChartIntent` |
| `validatePieSeries` / `validateLineSeries` / `validateBarSeries` | chart renderer fallback 決策 |
| `renderPieChart` / `renderLineChart` / `renderBarChart` | `renderChartIntent`、preview matrix |
| `renderMetricCard` / `renderMetricGroup` / `renderFactTable` | `renderChartIntent` fallback/非真圖 paths |
| `chart-treatment-mapping.ts` | design planner fallback + mapping tests |
| `preview-chart-matrix.ts` | `pnpm --filter @slides-agent/api preview:chart-matrix` + smoke test/manual QA |
| chart CSS classes | `renderTemplateDeck` output |

## Complexity Tracking

| 新增複雜度 | 為何需要 | 否決的更簡單替代 |
|---|---|---|
| `ChartSeries` 抽取/驗證管線 | 008 要真圖,必須有可審查的 `{label,value,sourceFactId}` 最小資料模型,避免 renderer 直接猜字串 | 直接在 SVG renderer 裡 parse facts:規則分散、難測、fallback/review reason 不一致 |
| 三個 SVG renderer(pie/line/bar) | 使用者明確要求 008 就有圓餅、線圖/折線圖;bar 是 comparison 的基本真圖 | 只做 metric/table:不符合 scope update |
| preview chart matrix script | 每種 chart 在每個風格都要能預覽,且新增 style/chart 時要 fail fast | 手動抽樣看幾個 style:容易漏掉 palette/density/label overflow 問題 |
| `VisualizationType → ChartTreatment` 單向 mapping | spec 決策 B 要單一真實來源;避免 content-core/design 雙 enum 漂移 | 到處 switch enum:短期快但 mapping 無法完整測,新增型別易漏 |

## Evidence Plan

- **Automated Evidence**: Vitest tests for parsing, series extraction/validation, mapping, SVG/HTML renderer output, sanitize, fallback notes, `renderTemplateDeck` integration, preview matrix completeness/self-contained smoke。
- **Manual Verification**: `pnpm --filter @slides-agent/api preview:chart-matrix`;打開產出的 matrix index,逐 style 檢查 pie/donut、line、bar、metric card、table、metric group、fallback。
- **Operational Evidence**: generated preview artifacts、test output、renderer snapshot fixtures、review report notes。
- **Decision Evidence**: [research.md](./research.md) 的 DR、[contracts/chart-rendering.md](./contracts/chart-rendering.md)、Complexity Tracking。

## Phase 0 Research Output

See [research.md](./research.md)。

## Phase 1 Design Output

See [data-model.md](./data-model.md)、[contracts/chart-rendering.md](./contracts/chart-rendering.md)、[quickstart.md](./quickstart.md)。

## Post-Design Constitution Check

PASS。Phase 1 artifacts preserve 008 boundaries:不新增圖表套件、不新增 LLM series generation、不新增 DB schema;新增 domain artifacts 均有當下 consumer 與可測路徑。Preview matrix contract 明確覆蓋每個已啟用 style × 每個支援 chart visual,滿足手動驗收與 operational evidence。Fallback/review note/data lineage 保護 source fidelity。
