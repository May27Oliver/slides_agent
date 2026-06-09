import type {
  ManualThemeSelection,
  ThemeCatalog,
  ThemeSelectionWarning
} from "@slides-agent/domain";
import { useI18n } from "@/i18n";
import { THEME_AXES, resolveThemeName } from "@/features/theme-picker/theme-axes";

interface ThemeSummaryProps {
  selection: ManualThemeSelection;
  catalog: ThemeCatalog | null;
  onBrowse: () => void;
  /** Optional fallback evidence (post-generation / post-save) to disclose honestly. */
  warnings?: ThemeSelectionWarning[];
}

/**
 * 011: the always-on theme summary, shared by the generation form sidebar and the
 * editor panel. Shows the three axes (font / palette / style), each as the picked
 * theme name or "自動" (auto = keyword baseline, NOT a fallback), and opens the
 * browser modal. When warnings are present it honestly discloses that an axis fell
 * back to the DEFAULT theme (never claims it silently applied).
 */
export function ThemeSummary({ selection, catalog, onBrowse, warnings = [] }: ThemeSummaryProps) {
  const { t } = useI18n();

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-ink">{t("theme.summary.title")}</h4>
        <button
          type="button"
          onClick={onBrowse}
          className="rounded-lg border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {t("theme.summary.browse")} →
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {THEME_AXES.map((axis) => {
          const name = resolveThemeName(catalog, axis, selection[axis.idKey]);
          return (
            <div key={axis.kind} className="min-w-0">
              <dt className="text-[11px] font-medium text-ink-soft">{t(axis.labelKey)}</dt>
              <dd
                className={`truncate text-xs font-semibold ${name ? "text-ink" : "text-ink-soft/70"}`}
                title={name ?? t("theme.auto")}
              >
                {name ?? t("theme.auto")}
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
