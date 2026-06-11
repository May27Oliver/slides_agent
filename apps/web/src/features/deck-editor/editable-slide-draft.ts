import type { EditRevisionRequestContract } from "@slides-agent/contracts";
import type {
  ChartOperation,
  ChartVisualOverride,
  Slide,
  SlideDeck,
  SlideOutlineItem
} from "@slides-agent/domain";

/**
 * 010 (US1, data-model §7): the editor's immutable working model. Every mutator
 * returns a NEW draft (never mutates) so React state updates stay predictable. The
 * draft carries the full working `SlideDeck` — including the read-only contentBlocks
 * and non-editable fields — so retained slides can be echoed back by id; the server
 * re-derives those from base regardless (FR-021). New slides are pure-text
 * placeholders; the server assigns their real type/layout on merge.
 */

const NEUTRAL_BULLET = (): SlideOutlineItem => ({
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
    return new EditableSlideDraft(baseRevision, slideDeck, newId, chartOperations);
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
      outline.splice(Math.max(0, Math.min(at, outline.length)), 0, NEUTRAL_BULLET());
      return { ...s, outline };
    });
  }

  removeBullet(slideId: string, index: number): EditableSlideDraft {
    return this.mapSlide(slideId, (s) => ({
      ...s,
      outline: s.outline.filter((_, i) => i !== index)
    }));
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
    return this.withDeck({
      ...this.deck,
      slides: this.deck.slides.filter((s) => s.id !== slideId)
    });
  }

  moveSlide(from: number, to: number): EditableSlideDraft {
    return this.withDeck({ ...this.deck, slides: reorder(this.deck.slides, from, to) });
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
