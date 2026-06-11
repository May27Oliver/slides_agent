import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChartIntent, EditDataPoint, SourceFact, UserPointInput } from "@slides-agent/domain";
import {
  CHART_EDIT_LIMITS,
  USER_POINT_VALUE_PATTERN,
  deriveChartPointLabel,
  parseMetricValue
} from "@slides-agent/domain";
import {
  GripIcon,
  dragEndIndices,
  useReorderSensors
} from "@/features/deck-editor/sortable-helpers";
import { useI18n } from "@/i18n";

const cellBox =
  "w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700";

interface ChartDataTableProps {
  /** The intent's CURRENT (base) state — fact lookup + the default row list. */
  intent: ChartIntent;
  /** The draft's pending edit for this intent, or null (no data edits yet). */
  pendingEdit: { points: EditDataPoint[]; title?: string } | null;
  /** Full-list edit (array order = display order); title only when changed. */
  onEdit: (points: EditDataPoint[], title?: string) => void;
  /** Clears every pending op for this intent; null hides the button. */
  onResetAll: (() => void) | null;
}

/**
 * 014 (US3, FR-006~009): the chart's data-point editor. Rows mirror the intent's
 * facts; touching an original row converts it into a user-provided point that
 * carries `replacesFactId` (provenance honesty — the original id is never reused
 * for a changed value), with an inline badge and per-row restore.
 */
