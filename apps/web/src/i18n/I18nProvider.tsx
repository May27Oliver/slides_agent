import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translations,
  type Locale,
  type TranslationKey
} from "@/i18n/translations";

const STORAGE_KEY = "slides-agent.locale";

type TranslateValues = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: TranslateValues) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function isLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function readInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private mode, tests) — fall back to default.
  }

  return DEFAULT_LOCALE;
}

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    token in values ? String(values[token]) : match
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore persistence failures — locale still applies for this session.
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, values?: TranslateValues) =>
      interpolate(translations[locale][key], values),
    [locale]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallbackContext: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key, values) => interpolate(translations[DEFAULT_LOCALE][key], values)
};

export function useI18n(): I18nContextValue {
  // Falls back to the default locale when rendered outside a provider
  // (e.g. isolated component tests) instead of throwing.
  return useContext(I18nContext) ?? fallbackContext;
}
