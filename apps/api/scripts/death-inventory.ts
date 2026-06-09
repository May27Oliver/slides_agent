/**
 * 011 research (T017): quantify the "dead inventory" the keyword `selectTheme`
 * leaves behind — how few of the 220 builtin themes are ever actually selected.
 * Reads the SAME committed seed JSON the DB is seeded from, builds the selectable
 * candidate list (style excludes support=raw; applies_to in presentation/universal),
 * then measures two things:
 *
 *   1. Empty-brief selection — with no styleDirection every axis ties, so the stable
 *      "first candidate" wins: only 3 of 220 themes are reachable by default.
 *   2. Best-case reachability — summon each theme by its OWN keywords as the
 *      styleDirection and count the distinct winners per axis. Themes that never win
 *      even when described exactly are structurally unreachable via keywords.
 *
 * Run: pnpm --filter @slides-agent/api exec tsx scripts/death-inventory.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { selectTheme, type SelectableTheme } from "@slides-agent/domain";

const SEED_DIR = new URL("../src/infra/db/seeds/", import.meta.url);

interface Seed extends SelectableTheme {
  readonly appliesTo?: string;
}

function load(file: string): Seed[] {
  return JSON.parse(readFileSync(fileURLToPath(new URL(file, SEED_DIR)), "utf8")) as Seed[];
}

function selectable(seeds: Seed[]): SelectableTheme[] {
  return seeds.filter(
    (s) =>
      (s.appliesTo === undefined || s.appliesTo === "presentation" || s.appliesTo === "universal") &&
      !(s.kind === "style" && s.support === "raw")
  );
}

const fonts = selectable(load("theme-fonts.json"));
const palettes = selectable(load("theme-palettes.json"));
const styles = selectable(load("theme-styles.json"));
const candidates = [...fonts, ...palettes, ...styles];
const totals = { font: fonts.length, palette: palettes.length, style: styles.length };

// 1. Empty brief → stable-first per axis.
const emptyPick = selectTheme({}, candidates);

// 2. Best-case reachability: each theme summoned by its own keywords.
const reachable = { font: new Set<string>(), palette: new Set<string>(), style: new Set<string>() };
for (const theme of candidates) {
  const pick = selectTheme({ styleDirection: theme.keywords.join(" ") }, candidates);
  if (pick.ids.font) reachable.font.add(pick.ids.font);
  if (pick.ids.palette) reachable.palette.add(pick.ids.palette);
  if (pick.ids.style) reachable.style.add(pick.ids.style);
}

const total = totals.font + totals.palette + totals.style;
const reach = reachable.font.size + reachable.palette.size + reachable.style.size;

/* eslint-disable no-console */
console.log("=== 011 death-inventory (keyword selectTheme) ===");
console.log(`total selectable themes: ${total} (font ${totals.font} / palette ${totals.palette} / style ${totals.style})`);
console.log(`empty-brief winners: font=${emptyPick.ids.font} palette=${emptyPick.ids.palette} style=${emptyPick.ids.style} → 3 reachable`);
for (const axis of ["font", "palette", "style"] as const) {
  const r = reachable[axis].size;
  console.log(`best-case reachable ${axis}: ${r}/${totals[axis]} (dead ${totals[axis] - r})`);
}
console.log(`best-case reachable total: ${reach}/${total} (${((reach / total) * 100).toFixed(1)}%) → dead inventory ${total - reach} (${(((total - reach) / total) * 100).toFixed(1)}%)`);
