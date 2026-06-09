import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, or, ne, type SQL } from "drizzle-orm";
import type {
  BrowsableTheme,
  SelectableTheme,
  ThemeKind,
  ThemeStore,
  ThemeSupport
} from "@slides-agent/domain";
import type { AppDatabase } from "@/infra/db/db.service";
import { DRIZZLE } from "@/infra/db/db.tokens";
import { themes } from "@/infra/db/schema";

/**
 * Drizzle-backed ThemeStore (feature 007 + 011). Reads the selectable builtin
 * theme catalogue. Filters: scope='builtin', active, applies_to in (presentation,
 * universal), and the `style` kind excludes support='raw' (C-grade rows the engine
 * cannot render). Ordered by id so the "no-match / tie -> first candidate"
 * selection is reproducible and the `00`-prefixed safe default sorts first
 * (DR-004 / DR-006). `listSelectable` (selection) and `listBrowsable` (011 browse)
 * share the SAME filter + order — defined once in `selectableThemeFilter` so they
 * never drift.
 */
@Injectable()
export class DrizzleThemeStore implements ThemeStore {
  constructor(@Inject(DRIZZLE) private readonly db: AppDatabase) {}

  async listSelectable(): Promise<SelectableTheme[]> {
    const rows = await this.db
      .select({
        id: themes.id,
        kind: themes.kind,
        keywords: themes.keywords,
        support: themes.support,
        styleKit: themes.styleKit
      })
      .from(themes)
      .where(selectableThemeFilter())
      .orderBy(asc(themes.id));

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as ThemeKind,
      keywords: toKeywords(row.keywords),
      support: row.support as ThemeSupport,
      styleKit: row.styleKit
    }));
  }

  async listBrowsable(): Promise<BrowsableTheme[]> {
    const rows = await this.db
      .select({
        id: themes.id,
        kind: themes.kind,
        name: themes.name,
        description: themes.description,
        keywords: themes.keywords,
        support: themes.support,
        styleKit: themes.styleKit
      })
      .from(themes)
      .where(selectableThemeFilter())
      .orderBy(asc(themes.id));

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as ThemeKind,
      name: row.name,
      ...(row.description != null ? { description: row.description } : {}),
      keywords: toKeywords(row.keywords),
      support: row.support as ThemeSupport,
      styleKit: row.styleKit
    }));
  }
}

/** Single source for the builtin selectable/browsable predicate (shared by both reads). */
function selectableThemeFilter(): SQL | undefined {
  return and(
    eq(themes.scope, "builtin"),
    eq(themes.active, true),
    inArray(themes.appliesTo, ["presentation", "universal"]),
    // style kind never selects from raw rows; other kinds are unaffected.
    or(ne(themes.kind, "style"), ne(themes.support, "raw"))
  );
}

function toKeywords(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}
