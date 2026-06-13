import type { EditRevisionRequestContract } from "@slides-agent/contracts";
import type {
  ChartOperation,
  ChartVisualOverride,
  EditDataPoint,
  Slide,
  SlideDeck,
  SlideOutlineItem,
  SlideTextStyleOverrides,
  TextStyleOverride,
  UserPointInput
} from "@slides-agent/domain";

/**
 * 010 (US1, data-model §7): the editor's immutable working model. Every mutator
 * returns a NEW draft (never mutates) so React state updates stay predictable. The
 * draft carries the full working `SlideDeck` — including the read-only contentBlocks
 * and non-editable fields — so retained slides can be echoed back by id; the server
 * re-derives those from base regardless (FR-021). New slides are pure-text
 * placeholders; the server assigns their real type/layout on merge.
 */

const NEUTRAL_BULLET = (id: string): SlideOutlineItem => ({
  id,
  text: "",
  sourceTrace: [],
  emphasis: "context"
});

function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

function defaultNewId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? `new-${c.randomUUID()}` : `new-${Math.random().toString(36).slice(2)}`;
}

/** A fresh, pure-text slide. type/layout here are placeholders the server overrides. */
function makeNewSlide(id: string): Slide {
  return {
    id,
    slideKind: "content",
    type: "content",
    title: "",
    message: "",
    outline: [],
    layout: "title-bullets",
    layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
    contentBlocks: [],
    sourceTrace: [],
    speakerNotesDraft: ""
  };
}

export class EditableSlideDraft {
  private constructor(
    readonly baseRevision: number,
    readonly deck: SlideDeck,
    private readonly newId: () => string,
    /** 014: pending structured chart edits, submitted with the save body. */
    readonly chartOperations: readonly ChartOperation[] = []
  ) {}

  static fromRevision(
    baseRevision: number,
    slideDeck: SlideDeck,
    newId: () => string = defaultNewId,
    chartOperations: readonly ChartOperation[] = []
  ): EditableSlideDraft {
    // 015 (FR-015): lazily backfill stable bullet ids on legacy revisions — once,
    // at construction, so they stay stable for the whole editing session. Text is
    // untouched; the ids persist with the NEXT save (the old revision is immutable).
    const withIds: SlideDeck = {
      ...slideDeck,
      slides: slideDeck.slides.map((slide) =>
        slide.outline.some((item) => !item.id)
          ? {
              ...slide,
              outline: slide.outline.map((item) => (item.id ? item : { ...item, id: newId() }))
            }
          : slide
      )
    };
    return new EditableSlideDraft(baseRevision, withIds, newId, chartOperations);
  }

  get slides(): readonly Slide[] {
    return this.deck.slides;
  }

  slide(slideId: string): Slide | undefined {
    return this.deck.slides.find((s) => s.id === slideId);
  }

  private withDeck(deck: SlideDeck): EditableSlideDraft {
    return new EditableSlideDraft(this.baseRevision, deck, this.newId, this.chartOperations);
  }

  private withOps(chartOperations: readonly ChartOperation[]): EditableSlideDraft {
    return new EditableSlideDraft(this.baseRevision, this.deck, this.newId, chartOperations);
  }

  private mapSlide(slideId: string, fn: (slide: Slide) => Slide): EditableSlideDraft {
    return this.withDeck({
      ...this.deck,
      slides: this.deck.slides.map((s) => (s.id === slideId ? fn(s) : s))
    });
  }

