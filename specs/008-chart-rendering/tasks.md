# Tasks: 008 chart-rendering

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Input**: Design documents from `/specs/008-chart-rendering/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/chart-rendering.md](./contracts/chart-rendering.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED。008 是 slide-generation/rendering feature,必須 TDD。每個 user story 先寫 focused failing tests / executable verification tasks,再實作最小行為,最後跑 quickstart 與 preview matrix。

**Organization**: Tasks 依 user story 分組,確保每個 story 可獨立實作、測試與展示。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行(不同檔案、無未完成 task 依賴)
- **[Story]**: User story phase 內必填,格式 `[US1]`
- 所有任務描述都包含具體 file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 確認修改範圍與建立 shared chart rendering skeleton。

- [x] T001 Run GitNexus impact analysis; risk notes below.

  **Impact notes (2026-06-06)**:
  - `renderTemplateDeck` — **LOW**。唯一 d=1 caller 為 `apps/api/scripts/preview-themes.ts`。新增 `chartIntents` 採 optional 參數,簽章向後相容,不破壞該 script。
  - `buildDeckStyleCss` — **LOW**。impact graph 無外部 d=1 caller(僅經 `renderTemplateDeck`)。只新增 chart CSS class,不改簽章。
  - `compileDeckPlanProposal` — **HIGH**(4 processes:planSlideDeck / generatePreview / preview / generatePreviewDeck)。緩解:本 feature 只在 slide 既有 `contentBlocks` **追加** `chart_placeholder` block(沿用既有 `ContentBlockKind` 與 `generation-summary` 既讀的 `block.chartIntentId`),不改回傳形狀或簽章 → 實際為 additive,非 breaking。
  - 資料流缺口:`Slide` 不帶 `chartIntentIds`、compiler 未產 chart block、`renderTemplateDeckArtifact` 未收 `chartIntents`。整合策略:compiler 依 proposal `chartIntentIds` 追加 `chart_placeholder` blocks;`TemplateDeckInput`/`HtmlDeckGenerationInput` 新增 optional `chartIntents`;`slides.service` 傳 `deckResult.chartIntents`。
- [x] T002 [P] Add shared chart rendering type placeholders and exports in `packages/domain/src/rendering/chart-rendering.types.ts` and `packages/domain/src/index.ts`
- [x] T003 [P] Add chart treatment mapping module placeholder and exports in `packages/domain/src/design/chart-treatment-mapping.ts` and `packages/domain/src/index.ts`
- [x] T004 [P] Add chart preview script placeholder and package script in `apps/api/scripts/preview-chart-matrix.ts` and `apps/api/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有 chart visual 共用的 domain language、mapping、sanitize 與 fixture 基礎。

**CRITICAL**: 完成此 phase 前不要開始 user story implementation。

