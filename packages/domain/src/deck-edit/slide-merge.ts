import type {
  LayoutIntent,
  Slide,
  SlideDeck,
  SlideKind,
  SlideOutlineEmphasis,
  SlideOutlineItem,
  SlideType
} from "@/deck/deck.types";

/**
 * 010 (US1, data-model §3/§4): merge a client-edited deck onto the server-loaded
 * base, by slide `id`. The merge is the authority for the read-only / source-fidelity
 * guarantees (FR-021): retained slides take their read-only blocks and non-editable
 * fields from base; any client divergence on those is rejected (not silently
 * ignored); new slides must be pure text. Pure function — no I/O, no LLM.
 */
export type SlideMergeResult =
  | { ok: true; slideDeck: SlideDeck }
  | { ok: false; rejection: "INVALID_EDIT"; detail: string };

// Server-assigned defaults for a newly added (pure-text) slide. The client has no
// authority over these — there is no base slide to compare against (FR-021).
const DEFAULT_TYPE: SlideType = "content";
const DEFAULT_SLIDE_KIND: SlideKind = "content";
const DEFAULT_LAYOUT = "title-bullets";
const DEFAULT_LAYOUT_INTENT: LayoutIntent = {
  priority: "message_first",
  density: "medium",
  emphasis: "narrative"
};
// Neutral emphasis for user-authored bullets — we do not claim a semantic role we
// cannot ground (CR-001).
const DEFAULT_EMPHASIS: SlideOutlineEmphasis = "context";

export function mergeEditedDeck(base: SlideDeck, edited: SlideDeck): SlideMergeResult {
  const baseById = new Map(base.slides.map((s) => [s.id, s]));

  const seen = new Set<string>();
  const mergedSlides: Slide[] = [];

  for (const editedSlide of edited.slides) {
    if (seen.has(editedSlide.id)) {
      return reject(`duplicate slide id "${editedSlide.id}"`);
    }
    seen.add(editedSlide.id);

    const baseSlide = baseById.get(editedSlide.id);
    if (baseSlide) {
      const tamper = detectReadonlyTamper(baseSlide, editedSlide);
      if (tamper) {
        return reject(tamper);
      }
      mergedSlides.push({
        // Read-only blocks + non-editable fields are authoritative from base.
        ...baseSlide,
        // Whitelisted, user-editable text.
        title: editedSlide.title,
        message: editedSlide.message,
        speakerNotesDraft: editedSlide.speakerNotesDraft,
        outline: mergeOutline(baseSlide.outline, editedSlide.outline)
      });
    } else {
      // New slide: pure text only. Smuggling content blocks injects charts (FR-021).
      if (editedSlide.contentBlocks.length > 0) {
        return reject(`new slide "${editedSlide.id}" must not carry content blocks`);
      }
      mergedSlides.push({
        id: editedSlide.id,
        slideKind: DEFAULT_SLIDE_KIND,
        type: DEFAULT_TYPE,
        title: editedSlide.title,
        message: editedSlide.message,
        outline: editedSlide.outline.map((item) => ({
          text: item.text,
          sourceTrace: [],
          emphasis: DEFAULT_EMPHASIS
        })),
        layout: DEFAULT_LAYOUT,
        layoutIntent: DEFAULT_LAYOUT_INTENT,
        contentBlocks: [],
        sourceTrace: [],
        speakerNotesDraft: editedSlide.speakerNotesDraft
      });
    }
  }

  return {
    ok: true,
    // Deck-level fields stay from base; only the slide set/order/text changes.
    // title/subtitle are NOT editable this batch (I2).
    slideDeck: { ...base, slides: mergedSlides }
  };
}

/**
 * Returns a rejection reason when a retained slide's read-only blocks or non-editable
 * fields diverge from base, else null. The client must echo these back unchanged.
 */
function detectReadonlyTamper(base: Slide, edited: Slide): string | null {
  if (!deepEqual(base.contentBlocks, edited.contentBlocks)) {
    return `slide "${base.id}" content blocks are read-only`;
  }
  if (edited.type !== base.type) {
    return `slide "${base.id}" type is read-only`;
  }
  if (edited.slideKind !== base.slideKind) {
    return `slide "${base.id}" slideKind is read-only`;
  }
  if (edited.layout !== base.layout) {
    return `slide "${base.id}" layout is read-only`;
  }
  if (!deepEqual(base.layoutIntent, edited.layoutIntent)) {
    return `slide "${base.id}" layoutIntent is read-only`;
  }
  return null;
}

/**
 * Outline fidelity (FR-003a): bullets have no stable id, so match by text against a
 * FIFO pool of base bullets. An unchanged bullet reuses its base sourceTrace/emphasis;
 * a rewritten or newly-added bullet gets an empty trace + neutral emphasis (we never
 * fabricate a source for user-authored text).
 */
function mergeOutline(
  baseOutline: SlideOutlineItem[],
  editedOutline: SlideOutlineItem[]
): SlideOutlineItem[] {
  const pool = new Map<string, SlideOutlineItem[]>();
  for (const item of baseOutline) {
    const queue = pool.get(item.text);
    if (queue) {
      queue.push(item);
    } else {
      pool.set(item.text, [item]);
    }
  }

  return editedOutline.map((item) => {
    const queue = pool.get(item.text);
    const matched = queue?.shift();
    if (matched) {
      return { text: item.text, sourceTrace: matched.sourceTrace, emphasis: matched.emphasis };
    }
    return { text: item.text, sourceTrace: [], emphasis: DEFAULT_EMPHASIS };
  });
}

function reject(detail: string): SlideMergeResult {
  return { ok: false, rejection: "INVALID_EDIT", detail };
}

/** Structural deep equality: order-sensitive for arrays, key-order-insensitive for objects. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
  return false;
}
