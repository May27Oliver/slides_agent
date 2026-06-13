import type {
  SlideOutlineItem,
  SlideTextStyleOverrides,
  TextStyleOverride
} from "@/deck/deck.types";

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
  const normalized: TextStyleOverride = {
    ...(typeof override.sizePx === "number" && Number.isFinite(override.sizePx)
      ? { sizePx: override.sizePx }
      : {}),
    ...(override.color ? { color: override.color } : {}),
    ...(override.fontFamily ? { fontFamily: override.fontFamily } : {})
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