- [x] T005 [P] Write failing type/export smoke test for chart rendering public API in `packages/domain/test/rendering/chart-rendering-exports.test.ts`
- [x] T006 [P] Write failing `VisualizationType → ChartTreatment` mapping coverage test in `packages/domain/test/design/chart-treatment-mapping.test.ts`
- [x] T007 [P] Write failing shared chart fixture builders in `packages/domain/test/rendering/chart-rendering-fixtures.ts`
- [x] T008 Implement `ChartVisualKind`, `ParsedMetricValue`, `ChartPoint`, `ChartSeries`, `ChartRenderingNote`, and `RenderedChart` in `packages/domain/src/rendering/chart-rendering.types.ts`
- [x] T009 Implement `VisualizationType → ChartTreatment` single-source mapping in `packages/domain/src/design/chart-treatment-mapping.ts`
- [x] T010 Export chart rendering and mapping APIs from `packages/domain/src/index.ts`
- [x] T011 Add shared chart CSS class names and responsive container rules in `packages/domain/src/rendering/deck-style-css.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - 可解析數列渲染成真圖 (Priority: P1) MVP

**Goal**: `comparison` / `timeline` / `chart` 類意圖能從 source facts 抽出可信 `ChartSeries`,並渲染 pie/donut、line、bar inline SVG 真圖;資料不足時安全 fallback。

**Independent Test**: 帶同單位 category facts 的 `comparison` intent 產生 bar/pie SVG;帶可排序期間 facts 的 `timeline` intent 產生 line SVG;每個 label/value 追溯到 source facts,惡意字串不得逸出。

### Tests for User Story 1 (REQUIRED - write first)

- [x] T012 [P] [US1] Write failing metric parser tests for currency, percentage, thousands, invalid text, and preserved display values in `packages/domain/test/rendering/metric-value-parser.test.ts`
- [x] T013 [P] [US1] Write failing series extraction tests for categorical, time, unit mismatch, insufficient points, and sourceFact lineage in `packages/domain/test/rendering/chart-series-extractor.test.ts`
- [x] T014 [P] [US1] Write failing pie/bar/line validation tests for negative pie values, zero totals, line sort failures, and unit compatibility in `packages/domain/test/rendering/chart-series-validator.test.ts`
- [x] T015 [P] [US1] Write failing SVG renderer tests for pie/donut, line, bar structure, labels, values, `data-source-fact-ids`, and no external resources in `packages/domain/test/rendering/chart-svg-renderer.test.ts`
- [x] T016 [P] [US1] Write failing `renderChartIntent` integration tests for chart treatment, fallback notes, and malicious source strings in `packages/domain/test/rendering/chart-renderer.test.ts`
- [x] T017 [US1] Write failing `renderTemplateDeck` integration test proving slide `chartIntentIds` render chart visuals instead of bullets in `packages/domain/test/rendering/template-chart-rendering.test.ts`

### Implementation for User Story 1

- [x] T018 [P] [US1] Implement `parseMetricValue()` in `packages/domain/src/rendering/metric-value-parser.ts`
- [x] T019 [P] [US1] Implement `extractChartSeries()` in `packages/domain/src/rendering/chart-series-extractor.ts`
- [x] T020 [P] [US1] Implement `validatePieSeries()`, `validateLineSeries()`, and `validateBarSeries()` in `packages/domain/src/rendering/chart-series-validator.ts`
- [x] T021 [P] [US1] Implement safe SVG helpers and `renderPieChart()`, `renderLineChart()`, `renderBarChart()` in `packages/domain/src/rendering/chart-svg-renderer.ts`
- [x] T022 [US1] Implement `renderChartIntent()` true-chart selection and fallback orchestration in `packages/domain/src/rendering/chart-renderer.ts`
- [x] T023 [US1] Integrate `renderChartIntent()` into slide rendering in `packages/domain/src/rendering/template-html-renderer.ts`
- [x] T024 [US1] Add chart visual CSS variables, SVG sizing, legends, axis, and no-overflow rules in `packages/domain/src/rendering/deck-style-css.ts`
- [x] T025 [US1] Export US1 renderer modules from `packages/domain/src/index.ts`
- [x] T026 [US1] Run focused domain tests for US1 with `pnpm --filter @slides-agent/domain test` and capture any failure notes in `specs/008-chart-rendering/tasks.md`

**Checkpoint**: User Story 1 should show real pie/donut, line, and bar charts in template-rendered HTML.

---

## Phase 4: User Story 2 - Metric card / 單值視覺 (Priority: P2)

**Goal**: `metric_card` / `callout` / `milestone` 類意圖渲染成大數字 + 標籤 + 脈絡的 sanitized HTML metric card。

**Independent Test**: 帶 `metric_card` intent + `$2.3M` fact 的 deck 出現 metric card;不可解析 value fallback 成文字並產生 review note。

### Tests for User Story 2 (REQUIRED - write first)

- [x] T027 [P] [US2] Write failing metric card renderer tests for parsed metric, invalid metric fallback, source lineage, and theme accent usage in `packages/domain/test/rendering/chart-html-renderer.metric-card.test.ts`
- [x] T028 [P] [US2] Write failing template integration test for repeated metric card style consistency across slides in `packages/domain/test/rendering/template-metric-card-rendering.test.ts`

### Implementation for User Story 2

- [x] T029 [US2] Implement `renderMetricCard()` and metric fallback text path in `packages/domain/src/rendering/chart-html-renderer.ts`
- [x] T030 [US2] Wire metric-card treatment into `renderChartIntent()` in `packages/domain/src/rendering/chart-renderer.ts`
- [x] T031 [US2] Add metric card CSS rules in `packages/domain/src/rendering/deck-style-css.ts`
- [x] T032 [US2] Run focused domain tests for US2 with `pnpm --filter @slides-agent/domain test` and capture any failure notes in `specs/008-chart-rendering/tasks.md`

**Checkpoint**: User Story 2 should be independently demonstrable with a metric-only deck.

---

## Phase 5: User Story 5 - 每種 chart 在每個風格內可 script 預覽 (Priority: P2)

**Goal**: 提供 repeatable preview matrix script/test,覆蓋 007 已啟用 style × 008 支援 chart visual。

**Independent Test**: 執行 preview matrix script/test 後產生所有 style × chart visual artifacts;缺少組合、空白、外部資源或基本 overflow smoke 失敗時測試 fail。

### Tests for User Story 5 (REQUIRED - write first)

- [x] T033 [P] [US5] Write failing API test for preview matrix completeness and missing-combination detection in `apps/api/test/preview-chart-matrix.test.ts`
- [x] T034 [P] [US5] Write failing API test for preview matrix self-contained/no-blank smoke checks in `apps/api/test/preview-chart-matrix-output.test.ts`
- [x] T035 [P] [US5] Add expected matrix visual list fixture in `apps/api/test/fixtures/chart-matrix-visuals.json`

### Implementation for User Story 5

- [x] T036 [US5] Implement chart sample deck builders for every `ChartVisualKind` in `apps/api/scripts/preview-chart-matrix.ts`
- [x] T037 [US5] Implement style loading from committed 007 seeds and composeKit pairing in `apps/api/scripts/preview-chart-matrix.ts`
- [x] T038 [US5] Implement matrix artifact generation (`index.html`, per-case HTML, `matrix.json`) in `apps/api/scripts/preview-chart-matrix.ts`
- [x] T039 [US5] Add `preview:chart-matrix` script in `apps/api/package.json`
- [x] T040 [US5] Update quickstart matrix command and artifact expectations in `specs/008-chart-rendering/quickstart.md`
- [x] T041 [US5] Run `pnpm --filter @slides-agent/api test` and, if implemented, `pnpm --filter @slides-agent/api preview:chart-matrix`; capture artifact path in `specs/008-chart-rendering/tasks.md`

**Checkpoint**: User Story 5 should let maintainers open a chart × style matrix index and inspect all combinations.

---

## Phase 6: User Story 3 - 表格處理 (Priority: P3)

**Goal**: `table` intent 渲染成 sanitized, themed HTML table;過量 rows 截斷並產生 note。

**Independent Test**: 帶多筆 facts 的 `table` intent 渲染 `<table>`;文字 escape;超過 row limit 顯示前 N 筆並記「省略 M 列」。

### Tests for User Story 3 (REQUIRED - write first)

- [x] T042 [P] [US3] Write failing fact table renderer tests for table structure, escaped text, lineage, and row truncation notes in `packages/domain/test/rendering/chart-html-renderer.table.test.ts`
- [x] T043 [P] [US3] Write failing template integration test for table treatment in `packages/domain/test/rendering/template-table-rendering.test.ts`

### Implementation for User Story 3

- [x] T044 [US3] Implement `renderFactTable()` with row limit and truncation notes in `packages/domain/src/rendering/chart-html-renderer.ts`
- [x] T045 [US3] Wire table treatment and table fallback paths into `renderChartIntent()` in `packages/domain/src/rendering/chart-renderer.ts`
- [x] T046 [US3] Add responsive table CSS rules in `packages/domain/src/rendering/deck-style-css.ts`
- [x] T047 [US3] Add table visual case to preview matrix samples in `apps/api/scripts/preview-chart-matrix.ts`
- [x] T048 [US3] Run focused domain/API tests for US3 with `pnpm --filter @slides-agent/domain test` and `pnpm --filter @slides-agent/api test`; capture any failure notes in `specs/008-chart-rendering/tasks.md`

**Checkpoint**: User Story 3 should be independently demonstrable with a table-only deck and fallback table cases.

---

## Phase 7: User Story 4 - Metric 群組 + 列舉整併 (Priority: P4)

**Goal**: `comparison` facts that cannot become valid bar/pie render as metric group/table, and enum mapping remains complete and tested.

**Independent Test**: 混合單位 comparison facts 不畫誤導性同軸 chart,而是 metric group/table;mapping 覆蓋每個 `VisualizationType`。

### Tests for User Story 4 (REQUIRED - write first)

- [x] T049 [P] [US4] Write failing metric group renderer tests for mixed units, multiple metrics, source lineage, and sanitized labels in `packages/domain/test/rendering/chart-html-renderer.metric-group.test.ts`
- [x] T050 [P] [US4] Extend mapping tests for every `VisualizationType` enum and unsupported/fallback behavior in `packages/domain/test/design/chart-treatment-mapping.test.ts`
- [x] T051 [P] [US4] Write failing `renderChartIntent` tests proving invalid comparison falls back to metric group/table rather than bar/pie in `packages/domain/test/rendering/chart-renderer.comparison-fallback.test.ts`

### Implementation for User Story 4

- [x] T052 [US4] Implement `renderMetricGroup()` in `packages/domain/src/rendering/chart-html-renderer.ts`
- [x] T053 [US4] Wire mixed-unit comparison fallback ordering into `renderChartIntent()` in `packages/domain/src/rendering/chart-renderer.ts`
- [x] T054 [US4] Finalize `chart-treatment-mapping.ts` and update `design-planner.ts` to consume the mapping in `packages/domain/src/design/design-planner.ts`
- [x] T055 [US4] Add metric group CSS rules in `packages/domain/src/rendering/deck-style-css.ts`
- [x] T056 [US4] Add metric group and fallback visual cases to preview matrix samples in `apps/api/scripts/preview-chart-matrix.ts`
- [x] T057 [US4] Run focused domain/API tests for US4 with `pnpm --filter @slides-agent/domain test` and `pnpm --filter @slides-agent/api test`; capture any failure notes in `specs/008-chart-rendering/tasks.md`

**Checkpoint**: User Story 4 should complete fallback behavior and enum mapping coverage.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Release verification, evidence capture, cleanup, and non-redundant coverage.

- [x] T058 [P] Run full domain/API regression with `pnpm --filter @slides-agent/domain test` and `pnpm --filter @slides-agent/api test`; record results in `specs/008-chart-rendering/tasks.md`
- [x] T059 [P] Run full monorepo tests with `pnpm test`; record results in `specs/008-chart-rendering/tasks.md`
- [x] T060 [P] Validate generated matrix artifacts with self-contained grep command from `specs/008-chart-rendering/quickstart.md`
- [x] T061 [P] Verify generated HTML keyboard navigation and 16:9 responsive behavior using `packages/domain/test/rendering/keyboard-navigation.test.ts` and matrix artifacts in `apps/api/preview/chart-matrix/`
- [x] T062 [P] Remove redundant or implementation-detail assertions from chart tests in `packages/domain/test/rendering/`
- [x] T063 [P] Update domain documentation for chart rendering concepts in `packages/domain/docs/domain.md`
- [x] T064 [P] Update product/design documentation for chart visuals and preview matrix in `docs/design.md`
- [x] T065 Verify new domain artifacts have current consumers or remove unused exports in `packages/domain/src/index.ts`
- [x] T066 Run `gitnexus_detect_changes()` for all uncommitted changes and confirm affected flows match 008 chart rendering before any commit; record scope notes in `specs/008-chart-rendering/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: no dependencies.
- **Phase 2 Foundational**: depends on Phase 1; blocks all user stories.
- **US1 (Phase 3)**: depends on Foundation; MVP.
- **US2 (Phase 4)**: depends on Foundation and can reuse US1 parser types; independently testable.
- **US5 (Phase 5)**: depends on at least US1 renderer and benefits from US2; later stories update matrix cases as their visuals land.
- **US3 (Phase 6)**: depends on Foundation and chart HTML renderer from US2 if already present.
- **US4 (Phase 7)**: depends on Foundation and US1/US2 renderer paths for comparison fallback.
- **Polish (Phase 8)**: depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: MVP; no other story dependency after Foundation.
- **US2 (P2)**: can start after Foundation, but implementation can reuse `parseMetricValue()` from US1.
- **US5 (P2)**: can scaffold after Foundation; complete coverage requires all chart visuals from US1/US2/US3/US4.
- **US3 (P3)**: can start after Foundation; no dependency on true chart logic beyond shared renderer shell.
- **US4 (P4)**: depends on mapping foundation and fallback ordering from US1.

