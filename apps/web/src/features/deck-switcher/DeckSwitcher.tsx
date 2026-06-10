import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DeckSummaryContract } from "@slides-agent/contracts";
import { AuthError } from "@/features/auth/auth-client";
import { listDecks } from "@/features/decks/decks-client";
import { switcherDecks } from "@/features/deck-switcher/recent-decks";
import { useI18n } from "@/i18n";

interface DeckSwitcherProps {
  fetchImpl: typeof fetch;
  /** Return false to cancel navigation (US2 #5 — guard unsaved edits). */
  confirmNavigate?: () => boolean;
}

/**
 * 010 (US2, FR-009/FR-010): the cross-deck history switcher shared by the generation
 * and editor topbars. A hybrid dropdown — title search + recent 8 + "browse all" →
 * /decks. Selecting a deck routes to its editor. Reuses GET /api/decks (no new
 * endpoint); search filters the full set client-side.
 */
export function DeckSwitcher({ fetchImpl, confirmNavigate }: DeckSwitcherProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [decks, setDecks] = useState<DeckSummaryContract[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listDecks(fetchImpl)
      .then((result) => setDecks(result.decks))
      .catch((error) => {
        if (!(error instanceof AuthError)) {
          setDecks([]);
        }
      })
      .finally(() => setLoading(false));
  }, [open, fetchImpl]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const navigateTo = useCallback(
    (path: string) => {
      if (confirmNavigate && !confirmNavigate()) return;
      setOpen(false);
      navigate(path);
    },
    [confirmNavigate, navigate]
  );

  const visible = switcherDecks(decks, query);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-line px-3 py-1 font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
      >
        {t("switcher.open")} ▾
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1 w-[min(92vw,22rem)] rounded-2xl border border-line bg-panel p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("switcher.search")}
            aria-label={t("switcher.search")}
            className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          />
          {!query ? (
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {t("switcher.recent")}
            </p>
          ) : null}

          {loading ? (
            <p className="px-2 py-3 text-sm text-ink-soft">{t("editor.loading")}</p>
          ) : visible.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-soft">{t("switcher.empty")}</p>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto">
              {visible.map((deck) => (
                <li key={deck.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => navigateTo(`/decks/${deck.id}/edit`)}
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                  >
                    <span className="w-full truncate text-sm text-ink">{deck.title}</span>
                    <span className="text-xs text-ink-soft">
                      {statusLabel(deck.status, t)} · {formatDate(deck.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => navigateTo("/decks")}
            className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-brand-700 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            📂 {t("switcher.browseAll")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(
  status: string,
  t: (key: "decks.status.ready" | "decks.status.failed") => string
): string {
  if (status === "ready") return t("decks.status.ready");
  if (status === "failed") return t("decks.status.failed");
  return status;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
}
