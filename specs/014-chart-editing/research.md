# Research: 014 編輯頁圖表編輯（Phase 0）

**Branch**: `014-chart-editing` ｜ **Date**: 2026-06-11

所有結論皆經 codebase 實地驗證（檔案：行號）。每項 = Decision / Rationale / Alternatives considered。

---

## R1. `visualOverride` 的掛載點：`renderChartIntent` 的視覺選擇層

**Decision**：`ChartTreatmentPlan` 增加可選 `visualOverride?: ChartVisualOverride`。`renderChartIntent`（`packages/domain/src/rendering/chart-renderer.ts`）把 override 傳入 `selectVisual`：

- `"auto"` 或缺欄位 → 走現行 `switch (treatment)` 自動選型，**零行為變化**。
- `"pie_donut"` → `validatePieSeries` ＋ `isPartToWhole` 通過才畫，否則進現行 comparison 降級鏈（bar → metric group → table → text）。
- `"line"` → `validateLineSeries` 通過才畫，否則進現行 timeline 降級鏈。
- `"bar"` → `validateBarSeries` 通過才畫，否則 metric group → table → text。
- `"metric_card"` → 現行 `selectMetric`；`"table"` → 現行 `tableVisual`（這兩者本身已含降級）。

`fallback` 旗標：`isChartFallback`（chart-renderer.ts:82）擴充——override 要求 true-chart（pie/line/bar）而實際 `visualKind` 非該值 → `fallback: true`＋`fallback_used` note。

**Rationale**：現行架構中「treatment 定策略、series 驗證定具體視覺」（`selectComparison` 註解：pie 只在 part-to-whole 時誠實）。override 插在「優先嘗試哪個具體視覺」一層，validator 守門權不動（spec FR-003、CR-007）。

**Alternatives**：
- 擴充 `ChartTreatment` 加 pie/line/bar 值——被拒：`ChartTreatment` 是 content-core `VisualizationType` 的映射輸出（`chart-treatment-mapping.ts` 單一真實來源表），加具體視覺值會污染「語意 → 策略」的分層，且 008 的映射覆蓋測試全要改。
- 在 series extractor 層強制視覺——被拒：extractor 只管資料形狀，視覺選擇本來就在 `selectVisual`。

## R2. `applyChartOperations` 的插入點：merge 之後、render 之前

**Decision**：新模組 `packages/domain/src/deck-edit/apply-chart-operations.ts`（純函式）＋ `chart-operation.types.ts`。`applyDeckEdit`（apply-deck-edit.ts:38）在 `mergeEditedDeck` 成功後呼叫：

```
mergeEditedDeck(base.slideDeck, edited)            // 010，不動
  → applyChartOperations({                          // 014 新增
      mergedDeck, baseChartIntents, baseTreatmentPlans,
      baseRevision: base.revision, operations })
      → { slideDeck', chartIntents', treatmentPlans' } | { rejection: INVALID_EDIT }
  → findUnrenderableReason → re-theme(011) → renderTemplateDeckArtifact   // 不動
```

衍生 `chartIntents'` 與含 `treatmentPlans'` 的衍生 `designPlan` 進 `EditRevisionPayload`（apply-deck-edit.types.ts 既有欄位，jsonb 持久化，零 migration）。

**Rationale**：操作引用的 `slideId` 必須對 merged deck 驗證（含同請求新增/刪除的 slide），所以必在 merge 後；渲染需要最終 intents/plans，所以必在 render 前。`renderLivePreview`（live-preview-render.ts）呼叫同一 `applyDeckEdit` → parity 免費（spec FR-014）。

**Alternatives**：獨立端點 `POST /api/decks/:id/chart-edits`——被拒：拆兩個請求破壞「一次儲存 = 一個 revision」的原子性與 010 並發模型，文字＋圖表編輯就無法同 revision 落地。

## R3. 確定性 id：前綴隔離 ＋ base revision ＋ 索引

**Decision**：
- user fact id：`fact_user_r{baseRevision}_{opIndex}_{pointIndex}`
- user intent id：`chart_user_r{baseRevision}_{opIndex}`

由 `applyChartOperations` 內部導出（輸入皆為函式參數，無隨機、無時鐘）。

