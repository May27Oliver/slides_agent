import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Slide, TextStyleOverride } from "@slides-agent/domain";
import type { TextStylePatch } from "@/features/deck-editor/editable-slide-draft";
import {
  GripIcon,
  dragEndIndices,
  useReorderSensors
} from "@/features/deck-editor/sortable-helpers";
import { TextStyleToolbar } from "@/features/deck-editor/TextStyleToolbar";
import { useI18n } from "@/i18n";

interface SlideEditPanelProps {
  slide: Slide;
  onTitle: (value: string) => void;
  onMessage: (value: string) => void;
  onNotes: (value: string) => void;
  onOutlineText: (index: number, value: string) => void;
  onAddBullet: () => void;
  onRemoveBullet: (index: number) => void;
  onMoveBullet: (from: number, to: number) => void;
  /** 015 US3: per-field style patch/reset — title/message by field, bullets by id. */
  onFieldStyle: (field: "title" | "message", patch: TextStylePatch) => void;
  onFieldStyleReset: (field: "title" | "message") => void;
  onOutlineStyle: (outlineId: string, patch: TextStylePatch) => void;
  onOutlineStyleReset: (outlineId: string) => void;
  /** 014: the chart editor card (or add-chart entry) composed by the page. */
  chartEditor?: React.ReactNode;
}

const fieldLabel = "mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft";
const fieldBox =
  "w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700";

/**
 * 010 (US1, FR-003/FR-004): the structured edit form. Edits the grounded four fields
 * (title / message / outline bullets / speaker notes). Bullets reorder by drag (pointer
 * + keyboard via @dnd-kit, FR-017) and are keyed by their STABLE id (015), so styles
 * and edits follow the bullet through reorders. Charts edit through the composed
 * `chartEditor` card (014); contentBlocks stay read-only at the server merge (FR-021).
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
  onFieldStyle,
  onFieldStyleReset,
  onOutlineStyle,
  onOutlineStyleReset,
  chartEditor
}: SlideEditPanelProps) {
  const { t } = useI18n();
  const sensors = useReorderSensors();
  // 015: bullets carry stable ids (the draft backfills legacy ones); they double as
  // the sortable ids, replacing the old index-based scheme.
  const bulletIds = slide.outline.map((item, index) => item.id ?? `bullet-${index}`);
  const styles = slide.textStyleOverrides;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label className={`${fieldLabel} mb-0`} htmlFor="edit-title">
            {t("editor.field.title")}
          </label>
          <TextStyleToolbar
            label={t("editor.field.title")}
            value={styles?.title}
            onPatch={(patch) => onFieldStyle("title", patch)}
            onReset={() => onFieldStyleReset("title")}
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
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label className={`${fieldLabel} mb-0`} htmlFor="edit-message">
            {t("editor.field.message")}
          </label>
          <TextStyleToolbar
            label={t("editor.field.message")}
            value={styles?.message}
            onPatch={(patch) => onFieldStyle("message", patch)}
            onReset={() => onFieldStyleReset("message")}
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
            <ul className="space-y-2">
              {slide.outline.map((item, index) => (
                <SortableBulletRow
                  key={bulletIds[index]}
                  id={bulletIds[index]!}
                  index={index}
                  text={item.text}
                  style={item.id ? styles?.outlineById?.[item.id] : undefined}
                  onText={onOutlineText}
                  onRemove={onRemoveBullet}
                  {...(item.id
                    ? {
                        onStyle: (patch: TextStylePatch) => onOutlineStyle(item.id!, patch),
                        onStyleReset: () => onOutlineStyleReset(item.id!)
                      }
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

function SortableBulletRow({
  id,
  index,
  text,
  style,
  onText,
  onRemove,
  onStyle,
  onStyleReset
}: {
  id: string;
  index: number;
  text: string;
  style: TextStyleOverride | undefined;
  onText: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onStyle?: (patch: TextStylePatch) => void;
  onStyleReset?: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-1 ${isDragging ? "z-10 opacity-80" : ""}`}
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
          aria-label={`${t("editor.field.outline")} ${index + 1}`}
          className={fieldBox}
          value={text}
          onChange={(e) => onText(index, e.target.value)}
        />
        <button
          type="button"
          aria-label={t("editor.bullet.remove")}
          onClick={() => onRemove(index)}
          className="rounded border border-line px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          ✕
        </button>
      </div>
      {onStyle && onStyleReset ? (
        <div className="pl-8">
          <TextStyleToolbar
            label={`${t("editor.field.outline")} ${index + 1}`}
            value={style}
            onPatch={onStyle}
            onReset={onStyleReset}
          />
        </div>
      ) : null}
    </li>
  );
}
