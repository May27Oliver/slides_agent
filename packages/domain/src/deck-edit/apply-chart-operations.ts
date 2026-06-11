import type { ChartIntent, VisualizationType } from "@/content-core/chart-intent.types";
import {
  mapVisualizationTypeToTreatment,
  resolveTreatmentForVisuals
} from "@/design/chart-treatment-mapping";
import type { ChartTreatmentPlan, ChartVisualOverride } from "@/design/design.types";
import type { Slide, SlideDeck, SourceFact } from "@/deck/deck.types";
import {
  CHART_EDIT_LIMITS,
  type ChartOperation,
  type UserPointInput
} from "@/deck-edit/chart-operation.types";

export interface ApplyChartOperationsInput {
  /** mergeEditedDeck 的輸出（文字編輯已套用、contentBlocks 仍 === base）。 */
  mergedDeck: SlideDeck;
  /** base revision 持久化值；legacy revision 為 null。 */
  baseChartIntents: ChartIntent[] | null;
  baseTreatmentPlans: ChartTreatmentPlan[];
  /** 確定性 id 的種子（fact_user_r{baseRevision}_{opIndex}_{pointIndex}）。 */
  baseRevision: number;
  operations: ChartOperation[];
}

export type ApplyChartOperationsResult =
  | {
      ok: true;
      slideDeck: SlideDeck;
      chartIntents: ChartIntent[];
      treatmentPlans: ChartTreatmentPlan[];
    }
  | { ok: false; rejection: "INVALID_EDIT"; detail: string };

const USER_FACT_SOURCE_TEXT = "使用者於編輯器輸入";
/** 字面數字（負號/小數可選）——拒絕 "1e5"、"1/3"、"Infinity"、"12." 等非字面形式。 */
const VALUE_TEXT_PATTERN = /^-?\d+(\.\d+)?$/;

/** 每個 override 目標對應的 content-core 語意（user_data intent 的 recommendedVisuals）。 */
const VISUAL_TO_VISUALIZATION: Record<ChartVisualOverride, VisualizationType> = {
  auto: "comparison",
  pie_donut: "comparison",
  bar: "comparison",
  line: "timeline",
  metric_card: "metric_card",
  table: "table"
};

interface WorkingState {
  deck: SlideDeck;
  intents: ChartIntent[];
  plans: ChartTreatmentPlan[];
}

/**
 * 014 (data-model §4): pure, deterministic application of structured chart
 * operations onto a merged deck. Array order = application order — a later op
 * sees the state AFTER every preceding op (so `add_chart(user_data)` followed by
 * `edit_data` on the new intent in the same request is legal). Any violation
 * rejects the WHOLE request (zero partial application). Never mutates inputs.
 */
export function applyChartOperations(
  input: ApplyChartOperationsInput
): ApplyChartOperationsResult {
  const { operations, baseRevision } = input;
  if (operations.length === 0) {
    return {
      ok: true,
      slideDeck: input.mergedDeck,
      chartIntents: input.baseChartIntents ?? [],
      treatmentPlans: input.baseTreatmentPlans
    };
  }
  if (input.baseChartIntents === null) {
    return {
      ok: false,
      rejection: "INVALID_EDIT",
      detail: "此版本無持久化的圖表輸入（chartIntents），無法執行圖表編輯（FR-015）"
    };
  }
  if (operations.length > CHART_EDIT_LIMITS.maxOperations) {
    return {
      ok: false,
      rejection: "INVALID_EDIT",
      detail: `operations 數量 ${operations.length} 超過上限 ${CHART_EDIT_LIMITS.maxOperations}`
    };
  }

  let state: WorkingState = {
    deck: input.mergedDeck,
    intents: input.baseChartIntents,
    plans: input.baseTreatmentPlans
  };
  for (const [index, operation] of operations.entries()) {
    const outcome = applyOne(state, operation, index, baseRevision);
    if (!outcome.ok) {
      return outcome;
    }
    state = outcome.state;
  }
  return {
    ok: true,
    slideDeck: state.deck,
    chartIntents: state.intents,
    treatmentPlans: state.plans
  };
}

type StepResult =
  | { ok: true; state: WorkingState }
  | { ok: false; rejection: "INVALID_EDIT"; detail: string };

function applyOne(
  state: WorkingState,
  operation: ChartOperation,
  index: number,
  baseRevision: number
): StepResult {
  switch (operation.op) {
    case "set_visual":
      return applySetVisual(state, operation, index);
    case "remove_chart":
      return applyRemoveChart(state, operation, index);
    case "add_chart":
      return applyAddChart(state, operation, index, baseRevision);
    case "edit_data":
      return applyEditData(state, operation, index, baseRevision);
  }
}

