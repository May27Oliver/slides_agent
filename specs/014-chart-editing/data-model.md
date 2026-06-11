# Data Model: 014 編輯頁圖表編輯（Phase 1）

**Branch**: `014-chart-editing` ｜ 對應 spec Key Entities 與 FR-001~017、research R1~R10。

---

## §1. `ChartVisualOverride`（domain，新增）

```ts
// packages/domain/src/design/design.types.ts（既有檔案擴充）
export type ChartVisualOverride =
  | "auto"        // 現行自動選型（等同缺欄位）
  | "pie_donut"
  | "line"
  | "bar"
  | "metric_card"
  | "table";

export interface ChartTreatmentPlan {
  chartIntentId: string;
  treatment: ChartTreatment;          // 不動
  /** 014: 使用者指定的視覺覆寫；缺/auto = 現行自動選型。validator 守門不外移。 */
  visualOverride?: ChartVisualOverride;
  labelingNotes: string[];
  preservedContext: string[];
  fallbackRationale?: string;
}
```

- 值域刻意 = `ChartVisualKind` 扣掉 `metric_group`／`fallback_text`（那兩個是降級產物，不是可指定目標）再加 `auto`。
- 持久化：隨衍生 `designPlan` 進 revision jsonb；舊資料缺欄位 → `auto` 語意，零 migration。

## §2. `SourceFact` 擴充（domain）

```ts
// packages/domain/src/deck/deck.types.ts（既有檔案擴充）
export type SourceFactKind = /* 既有值 */ | "user_provided";

export interface SourceFact {
  id: string;
  kind: SourceFactKind;
  value: string;                  // user_provided 時 MUST === metric.displayValue（鏡像，FR-007）
  sourceText: string;             // user_provided 時固定 "使用者於編輯器輸入"
  sourceSectionId?: string;
  /** 014: 結構化數值；存在時 series 抽取 short-circuit 直接採用（R6）。 */
  metric?: {
    label: string;
    displayValue: string;         // domain 自 valueText + unit 組合
    numericValue: number;         // domain 自 valueText 解析（有限）
    unit: string | null;
  };
  /** 014: 被此 user fact 取代的 base fact id；僅稽核/還原，非 provenance（FR-008）。 */
  replacesFactId?: string;
}
```

## §3. `ChartOperation`（domain，新檔 `packages/domain/src/deck-edit/chart-operation.types.ts`）

```ts
export interface UserPointInput {
  label: string;        // trim 後非空，≤ 120 字元
  valueText: string;    // /^-?\d+(\.\d+)?$/，≤ 32 字元，解析後有限
  unit: string | null;  // ≤ 16 字元
}

export type EditDataPoint =
  | { kind: "original"; sourceFactId: string }                       // 必屬該 intent 的 base facts；清單內不得重複
  | { kind: "user"; point: UserPointInput; replacesFactId?: string };

export type ChartOperation =
  | { op: "set_visual"; chartIntentId: string; visual: ChartVisualOverride }
  | { op: "remove_chart"; slideId: string; chartIntentId: string }
  | { op: "add_chart"; slideId: string;
      source:
        | { kind: "existing_intent"; chartIntentId: string }
        | { kind: "user_data"; title: string; visual: ChartVisualOverride;
            points: UserPointInput[] } }
  | { op: "edit_data"; chartIntentId: string;
      points: EditDataPoint[];          // 完整清單，陣列序 = 顯示序
      title?: string };                 // 提供時 trim 非空，覆寫 intent.title

export const CHART_EDIT_LIMITS = {
  maxPointsPerChart: 12,
  maxChartsPerSlide: 1,
  maxOperations: 50,
  maxLabelLength: 120,    // label 與 title 共用
  maxUnitLength: 16,
  maxValueTextLength: 32
} as const;
```

## §4. `applyChartOperations`（domain，新檔 `packages/domain/src/deck-edit/apply-chart-operations.ts`）