### Within Each User Story

- Tests MUST be written first and fail or be unimplemented before production code.
- Type-only declarations before behavior.
- Parsers/extractors/validators before renderers.
- Renderer fragments before template integration.
- CSS/responsive rules before matrix/manual verification.
- Refactor only after focused tests pass.

---

## Parallel Opportunities

- T002, T003, T004 can run in parallel after T001 risk notes are reviewed.
- T005, T006, T007 can run in parallel.
- US1 tests T012-T016 can run in parallel before implementation; T017 depends on knowing expected template integration shape.
- US1 implementation T018-T021 can run in parallel, then T022-T024 sequentially.
- US2 tests T027-T028 can run in parallel.
- US5 tests T033-T035 can run in parallel; implementation T036-T038 is sequential.
- US3 tests T042-T043 can run in parallel.
- US4 tests T049-T051 can run in parallel.
- Polish documentation tasks T063-T064 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch focused tests/design work in parallel:
Task: "Write failing metric parser tests in packages/domain/test/rendering/metric-value-parser.test.ts"
Task: "Write failing series extraction tests in packages/domain/test/rendering/chart-series-extractor.test.ts"
Task: "Write failing validation tests in packages/domain/test/rendering/chart-series-validator.test.ts"
Task: "Write failing SVG renderer tests in packages/domain/test/rendering/chart-svg-renderer.test.ts"