function applySetVisual(
  state: WorkingState,
  operation: Extract<ChartOperation, { op: "set_visual" }>,
  index: number
): StepResult {
  const intent = state.intents.find((candidate) => candidate.id === operation.chartIntentId);
  if (!intent) {
    return fail(index, `chartIntentId "${operation.chartIntentId}" 不存在`);
  }
  const existing = state.plans.find((plan) => plan.chartIntentId === operation.chartIntentId);

  if (operation.visual === "auto") {
    // auto = 回到自動選型 = 移除欄位；本無 plan 者保持無 plan。
    if (!existing) {
      return { ok: true, state };
    }
    const plans = state.plans.map((plan) =>
      plan.chartIntentId === operation.chartIntentId ? withoutOverride(plan) : plan
    );
    return { ok: true, state: { ...state, plans } };
  }

  const plans = existing
    ? state.plans.map((plan) =>
        plan.chartIntentId === operation.chartIntentId
          ? { ...plan, visualOverride: operation.visual }
          : plan
      )
    : [
        ...state.plans,
        {
          chartIntentId: operation.chartIntentId,
          treatment: resolveTreatmentForVisuals(intent.recommendedVisuals),
          visualOverride: operation.visual,
          labelingNotes: [],
          preservedContext: []
        }
      ];
  return { ok: true, state: { ...state, plans } };
}

function withoutOverride(plan: ChartTreatmentPlan): ChartTreatmentPlan {
  const { visualOverride: _removed, ...rest } = plan;
  return rest;
}

function applyRemoveChart(
  state: WorkingState,
  operation: Extract<ChartOperation, { op: "remove_chart" }>,
  index: number
): StepResult {
  const slide = state.deck.slides.find((candidate) => candidate.id === operation.slideId);
  if (!slide) {
    return fail(index, `slideId "${operation.slideId}" 不存在`);
  }
  const hasPlaceholder = slide.contentBlocks.some(
    (block) => block.kind === "chart_placeholder" && block.chartIntentId === operation.chartIntentId
  );
  if (!hasPlaceholder) {
    return fail(
      index,
      `slide "${operation.slideId}" 沒有 chartIntentId "${operation.chartIntentId}" 的圖表`
    );
  }
  const deck = updateSlide(state.deck, operation.slideId, (target) => ({
    ...target,
    contentBlocks: target.contentBlocks.filter(
      (block) =>
        !(block.kind === "chart_placeholder" && block.chartIntentId === operation.chartIntentId)
    )
  }));
  return { ok: true, state: { ...state, deck } };
}

function applyAddChart(
  state: WorkingState,
  operation: Extract<ChartOperation, { op: "add_chart" }>,
  index: number,
  baseRevision: number
): StepResult {
  const slide = state.deck.slides.find((candidate) => candidate.id === operation.slideId);
  if (!slide) {
    return fail(index, `slideId "${operation.slideId}" 不存在`);
  }
  if (slide.slideKind === "opening") {
    return fail(index, "開場頁不可放置圖表");
  }
  if (slide.contentBlocks.some((block) => block.kind === "chart_placeholder")) {
    return fail(
      index,
      `slide "${operation.slideId}" 已有圖表（每頁上限 ${CHART_EDIT_LIMITS.maxChartsPerSlide} 個）`
    );
  }

  if (operation.source.kind === "existing_intent") {
    const { chartIntentId } = operation.source;
    if (!state.intents.some((candidate) => candidate.id === chartIntentId)) {
      return fail(index, `chartIntentId "${chartIntentId}" 不存在`);
    }
    return { ok: true, state: { ...state, deck: appendPlaceholder(state.deck, slide.id, chartIntentId) } };
  }

  const { title, visual, points } = operation.source;
  const titleProblem = validateTitle(title);
  if (titleProblem) {
    return fail(index, titleProblem);
  }
  const countProblem = validatePointCount(points.length);
  if (countProblem) {
    return fail(index, countProblem);
  }
  for (const [pointIndex, point] of points.entries()) {
    const problem = validateUserPoint(point);
    if (problem) {
      return fail(index, `points[${pointIndex}] ${problem}`);
    }
  }

  // §4a：全 user intent 的確定性建構。
  const intentId = `chart_user_r${baseRevision}_${index}`;
  const facts = points.map((point, pointIndex) =>
    buildUserFact(baseRevision, index, pointIndex, point)
  );
  const primary = VISUAL_TO_VISUALIZATION[visual];
  const intent: ChartIntent = {
    id: intentId,
    title: title.trim(),
    sourceFacts: facts,
    recommendedVisuals: [primary],
    rationale: "使用者於編輯器手動建立"
  };
  const plan: ChartTreatmentPlan = {
    chartIntentId: intentId,
    treatment: mapVisualizationTypeToTreatment(primary),
    ...(visual === "auto" ? {} : { visualOverride: visual }),
    labelingNotes: [],
    preservedContext: []
  };
  return {
    ok: true,
    state: {
      deck: appendPlaceholder(state.deck, slide.id, intentId),
      intents: [...state.intents, intent],
      plans: [...state.plans, plan]
    }
  };
}