```ts
export interface ApplyChartOperationsInput {
  mergedDeck: SlideDeck;                       // mergeEditedDeck 的輸出
  baseChartIntents: ChartIntent[] | null;      // base revision 持久化值
  baseTreatmentPlans: ChartTreatmentPlan[];
  baseRevision: number;                        // 確定性 id 的種子（R3）
  operations: ChartOperation[];
}

export type ApplyChartOperationsResult =
  | { ok: true; slideDeck: SlideDeck; chartIntents: ChartIntent[];
      treatmentPlans: ChartTreatmentPlan[] }
  | { ok: false; rejection: "INVALID_EDIT"; detail: string };  // detail 指明第幾個 op 哪裡違規
```

**套用規則（陣列序、immutable、純函式）**：

| op | 效果 | 驗證（違反 → INVALID_EDIT） |
|----|------|------|
| `set_visual` | treatmentPlans 中對應 plan 的 `visualOverride` = visual（`auto` = 移除欄位）；無 plan 者建立 `{ treatment: resolveTreatmentForVisuals(intent.recommendedVisuals), visualOverride }` | intent 存在於（前序套用後）集合 |
| `remove_chart` | 自該 slide 的 `contentBlocks` 過濾掉 `chartIntentId` 相符的 `chart_placeholder`；intent／plan 保留 | slide 存在於 mergedDeck；該 slide 確有此 placeholder |
| `add_chart` (existing) | 目標 slide append `{ kind: "chart_placeholder", content: {}, chartIntentId }` | slide 存在且 `slideKind !== "opening"`；目標 slide（前序套用後）無任何 `chart_placeholder`；intent 存在 |
| `add_chart` (user_data) | 造新 intent（§4a）＋新 plan ＋ append placeholder | 同上 ＋ points 全數過 §3 規則、點數 ≤ 12、title trim 非空 |
| `edit_data` | 衍生 intent：sourceFacts = 依 points 重建（§4b）；title 提供則覆寫 | intent 存在；original.sourceFactId 屬該 intent base facts 且不重複；user 點過 §3 規則；點數 ≤ 12 |

**前置檢查**：`baseChartIntents === null` 且 `operations.length > 0` → INVALID_EDIT（FR-015）；`operations.length > 50` → INVALID_EDIT。

### §4a. user_data 新 intent 的建構

```
intentId  = `chart_user_r{baseRevision}_{opIndex}`
facts[i]  = { id: `fact_user_r{baseRevision}_{opIndex}_{i}`, kind: "user_provided",
              value: displayValue, sourceText: "使用者於編輯器輸入",
              metric: { label, displayValue: valueText + (unit ?? ""), numericValue: Number(valueText), unit } }
recommendedVisuals = visual 反查 VisualizationType：
  pie_donut/bar/auto → ["comparison"]，line → ["timeline"]，
  metric_card → ["metric_card"]，table → ["table"]
intent    = { id, title, sourceFacts: facts, recommendedVisuals,
              rationale: "使用者於編輯器手動建立" }
plan      = { chartIntentId: id, treatment: mapVisualizationTypeToTreatment(primary),
              visualOverride: visual === "auto" ? undefined : visual,
              labelingNotes: [], preservedContext: [] }
```

### §4b. edit_data 的 fact 重建

- `original` 點 → 自 base intent 取回該 fact **原樣**（id/lineage 不動）。
- `user` 點 → 新 fact，id = `fact_user_r{baseRevision}_{opIndex}_{pointIndex}`，建構同 §4a（含 `replacesFactId` 透傳）。
- 衍生 intent = `{ ...baseIntent, title: title ?? baseIntent.title, sourceFacts: 重建清單 }`；被取代/刪除的 base fact 不在新清單（FR-008）。

## §5. `applyDeckEdit` 整合（既有檔案擴充）

```ts
export interface ApplyDeckEditOptions {
  themeSelection?: ManualThemeSelection;   // 011，不動
  candidates?: SelectableTheme[];          // 011，不動
  chartOperations?: ChartOperation[];      // 014 新增
}
```

