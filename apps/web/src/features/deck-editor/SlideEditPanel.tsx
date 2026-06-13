import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Slide } from "@slides-agent/domain";
import {
  GripIcon,
  dragEndIndices,
  useReorderSensors
} from "@/features/deck-editor/sortable-helpers";
import { useI18n } from "@/i18n";

/** 015 US3: which text field's style the right panel should edit. */
export type StyleField =
  | { kind: "title" }
  | { kind: "message" }
  | { kind: "outline"; outlineId: string };

interface SlideEditPanelProps {
  slide: Slide;
  onTitle: (value: string) => void;
  onMessage: (value: string) => void;
  onNotes: (value: string) => void;
  onOutlineText: (index: number, value: string) => void;
  onAddBullet: () => void;
  onRemoveBullet: (index: number) => void;
  onMoveBullet: (from: number, to: number) => void;
  /** 015 US3: open the right slide-out style editor for a field. */
  onOpenStyle: (field: StyleField) => void;
  /** 014: the chart editor card (or add-chart entry) composed by the page. */
  chartEditor?: React.ReactNode;
}

const fieldLabel = "mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft";
const fieldBox =
  "w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700";

/**
 * 010 (US1, FR-003/FR-004): the structured edit form. Edits the grounded four fields
 * (title / message / outline bullets / speaker notes). Bullets reorder by drag and are
 * keyed by their STABLE id (015), so styles follow the bullet. Each text field has a
 * style affordance (015 US3) that opens the right slide-out editor (free color + px).
 */
export function SlideEditPanel({
  slide,
  onTitle,
  onMessage,
  onNotes,
  onOutlineText,
  onAddBullet,
  onRemoveBullet,
  onMoveBullet,
  onOpenStyle,
  chartEditor
}: SlideEditPanelProps) {
  const { t } = useI18n();
  const sensors = useReorderSensors();
  const bulletIds = slide.outline.map((item, index) => item.id ?? `bullet-${index}`);
  const styles = slide.textStyleOverrides;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className={`${fieldLabel} mb-0`} htmlFor="edit-title">
            {t("editor.field.title")}
          </label>
          <StyleEditButton
            active={Boolean(styles?.title)}
            onClick={() => onOpenStyle({ kind: "title" })}
          />
        </div>
        <input
          id="edit-title"
          className={fieldBox}
          value={slide.title}
          onChange={(e) => onTitle(e.target.value)}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className={`${fieldLabel} mb-0`} htmlFor="edit-message">
            {t("editor.field.message")}
          </label>
          <StyleEditButton
            active={Boolean(styles?.message)}
            onClick={() => onOpenStyle({ kind: "message" })}
          />
        </div>
        <textarea
          id="edit-message"
          rows={2}
          className={fieldBox}
          value={slide.message}
          onChange={(e) => onMessage(e.target.value)}
        />
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <span className={fieldLabel}>{t("editor.field.outline")}</span>
          <button
            type="button"
            onClick={onAddBullet}
            className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            + {t("editor.bullet.add")}
          </button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            const move = dragEndIndices(bulletIds, event);
            if (move) {
              onMoveBullet(move.from, move.to);
            }
          }}
        >
          <SortableContext items={bulletIds} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {slide.outline.map((item, index) => (
                <SortableBulletRow
                  key={bulletIds[index]}
                  id={bulletIds[index]!}
                  index={index}
                  text={item.text}
                  hasStyle={Boolean(item.id && styles?.outlineById?.[item.id])}
                  onText={onOutlineText}
                  onRemove={onRemoveBullet}
                  {...(item.id
                    ? { onOpenStyle: () => onOpenStyle({ kind: "outline", outlineId: item.id! }) }
                    : {})}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <div>
        <label className={fieldLabel} htmlFor="edit-notes">
          {t("editor.field.notes")}
        </label>
        <textarea
          id="edit-notes"
          rows={3}
          className={fieldBox}
          value={slide.speakerNotesDraft}
          onChange={(e) => onNotes(e.target.value)}
        />
      </div>

      {chartEditor}
    </div>
  );
}

/** Pencil button that opens the style panel; filled state marks a field with overrides. */
function StyleEditButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t("editor.textStyle.edit")}
      aria-pressed={active}
      onClick={onClick}
      className={[
        "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
        "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
        active
          ? "border-brand-700 bg-brand-50 text-brand-700"
          : "border-line text-ink-soft hover:bg-surface hover:text-ink"
      ].join(" ")}
    >
      <PencilIcon />
      {t("editor.textStyle.heading")}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden focusable="false">
      <path
        d="M4 20h4L18.5 9.5a2 2 0 0 0-2.83-2.83L5 17v3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortableBulletRow({
  id,
  index,
  text,
  hasStyle,
  onText,
  onRemove,
  onOpenStyle
}: {
  id: string;
  index: number;
  text: string;
  hasStyle: boolean;
  onText: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onOpenStyle?: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 ${isDragging ? "z-10 opacity-80" : ""}`}
    >
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
        aria-label={`${t("editor.field.outline")} ${index + 1}`}
        className={fieldBox}
        value={text}
        onChange={(e) => onText(index, e.target.value)}
      />
      {onOpenStyle ? (
        <button
          type="button"
          aria-label={`${t("editor.textStyle.edit")} ${index + 1}`}
          aria-pressed={hasStyle}
          onClick={onOpenStyle}
          className={[
            "flex shrink-0 items-center rounded border px-1.5 py-2 transition-colors",
            "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
            hasStyle
              ? "border-brand-700 bg-brand-50 text-brand-700"
              : "border-line text-ink-soft hover:bg-surface hover:text-ink"
          ].join(" ")}
        >
          <PencilIcon />
        </button>
      ) : null}
      <button
        type="button"
        aria-label={t("editor.bullet.remove")}
        onClick={() => onRemove(index)}
        className="shrink-0 rounded border border-line px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        ✕
      </button>
    </li>
  );
}
