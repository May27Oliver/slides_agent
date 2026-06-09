import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode
} from "react";
import type { ManualThemeSelection } from "@slides-agent/domain";
import { AlertIcon, SparklesIcon, UploadIcon, XIcon } from "@/components/icons";
import { StyleCardGallery } from "@/features/slide-generation/StyleCardGallery";
import { stylePresets, type StylePresetKey } from "@/features/slide-generation/style-presets";
import type { SlideGenerationRequest } from "@/features/slide-generation/slide-generation.types";
import { ThemePicker } from "@/features/theme-picker/ThemePicker";
import { useI18n } from "@/i18n";

interface SlideGenerationFormProps {
  onSubmit: (request: SlideGenerationRequest) => void;
  isSubmitting?: boolean;
  errorMessage?: string | undefined;
  fetchImpl?: typeof fetch;
}

const MAX_UPLOAD_BYTES = 1_000_000;

export function SlideGenerationForm({
  onSubmit,
  isSubmitting = false,
  errorMessage,
  fetchImpl
}: SlideGenerationFormProps) {
  const { t } = useI18n();
  const ids = useFieldIds();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceContent, setSourceContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  // Presets are tracked by translation key so the selection survives a language switch.
  const [stylePresetKey, setStylePresetKey] = useState<StylePresetKey | "">("");
  // 011: per-axis manual theme override (empty = keyword baseline, i.e. current behaviour).
  const [themeSelection, setThemeSelection] = useState<ManualThemeSelection>({});
  // 011: the two design approaches are mutually exclusive — a preset (styleDirection
  // keyword) OR a hand-picked theme — so they live in separate tabs and only the active
  // one is submitted. `customMounted` keeps the picker mounted once opened (so its
  // catalogue isn't re-fetched on every tab toggle, and isn't fetched at all unless used).
  const [designMode, setDesignMode] = useState<"preset" | "custom">("preset");
  const [customMounted, setCustomMounted] = useState(false);
  const sourceLength = sourceContent.trim().length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isCustom = designMode === "custom";
    const presetStyleDirection =
      stylePresets.find((preset) => preset.key === stylePresetKey)?.styleDirection ?? "";
    // Mutually exclusive: in custom-theme mode the preset/styleDirection is not sent;
    // in preset mode the manual themeSelection is not sent.
    const styleDirection = isCustom
      ? ""
      : stringValue(form, "styleDirection") || presetStyleDirection;
    const chartEmphasis = stringValue(form, "chartEmphasis");
    const request: SlideGenerationRequest = {
      sourceContent: sourceContent.trim(),
      deckBrief: {
        purpose: stringValue(form, "purpose"),
        audience: stringValue(form, "audience"),
        ...(styleDirection ? { styleDirection } : {}),
        ...(chartEmphasis ? { chartEmphasis } : {}),
        ...optionalValue("segmentationGuidance", form, "segmentationGuidance"),
        ...optionalValue("language", form, "language")
      },
      ...(isCustom && hasThemeSelection(themeSelection) ? { themeSelection } : {})
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
          {/* 011: preset (styleDirection keyword) vs custom theme are mutually exclusive,
              so they live in a segmented control — a recessed track (bg-surface) holding two
              options, the active one a raised brand-tinted pill — only the active tab's
              choice is submitted. Arrow keys rove between tabs (WAI tabs pattern). */}
          <div
            role="tablist"
            aria-label={t("form.design.title")}
            className="inline-flex w-full gap-1 rounded-xl border border-line bg-surface p-1"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                setDesignMode("custom");
                setCustomMounted(true);
                document.getElementById(ids.designCustomTab)?.focus();
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                setDesignMode("preset");
                document.getElementById(ids.designPresetTab)?.focus();
              }
            }}
          >
            <DesignTab
              id={ids.designPresetTab}
              controls={ids.designPresetPanel}
              active={designMode === "preset"}
              onClick={() => setDesignMode("preset")}
            >
              {t("form.design.tab.preset")}
            </DesignTab>
            <DesignTab
              id={ids.designCustomTab}
              controls={ids.designCustomPanel}
              active={designMode === "custom"}
              onClick={() => {
                setDesignMode("custom");
                setCustomMounted(true);
              }}
            >
              {t("form.design.tab.custom")}
            </DesignTab>
          </div>

          {/* Preset panel — always mounted (uncontrolled styleDirection persists across
              tab switches); hidden + inert when the custom tab is active (so AT/Tab/FormData
              skip it). */}
          <div
            role="tabpanel"
            id={ids.designPresetPanel}
            aria-labelledby={ids.designPresetTab}
            hidden={designMode !== "preset"}
            inert={designMode !== "preset"}
            className="flex flex-col gap-4"
          >
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-semibold text-ink">
                {t("form.design.stylePreset")}
              </legend>
              <StyleCardGallery
                presets={stylePresets}
                selectedKey={stylePresetKey}
                onSelect={setStylePresetKey}
              />
            </fieldset>
            <Field id={ids.styleDirection} label={t("form.design.styleDirection")}>
              <input
                id={ids.styleDirection}
                name="styleDirection"
                placeholder={t("form.design.styleDirectionPlaceholder")}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Custom-theme panel — mounted on first open (catalogue loads once, only when the
              user opts in); hidden + inert when the preset tab is active. */}
          {customMounted ? (
            <div
              role="tabpanel"
              id={ids.designCustomPanel}
              aria-labelledby={ids.designCustomTab}
              hidden={designMode !== "custom"}
              inert={designMode !== "custom"}
            >
              <ThemePicker
                selection={themeSelection}
                onChange={setThemeSelection}
                {...(fetchImpl ? { fetchImpl } : {})}
              />
            </div>
          ) : null}

          {/* Chart emphasis is orthogonal to the style approach — always visible. */}
          <Field id={ids.chartEmphasis} label={t("form.design.chartEmphasis")}>
            <input
              id={ids.chartEmphasis}
              name="chartEmphasis"
              placeholder={t("form.design.chartEmphasisPlaceholder")}
              className={inputClass}
            />
          </Field>
        </FormSection>

        <FormSection step={t("form.planning.step")} title={t("form.planning.title")}>
          <Field id={ids.segmentation} label={t("form.planning.segmentation")}>
            <input
              id={ids.segmentation}
              name="segmentationGuidance"
              placeholder={t("form.planning.segmentationPlaceholder")}
              className={inputClass}
              aria-describedby={`${ids.segmentation}-help`}
            />
            <div id={`${ids.segmentation}-help`} className="text-xs text-ink-soft">
              <p>{t("form.planning.segmentationHelp")}</p>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>{t("form.planning.segmentationHelp.topic")}</li>
                <li>{t("form.planning.segmentationHelp.focus")}</li>
                <li>{t("form.planning.segmentationHelp.time")}</li>
              </ul>
            </div>
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

function DesignTab({
  active,
  onClick,
  id,
  controls,
  children
}: {
  active: boolean;
  onClick: () => void;
  id: string;
  controls: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      // Roving tabindex: only the active tab is in the Tab sequence; arrows move between.
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={[
        "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        // Active = raised white pill (brand-tinted + shadow + ring) on the recessed track;
        // selection is signalled by fill + elevation + colour, not colour alone.
        active
          ? "bg-panel text-brand-700 shadow-sm ring-1 ring-line"
          : "text-ink-soft hover:bg-panel/60 hover:text-ink"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

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
    segmentation: `${prefix}-segmentation`,
    designPresetTab: `${prefix}-design-tab-preset`,
    designCustomTab: `${prefix}-design-tab-custom`,
    designPresetPanel: `${prefix}-design-panel-preset`,
    designCustomPanel: `${prefix}-design-panel-custom`
  };
}

function hasThemeSelection(selection: ManualThemeSelection): boolean {
  return Boolean(selection.fontId || selection.paletteId || selection.styleId);
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
