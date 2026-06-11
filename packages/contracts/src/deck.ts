/**
 * Read-only "my decks" API contracts (feature 006 US3). Shapes mirror the API
 * responses for `GET /api/decks` and `GET /api/decks/:id`. The structured
 * `slideDeck` / `designPlan` / `generationSummary` payloads stay `unknown` here so
 * the web layer never re-declares domain types it only forwards to the renderer.
 */

import { parseThemeSelection, type ThemeSelectionContract } from "./theme-selection";

export interface DeckSummaryContract {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export interface DeckListResponseContract {
  decks: DeckSummaryContract[];
}

export interface DeckRevisionContract {
  revision: number;
  slideDeck: unknown;
  designPlan: unknown | null;
  html: string | null;
  generationSummary: unknown | null;
  /**
   * 010 (C1/FR-006a): planned chart intents for this revision, so the client
   * LivePreview can redraw charts with the same domain renderer the server uses.
   * Opaque here (the web layer forwards it to the renderer, never re-declares it);
   * null for legacy revisions written before the column existed.
   */
  chartIntents: unknown | null;
  origin: "generation" | "edit";
  sourceJobId: string | null;
  createdAt: string;
}

export interface DeckDetailResponseContract {
  id: string;
  title: string;
  status: string;
  sourceContent: string;
  deckBrief: unknown;
  // Null only for the (unexpected) case of a deck with no current revision; the
  // generation flow always writes one, but the read path stays defensive.
  currentRevision: DeckRevisionContract | null;
}

/** Unified not-found shape; never reveals whether the id exists for another account. */
export interface DeckNotFoundContract {
  code: "DECK_NOT_FOUND";
  message: string;
}

/**
 * 010 (US1, FR-007): body for `POST /api/decks/:id/revisions`. Locked to the base
 * revision the client edited from (optimistic concurrency, FR-020) plus the edited
 * deck. `slideDeck` stays opaque here — the server re-loads the base and merges by
 * slide id (FR-021), so it never trusts the client's read-only blocks / structure.
 */
export interface EditRevisionRequestContract {
  baseRevision: number;
  slideDeck: unknown;
  /** 011: optional manual theme override; re-themes deterministically (no LLM). */
  themeSelection?: ThemeSelectionContract;
  /**
   * 014: optional structured chart operations (the only legal chart-edit channel).
   * Shape-validated here; semantics (id existence, ownership, limits per chart)
   * are enforced by the domain `applyChartOperations`.
   */
  chartOperations?: unknown[];
}

/** 409: the base the client edited from is no longer current (FR-020). */
export interface RevisionConflictContract {
  code: "REVISION_CONFLICT";
  message: string;
  /** Current (latest) revision number, so the client can reload and rebase. */
  currentRevision: number;
}

/** 400: malformed body, or read-only/structure tampering rejected by merge (FR-021). */
export interface InvalidEditContract {
  code: "INVALID_EDIT";
  message: string;
  fields?: string[];
}

export type DeckContractValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

const ORIGINS = new Set(["generation", "edit"]);

export function validateDeckListResponse(
  input: unknown
): DeckContractValidationResult<DeckListResponseContract> {
  if (!isRecord(input) || !Array.isArray(input.decks)) {
    return invalid(["response must have a decks array"]);
  }

  const issues: string[] = [];
  input.decks.forEach((deck, index) => {
    if (!isValidSummary(deck)) {
      issues.push(`decks[${index}] is invalid`);
    }
  });

  return issues.length === 0
    ? { ok: true, value: input as unknown as DeckListResponseContract }
    : invalid(issues);
}

export function validateDeckDetailResponse(
  input: unknown
): DeckContractValidationResult<DeckDetailResponseContract> {
  if (!isRecord(input)) {
    return invalid(["response must be an object"]);
  }

  const issues: string[] = [];
  requireString(input, "id", issues);
  requireString(input, "title", issues);
  requireString(input, "status", issues);
  requireString(input, "sourceContent", issues);

  if (!isRecord(input.deckBrief)) {
    issues.push("deckBrief must be an object");
  }

  if (input.currentRevision !== null && !isValidRevision(input.currentRevision)) {
    issues.push("currentRevision is invalid");
  }

  return issues.length === 0
    ? { ok: true, value: input as unknown as DeckDetailResponseContract }
    : invalid(issues);
}

// Defensive upper bounds on user-editable text so a single request can't store a
// multi-megabyte JSONB blob or feed an oversized render (storage/CPU abuse). Generous
// vs. realistic slide content; exceeding these is a 400, never silent truncation.
const MAX_SLIDES = 200;
const MAX_BULLETS_PER_SLIDE = 100;
const FIELD_LIMITS = { title: 400, message: 2000, bullet: 1000, notes: 8000 } as const;

/**
 * 010 (FR-007 step 1): validate the request body shape before the server loads the
 * base or merges. A malformed body is a 400 `INVALID_EDIT`. Deeper rules (read-only
 * tampering, structure injection) are enforced by the domain merge, not here.
 */
export function validateEditRevisionRequest(
  input: unknown
): DeckContractValidationResult<EditRevisionRequestContract> {
  if (!isRecord(input)) {
    return invalid(["request must be an object"]);
  }

  const issues: string[] = [];
  if (!Number.isInteger(input.baseRevision) || (input.baseRevision as number) < 0) {
    issues.push("baseRevision must be a non-negative integer");
  }

  const slides = (input.slideDeck as { slides?: unknown } | undefined)?.slides;
  if (!isRecord(input.slideDeck) || !Array.isArray(slides)) {
    issues.push("slideDeck must be an object with a slides array");
  } else {
    if (slides.length > MAX_SLIDES) {
      issues.push(`slideDeck.slides exceeds ${MAX_SLIDES}`);
    }
    slides.forEach((slide, index) => validateSlideShape(slide, index, issues));
  }

  // 011: optional manual theme override (shared validator — same rules as the
  // preview request, no drift). Malformed types add to the same 400 issue list.
  const themeSelection = parseThemeSelection(input.themeSelection);
  if (!themeSelection.ok) {
    issues.push(...themeSelection.fields);
  }

  // 014: optional chart operations — shape only; semantics stay in the domain.
  validateChartOperationsShape(input.chartOperations, issues);

  return issues.length === 0
    ? { ok: true, value: input as unknown as EditRevisionRequestContract }
    : invalid(issues);
}

const MAX_CHART_OPERATIONS = 50;
const CHART_VISUAL_OVERRIDES = new Set([
  "auto",
  "pie_donut",
  "line",
  "bar",
  "metric_card",
  "table"
]);

function validateChartOperationsShape(input: unknown, issues: string[]): void {
  if (input === undefined) {
    return;
  }
  if (!Array.isArray(input)) {
    issues.push("chartOperations must be an array");
    return;
  }
  if (input.length > MAX_CHART_OPERATIONS) {
    issues.push(`chartOperations exceeds ${MAX_CHART_OPERATIONS}`);
    return;
  }
  input.forEach((operation, index) => {
    const path = `chartOperations[${index}]`;
    if (!isRecord(operation)) {
      issues.push(`${path} must be an object`);
      return;
    }
    switch (operation.op) {
      case "set_visual":
        requireNonEmptyString(operation.chartIntentId, `${path}.chartIntentId`, issues);
        if (!isStringInSet(operation.visual, CHART_VISUAL_OVERRIDES)) {
          issues.push(`${path}.visual must be one of auto/pie_donut/line/bar/metric_card/table`);
        }
        return;
      case "remove_chart":
        requireNonEmptyString(operation.slideId, `${path}.slideId`, issues);
        requireNonEmptyString(operation.chartIntentId, `${path}.chartIntentId`, issues);
        return;
      case "add_chart":
        requireNonEmptyString(operation.slideId, `${path}.slideId`, issues);
        validateAddChartSource(operation.source, `${path}.source`, issues);
        return;
      case "edit_data":
        requireNonEmptyString(operation.chartIntentId, `${path}.chartIntentId`, issues);
        if (operation.title !== undefined && typeof operation.title !== "string") {
          issues.push(`${path}.title must be a string`);
        }
        validateEditDataPoints(operation.points, `${path}.points`, issues);
        return;
      default:
        issues.push(`${path}.op must be one of set_visual/remove_chart/add_chart/edit_data`);
    }
  });
}

function validateAddChartSource(source: unknown, path: string, issues: string[]): void {
  if (!isRecord(source)) {
    issues.push(`${path} must be an object`);
    return;
  }
  if (source.kind === "existing_intent") {
    requireNonEmptyString(source.chartIntentId, `${path}.chartIntentId`, issues);
    return;
  }
  if (source.kind === "user_data") {
    requireNonEmptyString(source.title, `${path}.title`, issues);
    if (!isStringInSet(source.visual, CHART_VISUAL_OVERRIDES)) {
      issues.push(`${path}.visual must be one of auto/pie_donut/line/bar/metric_card/table`);
    }
    if (!Array.isArray(source.points)) {
      issues.push(`${path}.points must be an array`);
      return;
    }
    source.points.forEach((point, index) =>
      validateUserPointShape(point, `${path}.points[${index}]`, issues)
    );
    return;
  }
  issues.push(`${path}.kind must be existing_intent or user_data`);
}

function validateEditDataPoints(points: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(points)) {
    issues.push(`${path} must be an array`);
    return;
  }
  points.forEach((point, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(point)) {
      issues.push(`${itemPath} must be an object`);
      return;
    }
    if (point.kind === "original") {
      requireNonEmptyString(point.sourceFactId, `${itemPath}.sourceFactId`, issues);
      return;
    }
    if (point.kind === "user") {
      validateUserPointShape(point.point, `${itemPath}.point`, issues);
      if (point.replacesFactId !== undefined && typeof point.replacesFactId !== "string") {
        issues.push(`${itemPath}.replacesFactId must be a string`);
      }
      return;
    }
    issues.push(`${itemPath}.kind must be original or user`);
  });
}