  setTitle(slideId: string, title: string): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => ({ ...s, title }));
  }

  setMessage(slideId: string, message: string): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => ({ ...s, message }));
  }

  setNotes(slideId: string, speakerNotesDraft: string): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => ({ ...s, speakerNotesDraft }));
  }

  setOutlineText(slideId: string, index: number, text: string): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => ({
      ...s,
      outline: s.outline.map((item, i) => (i === index ? { ...item, text } : item))
    }));
  }

  addBullet(slideId: string, atIndex?: number): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => {
      const outline = [...s.outline];
      const at = atIndex ?? outline.length;
      outline.splice(Math.max(0, Math.min(at, outline.length)), 0, NEUTRAL_BULLET(this.newId()));
      return { ...s, outline };
    });
  }

  removeBullet(slideId: string, index: number): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => {
      const removed = s.outline[index];
      const outline = s.outline.filter((_, i) => i !== index);
      // 015 (FR-010): the bullet's style entry leaves with it — no orphans.
      return withSlideOverrides(
        { ...s, outline },
        removed?.id ? dropOutlineEntry(s.textStyleOverrides, removed.id) : s.textStyleOverrides
      );
    });
  }

  moveBullet(slideId: string, from: number, to: number): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => ({ ...s, outline: reorder(s.outline, from, to) }));
  }

  addSlide(afterId?: string): EditableSlideDraft {
    const slide = makeNewSlide(this.newId());
    const slides = [...this.deck.slides];
    const afterIndex = afterId ? slides.findIndex((s) => s.id === afterId) : slides.length - 1;
    const insertAt = afterIndex < 0 ? slides.length : afterIndex + 1;
    slides.splice(insertAt, 0, slide);
    return this.withDeck({ ...this.deck, slides });
  }

  removeSlide(slideId: string): EditableSlideDraft {
    return new EditableSlideDraft(
      this.baseRevision,
      {
        ...this.deck,
        slides: this.deck.slides.filter((s) => s.id !== slideId)
      },
      this.newId,
      pruneOperationsForRemovedSlide(this.chartOperations, slideId, this.baseRevision)
    );
  }

  moveSlide(from: number, to: number): EditableSlideDraft {
    return this.withDeck({ ...this.deck, slides: reorder(this.deck.slides, from, to) });
  }

  // --- 015 US3: per-field text style overrides (FR-007/008/010/011) ---

  /**
   * Merges a style patch into the title override. A key explicitly set to
   * `undefined` clears that axis (single-property reset); an empty result drops
   * the whole entry.
   */
  setTitleStyle(slideId: string, patch: TextStylePatch): EditableSlideDraft {
    return this.patchFieldStyle(slideId, "title", patch);
  }

  setMessageStyle(slideId: string, patch: TextStylePatch): EditableSlideDraft {
    return this.patchFieldStyle(slideId, "message", patch);
  }

  /** Same merge semantics, addressed by the bullet's stable id (FR-015). */
  setOutlineStyle(slideId: string, outlineId: string, patch: TextStylePatch): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => {
      const current = s.textStyleOverrides?.outlineById?.[outlineId];
      const merged = mergeOverride(current, patch);
      const entries = { ...s.textStyleOverrides?.outlineById };
      if (merged) {
        entries[outlineId] = merged;
      } else {
        delete entries[outlineId];
      }
      return withSlideOverrides(s, {
        title: s.textStyleOverrides?.title,
        message: s.textStyleOverrides?.message,
        outlineById: Object.keys(entries).length > 0 ? entries : undefined
      });
    });
  }

  /** Full reset for a field: the whole override entry disappears (FR-011). */
  resetFieldStyle(slideId: string, field: "title" | "message"): EditableSlideDraft {
    return this.mapSlide(slideId, (s) =>
      withSlideOverrides(s, {
        title: field === "title" ? undefined : s.textStyleOverrides?.title,
        message: field === "message" ? undefined : s.textStyleOverrides?.message,
        outlineById: s.textStyleOverrides?.outlineById
      })
    );
  }

  resetOutlineStyle(slideId: string, outlineId: string): EditableSlideDraft {
    return this.setOutlineStyle(slideId, outlineId, {
      sizePx: undefined,
      color: undefined
    });
  }

  private patchFieldStyle(
    slideId: string,
    field: "title" | "message",
    patch: TextStylePatch
  ): EditableSlideDraft {
    const merged = (s: Slide) => mergeOverride(s.textStyleOverrides?.[field], patch);
    return this.mapSlide(slideId, (s) =>
      withSlideOverrides(s, {
        title: field === "title" ? merged(s) : s.textStyleOverrides?.title,
        message: field === "message" ? merged(s) : s.textStyleOverrides?.message,
        outlineById: s.textStyleOverrides?.outlineById
      })
    );
  }

  // --- 014: structured chart edits (the only legal chart channel, FR-021) ---

  /**
   * Records a visual override for an intent; a later call on the same intent
   * replaces the earlier one (the operation list stays minimal, R10).
   */
  setChartVisual(chartIntentId: string, visual: ChartVisualOverride): EditableSlideDraft {
    const kept = this.chartOperations.filter(
      (op) => !(op.op === "set_visual" && op.chartIntentId === chartIntentId)
    );
    return this.withOps([...kept, { op: "set_visual", chartIntentId, visual }]);
  }

  /** Drops every pending operation for the intent (back to the base render). */
  resetChartEdits(chartIntentId: string): EditableSlideDraft {
    return this.withOps(
      this.chartOperations.filter((op) => operationIntentId(op) !== chartIntentId)
    );
  }

  /**
   * Removes a chart placement. A pending `add_chart` on the same slide that would
   * yield this intent is simply cancelled; otherwise a `remove_chart` op is recorded.
   * The deck's contentBlocks stay pristine (010 read-only wall) — placement state
   * is derived by replaying the ops (`placedChartId`).
   */
  removeChart(slideId: string, chartIntentId: string): EditableSlideDraft {
    const pendingAddIndex = this.chartOperations.findIndex(
      (op, index) =>
        op.op === "add_chart" &&
        op.slideId === slideId &&
        this.addedIntentId(op, index) === chartIntentId
    );
    if (pendingAddIndex >= 0) {
      return this.withOps(this.chartOperations.filter((_, index) => index !== pendingAddIndex));
    }
    return this.withOps([...this.chartOperations, { op: "remove_chart", slideId, chartIntentId }]);
  }

  /** Places an existing intent on a slide; cancels a pending removal of the same pair. */
  addChartFromIntent(slideId: string, chartIntentId: string): EditableSlideDraft {
    const pendingRemoveIndex = this.chartOperations.findIndex(
      (op) =>
        op.op === "remove_chart" && op.slideId === slideId && op.chartIntentId === chartIntentId
    );
    if (pendingRemoveIndex >= 0) {
      return this.withOps(this.chartOperations.filter((_, index) => index !== pendingRemoveIndex));
    }
    return this.withOps([
      ...this.chartOperations,
      { op: "add_chart", slideId, source: { kind: "existing_intent", chartIntentId } }
    ]);
  }

  /** US4: places a brand-new chart built from user-entered points. */
  addChartFromUserData(
    slideId: string,
    source: { title: string; visual: ChartVisualOverride; points: UserPointInput[] }
  ): EditableSlideDraft {
    return this.withOps([
      ...this.chartOperations,
      { op: "add_chart", slideId, source: { kind: "user_data", ...source } }
    ]);
  }

  /**
   * The chart intent EFFECTIVELY placed on a slide after replaying the pending ops
   * over the base placeholder. Pending user_data adds resolve to the deterministic
   * id the domain will mint (`chart_user_r{baseRevision}_{opIndex}`), so the UI and
   * the live preview's render evidence agree on ids before the save happens.
   */
  placedChartId(slideId: string): string | null {
    const target = this.slide(slideId);
    if (!target) return null;
    let current =
      target.contentBlocks.find(
        (block) => block.kind === "chart_placeholder" && block.chartIntentId
      )?.chartIntentId ?? null;
    for (const [index, op] of this.chartOperations.entries()) {
      if (op.op === "remove_chart" && op.slideId === slideId && op.chartIntentId === current) {
        current = null;
      } else if (op.op === "add_chart" && op.slideId === slideId) {
        current = this.addedIntentId(op, index);
      }
    }
    return current;
  }

  private addedIntentId(op: Extract<ChartOperation, { op: "add_chart" }>, opIndex: number): string {
    return op.source.kind === "existing_intent"
      ? op.source.chartIntentId
      : syntheticUserIntentId(this.baseRevision, opIndex);
  }

  /**
   * US3: records the intent's FULL point list (array order = display order); a later
   * edit on the same intent replaces the earlier one. `title` is included only when
   * the user actually changed it.
   */
  editChartData(
    chartIntentId: string,
    points: EditDataPoint[],
    title?: string
  ): EditableSlideDraft {
    const kept = this.chartOperations.filter(
      (op) => !(op.op === "edit_data" && op.chartIntentId === chartIntentId)
    );
    return this.withOps([
      ...kept,
      { op: "edit_data", chartIntentId, points, ...(title !== undefined ? { title } : {}) }
    ]);
  }

  /** The pending data edit for an intent (the table's working state), or null. */
  chartDataOf(chartIntentId: string): { points: EditDataPoint[]; title?: string } | null {
    const found = this.chartOperations.find(
      (op): op is Extract<ChartOperation, { op: "edit_data" }> =>
        op.op === "edit_data" && op.chartIntentId === chartIntentId
    );
    if (!found) return null;
    return { points: found.points, ...(found.title !== undefined ? { title: found.title } : {}) };
  }

  /** The pending visual override for an intent; "auto" when none recorded. */
  chartVisualOf(chartIntentId: string): ChartVisualOverride {
    const found = this.chartOperations.find(
      (op): op is Extract<ChartOperation, { op: "set_visual" }> =>
        op.op === "set_visual" && op.chartIntentId === chartIntentId
    );
    return found?.visual ?? "auto";
  }

  toRequest(): EditRevisionRequestContract {
    return {
      baseRevision: this.baseRevision,
      slideDeck: this.deck,
      ...(this.chartOperations.length > 0 ? { chartOperations: [...this.chartOperations] } : {})
    };
  }
}

