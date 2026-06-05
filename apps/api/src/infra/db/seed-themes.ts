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
        issues
          .map((issue) => `  [${issue.index}] ${issue.id}: ${issue.problems.join("; ")}`)
          .join("\n")
    );
    this.name = "ThemeSeedValidationError";
  }
}

const KINDS: readonly ThemeKind[] = ["font", "palette", "style"];
const SUPPORTS: readonly ThemeSupport[] = ["full", "partial", "raw"];
const APPLIES_TO: readonly ThemeAppliesTo[] = ["presentation", "landing", "dashboard", "universal"];
const TEXTURE_OVERLAYS = ["grain", "noise", "paper"];
const GRADIENT_PRESETS = ["aurora", "mesh"];
// Mirrors the renderer's UNSAFE_CSS_VALUE guard (deck-style-css.ts): free-CSS
// string tokens reaching the <style> block must not be able to break out of a
// declaration/rule. Render-time safeCssValue is the live guard; this rejects such
// values at the catalogue boundary too (defense-in-depth — validate at the edge).
const UNSAFE_CSS_VALUE = /[;{}<>\\@]|url\(|\/\*|\*\/|expression\(|\r|\n/iu;
const FONTS_HREF_HOST = "fonts.googleapis.com";

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
    problems.push("keywords must be an array of non-empty strings");
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
  if (!isSafeCssValue(fonts.heading)) {
    problems.push("font styleKit.fonts.heading must be a safe, non-empty CSS font stack");
  }
  if (!isSafeCssValue(fonts.body)) {
    problems.push("font styleKit.fonts.body must be a safe, non-empty CSS font stack");
  }
  if (fonts.googleFontsHref !== undefined) {
    if (!isString(fonts.googleFontsHref)) {
      problems.push("font styleKit.fonts.googleFontsHref must be a string when present");
    } else if (fontsHrefHost(fonts.googleFontsHref) !== FONTS_HREF_HOST) {
      // A <link href>/@import to an arbitrary host would let a crafted seed load
      // attacker-controlled CSS into every rendered deck — restrict to Google Fonts.
      problems.push(`font styleKit.fonts.googleFontsHref must be a https://${FONTS_HREF_HOST} URL`);
    }
  }
  return problems;
}

function fontsHrefHost(href: string): string | undefined {
  try {
    return new URL(href).hostname;
  } catch {
    return undefined;
  }
}

function validatePaletteKit(kit: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (!Array.isArray(kit.accentHues) || kit.accentHues.length === 0) {
    problems.push("palette styleKit.accentHues must be a non-empty array");
  } else {
    kit.accentHues.forEach((hue, i) => {
      if (
        !isObject(hue) ||
        !isNonEmptyString(hue.name) ||
        !isNonEmptyString(hue.base) ||
        !isSafeCssValue(hue.gradient)
      ) {
        problems.push(
          `palette styleKit.accentHues[${i}] must have name/base strings and a safe gradient`
        );
      }
    });
  }
  if (!isSafeCssValue(kit.accentGradient)) {
    problems.push("palette styleKit.accentGradient must be a safe, non-empty CSS value");
  }
  if (!isObject(kit.background) || !isSafeCssValue(kit.background.css)) {
    problems.push("palette styleKit.background.css must be a safe, non-empty CSS value");
  }
  if (!isSafeCssValue(kit.cardSurface)) {
    problems.push("palette styleKit.cardSurface must be a safe, non-empty CSS value");
  }
  if (!isSafeCssValue(kit.cardBorder)) {
    problems.push("palette styleKit.cardBorder must be a safe, non-empty CSS value");
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
    if (!isSafeCssValue(effects.cardShadow)) {
      problems.push("style styleKit.effects.cardShadow must be a safe, non-empty CSS value");
    }
    if (effects.cardBackdropBlurPx !== undefined && !isFiniteNumber(effects.cardBackdropBlurPx)) {
      problems.push("style styleKit.effects.cardBackdropBlurPx must be a number when present");
    }
    // glow is a B-grade token rendered in US3; guard it as a safe CSS value now so
    // a crafted seed can never carry a CSS breakout into the future renderer.
    if (effects.glow !== undefined && !isSafeCssValue(effects.glow)) {
      problems.push("style styleKit.effects.glow must be a safe CSS value when present");
    }
  }
  problems.push(...validateMotion(kit.motion));
  problems.push(...validateTypeScale(kit.typeScale));
  problems.push(...validateBackgroundStructure(kit.backgroundStructure));
  return problems;
}

/**
 * Each provided typeScale role replaces the default token wholesale (composeKit
 * merges role-level), so a present role must be a complete numeric TypeScaleToken.
 * Non-numeric size fields would otherwise reach clampFontSizeCss's CSS template.
 */
function validateTypeScale(typeScale: unknown): string[] {
  if (typeScale === undefined) {
    return [];
  }
  if (!isObject(typeScale)) {
    return ["style styleKit.typeScale must be an object when present"];
  }
  const fields = ["min", "preferredVw", "max", "weight", "lineHeight"];
  const problems: string[] = [];
  for (const [role, token] of Object.entries(typeScale)) {
    if (!isObject(token)) {
      problems.push(`style styleKit.typeScale.${role} must be an object`);
      continue;
    }
    for (const field of fields) {
      if (!isFiniteNumber(token[field])) {
        problems.push(`style styleKit.typeScale.${role}.${field} must be a finite number`);
      }
    }
  }
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
    problems.push(
      `backgroundStructure.textureOverlay must be one of ${TEXTURE_OVERLAYS.join(" | ")}`
    );
  }
  const animation = structure.gradientAnimation;
  if (animation !== undefined) {
    if (!isObject(animation)) {
      problems.push("backgroundStructure.gradientAnimation must be an object");
    } else {
      if (!GRADIENT_PRESETS.includes(animation.preset as string)) {
        problems.push(
          `backgroundStructure.gradientAnimation.preset must be one of ${GRADIENT_PRESETS.join(" | ")}`
        );
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
/** A non-empty string with no CSS-injection characters (mirrors the renderer). */
function isSafeCssValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !UNSAFE_CSS_VALUE.test(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
/** Every entry must be a non-empty string — an empty keyword scores a phantom match. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}