export function ChartDataTable({ intent, pendingEdit, onEdit, onResetAll }: ChartDataTableProps) {
  const { t } = useI18n();
  const sensors = useReorderSensors();
  const factsById = new Map(intent.sourceFacts.map((fact) => [fact.id, fact]));
  const rows: EditDataPoint[] =
    pendingEdit?.points ??
    intent.sourceFacts.map((fact) => ({ kind: "original", sourceFactId: fact.id }));
  const title = pendingEdit?.title;

  const emit = (nextRows: EditDataPoint[], nextTitle?: string | undefined) =>
    onEdit(nextRows, nextTitle !== undefined ? nextTitle : title);

  const updateRow = (index: number, field: keyof UserPointInput, value: string | null) => {
    const next = rows.map((row, i) => {
      if (i !== index) return row;
      const base: UserPointInput & { replacesFactId?: string } =
        row.kind === "user"
          ? { ...row.point, ...(row.replacesFactId ? { replacesFactId: row.replacesFactId } : {}) }
          : { ...prefillFrom(factsById.get(row.sourceFactId)), replacesFactId: row.sourceFactId };
      const { replacesFactId, ...point } = { ...base, [field]: value };
      return {
        kind: "user" as const,
        point,
        ...(replacesFactId ? { replacesFactId } : {})
      };
    });
    emit(next);
  };

  const rowIds = rows.map((_, index) => `point-${index}`);

  return (
    <div className="mt-2">
      <div className="mb-2">
        <label
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft"
          htmlFor={`chart-title-${intent.id}`}
        >
          {t("editor.chart.data.title")}
        </label>
        <input
          id={`chart-title-${intent.id}`}
          className={cellBox}
          maxLength={CHART_EDIT_LIMITS.maxLabelLength}
          value={title ?? intent.title}
          onChange={(event) => emit(rows, event.target.value)}
        />
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t("editor.chart.data.heading")}
        </span>
        <div className="flex items-center gap-2">
          {onResetAll && pendingEdit ? (
            <button
              type="button"
              onClick={onResetAll}
              className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
            >
              {t("editor.chart.reset")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              emit([...rows, { kind: "user", point: { label: "", valueText: "", unit: null } }])
            }
            className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            + {t("editor.chart.data.addRow")}
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const move = dragEndIndices(rowIds, event);
          if (move) {
            const next = [...rows];
            const [moved] = next.splice(move.from, 1);
            next.splice(move.to, 0, moved!);
            emit(next);
          }
        }}
      >
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {rows.map((row, index) => (
              <SortablePointRow
                key={rowIds[index]}
                id={rowIds[index]!}
                display={displayOf(row, factsById)}
                onField={(field, value) => updateRow(index, field, value)}
                onRemove={() => emit(rows.filter((_, i) => i !== index))}
                onRestore={
                  row.kind === "user" && row.replacesFactId
                    ? () =>
                        emit(
                          rows.map((candidate, i) =>
                            i === index
                              ? { kind: "original", sourceFactId: row.replacesFactId! }
                              : candidate
                          )
                        )
                    : null
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface RowDisplay {
  label: string;
  valueText: string;
  unit: string;
  isUser: boolean;
  invalidValue: boolean;
}

function displayOf(row: EditDataPoint, factsById: Map<string, SourceFact>): RowDisplay {
  if (row.kind === "user") {
    return {
      label: row.point.label,
      valueText: row.point.valueText,
      unit: row.point.unit ?? "",
      isUser: true,
      invalidValue:
        row.point.valueText.length > 0 && !USER_POINT_VALUE_PATTERN.test(row.point.valueText)
    };
  }
  const prefill = prefillFrom(factsById.get(row.sourceFactId));
  return {
    label: prefill.label,
    valueText: prefill.valueText,
    unit: prefill.unit ?? "",
    isUser: false,
    invalidValue: false
  };
}

/** Editable prefill for a fact: the SAME label the chart shows + parsed value/unit. */
function prefillFrom(fact: SourceFact | undefined): UserPointInput {
  if (!fact) {
    return { label: "", valueText: "", unit: null };
  }
  const parsed = fact.metric
    ? { numericValue: fact.metric.numericValue, unit: fact.metric.unit }
    : parseMetricValue(fact.value);
  return {
    label: deriveChartPointLabel(fact),
    valueText: parsed ? String(parsed.numericValue) : "",
    unit: parsed?.unit ?? null
  };
}

function SortablePointRow({
  id,
  display,
  onField,
  onRemove,
  onRestore
}: {
  id: string;
  display: RowDisplay;
  onField: (field: keyof UserPointInput, value: string | null) => void;
  onRemove: () => void;
  onRestore: (() => void) | null;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-line bg-panel/50 p-1.5 ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("editor.dragHandle")}
          className="flex cursor-grab touch-none items-center rounded border border-line px-1.5 py-2 text-ink-soft hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
        <input
          aria-label={t("editor.chart.data.label")}
          placeholder={t("editor.chart.data.label.placeholder")}
          maxLength={CHART_EDIT_LIMITS.maxLabelLength}
          className={cellBox}
          value={display.label}
          onChange={(event) => onField("label", event.target.value)}
        />
        <input
          aria-label={t("editor.chart.data.value")}
          placeholder={t("editor.chart.data.value.placeholder")}
          maxLength={CHART_EDIT_LIMITS.maxValueTextLength}
          className={`${cellBox} max-w-24 ${display.invalidValue ? "border-red-400" : ""}`}
          value={display.valueText}
          onChange={(event) => onField("valueText", event.target.value)}
        />
        <input
          aria-label={t("editor.chart.data.unit")}
          placeholder={t("editor.chart.data.unit.placeholder")}
          maxLength={CHART_EDIT_LIMITS.maxUnitLength}
          className={`${cellBox} max-w-16`}
          value={display.unit}
          onChange={(event) =>
            onField("unit", event.target.value === "" ? null : event.target.value)
          }
        />
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
            display.isUser ? "bg-brand-100 text-brand-700" : "bg-surface text-ink-soft"
          }`}
        >
          {display.isUser
            ? t("editor.chart.data.badge.user")
            : t("editor.chart.data.badge.original")}
        </span>
        {onRestore ? (
          <button
            type="button"
            aria-label={t("editor.chart.data.restoreRow")}
            onClick={onRestore}
            className="shrink-0 rounded border border-line px-1.5 py-1 text-xs text-ink hover:bg-surface"
          >
            ↺
          </button>
        ) : null}
        <button
          type="button"
          aria-label={t("editor.chart.data.removeRow")}
          onClick={onRemove}
          className="shrink-0 rounded border border-line px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          ✕
        </button>
      </div>
      {display.invalidValue ? (
        <p className="mt-1 pl-8 text-xs text-red-600">{t("editor.chart.data.invalidValue")}</p>
      ) : null}
    </li>
  );
}
