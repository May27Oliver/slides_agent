import { composeKit } from "@/design/compose-kit";
import { composeKitName } from "@/design/compose-kit-name";
import { pickBest } from "@/design/pick-best";
import type {
  FontStyleKit,
  PaletteStyleKit,
  SelectableTheme,
  SelectedTheme,
  StyleStyleKit,
  ThemeKind
} from "@/design/theme.types";

export interface SelectThemeBrief {
  readonly purpose?: string;
  readonly audience?: string;
  readonly styleDirection?: string;
}

/**
 * Deterministic theme selection (feature 007). Scores each of the three axes
 * (font / palette / style) independently against the brief, takes the best (or
 * the stably-ordered first candidate on no match / tie), and merges the chosen
 * partial kits via composeKit. An axis with no candidate is left null and that
 * part falls back to the default — `fallback` is true whenever any axis (or all)
 * fell back. Pure: receives the candidate list, never queries the DB (DR-006).
 */
export function selectTheme(brief: SelectThemeBrief, candidates: SelectableTheme[]): SelectedTheme {
  const strong = (brief.styleDirection ?? "").toLowerCase();
  const weak = [brief.purpose, brief.audience]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  // `style` kind never renders from raw rows; exclude defensively even though the
  // adapter already filters support='raw' out of the candidate list.
  const style = pickBest(
    byKind(candidates, "style").filter((theme) => theme.support !== "raw"),
    strong,
    weak
  );
  const palette = pickBest(byKind(candidates, "palette"), strong, weak);
  const font = pickBest(byKind(candidates, "font"), strong, weak);

  const styleKit = composeKit({
    ...(style ? { style: style.styleKit as StyleStyleKit } : {}),
    ...(palette ? { palette: palette.styleKit as PaletteStyleKit } : {}),
    ...(font ? { font: font.styleKit as FontStyleKit } : {})
  });

  const ids = {
    style: style?.id ?? null,
    palette: palette?.id ?? null,
    font: font?.id ?? null
  };

  return {
    styleKit: {
      ...styleKit,
      kitName: composeKitName(ids)
    },
    ids,
    fallback: ids.style === null || ids.palette === null || ids.font === null
  };
}

function byKind(candidates: SelectableTheme[], kind: ThemeKind): SelectableTheme[] {
  return candidates.filter((theme) => theme.kind === kind);
}
