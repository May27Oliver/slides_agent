import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode
} from "react";
import { AlertIcon, SparklesIcon, UploadIcon, XIcon } from "@/components/icons";
import type { SlideGenerationRequest } from "@/features/slide-generation/slide-generation.types";
import { useI18n, type TranslationKey } from "@/i18n";

interface SlideGenerationFormProps {
  onSubmit: (request: SlideGenerationRequest) => void;
  isSubmitting?: boolean;
  errorMessage?: string | undefined;
}

// Each preset's styleDirection is a curated keyword phrase that reliably selects
// a coherent design kit (font pairing + palette) in the backend's
// selectDesignStyleKit. The phrase is decoupled from the (translated) label so
// switching languages never changes which design kit a preset maps to.
const stylePresets: { key: TranslationKey; styleDirection: string }[] = [
  { key: "preset.style.professional", styleDirection: "professional business corporate 商務" },
  { key: "preset.style.warm", styleDirection: "warm friendly approachable 暖 親切" },
  { key: "preset.style.vibrant", styleDirection: "playful creative vibrant 活潑 創意" },
  { key: "preset.style.elegant", styleDirection: "elegant luxury editorial 優雅 高級" },
  { key: "preset.style.tech", styleDirection: "tech startup developer 科技" },
  { key: "preset.style.minimal", styleDirection: "minimal geometric clean 簡潔" }
];

const chartPresetKeys: TranslationKey[] = [
  "preset.chart.none",
  "preset.chart.comparison",
  "preset.chart.trend",
  "preset.chart.metric"
];

const MAX_UPLOAD_BYTES = 1_000_000;

