import type {
  ManualThemeSelection,
  ThemeCatalog,
  ThemeSelectionWarning
} from "@slides-agent/domain";
import { useI18n } from "@/i18n";
import { THEME_AXES, resolveTheme } from "@/features/theme-picker/theme-axes";
import { ThemeSwatchView } from "@/features/theme-picker/ThemeSwatchView";

interface ThemeSummaryProps {
  selection: ManualThemeSelection;
  catalog: ThemeCatalog | null;
  onBrowse: () => void;
  /** Optional fallback evidence (post-generation / post-save) to disclose honestly. */
  warnings?: ThemeSelectionWarning[];
  /** Catalogue load state — drives the browse button + a status line (no silent failure). */
  status?: "loading" | "ready" | "error";
}

/**
 * 011: the always-on theme summary, shared by the generation form sidebar and the
 * editor panel. Shows the three axes (font / palette / style), each as the picked
 * theme name or "自動" (auto = keyword baseline, NOT a fallback), and opens the
 * browser modal. When warnings are present it honestly discloses that an axis fell
 * back to the DEFAULT theme (never claims it silently applied).
 */
export function ThemeSummary({
  selection,
  catalog,
  onBrowse,
  warnings = [],
  status = "ready"
}: ThemeSummaryProps) {
  const { t } = useI18n();
  const ready = status === "ready" && catalog !== null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-ink">{t("theme.summary.title")}</h4>
        <button
          type="button"
          onClick={onBrowse}
          disabled={!ready}
          className="rounded-lg border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("theme.summary.browse")} →
        </button>
      </div>

      {status === "loading" ? (
        <p className="text-[11px] text-ink-soft/80">{t("theme.modal.loading")}</p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="text-[11px] font-medium text-red-600">
          {t("theme.modal.error")}
        </p>
      ) : null}

      <dl className="flex flex-col gap-1.5">
        {THEME_AXES.map((axis) => {
          const theme = resolveTheme(catalog, axis, selection[axis.idKey]);
          return (
            <div key={axis.kind} className="flex min-w-0 items-center gap-2">
              {theme ? (
                <ThemeSwatchView theme={theme} size="sm" />
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-lg border border-dashed border-line" />
              )}
              <dt className="shrink-0 text-[11px] font-medium text-ink-soft">{t(axis.labelKey)}</dt>
              <dd
                className={`min-w-0 flex-1 truncate text-right text-xs font-semibold ${theme ? "text-ink" : "text-ink-soft/70"}`}
                title={theme?.name ?? t("theme.auto")}
              >
                {theme?.name ?? t("theme.auto")}
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="text-[11px] leading-snug text-ink-soft/80">{t("theme.summary.hint")}</p>

      {warnings.length > 0 ? (
        <p role="alert" className="text-[11px] font-medium leading-snug text-amber-700">
          {t("theme.warning.fallback")}
        </p>
      ) : null}
    </section>
  );
}