管線（R2）：merge → **applyChartOperations**（有 operations 時）→ findUnrenderableReason → re-theme → render。`EditRevisionPayload.chartIntents`／`designPlan` 改為衍生值（無 operations 時 === base 值，現行行為不變）。

## §6. 揭露：`GenerationSummary.userDataDisclosures`（R7）

```ts
// packages/domain/src/deck/deck.types.ts（GenerationSummary 擴充）
export interface UserDataDisclosure {
  slideId: string;          // 放置該圖表的 slide（多頁共享時每頁一筆）
  chartIntentId: string;
  chartTitle: string;
  userPointCount: number;   // kind === "user_provided" 的點數
  totalPointCount: number;
}
// GenerationSummary 增: userDataDisclosures: UserDataDisclosure[]（always present，無則 []）
```

由 `applyDeckEdit` 組 summary 時自衍生 intents × placeholder 放置掃出。前端呈現格式（CR-013 一致用語）：「本圖表含使用者提供的數據點（{n}/{m}）」。

## §7. Contracts（packages/contracts/src/deck.ts 擴充）

```ts
export interface EditRevisionRequestContract {
  baseRevision: number;
  slideDeck: unknown;
  themeSelection?: ThemeSelectionContract;   // 011，不動
  chartOperations?: unknown[];               // 014：形狀驗證見 validator
}
```

`validateEditRevisionRequest` 增驗：`chartOperations` 若存在須為陣列、長度 ≤ 50、每項是 `op` 欄位合法的 record（四種值之一）＋各 op 必要欄位型別正確（字串/陣列/巢狀形狀）。**語意驗證（id 存在性、ownership、數值格式、上限）一律在 domain**（010 分工先例，R9）。

## §8. 渲染層（既有檔案最小擴充）

- `chart-series-extractor.ts`：`toChartPoint` 開頭 short-circuit `fact.metric`（R6）。
- `chart-renderer.ts`：`selectVisual` 接 `visualOverride`（R1）；`isChartFallback` 把「override 要求 true-chart 而未得」計為 fallback。
- `template-html-renderer.ts`：**零修改**（placeholder 驅動的渲染與 chart split 既有行為直接適用）。

## §9. 前端 draft model（apps/web/src/features/deck-editor/）

```ts
// editable-slide-draft.ts 擴充
interface EditableSlideDraft {
  // ...既有欄位
  chartOperations: ChartOperation[];   // 累積中的操作，save 時隨 body 提交
}
```

- mutators（全部回新 draft）：`setChartVisual`／`removeChart`／`addChartFromIntent`／`addChartFromUserData`／`editChartData`／`resetChartEdits(chartIntentId)`。
- 合併規則：同一 `chartIntentId` 的同類 op 後者取代前者（清單最小化、preview 重放成本低）；`resetChartEdits` = 移除該 intent 的所有 op。
- 放置資訊（共享提示、清單標註「已用於第 N 頁」）由 draft 的 `slideDeck.contentBlocks` 即時掃描導出，不新增後端欄位（R10）。
- localStorage 草稿（010 機制）自然涵蓋 `chartOperations`（draft 序列化欄位之一）。

## §10. 不變式（測試的骨幹）

1. `operations: []`（或缺）時，`applyDeckEdit` 輸出與 010/011 現行**逐欄位完全相同**（回歸保證）。
2. 任一 op 違規 → 整請求 INVALID_EDIT，**零部分套用**。
3. user fact 必同時滿足：`kind === "user_provided"`、有 `metric`、`value === metric.displayValue`、id 符合 `fact_user_r\d+_\d+_\d+`。
4. 衍生 intents 中的 original facts 與 base 對應 fact 深等值。
5. 同輸入重跑 `applyChartOperations` 輸出 byte-for-byte 相同（確定性；含 client/server 兩端）。
6. 衍生結果再經一輪編輯（以新 revision 為 base）行為與第一輪一致（繼承封閉性）。