export function SlideGenerationForm({
  onSubmit,
  isSubmitting = false,
  errorMessage
}: SlideGenerationFormProps) {
  const { t } = useI18n();
  const ids = useFieldIds();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceContent, setSourceContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  // Presets are tracked by translation key so the selection survives a language switch.
  const [stylePresetKey, setStylePresetKey] = useState<TranslationKey | "">("");
  const [chartPresetKey, setChartPresetKey] = useState<TranslationKey>("preset.chart.none");
  const sourceLength = sourceContent.trim().length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const presetStyleDirection =
      stylePresets.find((preset) => preset.key === stylePresetKey)?.styleDirection ?? "";
    const styleDirection = stringValue(form, "styleDirection") || presetStyleDirection;
    const chartEmphasis =
      stringValue(form, "chartEmphasis") ||
      (chartPresetKey !== "preset.chart.none" ? t(chartPresetKey) : "");
    const request: SlideGenerationRequest = {
      sourceContent: sourceContent.trim(),
      deckBrief: {
        purpose: stringValue(form, "purpose"),
        audience: stringValue(form, "audience"),
        ...(styleDirection ? { styleDirection } : {}),
        ...(chartEmphasis ? { chartEmphasis } : {}),
        ...optionalValue("segmentationGuidance", form, "segmentationGuidance"),
        ...optionalValue("language", form, "language")
      }
    };

    onSubmit(request);
  }

  async function loadFile(file: File | undefined) {
    if (!file || file.size > MAX_UPLOAD_BYTES) {
      return;
    }
    const text = await file.text();
    setSourceContent(text);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files?.[0]);
  }

  return (
    <form className="flex min-h-full flex-col" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5 lg:px-7">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-ink">{t("form.heading")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t("form.intro")}</p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-brand-50 px-3 py-1 text-xs font-semibold tabular-nums text-brand-700">
          {t("form.charCount", { count: sourceLength.toLocaleString() })}
        </span>
      </div>

      <div className="flex flex-col gap-7 px-6 py-6 lg:px-7">
        <FormSection step={t("form.source.step")} title={t("form.source.title")}>
          <div
            className={`rounded-2xl border-2 border-dashed bg-white transition-colors ${
              isDragging ? "border-brand-400 bg-brand-50" : "border-line"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <label htmlFor={ids.source} className="sr-only">
              {t("form.source.label")}
            </label>
            <textarea
              id={ids.source}
              name="sourceContent"
              rows={12}
              required
              value={sourceContent}
              placeholder={t("form.source.placeholder")}
              onChange={(event) => setSourceContent(event.currentTarget.value)}
              className="block w-full resize-none rounded-t-2xl border-0 bg-transparent p-4 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.csv,text/plain"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <UploadIcon className="h-4 w-4 text-brand-600" />
                {t("form.source.upload")}
              </button>
              {sourceContent ? (
                <button
                  type="button"
                  onClick={() => setSourceContent("")}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-accent-600"
                >
                  <XIcon className="h-4 w-4" />
                  {t("form.source.clear")}
                </button>
              ) : null}
              <span className="ml-auto text-xs text-ink-soft">{t("form.source.uploadHint")}</span>
            </div>
          </div>
        </FormSection>

        <FormSection step={t("form.brief.step")} title={t("form.brief.title")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={ids.purpose} label={t("form.brief.purpose")}>
              <input
                id={ids.purpose}
                name="purpose"
                required
                placeholder={t("form.brief.purposePlaceholder")}
                className={inputClass}
              />
            </Field>
            <Field id={ids.audience} label={t("form.brief.audience")}>
              <input
                id={ids.audience}
                name="audience"
                required
                placeholder={t("form.brief.audiencePlaceholder")}
                className={inputClass}
              />
            </Field>
            <Field id={ids.language} label={t("form.brief.language")} className="sm:col-span-2">
              <select id={ids.language} name="language" defaultValue="zh-TW" className={inputClass}>
                <option value="zh-TW">繁體中文 (zh-TW)</option>
                <option value="en-US">English (en-US)</option>
                <option value="ja-JP">日本語 (ja-JP)</option>
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection step={t("form.design.step")} title={t("form.design.title")}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-ink">
              {t("form.design.stylePreset")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {stylePresets.map(({ key }) => {
                const active = stylePresetKey === key;
                return (
                  <label
                    key={key}
                    className={`relative flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-colors ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-line bg-white text-ink-soft hover:border-brand-300 hover:text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="styleDirectionPreset"
                      checked={active}
                      onChange={() => setStylePresetKey(key)}
                      className="sr-only"
                    />
                    {t(key)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={ids.styleDirection} label={t("form.design.styleDirection")}>
              <input
                id={ids.styleDirection}
                name="styleDirection"
                placeholder={t("form.design.styleDirectionPlaceholder")}
                className={inputClass}
              />
            </Field>
            <Field id={ids.chartEmphasis} label={t("form.design.chartEmphasis")}>
              <input
                id={ids.chartEmphasis}
                name="chartEmphasis"
                placeholder={t("form.design.chartEmphasisPlaceholder")}
                className={inputClass}
              />
            </Field>
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-ink">
              {t("form.design.chartPreset")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {chartPresetKeys.map((key) => {
                const active = chartPresetKey === key;
                return (
                  <label
                    key={key}
                    className={`relative cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border-brand-500 bg-brand-600 text-white"
                        : "border-line bg-white text-ink-soft hover:border-brand-300 hover:text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="chartEmphasisPreset"
                      checked={active}
                      onChange={() => setChartPresetKey(key)}
                      className="sr-only"
                    />
                    {t(key)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </FormSection>

        <FormSection step={t("form.planning.step")} title={t("form.planning.title")}>
          <Field id={ids.segmentation} label={t("form.planning.segmentation")}>
            <input
              id={ids.segmentation}
              name="segmentationGuidance"
              placeholder={t("form.planning.segmentationPlaceholder")}
              className={inputClass}
            />
          </Field>
        </FormSection>

        {errorMessage ? (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-accent-400 bg-orange-50 px-4 py-3 text-sm font-semibold text-accent-600"
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-line bg-panel/90 px-6 py-4 backdrop-blur lg:px-7">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          <SparklesIcon className="h-5 w-5" />
          {isSubmitting ? t("form.submitting") : t("form.submit")}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400";

function FormSection({
  step,
  title,
  children
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
          {step}
        </span>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  className,
  children
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function useFieldIds() {
  const prefix = useId();
  return {
    source: `${prefix}-source`,
    purpose: `${prefix}-purpose`,
    audience: `${prefix}-audience`,
    language: `${prefix}-language`,
    styleDirection: `${prefix}-style-direction`,
    chartEmphasis: `${prefix}-chart-emphasis`,
    segmentation: `${prefix}-segmentation`
  };
}

function stringValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optionalValue<TName extends string>(
  outputName: TName,
  form: FormData,
  formName: string
): Partial<Record<TName, string>> {
  const value = stringValue(form, formName);
  return value ? ({ [outputName]: value } as Partial<Record<TName, string>>) : {};
}