# After tests exist, implement independent modules in parallel:
Task: "Implement parseMetricValue() in packages/domain/src/rendering/metric-value-parser.ts"
Task: "Implement extractChartSeries() in packages/domain/src/rendering/chart-series-extractor.ts"
Task: "Implement validators in packages/domain/src/rendering/chart-series-validator.ts"
Task: "Implement SVG renderers in packages/domain/src/rendering/chart-svg-renderer.ts"
```

## Parallel Example: User Story 5

```bash
Task: "Write preview matrix completeness test in apps/api/test/preview-chart-matrix.test.ts"
Task: "Write preview matrix self-contained smoke test in apps/api/test/preview-chart-matrix-output.test.ts"
Task: "Add chart visual list fixture in apps/api/test/fixtures/chart-matrix-visuals.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational.
3. Complete Phase 3 US1 true chart rendering.
4. Stop and validate: `pnpm --filter @slides-agent/domain test`.
5. Demo a template-rendered deck with pie/donut, line, and bar.

### Incremental Delivery

1. US1: true charts from valid series.
2. US2: metric card for single-value visuals.
3. US5: matrix script scaffold and coverage checks.
4. US3: table renderer and truncation notes.
5. US4: metric group fallback and mapping integration.
6. Polish: full quickstart, matrix artifacts, docs, GitNexus detect_changes.

