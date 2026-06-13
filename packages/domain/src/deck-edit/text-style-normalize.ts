import {
  TEXT_FONT_FAMILY_MAX,
  TEXT_SIZE_PX_MAX,
  TEXT_SIZE_PX_MIN,
  type SlideOutlineItem,
  type SlideTextStyleOverrides,
  type TextStyleOverride
} from "@/deck/deck.types";

// Self-defending domain gate (deep-review H3): re-validate every value before it can
// reach the renderer's inline style, so a row written by an older API version or a
// direct DB insert can NEVER inject into `style=""`. Mirrors the contract bounds; the
// renderer interpolates these verbatim, so the domain must not trust the store.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/u;
const FONT_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]*$/u;

/**
 * 015 (FR-016): canonicalizes a slide's text style overrides before persisting.
 * - An override with neither `sizePx` nor `color` is empty and is dropped (every
 *   present value is meaningful — these are absolute px / hex, not theme defaults).
 * - `outlineById` keys must point at an EXISTING bullet id in the merged outline;
 *   orphans (deleted bullets, unknown ids) are dropped so no style outlives its field.
 * Returns undefined when nothing survives, so the field disappears from storage.
 */
export function normalizeTextStyleOverrides(
  overrides: SlideTextStyleOverrides | undefined,
  outline: readonly SlideOutlineItem[]
): SlideTextStyleOverrides | undefined {
  if (!overrides) {
    return undefined;
  }

  const title = normalizeOverride(overrides.title);
  const message = normalizeOverride(overrides.message);

  const knownIds = new Set(outline.map((item) => item.id).filter((id): id is string => !!id));
  const outlineEntries = Object.entries(overrides.outlineById ?? {})
    .filter(([id]) => knownIds.has(id))
    .map(([id, override]) => [id, normalizeOverride(override)] as const)
    .filter((entry): entry is [string, TextStyleOverride] => entry[1] !== undefined);

  const normalized: SlideTextStyleOverrides = {
    ...(title ? { title } : {}),
    ...(message ? { message } : {}),
    ...(outlineEntries.length > 0 ? { outlineById: Object.fromEntries(outlineEntries) } : {})
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** Keeps only the present values; drops the override when nothing remains. */
function normalizeOverride(override: TextStyleOverride | undefined): TextStyleOverride | undefined {
  if (!override) {
    return undefined;
  }
  const sizeOk =
    typeof override.sizePx === "number" &&
    Number.isFinite(override.sizePx) &&
    override.sizePx >= TEXT_SIZE_PX_MIN &&
    override.sizePx <= TEXT_SIZE_PX_MAX;
  const colorOk = typeof override.color === "string" && HEX_COLOR.test(override.color);
  const fontOk =
    typeof override.fontFamily === "string" &&
    override.fontFamily.length <= TEXT_FONT_FAMILY_MAX &&
    FONT_FAMILY.test(override.fontFamily);
  const normalized: TextStyleOverride = {
    ...(sizeOk ? { sizePx: override.sizePx } : {}),
    ...(colorOk ? { color: override.color } : {}),
    ...(fontOk ? { fontFamily: override.fontFamily } : {})
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