**Rationale**：既有 id 鋪面是 `fact_{n}`（source-fact-extractor.ts:21）、`chart-{i}`／`metric-{i}`（chart-intent-planner.ts:161,181）——`fact_user_`／`chart_user_` 前綴不可能碰撞。`baseRevision` 進 id 保證跨 revision 繼承後再編輯也不互撞（r2 的 op0 與 r5 的 op0 不同名）。client preview 與 server save 同函式同輸入 → 同 id 同 html（spec FR-008/FR-014）。

**Alternatives**：client 預先 mint UUID 隨 operation 提交——被拒：要信任 client 的 id 唯一性與格式，且 server 必須重驗，比 domain 導出多一個攻擊面（spec 審查 HIGH-2 的直接成因）。

## R4. opening slide 判定：`slideKind === "opening"`

**Decision**：`add_chart` 對 `slideKind === "opening"` 的 slide → `INVALID_EDIT`。

**Rationale**：renderer 以 `layout === "cover"`（template-html-renderer.ts:102）決定 `isCover` 並排除圖表（`useChartSplit = ... && !isCover`），而 opening slide 的 layout 即 cover——domain 驗證用 `slideKind`（語意層）而非 layout（渲染層），與 spec「封面不支援圖表」的語意一致。本次編輯新增的純文字 slide 一律 `slideKind: "content"`（slide-merge.ts:25），天然可放圖。

## R5. 每頁上限 1 ＝「目標 slide 無 `chart_placeholder`」

**Decision**：`add_chart` 驗證目標 slide 的 `contentBlocks`（套用前序操作後）不含任何 `chart_placeholder`；含 → 400。放置 = append 一個 `{ kind: "chart_placeholder", content: {}, chartIntentId }` block。

**Rationale**：`slideChartIntents`（template-html-renderer.ts:236）按 block 逐一渲染，chart split 版面（renderChartSplitBody）為單圖設計（clarify 定案）。`remove_chart` = 過濾掉對應 block——兩個操作都是 contentBlocks 的最小增刪，merge 的唯讀牆不受影響（操作在 server 端套用，非 client 提交）。

## R6. `SourceFact.metric` short-circuit 的接點與鏡像規則

**Decision**：`toChartPoint`（chart-series-extractor.ts）開頭加：`fact.metric` 存在 → 直接回 `ChartPoint`（label/displayValue/numericValue/unit 取自 metric，sourceFactId/sourceText 照常），跳過 `parseMetricValue`。`applyChartOperations` 建構 user fact 時強制 `value = metric.displayValue`（鏡像）。

**Rationale**：讀 `.value` 的路徑——`renderFactTable`（chart-html-renderer，table 降級）、review 的 `chartingDecisions.sourceFacts`、揭露——鏡像後自然顯示正確值（spec 審查 MEDIUM-4）。時間序列的 `sortKey` 沿用既有 `detectPeriodKey(label)` 推導，user 點不另設排序鍵（clarify 決議）。

**Alternatives**：所有讀 `.value` 的路徑改讀 `metric?.displayValue ?? value`——被拒：觸點多（renderer/review/summary）、易漏；鏡像把不變式收在單一建構點。

## R7. 揭露的落點：`GenerationSummary.userDataDisclosures` ＋ `reviewReport` 同步（plan 審查修正後）

**Decision**：雙軌並行（spec FR-010 的兩個承諾各有落點）——

1. `GenerationSummary` 增加 `userDataDisclosures: Array<{ slideId, chartIntentId, chartTitle, userPointCount, totalPointCount }>`——always present，無使用者數據時 `[]`。由 `applyDeckEdit` 在套用操作後、組 summary 時計算。**結構化、供 UI 渲染**（編輯器卡片＋summary 面板）。
2. `applyDeckEdit` 同步衍生 deck 的 `slideDeck.reviewReport`（review/types.ts:8，已驗證在 SlideDeck 內、deck.types.ts:137）：含使用者數據的圖表追加 `humanReviewNotes` 揭露行（與 UI 同文案，CR-013）；`add_chart(user_data)` 新 intent 追加 `chartingDecisions` 條目（decision/sourceFacts/rationale 結構沿用既有）。**review 輸出的人讀證據**。

**回歸不變式例外**：`userDataDisclosures` 為 always-present 新欄位 → 「`operations: []` 與 010/011 輸出相同」的不變式改為「**除 `generationSummary.userDataDisclosures: []` 外**逐欄位相同」（009 `renderedCharts`／011 `themeSelectionWarnings` 加欄位時同一模式）；`reviewReport` 在無 user 數據時**零變化**（不加空行）。

