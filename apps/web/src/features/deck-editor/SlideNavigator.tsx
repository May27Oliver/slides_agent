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

interface SlideNavigatorProps {
  slides: readonly Slide[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSlide: (afterId: string | null) => void;
  onRemoveSlide: (id: string) => void;
  onMoveSlide: (from: number, to: number) => void;
}

/**
 * 010 (US1, FR-002): left/slides-tab navigator. A pure-text slide list (number +
 * title) — no thumbnails. Reordering is drag-and-drop (pointer + keyboard via
 * @dnd-kit, so it stays keyboard-operable, FR-017).
 */
export function SlideNavigator({
  slides,
  selectedId,
  onSelect,
  onAddSlide,
  onRemoveSlide,
  onMoveSlide
}: SlideNavigatorProps) {
  const { t } = useI18n();
  const sensors = useReorderSensors();
  const ids = slides.map((s) => s.id);

  return (
    <nav aria-label={t("editor.nav.aria")} className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t("editor.nav.heading")}</h2>
        <button
          type="button"
          onClick={() => onAddSlide(selectedId)}
          className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
        >
          + {t("editor.slide.add")}
        </button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const move = dragEndIndices(ids, event);
          if (move) {
            onMoveSlide(move.from, move.to);
          }
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {slides.map((slide, index) => (
              <SortableSlideRow
                key={slide.id}
                slide={slide}
                index={index}
                selected={slide.id === selectedId}
                canRemove={slides.length > 1}
                onSelect={onSelect}
                onRemove={onRemoveSlide}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </nav>
  );
}

function SortableSlideRow({
  slide,
  index,
  selected,
  canRemove,
  onSelect,
  onRemove
}: {
  slide: Slide;
  index: number;
  selected: boolean;
  canRemove: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-stretch gap-1 ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <button
        type="button"
        aria-label={t("editor.dragHandle")}
        className="flex cursor-grab touch-none items-center rounded-lg border border-line px-1.5 text-ink-soft hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <button
        type="button"
        onClick={() => onSelect(slide.id)}
        aria-current={selected ? "true" : undefined}
        className={[
          "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
          selected
            ? "border-brand-700 bg-brand-50 text-ink"
            : "border-line bg-panel text-ink hover:bg-surface"
        ].join(" ")}
      >
        <span className="shrink-0 tabular-nums text-xs text-ink-soft">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate">{slide.title || "—"}</span>
      </button>
      <button
        type="button"
        aria-label={t("editor.slide.remove")}
        disabled={!canRemove}
        onClick={() => onRemove(slide.id)}
        className="shrink-0 rounded border border-line px-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30"
      >
        ✕
      </button>
    </li>
  );
}