### Final Verification

1. `pnpm --filter @slides-agent/domain test`
2. `pnpm --filter @slides-agent/api test`
3. `pnpm --filter @slides-agent/api preview:chart-matrix`
4. `pnpm test`
5. Manual matrix inspection from `apps/api/preview/chart-matrix/index.html`

---

## 實作結果與驗證（2026-06-06）

**全綠**:`pnpm test` — domain 174 / api 158 / web 21 / contracts 25,全部通過。

- **MVP (US1)**:`renderTemplateDeck` 把 slide 的 `chart_placeholder` block 畫成真 pie/donut、line、bar inline SVG;資料不足安全 fallback。
- **US2/US3/US4**:metric card / table（含截斷 note）/ metric group 皆實作並串接;`VisualizationType → ChartTreatment` 映射為單一真實來源,`design-planner` 經 `mapVisualizationTypeToTreatment` 消費。
- **US5**:`pnpm --filter @slides-agent/api preview:chart-matrix` 產生 **140 cases(20 styles × 7 visuals)**,全部以預期 visual 渲染(無非預期 fallback);artifacts 在 `apps/api/preview/chart-matrix/`(git-ignored)。自包含 grep 僅命中 deck 級 Google Fonts `<link>`(quickstart 允許),chart fragment 本身無外部資源。

**偏離說明**:T028 + T043 的兩個 template 測試合併為單一 `packages/domain/test/rendering/template-visual-rendering.test.ts`(metric card 一致性 + table treatment),避免冗餘(CR-010 / T062)。