/**
 * 015: editing patch for one field's style. Unlike the stored TextStyleOverride, a
 * key EXPLICITLY set to `undefined` means "clear this axis" (single-property reset),
 * while an absent key means "leave alone" — distinguished via `"key" in patch`.
 */
export interface TextStylePatch {
  sizePx?: number | undefined;
  color?: string | undefined;
}

/** Working shape while editing: branches may be explicitly undefined (= dropped). */
interface OverridesDraft {
  title?: TextStyleOverride | undefined;
  message?: TextStyleOverride | undefined;
  outlineById?: Record<string, TextStyleOverride> | undefined;
}

/** Merges a patch over the current override; undefined when nothing remains. */
function mergeOverride(
  current: TextStyleOverride | undefined,
  patch: TextStylePatch
): TextStyleOverride | undefined {
  const sizePx = "sizePx" in patch ? patch.sizePx : current?.sizePx;
  const color = "color" in patch ? patch.color : current?.color;
  const next: TextStyleOverride = {
    ...(typeof sizePx === "number" ? { sizePx } : {}),
    ...(color ? { color } : {})
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Rebuilds the slide with canonical overrides: empty branches and entries drop out. */
function withSlideOverrides(slide: Slide, overrides: OverridesDraft | undefined): Slide {
  const canonical: SlideTextStyleOverrides = {
    ...(overrides?.title ? { title: overrides.title } : {}),
    ...(overrides?.message ? { message: overrides.message } : {}),
    ...(overrides?.outlineById && Object.keys(overrides.outlineById).length > 0
      ? { outlineById: overrides.outlineById }
      : {})
  };
  const { textStyleOverrides: _dropped, ...rest } = slide;
  return Object.keys(canonical).length > 0 ? { ...rest, textStyleOverrides: canonical } : rest;
}

function dropOutlineEntry(
  overrides: SlideTextStyleOverrides | undefined,
  outlineId: string
): SlideTextStyleOverrides | undefined {
  if (!overrides?.outlineById?.[outlineId]) {
    return overrides;
  }
  const { [outlineId]: _removed, ...kept } = overrides.outlineById;
  return { ...overrides, outlineById: kept };
}

function pruneOperationsForRemovedSlide(
  operations: readonly ChartOperation[],
  slideId: string,
  baseRevision: number
): ChartOperation[] {
  const removedSyntheticIds = new Set<string>();
  operations.forEach((op, index) => {
    if (op.op === "add_chart" && op.slideId === slideId && op.source.kind === "user_data") {
      removedSyntheticIds.add(syntheticUserIntentId(baseRevision, index));
    }
  });

  const provisional = operations.filter((op) => {
    if ((op.op === "add_chart" || op.op === "remove_chart") && op.slideId === slideId) {
      return false;
    }
    const target = operationIntentId(op);
    return !target || !removedSyntheticIds.has(target);
  });

  const remap = new Map<string, string>();
  provisional.forEach((op, newIndex) => {
    if (op.op !== "add_chart" || op.source.kind !== "user_data") return;
    const oldIndex = operations.indexOf(op);
    remap.set(
      syntheticUserIntentId(baseRevision, oldIndex),
      syntheticUserIntentId(baseRevision, newIndex)
    );
  });

  return provisional.map((op) => remapOperationIntent(op, remap));
}

function syntheticUserIntentId(baseRevision: number, opIndex: number): string {
  return `chart_user_r${baseRevision}_${opIndex}`;
}

function remapOperationIntent(op: ChartOperation, remap: Map<string, string>): ChartOperation {
  switch (op.op) {
    case "set_visual":
    case "remove_chart":
    case "edit_data": {
      const chartIntentId = remap.get(op.chartIntentId);
      return chartIntentId ? { ...op, chartIntentId } : op;
    }
    case "add_chart":
      if (op.source.kind !== "existing_intent") {
        return op;
      }
      return remap.has(op.source.chartIntentId)
        ? { ...op, source: { ...op.source, chartIntentId: remap.get(op.source.chartIntentId)! } }
        : op;
  }
}

/** The intent a chart operation targets (add_chart user_data has none yet → null). */
function operationIntentId(op: ChartOperation): string | null {
  switch (op.op) {
    case "set_visual":
    case "remove_chart":
    case "edit_data":
      return op.chartIntentId;
    case "add_chart":
      return op.source.kind === "existing_intent" ? op.source.chartIntentId : null;
  }
}
