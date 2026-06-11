import { useState } from "react";
import type { ChartIntent, ChartVisualOverride, UserPointInput } from "@slides-agent/domain";
import { CHART_EDIT_LIMITS, USER_POINT_VALUE_PATTERN } from "@slides-agent/domain";
import { SELECTABLE_VISUALS } from "@/features/deck-editor/chart-visual-options";
import { useI18n, type TranslationKey } from "@/i18n";

/** How many source-fact values to preview per intent before truncating. */
const FACT_PREVIEW_LIMIT = 3;

const fieldBox =
  "w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700";

interface AddChartPanelProps {
  /** ALL of the deck's chart intents (placed ones included, clarify 決議). */
  intents: ChartIntent[];
  /** 1-based pages where each intent is already placed (effective, ops replayed). */
  usedPagesByIntent: Record<string, number[]>;
  onAddExisting: (chartIntentId: string) => void;
  /** US4: create a chart from manual input; absent hides the manual tab. */
  onAddUserData?: (source: {
    title: string;
    visual: ChartVisualOverride;
    points: UserPointInput[];
  }) => void;
}

/**
 * 014 (US2/US4, FR-005/FR-011/FR-016): the add-chart entry for a chartless content
 * slide. Two tabs — place an existing source intent (already-placed ones carry a
 * 「已用於第 N 頁」 badge but stay selectable; shared placement is legal and edits
 * 連動 all pages), or build a brand-new chart from manually entered points.
 */
export function AddChartPanel({
  intents,
  usedPagesByIntent,
  onAddExisting,
  onAddUserData
}: AddChartPanelProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"source" | "manual">("source");

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {t("editor.chart.add.heading")}
      </p>

      {onAddUserData ? (
        <div role="tablist" className="mt-2 flex gap-1 rounded-xl bg-panel p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "source"}
            onClick={() => setTab("source")}
            className={tabClass(tab === "source")}
          >
            {t("editor.chart.add.fromSource")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "manual"}
            onClick={() => setTab("manual")}
            className={tabClass(tab === "manual")}
          >
            {t("editor.chart.add.manual")}
          </button>
        </div>
      ) : null}

      {tab === "source" || !onAddUserData ? (
        <SourceIntentList
          intents={intents}
          usedPagesByIntent={usedPagesByIntent}
          onAddExisting={onAddExisting}
        />
      ) : (
        <ManualChartForm onCreate={onAddUserData} />
      )}
    </div>
  );
}

function tabClass(active: boolean): string {
  return [
    "flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
    active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
  ].join(" ");
}

function SourceIntentList({
  intents,
  usedPagesByIntent,
  onAddExisting
}: Pick<AddChartPanelProps, "intents" | "usedPagesByIntent" | "onAddExisting">) {
  const { t } = useI18n();
  if (intents.length === 0) {
    return <p className="mt-2 text-xs text-ink-soft">{t("editor.chart.add.empty")}</p>;
  }
  return (
    <ul className="mt-2 space-y-2">
      {intents.map((intent) => {
        const usedPages = usedPagesByIntent[intent.id] ?? [];
        const preview = intent.sourceFacts
          .slice(0, FACT_PREVIEW_LIMIT)
          .map((fact) => fact.value)
          .join("、");
        return (
          <li key={intent.id} className="rounded-lg border border-line bg-panel px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{intent.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{intent.rationale}</p>
                {preview ? (
                  <p className="mt-0.5 truncate text-xs text-ink-soft/80">
                    {preview}
                    {intent.sourceFacts.length > FACT_PREVIEW_LIMIT ? "…" : ""}
                  </p>
                ) : null}
                {usedPages.length > 0 ? (
                  <p className="mt-1 text-xs text-brand-700">
                    {t("editor.chart.add.usedOn", { pages: usedPages.join("、") })}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onAddExisting(intent.id)}
                className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
              >
                {t("editor.chart.add.place")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ManualChartForm({
  onCreate
}: {
  onCreate: NonNullable<AddChartPanelProps["onAddUserData"]>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [visual, setVisual] = useState<ChartVisualOverride>("auto");
  const [points, setPoints] = useState<UserPointInput[]>([
    { label: "", valueText: "", unit: null }
  ]);

  const validPoint = (point: UserPointInput) =>
    point.label.trim().length > 0 && USER_POINT_VALUE_PATTERN.test(point.valueText);
  const canCreate = title.trim().length > 0 && points.length > 0 && points.every(validPoint);

  const updatePoint = (index: number, patch: Partial<UserPointInput>) =>
    setPoints((current) =>
      current.map((point, i) => (i === index ? { ...point, ...patch } : point))
    );

  return (
    <div className="mt-2 space-y-2">
      <div>
        <label
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft"
          htmlFor="manual-chart-title"
        >
          {t("editor.chart.data.title")}
        </label>
        <input
          id="manual-chart-title"
          className={fieldBox}
          maxLength={CHART_EDIT_LIMITS.maxLabelLength}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div>
        <label
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft"
          htmlFor="manual-chart-visual"
        >
          {t("editor.chart.visual")}
        </label>
        <select
          id="manual-chart-visual"
          className={fieldBox}
          value={visual}
          onChange={(event) => setVisual(event.target.value as ChartVisualOverride)}
        >
          {SELECTABLE_VISUALS.map((candidate) => (
            <option key={candidate} value={candidate}>
              {t(`editor.chart.visual.${candidate}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t("editor.chart.data.heading")}
        </span>
        <button
          type="button"
          onClick={() =>
            setPoints((current) => [...current, { label: "", valueText: "", unit: null }])
          }
          className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
        >
          + {t("editor.chart.data.addRow")}
        </button>
      </div>

      <ul className="space-y-1">
        {points.map((point, index) => (
          <li key={index} className="flex items-center gap-1">
            <input
              aria-label={t("editor.chart.data.label")}
              placeholder={t("editor.chart.data.label.placeholder")}
              maxLength={CHART_EDIT_LIMITS.maxLabelLength}
              className={fieldBox}
              value={point.label}
              onChange={(event) => updatePoint(index, { label: event.target.value })}
            />
            <input
              aria-label={t("editor.chart.data.value")}
              placeholder={t("editor.chart.data.value.placeholder")}
              maxLength={CHART_EDIT_LIMITS.maxValueTextLength}
              className={`${fieldBox} max-w-24 ${
                point.valueText.length > 0 && !USER_POINT_VALUE_PATTERN.test(point.valueText)
                  ? "border-red-400"
                  : ""
              }`}
              value={point.valueText}
              onChange={(event) => updatePoint(index, { valueText: event.target.value })}
            />
            <input
              aria-label={t("editor.chart.data.unit")}
              placeholder={t("editor.chart.data.unit.placeholder")}
              maxLength={CHART_EDIT_LIMITS.maxUnitLength}
              className={`${fieldBox} max-w-16`}
              value={point.unit ?? ""}
              onChange={(event) =>
                updatePoint(index, {
                  unit: event.target.value === "" ? null : event.target.value
                })
              }
            />
            <button
              type="button"
              aria-label={t("editor.chart.data.removeRow")}
              onClick={() => setPoints((current) => current.filter((_, i) => i !== index))}
              className="shrink-0 rounded border border-line px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={!canCreate}
        onClick={() => onCreate({ title: title.trim(), visual, points })}
        className="w-full rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
      >
        {t("editor.chart.add.create")}
      </button>
    </div>
  );
}
