import { useEffect, useState } from "react";
import type {
  ManualThemeSelection,
  ThemeCatalog,
  ThemeSelectionWarning
} from "@slides-agent/domain";
import { ThemeBrowserModal } from "@/features/theme-picker/ThemeBrowserModal";
import { ThemeSummary } from "@/features/theme-picker/ThemeSummary";
import { fetchThemeCatalog } from "@/features/theme-picker/themes-client";

interface ThemePickerProps {
  selection: ManualThemeSelection;
  onChange: (selection: ManualThemeSelection) => void;
  fetchImpl?: typeof fetch;
  warnings?: ThemeSelectionWarning[];
  /** Lets the editor reuse the already-loaded catalogue (avoids a second fetch). */
  onCatalogLoaded?: (catalog: ThemeCatalog) => void;
}

/**
 * 011: the single shared theme-picker unit — an always-on summary plus the browse
 * modal — mounted on BOTH the generation form sidebar and the editor panel. The
 * catalogue (GET /api/themes) is fetched once on mount; applying in the modal lifts
 * the chosen `ManualThemeSelection` to the parent via `onChange`.
 */
export function ThemePicker({
  selection,
  onChange,
  fetchImpl = fetch,
  warnings,
  onCatalogLoaded
}: ThemePickerProps) {
  const [catalog, setCatalog] = useState<ThemeCatalog | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchThemeCatalog(fetchImpl)
      .then((loaded) => {
        if (cancelled) return;
        setCatalog(loaded);
        onCatalogLoaded?.(loaded);
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      });
    return () => {
      cancelled = true;
    };
    // fetchImpl/onCatalogLoaded are stable per page; the catalogue loads once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ThemeSummary
        selection={selection}
        catalog={catalog}
        warnings={warnings ?? []}
        onBrowse={() => setOpen(true)}
      />
      {open && catalog ? (
        <ThemeBrowserModal
          catalog={catalog}
          initialSelection={selection}
          onApply={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