**Rationale**：009 的 `renderedCharts`（deck.types.ts:171）已立「per-chart readonly result evidence 放 GenerationSummary」先例。reviewReport 是 CR-002 的 review 輸出本體——只落 summary 會讓 spec FR-010「review 輸出同步反映」成空話（plan 審查 HIGH-2）。

**Alternatives**：只塞 humanReviewNotes 字串而無結構化欄位——被拒：前端無法渲染 n/m 點數。只落 summary 不動 reviewReport——被拒：違反 FR-010 字面承諾與 CR-002。

## R8. 點數上限 12 的執行層

**Decision**：上限全部收在 `applyChartOperations` 的 operation 驗證（domain 常數 `CHART_EDIT_LIMITS`）：每圖點數 ≤ 12、label/title ≤ 120、unit ≤ 16、valueText ≤ 32、operations ≤ 50。`valueText` 格式：`/^-?\d+(\.\d+)?$/`（嚴格數字，無千分位/符號）。

**Rationale**：SVG renderer 無既有點數上限（驗證過 chart-svg-renderer.ts 僅 `AXIS_LABEL_MAX = 12` 字元截斷），table 有 8 列截斷（`TABLE_ROW_LIMIT`，不動）——所以 cap 必須在進入渲染前由編輯驗證強制，渲染層不再加規則。

## R9. Contracts 與 API 觸點

**Decision**：`EditRevisionRequestContract`（contracts/deck.ts:62）增加 `chartOperations?: ChartOperationContract[]`；`validateEditRevisionRequest` 同步驗 schema 形狀（細部語意驗證在 domain，contracts 只驗結構：op 種類、欄位型別、陣列上限）。controller（decks.controller.ts）把 `chartOperations` 透傳給 `applyDeckEdit` options——API 層零新端點、零新模組。

**Rationale**：010 的分工先例：contracts 驗形狀、domain 驗語意（merge/tamper 在 domain）。錯誤碼沿用 `INVALID_EDIT`（400）/`REVISION_CONFLICT`（409）。

## R10. 前端觸點盤點（最小擴充面）

**Decision**：
- `editable-slide-draft.ts`：draft 增加 `chartOperations: ChartOperation[]`（immutable mutators：`setVisual`/`removeChart`/`addChart`/`editChartData`，依 intent 去重合併——同一 intent 的後一操作覆蓋前一同類操作，保持清單最小化）。
- `DeckEditorView.tsx`：save body 增 `chartOperations`；`renderLivePreview` 的 `ApplyDeckEditOptions` 增 `chartOperations` 透傳。
- `SlideEditPanel.tsx`：現有 contentBlocks 唯讀區改為圖表卡片區（有圖：視覺選擇器＋數據表格＋移除；無圖：新增入口）。
- 新元件：`ChartEditorCard.tsx`（卡片＋視覺選擇器＋notes）、`ChartDataTable.tsx`（點編輯表格＋徽章＋還原）、`AddChartPanel.tsx`（來源清單 tab ＋ 手動輸入 tab）。
- notes 來源：live preview 已是完整 `applyDeckEdit` → 其 `generationSummary.renderedCharts` 的 notes 直接餵 UI，**無需新渲染通道**。

**Rationale**：`@slides-agent/domain` browser-bundle-safe（010 已建立、live-preview-render.ts 驗證）；`applyChartOperations` 為純函式無 Node 依賴，準則維持。

**Alternatives**：UI 直接操作 contentBlocks 再 echo——被拒：撞 010 唯讀牆（client 提交的 contentBlocks 偏離 base 即 400），operations 是唯一合法通道。

## 殘留風險（plan 階段已知、tasks 需覆蓋）

1. **`auto` 與 user_data intent 的 treatment 推導**：user_data 新 intent 需要 `recommendedVisuals` 與 treatment plan——visual 反推 treatment（pie/line/bar→`chart`、metric_card→`metric_card`、table→`table`；`auto`→`chart`），`recommendedVisuals` 用對應 `VisualizationType` 反查（comparison/metric_card/table）。在 data-model §4 定案。
2. **`edit_data` 對共享 intent 的 UI 提示**：放置資訊（哪些 slide 引用此 intent）由 draft 即時掃 `contentBlocks` 導出，無需後端欄位。
3. **chart split 版面在 add_chart 後的目視驗證**：自動化只驗 DOM 結構（`has-chart-split` class、`.chart-split-media` 內 svg），視覺可讀性走 quickstart 手動路徑。
