import type {
  FontStyleKit,
  PaletteStyleKit,
  RawStyleKit,
  StyleStyleKit,
  ThemeAppliesTo,
  ThemeKind,
  ThemeSupport
} from "@slides-agent/domain";
import type { AppDatabase } from "@/infra/db/db.service";
import { themes } from "@/infra/db/schema";

/**
 * Builtin theme seeding (feature 007 US2). One JSON element ↔ one `themes` row.
 * The seeder is idempotent (upsert by id) and *all-or-nothing*: every row's
 * kind-aware `styleKit` is validated up front, and if any row is invalid the
 * whole batch is rejected (no writes) with all offending rows reported — never a
 * partial catalogue (FR-007 / contracts §4). Reused by both the `db:seed` script
 * and tests so behaviour stays single-sourced.
 */

export interface ThemeSeed {
  readonly id: string;
  readonly kind: ThemeKind;
  readonly scope: "builtin";
  readonly name: string;
  readonly description?: string;
  readonly keywords: readonly string[];
  readonly appliesTo: ThemeAppliesTo;
  readonly support: ThemeSupport;
  readonly active?: boolean;
  readonly styleKit: FontStyleKit | PaletteStyleKit | StyleStyleKit | RawStyleKit;
}

export interface ThemeSeedIssue {
  readonly index: number;
  readonly id: string;
  readonly problems: readonly string[];
}

export interface SeedThemesResult {
  readonly total: number;
  readonly byKind: Record<ThemeKind, number>;
}

/** Thrown when one or more seeds fail validation; no rows are written. */
export class ThemeSeedValidationError extends Error {
  constructor(readonly issues: readonly ThemeSeedIssue[]) {
    super(
      `Theme seed validation failed for ${issues.length} row(s):\n` +
        issues.map((issue) => `  [${issue.index}] ${issue.id}: ${issue.problems.join("; ")}`).join("\n")
    );
    this.name = "ThemeSeedValidationError";
  }
}

const KINDS: readonly ThemeKind[] = ["font", "palette", "style"];
const SUPPORTS: readonly ThemeSupport[] = ["full", "partial", "raw"];
const APPLIES_TO: readonly ThemeAppliesTo[] = [
  "presentation",
  "landing",
  "dashboard",
  "universal"
];
const TEXTURE_OVERLAYS = ["grain", "noise", "paper"];
const GRADIENT_PRESETS = ["aurora", "mesh"];

/**
 * Validates the whole batch and upserts it inside a single transaction. Throws
 * {@link ThemeSeedValidationError} (before any write) if any row is invalid.
 */
export async function seedThemes(
  db: AppDatabase,
  seeds: readonly ThemeSeed[]
): Promise<SeedThemesResult> {
  const issues = validateThemeSeeds(seeds);
  if (issues.length > 0) {
    throw new ThemeSeedValidationError(issues);
  }

  await db.transaction(async (tx) => {
    for (const seed of seeds) {
      await tx
        .insert(themes)
        .values({
          id: seed.id,
          scope: seed.scope,
          kind: seed.kind,
          name: seed.name,
          description: seed.description ?? null,
          keywords: seed.keywords as string[],
          appliesTo: seed.appliesTo,
          support: seed.support,
          styleKit: seed.styleKit,
          active: seed.active ?? true
        })
        .onConflictDoUpdate({
          target: themes.id,
          set: {
            kind: seed.kind,
            scope: seed.scope,
            name: seed.name,
            description: seed.description ?? null,
            keywords: seed.keywords as string[],
            appliesTo: seed.appliesTo,
            support: seed.support,
            styleKit: seed.styleKit,
            active: seed.active ?? true,
            updatedAt: new Date()
          }
        });
    }
  });

  return summarize(seeds);
}

