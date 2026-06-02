import { GlobeIcon } from "@/components/icons";
import { LOCALE_LABELS, SUPPORTED_LOCALES, useI18n, type Locale } from "@/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="group flex items-center gap-2 rounded-full border border-line bg-white/70 py-1.5 pl-3 pr-2 text-sm font-medium text-ink-soft shadow-sm transition-colors hover:border-brand-300 hover:text-ink">
      <GlobeIcon className="h-4 w-4 text-brand-600" />
      <span className="sr-only">{t("app.language")}</span>
      <select
        aria-label={t("app.language")}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((value) => (
          <option key={value} value={value}>
            {LOCALE_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
