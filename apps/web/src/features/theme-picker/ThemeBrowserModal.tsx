import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowsableTheme, ManualThemeSelection, ThemeCatalog } from "@slides-agent/domain";
import { CheckIcon, XIcon } from "@/components/icons";
import { useI18n } from "@/i18n";
import { THEME_AXES, type ThemeAxis, resolveThemeName } from "@/features/theme-picker/theme-axes";
import { extractSwatch } from "@/features/theme-picker/theme-swatch";

interface ThemeBrowserModalProps {
  catalog: ThemeCatalog;
  initialSelection: ManualThemeSelection;
  onApply: (selection: ManualThemeSelection) => void;
  onClose: () => void;
}

// Bound the mounted DOM swatches per the perf budget (≤ 50): paginate each axis.
const PAGE_SIZE = 24;

/**
 * 011: shared theme browser. Three axis tabs (font / palette / style), each a
 * searchable, paginated swatch list. Picking an id stages it; "Apply" returns the
 * combined `ManualThemeSelection`; clearing an axis drops back to auto (keyword
 * baseline). Accessible: role=dialog, Esc closes, focus is trapped and restored.
 */
export function ThemeBrowserModal({
  catalog,
  initialSelection,
  onApply,
  onClose
}: ThemeBrowserModalProps) {
  const { t } = useI18n();
  const [activeAxis, setActiveAxis] = useState<ThemeAxis>(THEME_AXES[0]);
  const [selection, setSelection] = useState<ManualThemeSelection>(initialSelection);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Esc + restore focus to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      // Exclude :disabled (e.g. pagination ‹/› at the extremes) so the trap endpoints
      // are always focusable and Tab can't escape the dialog.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const items = catalog[activeAxis.group];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (theme) =>
        theme.name.toLowerCase().includes(q) ||
        theme.id.toLowerCase().includes(q) ||
        theme.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  }, [catalog, activeAxis, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function switchAxis(axis: ThemeAxis) {
    setActiveAxis(axis);
    setQuery("");
    setPage(0);
  }

  function pick(theme: BrowsableTheme) {
    setSelection((prev) => ({ ...prev, [activeAxis.idKey]: theme.id }));
  }

  function clearAxis(axis: ThemeAxis) {
    setSelection((prev) => {
      const next = { ...prev };
      delete next[axis.idKey];
      return next;
    });
  }

  const selectedId = selection[activeAxis.idKey];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("theme.modal.title")}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-panel shadow-xl outline-none"
      >
        {/* Header + current combination */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-ink">{t("theme.modal.title")}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {t("theme.modal.current")}：
              {THEME_AXES.map((axis) => {
                const name = resolveThemeName(catalog, axis, selection[axis.idKey]);
                return `${t(axis.labelKey)} ${name ?? t("theme.auto")}`;
              }).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("theme.modal.close")}
            className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Axis tabs */}
        <div role="tablist" className="flex gap-1 border-b border-line px-5 pt-3">
          {THEME_AXES.map((axis) => (
            <button
              key={axis.kind}
              type="button"
              role="tab"
              aria-selected={axis.kind === activeAxis.kind}
              onClick={() => switchAxis(axis)}
              className={[
                "rounded-t-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500",
                axis.kind === activeAxis.kind
                  ? "border-b-2 border-brand-600 text-brand-700"
                  : "text-ink-soft hover:text-ink"
              ].join(" ")}
            >
              {t(axis.labelKey)}
            </button>
          ))}
        </div>

        {/* Search + clear */}
        <div className="flex items-center gap-2 px-5 py-3">
          <input
            type="search"
            value={query}
            placeholder={t("theme.modal.search")}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400"
          />
          {selectedId ? (
            <button
              type="button"
              onClick={() => clearAxis(activeAxis)}
              className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {t("theme.modal.clear")}
            </button>
          ) : null}
        </div>

        {/* Swatch list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <p className="mb-2 text-xs text-ink-soft">
            {t("theme.modal.count", { count: filtered.length })}
          </p>
          {pageItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">{t("theme.modal.empty")}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {pageItems.map((theme) => (
                <li key={theme.id}>
                  <ThemeRow
                    theme={theme}
                    selected={theme.id === selectedId}
                    onPick={() => pick(theme)}
                  />
                </li>
              ))}
            </ul>
          )}
          {pageCount > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40"
              >
                ‹
              </button>
              <span className="tabular-nums text-ink-soft">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
          >
            {t("theme.modal.close")}
          </button>
          <button
            type="button"
            onClick={() => onApply(selection)}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {t("theme.modal.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeRow({
  theme,
  selected,
  onPick
}: {
  theme: BrowsableTheme;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={[
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500",
        selected ? "border-brand-500 bg-brand-50" : "border-line bg-white hover:border-brand-300"
      ].join(" ")}
    >
      <SwatchPreview theme={theme} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{theme.name}</span>
        {theme.description ? (
          <span className="block truncate text-xs text-ink-soft">{theme.description}</span>
        ) : null}
      </span>
      {selected ? <CheckIcon className="h-4 w-4 shrink-0 text-brand-600" /> : null}
    </button>
  );
}

/** Renders the kind-specific lightweight swatch (colour chips / font sample / style chip). */
function SwatchPreview({ theme }: { theme: BrowsableTheme }) {
  const swatch = extractSwatch(theme);
  if (!swatch) {
    return <span className="h-9 w-9 shrink-0 rounded-lg border border-line bg-canvas" />;
  }
  if (swatch.kind === "palette") {
    return (
      <span
        className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line"
        style={swatch.background ? { background: swatch.background } : undefined}
      >
        {swatch.colors.slice(0, 4).map((color, index) => (
          <span key={index} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </span>
    );
  }
  if (swatch.kind === "font") {
    return (
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-lg font-bold text-ink"
        style={{ fontFamily: swatch.heading }}
      >
        Aa
      </span>
    );
  }
  return (
    <span
      className="h-9 w-9 shrink-0 border border-line bg-white"
      style={{
        borderRadius: swatch.radiusPx != null ? `${Math.min(swatch.radiusPx, 18)}px` : "8px"
      }}
    />
  );
}
