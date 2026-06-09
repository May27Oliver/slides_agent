import type { DragEndEvent } from "@dnd-kit/core";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * 010: shared drag-to-reorder wiring for the editor's bullet list and slide list.
 * Pointer drag plus a keyboard sensor — so reordering stays fully keyboard-operable
 * (focus the handle → Space to lift → arrows to move → Space to drop), preserving the
 * a11y guarantee the old ↑/↓ buttons provided (FR-017).
 */
export function useReorderSensors() {
  return useSensors(
    // A small activation distance so a focus/click on the handle doesn't micro-drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

/** Resolve a DragEnd into {from,to} indices over the given ordered id list, or null. */
export function dragEndIndices(ids: string[], event: DragEndEvent): { from: number; to: number } | null {
  const { active, over } = event;
  if (!over || active.id === over.id) {
    return null;
  }
  const from = ids.indexOf(String(active.id));
  const to = ids.indexOf(String(over.id));
  return from < 0 || to < 0 ? null : { from, to };
}

/** Six-dot grip used as the drag handle. */
export function GripIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="5" cy="3" r="1.4" />
      <circle cx="11" cy="3" r="1.4" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="11" cy="8" r="1.4" />
      <circle cx="5" cy="13" r="1.4" />
      <circle cx="11" cy="13" r="1.4" />
    </svg>
  );
}