**資料流補強(spec 未列,實作時補上)**:`Slide` 不帶 `chartIntentIds`,故由 `compileDeckPlanProposal` 依 proposal `chartIntentIds` 追加 `chart_placeholder` content block(沿用 `generation-summary` 既讀的 `block.chartIntentId`);`TemplateDeckInput`/`HtmlDeckGenerationInput` 新增 optional `chartIntents`;`slides.service` 傳 `deckResult.chartIntents`。皆向後相容(additive)。

**T066 detect_changes**:受影響流程全落在 008 面 — `generatePreview`/`Preview`(pipeline 傳 chartIntents)、`renderTemplateDeck(Artifact)`(渲染圖表)、`compileDeckPlanProposal`(產 chart block)、`treatmentFor`/`Plan`(走映射)、`renderSlide → EscapeHtml`。無非預期流程波及;risk=critical 來自變更量(13 檔)而非語意風險,378 測試全綠佐證行為正確。

---

## Phase 9 — US6 泛用 chart-intent 規劃決策層（2026-06-06 reopen，決策 C / FR-015~018）

**背景**:008 完成了下游渲染引擎,但上游「決定哪些資料成圖」的兩層皆為綁死範例的 stub —— `ChartIntentPlanner` 只認固定值、`extractSourceFacts` 連貨幣 `$1.1M` 都沒抽。真實內容(區域 `$M`、季度時間序列、裝置 `%`)因此全退回項目符號。本階段以泛用、確定性的規劃 + 抽取取代之。

- [x] **T067**〔shared〕`content-core/metric-fact-parser.ts`(新):`parseMetricValue` + `ParsedMetricValue` + 新 `detectPeriodKey` 移入 content-core;`rendering/metric-value-parser.ts` 與 `chart-rendering.types.ts` 改 re-export,`chart-series-extractor` 改用 shared `detectPeriodKey`(移除本地 `timeSortKey`/`MONTHS`)。FR-017 共用判斷達成。
- [x] **T068**〔extractor〕`source-fact-extractor.ts`:補抽貨幣 `[$€£¥]…[KMB]?`(收斂空白)。fixture 無貨幣故 `sourceFactCount` 不變;貨幣內容如 NovaDesk 現可抽出 facts。
- [x] **T069**〔planner〕`chart-intent-planner.ts` 重寫:section→unit 分組 + `isChartable`(期間/部分對全體 sum≈100/非%同單位/同行 before-after,否則不產);metric_card 單值僅 `kind==="metric"`。零寫死樣本值。
- [x] **T070**〔types/call-site〕`ChartIntentInput` 加 optional `sections`;`generate-preview-deck` / `slide-deck-planner` 傳 sections。
- [x] **T071**〔test〕rewrite `chart-intents.test.ts`(11 個 US6 案例:區域 comparison、季度 timeline、裝置 part-to-whole、before/after、拒畫不相干 %、0 intent、非範例資料集、分組、標題、emphasis);`source-facts.test.ts` 加貨幣抽取;`generate-preview-deck.test` 計數 4→2。**附加**:renderer `selectComparison` 的 pie 改 gate 在部分對全體(sum≈100),否則 bar——修掉 `18%→25%` 被誤畫成 pie。
- [x] **T072**〔verify〕domain 196 / api 159 / web 21 / contracts 25 全綠;typecheck 乾淨;NovaDesk 內容實測 → 區域 comparison(bar)/季度 timeline(line)/裝置 part-to-whole(pie);matrix 140 cases exit 0。

**驗證重點(已達成)**:規劃可圖性 ↔ 渲染可畫性一致(planner `isChartable` 與 renderer pie-gating 共用 sum≈100 部分對全體判斷,FR-017/SC-009);任意非範例內容正確判圖(SC-008);保守不硬湊(拒畫不相干 % 測試佐證)。

**偏離說明**:US6 實作時發現 fact 抽取層(`extractSourceFacts`)也是 stub(連貨幣都沒抽),故一併補強(spec Assumptions 已預列此相依);並補修 renderer 的 pie 部分對全體 gating(原 `unit==="%"` 即 pie 會把 before/after 誤畫成 pie)。