function validateUserPointShape(point: unknown, path: string, issues: string[]): void {
  if (!isRecord(point)) {
    issues.push(`${path} must be an object`);
    return;
  }
  if (typeof point.label !== "string") {
    issues.push(`${path}.label must be a string`);
  }
  if (typeof point.valueText !== "string") {
    issues.push(`${path}.valueText must be a string`);
  }
  if (point.unit !== null && typeof point.unit !== "string") {
    issues.push(`${path}.unit must be a string or null`);
  }
}

function requireNonEmptyString(value: unknown, path: string, issues: string[]): void {
  if (typeof value !== "string" || value.length === 0) {
    issues.push(`${path} must be a non-empty string`);
  }
}

function validateSlideShape(slide: unknown, index: number, issues: string[]): void {
  if (!isRecord(slide)) {
    issues.push(`slides[${index}] must be an object`);
    return;
  }
  if (typeof slide.id !== "string" || slide.id.length === 0) {
    issues.push(`slides[${index}].id must be a non-empty string`);
  }
  if (overLimit(slide.title, FIELD_LIMITS.title)) {
    issues.push(`slides[${index}].title too long`);
  }
  if (overLimit(slide.message, FIELD_LIMITS.message)) {
    issues.push(`slides[${index}].message too long`);
  }
  if (overLimit(slide.speakerNotesDraft, FIELD_LIMITS.notes)) {
    issues.push(`slides[${index}].speakerNotesDraft too long`);
  }
  if (Array.isArray(slide.outline)) {
    if (slide.outline.length > MAX_BULLETS_PER_SLIDE) {
      issues.push(`slides[${index}].outline exceeds ${MAX_BULLETS_PER_SLIDE}`);
    }
    slide.outline.forEach((item, i) => {
      const text = isRecord(item) ? item.text : undefined;
      if (overLimit(text, FIELD_LIMITS.bullet)) {
        issues.push(`slides[${index}].outline[${i}].text too long`);
      }
    });
  }
}

function overLimit(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > max;
}

function isValidSummary(value: unknown): value is DeckSummaryContract {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isValidRevision(value: unknown): value is DeckRevisionContract {
  return (
    isRecord(value) &&
    typeof value.revision === "number" &&
    "slideDeck" in value &&
    "chartIntents" in value &&
    (value.html === null || typeof value.html === "string") &&
    isStringInSet(value.origin, ORIGINS) &&
    (value.sourceJobId === null || typeof value.sourceJobId === "string") &&
    typeof value.createdAt === "string"
  );
}

function requireString(input: Record<string, unknown>, key: string, issues: string[]): void {
  if (typeof input[key] !== "string") {
    issues.push(`${key} must be a string`);
  }
}

function isStringInSet(value: unknown, allowed: Set<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid<T>(issues: string[]): DeckContractValidationResult<T> {
  return { ok: false, issues };
}
