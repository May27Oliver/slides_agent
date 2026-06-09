import { composeKit } from "@/design/compose-kit";
import { composeKitName } from "@/design/compose-kit-name";
import type {
  ApplyThemeResult,
  ManualThemeSelection,
  ThemeSelectionWarning
} from "@/design/theme-selection.types";
import type {
  FontStyleKit,
  PaletteStyleKit,
  SelectableTheme,
  StyleStyleKit,
  ThemeKind
} from "@/design/theme.types";

/** The three axis ids a caller supplies as the baseline (generation or edit). */
export interface BaselineThemeIds {
  readonly font: string | null;
  readonly palette: string | null;
  readonly style: string | null;
}

const AXES: readonly ThemeKind[] = ["style", "palette", "font"];

const SELECTION_KEY: Record<ThemeKind, keyof ManualThemeSelection> = {
  font: "fontId",
  palette: "paletteId",
  style: "styleId"
};

/**
 * 011: deterministic, zero-LLM theme application shared by the generation path
 * (baseline = `selectTheme(brief).ids`) and the editor path (baseline =
 * `base.selectedTheme.ids`). For each axis the effective id is the user override
 * (if any) else the baseline; that id is resolved back to its *partial* kit from
 * `candidates` (we never reverse-decompose the already-composed baseline kit — a
 * `SelectedTheme` only carries the merged kit + ids, not the per-axis partials,
 * data-model §2 F1/F2). The three resolved partials feed the same `composeKit`
 * path `selectTheme` uses, so a manual selection renders identically to a keyword
 * one.
 *
 * Failure-safe (locked semantic): any axis that cannot be resolved falls back to
 * the DEFAULT kit (NOT to baseline) and records a warning — `invalid_id` when the
 * user's override id is not in the current selectable catalogue, otherwise
 * `base_unresolved` (a baseline axis id that is null or no longer selectable, e.g.
 * a legacy deck). An empty/absent `selection` over a fully-resolvable baseline
 * reproduces the baseline exactly with no warnings (CR-004 backward compatible).
 */
export function applyThemeSelection(
  baselineIds: BaselineThemeIds,
  selection: ManualThemeSelection | undefined,
  candidates: SelectableTheme[]
): ApplyThemeResult {
  const warnings: ThemeSelectionWarning[] = [];
  const ids: { style: string | null; palette: string | null; font: string | null } = {
    style: null,
    palette: null,
    font: null
  };
  const partials: { style?: StyleStyleKit; palette?: PaletteStyleKit; font?: FontStyleKit } = {};

  for (const axis of AXES) {
    const requestedId = selection?.[SELECTION_KEY[axis]];
    const effectiveId = requestedId ?? baselineIds[axis];
    const hit =
      effectiveId != null
        ? candidates.find((theme) => theme.id === effectiveId && theme.kind === axis)
        : undefined;

    if (hit) {
      ids[axis] = hit.id;
      assignPartial(partials, axis, hit.styleKit);
      continue;
    }

    // Unresolved axis → default kit (omit the partial) + honest warning.
    ids[axis] = null;
    warnings.push(
      requestedId != null
        ? { axis, requestedId, reason: "invalid_id" }
        : { axis, reason: "base_unresolved" }
    );
  }

  const styleKit = composeKit({
    ...(partials.style ? { style: partials.style } : {}),
    ...(partials.palette ? { palette: partials.palette } : {}),
    ...(partials.font ? { font: partials.font } : {})
  });

  return {
    selectedTheme: {
      styleKit: { ...styleKit, kitName: composeKitName(ids) },
      ids,
      fallback: ids.style === null || ids.palette === null || ids.font === null
    },
    warnings
  };
}

function assignPartial(
  partials: { style?: StyleStyleKit; palette?: PaletteStyleKit; font?: FontStyleKit },
  axis: ThemeKind,
  styleKit: unknown
): void {
  // `SelectableTheme.styleKit` is `unknown` (a partial kit interpreted by `kind`);
  // composeKit owns the per-kind shape, so we narrow by axis exactly as selectTheme.
  if (axis === "style") {
    partials.style = styleKit as StyleStyleKit;
  } else if (axis === "palette") {
    partials.palette = styleKit as PaletteStyleKit;
  } else {
    partials.font = styleKit as FontStyleKit;
  }
}
