import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import {
  type CuratedFontPairing,
  type CuratedPalette,
  expandFontPairing,
  expandPalette
} from "@slides-agent/domain";
import type { ThemeSeed } from "@/infra/db/seed-themes";
import { AUTHORED_STYLE_KITS } from "@/infra/db/seeds/authored-style-kits";

/**
 * Dev-time CSV→seed converter (feature 007 US2). Reads the UI/UX Pro Max source
 * CSVs and emits committed seed JSON for the `themes` catalogue:
 *   - typography.csv → theme-fonts.json   (full, auto-expanded)
 *   - colors.csv     → theme-palettes.json (full, auto-expanded)
 *   - styles.csv     → theme-styles.json  (raw skeleton; A/B-grade tokens are
 *                                          hand-authored afterwards — T026/T031)
 *
 * Only the *output* tokens land in the repo/DB; the expansion engine stays in
 * code (style-kit-engine). The row→seed transforms are exported pure functions so
 * they can be unit-tested without filesystem IO.
 */

type CsvRecord = Record<string, string>;

/** Stable safe-default ids (`00` sorts first under ORDER BY id, DR-004). */
export const SAFE_DEFAULT_FONT_ID = "font-00-sans-default";
export const SAFE_DEFAULT_PALETTE_ID = "palette-00-safe-default";
export const SAFE_DEFAULT_STYLE_ID = "style-00-minimalism";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
}

/** Splits a comma-separated keyword cell into a clean, deduped, lowercased list. */
export function splitKeywords(value: string | undefined, max = 12): string[] {
  if (!value) {
    return [];
  }
  const seen = new Set<string>();
  for (const raw of value.split(/[,/]/u)) {
    const keyword = raw
      .trim()
      .toLowerCase()
      .replace(/\(.*?\)/gu, "")
      .trim();
    if (keyword.length > 0 && keyword.length <= 40) {
      seen.add(keyword);
    }
  }
  return [...seen].slice(0, max);
}

/** Extracts `Family:wght@w1;w2` pairs from a Google Fonts URL / CSS @import. */
export function parseFontWeights(...sources: Array<string | undefined>): Record<string, string> {
  const text = sources.filter(Boolean).join(" ");
  const weights: Record<string, string> = {};
  const pattern = /([A-Za-z][A-Za-z0-9+ ]*?):wght@([0-9;]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const family = match[1]!.replace(/\+/gu, " ").trim();
    if (family.length > 0) {
      weights[family] = match[2]!;
    }
  }
  return weights;
}

/** Relative luminance test so dark backgrounds drive the dark composition. */
export function isDarkHex(hex: string | undefined): boolean {
  const parsed = Number.parseInt((hex ?? "").replace(/[^0-9a-fA-F]/gu, "").slice(0, 6), 16);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance < 0.45;
}

export function fontRowToSeed(row: CsvRecord, id: string): ThemeSeed {
  const headingFamily = (row["Heading Font"] ?? "").trim();
  const bodyFamily = (row["Body Font"] ?? "").trim();
  const keywords = splitKeywords(row["Mood/Style Keywords"]);
  let weights = parseFontWeights(row["Google Fonts URL"], row["CSS Import"]);
  if (Object.keys(weights).length === 0) {
    weights = { [headingFamily]: "400;600;700", [bodyFamily]: "300;400;600" };
  }
  const pairing: CuratedFontPairing = { id, headingFamily, bodyFamily, weights, keywords };
  return {
    id,
    kind: "font",
    scope: "builtin",
    name: (row["Font Pairing Name"] ?? "").trim(),
    description: optional(row["Notes"]),
    keywords,
    appliesTo: "universal",
    support: "full",
    styleKit: expandFontPairing(pairing)
  };
}

export function paletteRowToSeed(row: CsvRecord, id: string): ThemeSeed {
  const keywords = splitKeywords(`${row["Product Type"] ?? ""}, ${row["Notes"] ?? ""}`);
  const palette: CuratedPalette = {
    id,
    primary: (row["Primary (Hex)"] ?? "").trim(),
    secondary: (row["Secondary (Hex)"] ?? "").trim(),
    cta: (row["CTA (Hex)"] ?? "").trim(),
    background: (row["Background (Hex)"] ?? "").trim(),
    text: (row["Text (Hex)"] ?? "").trim(),
    border: (row["Border (Hex)"] ?? "").trim(),
    dark: isDarkHex(row["Background (Hex)"]),
    keywords
  };
  return {
    id,
    kind: "palette",
    scope: "builtin",
    name: (row["Product Type"] ?? "").trim(),
    description: optional(row["Notes"]),
    keywords,
    appliesTo: "universal",
    support: "full",
    styleKit: expandPalette(palette)
  };
}