/** Pure, kind-aware validation. Returns one issue per invalid row (empty = ok). */
export function validateThemeSeeds(seeds: readonly ThemeSeed[]): ThemeSeedIssue[] {
  const issues: ThemeSeedIssue[] = [];
  const seenIds = new Set<string>();

  seeds.forEach((seed, index) => {
    const problems = validateCommon(seed);
    if (seenIds.has(seed.id)) {
      problems.push(`duplicate id within the seed batch`);
    }
    seenIds.add(seed.id);
    problems.push(...validateStyleKit(seed));
    if (problems.length > 0) {
      issues.push({ index, id: seed.id ?? "(missing id)", problems });
    }
  });

  return issues;
}

function validateCommon(seed: ThemeSeed): string[] {
  const problems: string[] = [];
  if (!isNonEmptyString(seed.id)) {
    problems.push("id must be a non-empty string");
  }
  if (!KINDS.includes(seed.kind)) {
    problems.push(`kind must be one of ${KINDS.join(" | ")}`);
  }
  if (seed.scope !== "builtin") {
    problems.push('scope must be "builtin" (007 seeds builtin only)');
  }
  if (!isNonEmptyString(seed.name)) {
    problems.push("name must be a non-empty string");
  }
  if (seed.description !== undefined && !isString(seed.description)) {
    problems.push("description must be a string when present");
  }
  if (!isStringArray(seed.keywords)) {
    problems.push("keywords must be an array of strings");
  }
  if (!APPLIES_TO.includes(seed.appliesTo)) {
    problems.push(`appliesTo must be one of ${APPLIES_TO.join(" | ")}`);
  }
  if (!SUPPORTS.includes(seed.support)) {
    problems.push(`support must be one of ${SUPPORTS.join(" | ")}`);
  }
  if (seed.active !== undefined && !isBoolean(seed.active)) {
    problems.push("active must be a boolean when present");
  }
  // font/palette are pure value rows — always full per the inventory.
  if ((seed.kind === "font" || seed.kind === "palette") && seed.support !== "full") {
    problems.push(`${seed.kind} rows must have support="full"`);
  }
  return problems;
}

function validateStyleKit(seed: ThemeSeed): string[] {
  const kit = seed.styleKit;
  if (!isObject(kit)) {
    return ["styleKit must be an object"];
  }
  if (seed.kind === "font") {
    return validateFontKit(kit);
  }
  if (seed.kind === "palette") {
    return validatePaletteKit(kit);
  }
  // kind === "style": raw vs full/partial use different shapes.
  return seed.support === "raw" ? validateRawKit(kit) : validateStructuralKit(kit);
}

function validateFontKit(kit: Record<string, unknown>): string[] {
  const fonts = kit.fonts;
  if (!isObject(fonts)) {
    return ["font styleKit.fonts must be an object"];
  }
  const problems: string[] = [];
  if (!isNonEmptyString(fonts.heading)) {
    problems.push("font styleKit.fonts.heading must be a non-empty string");
  }
  if (!isNonEmptyString(fonts.body)) {
    problems.push("font styleKit.fonts.body must be a non-empty string");
  }
  if (fonts.googleFontsHref !== undefined && !isString(fonts.googleFontsHref)) {
    problems.push("font styleKit.fonts.googleFontsHref must be a string when present");
  }
  return problems;
}

function validatePaletteKit(kit: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (!Array.isArray(kit.accentHues) || kit.accentHues.length === 0) {
    problems.push("palette styleKit.accentHues must be a non-empty array");
  } else {
    kit.accentHues.forEach((hue, i) => {
      if (!isObject(hue) || !isNonEmptyString(hue.name) || !isNonEmptyString(hue.base) || !isNonEmptyString(hue.gradient)) {
        problems.push(`palette styleKit.accentHues[${i}] must have name/base/gradient strings`);
      }
    });
  }
  if (!isNonEmptyString(kit.accentGradient)) {
    problems.push("palette styleKit.accentGradient must be a non-empty string");
  }
  if (!isObject(kit.background) || !isNonEmptyString(kit.background.css)) {
    problems.push("palette styleKit.background.css must be a non-empty string");
  }
  if (!isNonEmptyString(kit.cardSurface)) {
    problems.push("palette styleKit.cardSurface must be a non-empty string");
  }
  if (!isNonEmptyString(kit.cardBorder)) {
    problems.push("palette styleKit.cardBorder must be a non-empty string");
  }
  return problems;
}