function applyEditData(
  state: WorkingState,
  operation: Extract<ChartOperation, { op: "edit_data" }>,
  index: number,
  baseRevision: number
): StepResult {
  const intent = state.intents.find((candidate) => candidate.id === operation.chartIntentId);
  if (!intent) {
    return fail(index, `chartIntentId "${operation.chartIntentId}" 不存在`);
  }
  if (operation.title !== undefined) {
    const titleProblem = validateTitle(operation.title);
    if (titleProblem) {
      return fail(index, titleProblem);
    }
  }
  const countProblem = validatePointCount(operation.points.length);
  if (countProblem) {
    return fail(index, countProblem);
  }

  // original 引用必屬該 intent 於「前序操作套用後」的 sourceFacts，且清單內不得重複。
  const currentFactsById = new Map(intent.sourceFacts.map((factItem) => [factItem.id, factItem]));
  const seenOriginalIds = new Set<string>();
  const rebuilt: SourceFact[] = [];
  for (const [pointIndex, point] of operation.points.entries()) {
    if (point.kind === "original") {
      const original = currentFactsById.get(point.sourceFactId);
      if (!original) {
        return fail(
          index,
          `points[${pointIndex}] sourceFactId "${point.sourceFactId}" 不屬於此圖表的來源事實`
        );
      }
      if (seenOriginalIds.has(point.sourceFactId)) {
        return fail(index, `points[${pointIndex}] sourceFactId "${point.sourceFactId}" 重複引用`);
      }
      seenOriginalIds.add(point.sourceFactId);
      // §4b：original 點原樣保留（id / lineage 不動）。
      rebuilt.push(original);
      continue;
    }
    const problem = validateUserPoint(point.point);
    if (problem) {
      return fail(index, `points[${pointIndex}] ${problem}`);
    }
    rebuilt.push(
      buildUserFact(baseRevision, index, pointIndex, point.point, point.replacesFactId)
    );
  }

  const intents = state.intents.map((candidate) =>
    candidate.id === operation.chartIntentId
      ? {
          ...candidate,
          title: operation.title !== undefined ? operation.title.trim() : candidate.title,
          sourceFacts: rebuilt
        }
      : candidate
  );
  return { ok: true, state: { ...state, intents } };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function fail(index: number, message: string): StepResult {
  return { ok: false, rejection: "INVALID_EDIT", detail: `operations[${index}]: ${message}` };
}

function updateSlide(deck: SlideDeck, slideId: string, update: (slide: Slide) => Slide): SlideDeck {
  return {
    ...deck,
    slides: deck.slides.map((candidate) => (candidate.id === slideId ? update(candidate) : candidate))
  };
}

function appendPlaceholder(deck: SlideDeck, slideId: string, chartIntentId: string): SlideDeck {
  return updateSlide(deck, slideId, (target) => ({
    ...target,
    contentBlocks: [
      ...target.contentBlocks,
      { kind: "chart_placeholder", content: {}, chartIntentId }
    ]
  }));
}

/**
 * §4a：user fact 的單一建構點。displayValue = valueText + unit 是鏡像的單一來源
 * （value === metric.displayValue 的不變式在此收口，輸入精度原樣保留）。
 */
function buildUserFact(
  baseRevision: number,
  opIndex: number,
  pointIndex: number,
  point: UserPointInput,
  replacesFactId?: string
): SourceFact {
  const displayValue = `${point.valueText}${point.unit ?? ""}`;
  return {
    id: `fact_user_r${baseRevision}_${opIndex}_${pointIndex}`,
    kind: "user_provided",
    value: displayValue,
    sourceText: USER_FACT_SOURCE_TEXT,
    metric: {
      label: point.label,
      displayValue,
      numericValue: Number(point.valueText),
      unit: point.unit
    },
    ...(replacesFactId !== undefined ? { replacesFactId } : {})
  };
}

function validateTitle(title: string): string | null {
  if (title.trim().length === 0) {
    return "title 不可為空白";
  }
  if (title.trim().length > CHART_EDIT_LIMITS.maxLabelLength) {
    return `title 長度超過上限 ${CHART_EDIT_LIMITS.maxLabelLength}`;
  }
  return null;
}

function validatePointCount(count: number): string | null {
  if (count === 0) {
    return "points 不可為空";
  }
  if (count > CHART_EDIT_LIMITS.maxPointsPerChart) {
    return `points 數量 ${count} 超過上限 ${CHART_EDIT_LIMITS.maxPointsPerChart}`;
  }
  return null;
}

function validateUserPoint(point: UserPointInput): string | null {
  if (point.label.trim().length === 0) {
    return "label 不可為空白";
  }
  if (point.label.trim().length > CHART_EDIT_LIMITS.maxLabelLength) {
    return `label 長度超過上限 ${CHART_EDIT_LIMITS.maxLabelLength}`;
  }
  if (point.valueText.length > CHART_EDIT_LIMITS.maxValueTextLength) {
    return `valueText 長度超過上限 ${CHART_EDIT_LIMITS.maxValueTextLength}`;
  }
  if (!VALUE_TEXT_PATTERN.test(point.valueText)) {
    return `valueText "${point.valueText}" 不是合法的數字字面`;
  }
  if (!Number.isFinite(Number(point.valueText))) {
    return `valueText "${point.valueText}" 解析後不是有限數`;
  }
  if (point.unit !== null && point.unit.length > CHART_EDIT_LIMITS.maxUnitLength) {
    return `unit 長度超過上限 ${CHART_EDIT_LIMITS.maxUnitLength}`;
  }
  return null;
}