export function styleRowToSeed(row: CsvRecord, id: string): ThemeSeed {
  // Skeleton only: every style starts as raw (the engine cannot render arbitrary
  // CSV design systems). A/B-grade rows are hand-upgraded to full StyleStyleKit
  // tokens later (T026/T031); the raw original is preserved verbatim meanwhile.
  const rawDesignSystemVariables =
    optional(row["Design System Variables"]) ??
    optional(row["CSS/Technical Keywords"]) ??
    optional(row["Effects & Animation"]) ??
    (row["Style Category"] ?? "").trim();
  return {
    id,
    kind: "style",
    scope: "builtin",
    name: (row["Style Category"] ?? "").trim(),
    description: optional(row["Best For"]),
    keywords: splitKeywords(row["Keywords"]),
    appliesTo: "presentation",
    support: "raw",
    styleKit: { rawDesignSystemVariables }
  };
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Merges a hand-authored full style kit over the raw skeleton when one exists for
 * the seed's id (A-grade in US2, B-grade in US3). Non-authored style rows stay raw
 * so re-running the converter is non-destructive to the authored catalogue.
 */
export function applyAuthoredStyleKit(seed: ThemeSeed): ThemeSeed {
  const authored = AUTHORED_STYLE_KITS[seed.id];
  if (!authored) {
    return seed;
  }
  return {
    ...seed,
    support: authored.support,
    appliesTo: authored.appliesTo ?? seed.appliesTo,
    styleKit: authored.styleKit
  };
}

/**
 * Assigns stable ids: the safe-default row gets the fixed `00` id; every other
 * row gets `{kind}-10-{slug}`, disambiguated on slug collision.
 */
export function assignIds(
  records: CsvRecord[],
  kind: string,
  safeDefaultId: string,
  isSafeDefault: (row: CsvRecord) => boolean,
  nameFor: (row: CsvRecord) => string
): string[] {
  const used = new Set<string>([safeDefaultId]);
  let safeAssigned = false;
  return records.map((row) => {
    if (!safeAssigned && isSafeDefault(row)) {
      safeAssigned = true;
      return safeDefaultId;
    }
    const base = `${kind}-10-${slugify(nameFor(row)) || "item"}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id;
  });
}

// ---------------------------------------------------------------------------
// Dev-time IO entrypoint (guarded so importing the transforms has no side effect)
// ---------------------------------------------------------------------------

const DATA_DIR = fileURLToPath(
  new URL("../../../.claude/skills/ui-ux-pro-max/data/", import.meta.url)
);
const OUT_DIR = fileURLToPath(new URL("../src/infra/db/seeds/", import.meta.url));

function readCsv(name: string): CsvRecord[] {
  const content = readFileSync(`${DATA_DIR}${name}`, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true
  }) as CsvRecord[];
}

function writeSeeds(name: string, seeds: ThemeSeed[]): void {
  writeFileSync(`${OUT_DIR}${name}`, `${JSON.stringify(seeds, null, 2)}\n`, "utf8");
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const fontRows = readCsv("typography.csv");
  const fontIds = assignIds(
    fontRows,
    "font",
    SAFE_DEFAULT_FONT_ID,
    (row) => /modern professional/iu.test(row["Font Pairing Name"] ?? ""),
    (row) => row["Font Pairing Name"] ?? ""
  );
  const fonts = fontRows.map((row, i) => fontRowToSeed(row, fontIds[i]!));

  const paletteRows = readCsv("colors.csv");
  const paletteIds = assignIds(
    paletteRows,
    "palette",
    SAFE_DEFAULT_PALETTE_ID,
    (row) => /^saas \(general\)/iu.test(row["Product Type"] ?? ""),
    (row) => row["Product Type"] ?? ""
  );
  const palettes = paletteRows.map((row, i) => paletteRowToSeed(row, paletteIds[i]!));

  const styleRows = readCsv("styles.csv");
  const styleIds = assignIds(
    styleRows,
    "style",
    SAFE_DEFAULT_STYLE_ID,
    (row) => /minimalism/iu.test(row["Style Category"] ?? ""),
    (row) => row["Style Category"] ?? ""
  );
  const styles = styleRows.map((row, i) =>
    applyAuthoredStyleKit(styleRowToSeed(row, styleIds[i]!))
  );

  writeSeeds("theme-fonts.json", fonts);
  writeSeeds("theme-palettes.json", palettes);
  writeSeeds("theme-styles.json", styles);

  process.stdout.write(
    `Converted seeds → fonts=${fonts.length}, palettes=${palettes.length}, styles=${styles.length}\n`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