function validateRawKit(kit: Record<string, unknown>): string[] {
  return isNonEmptyString(kit.rawDesignSystemVariables)
    ? []
    : ["raw style styleKit.rawDesignSystemVariables must be a non-empty string"];
}

function validateStructuralKit(kit: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const effects = kit.effects;
  if (!isObject(effects)) {
    problems.push("style styleKit.effects must be an object");
  } else {
    if (!isFiniteNumber(effects.cardRadiusPx)) {
      problems.push("style styleKit.effects.cardRadiusPx must be a number");
    }
    if (!isNonEmptyString(effects.cardShadow)) {
      problems.push("style styleKit.effects.cardShadow must be a non-empty string");
    }
    if (effects.cardBackdropBlurPx !== undefined && !isFiniteNumber(effects.cardBackdropBlurPx)) {
      problems.push("style styleKit.effects.cardBackdropBlurPx must be a number when present");
    }
    if (effects.glow !== undefined && !isString(effects.glow)) {
      problems.push("style styleKit.effects.glow must be a string when present");
    }
  }
  problems.push(...validateMotion(kit.motion));
  problems.push(...validateBackgroundStructure(kit.backgroundStructure));
  return problems;
}

function validateMotion(motion: unknown): string[] {
  if (!isObject(motion)) {
    return ["style styleKit.motion must be an object"];
  }
  const numberFields = ["slideTransitionMs", "entranceMs", "staggerStepMs", "microMs"];
  const problems = numberFields
    .filter((field) => !isFiniteNumber(motion[field]))
    .map((field) => `style styleKit.motion.${field} must be a number`);
  if (!isNonEmptyString(motion.slideEasing)) {
    problems.push("style styleKit.motion.slideEasing must be a non-empty string");
  }
  if (!isBoolean(motion.respectReducedMotion)) {
    problems.push("style styleKit.motion.respectReducedMotion must be a boolean");
  }
  return problems;
}

function validateBackgroundStructure(structure: unknown): string[] {
  if (structure === undefined) {
    return [];
  }
  if (!isObject(structure)) {
    return ["style styleKit.backgroundStructure must be an object when present"];
  }
  const problems: string[] = [];
  if (
    structure.textureOverlay !== undefined &&
    !TEXTURE_OVERLAYS.includes(structure.textureOverlay as string)
  ) {
    problems.push(`backgroundStructure.textureOverlay must be one of ${TEXTURE_OVERLAYS.join(" | ")}`);
  }
  const animation = structure.gradientAnimation;
  if (animation !== undefined) {
    if (!isObject(animation)) {
      problems.push("backgroundStructure.gradientAnimation must be an object");
    } else {
      if (!GRADIENT_PRESETS.includes(animation.preset as string)) {
        problems.push(`backgroundStructure.gradientAnimation.preset must be one of ${GRADIENT_PRESETS.join(" | ")}`);
      }
      if (!isFiniteNumber(animation.durationMs)) {
        problems.push("backgroundStructure.gradientAnimation.durationMs must be a number");
      }
    }
  }
  return problems;
}

function summarize(seeds: readonly ThemeSeed[]): SeedThemesResult {
  const byKind: Record<ThemeKind, number> = { font: 0, palette: 0, style: 0 };
  for (const seed of seeds) {
    if (KINDS.includes(seed.kind)) {
      byKind[seed.kind] += 1;
    }
  }
  return { total: seeds.length, byKind };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isString(value: unknown): value is string {
  return typeof value === "string";
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
