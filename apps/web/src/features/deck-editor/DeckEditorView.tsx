import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DeckRevisionContract } from "@slides-agent/contracts";
import type {
  ChartIntent,
  GenerationSummary,
  ManualThemeSelection,
  SelectableTheme,
  SlideDeck,
  ThemeCatalog,
  ThemeSelectionWarning
} from "@slides-agent/domain";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthError } from "@/features/auth/auth-client";
import { getDeck } from "@/features/decks/decks-client";
import { DeckSwitcher } from "@/features/deck-switcher/DeckSwitcher";
import {
  EditConflictError,
  EditInvalidError,
  createEditRevision
} from "@/features/deck-editor/deck-editor-client";
import {
  AUTOSAVE_INTERVAL_MS,
  type DeckDraft,
  type DraftClassification,
  classifyDraft,
  clearDraft,
  loadDraft,
  saveDraft
} from "@/features/deck-editor/deck-draft-storage";
import { buildHtmlDownload } from "@/features/slide-generation/download-html";
import { AddChartPanel } from "@/features/deck-editor/AddChartPanel";
import { ChartDataTable } from "@/features/deck-editor/ChartDataTable";
import { ChartEditorCard } from "@/features/deck-editor/ChartEditorCard";
import { EditableSlideDraft } from "@/features/deck-editor/editable-slide-draft";
import { LivePreview } from "@/features/deck-editor/LivePreview";
import { SlideEditPanel } from "@/features/deck-editor/SlideEditPanel";
import { SlideNavigator } from "@/features/deck-editor/SlideNavigator";
import { ThemePicker } from "@/features/theme-picker/ThemePicker";
import { useI18n } from "@/i18n";

type LoadState = "loading" | "ready" | "error" | "notReady";
type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; revision: number }
  | { kind: "conflict"; revision: number }
  | { kind: "invalid" }
  | { kind: "error" };

/**
 * 010 (US1, FR-001): the editor page. Three columns — slide navigator / structured
 * edit form / live preview. Loads the deck's current revision, edits an immutable
 * working draft, and saves a new revision through the edit endpoint. A 409 reloads
 * and shows the latest revision (FR-020); the preview mirrors the server renderer.
 */
export function DeckEditorView({
  autosaveIntervalMs = AUTOSAVE_INTERVAL_MS
}: {
  autosaveIntervalMs?: number;
} = {}) {
  const { id = "" } = useParams();
  const { authFetch, logout, user } = useAuth();
  const { t } = useI18n();

  const [state, setState] = useState<LoadState>("loading");
  const [base, setBase] = useState<DeckRevisionContract | null>(null);
  const [deckTitle, setDeckTitle] = useState("");
  const [draft, setDraft] = useState<EditableSlideDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedHtml, setSavedHtml] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [rightTab, setRightTab] = useState<"edit" | "slides">("edit");
  const [pendingDraft, setPendingDraft] = useState<{
    draft: DeckDraft;
    kind: Exclude<DraftClassification, "none">;
  } | null>(null);
  // 011: manual re-theme. selection lifts from the picker; candidates feed the client
  // live preview (parity); warnings are the post-save fallback evidence to disclose.
  const [themeSelection, setThemeSelection] = useState<ManualThemeSelection>({});
  const [themeCandidates, setThemeCandidates] = useState<SelectableTheme[]>([]);
  const [themeWarnings, setThemeWarnings] = useState<ThemeSelectionWarning[]>([]);
  // 014: the live preview's summary — chart cards read render evidence from it.
  const [previewSummary, setPreviewSummary] = useState<GenerationSummary | null>(null);

  const adopt = useCallback((title: string, revision: DeckRevisionContract) => {
    const slideDeck = revision.slideDeck as SlideDeck;
    setDeckTitle(title);
    setBase(revision);
    setDraft(EditableSlideDraft.fromRevision(revision.revision, slideDeck));
    setSelectedId(slideDeck.slides[0]?.id ?? null);
    setDirty(false);
    // Drop any prior deck's post-save html so a deck switch (same component, new :id)
    // can't show the previous deck's preview. A fresh save re-sets it right after.
    setSavedHtml(null);
    // 011: the adopted revision has the theme baked in, so the pending override resets.
    // Surface any fallback evidence it carries (honest disclosure).
    setThemeSelection({});
    const summary = revision.generationSummary as {
      themeSelectionWarnings?: ThemeSelectionWarning[];
    } | null;
    setThemeWarnings(summary?.themeSelectionWarnings ?? []);
  }, []);

  const load = useCallback(() => {
    setState("loading");
    getDeck(id, authFetch)
      .then((detail) => {
        if (!detail.currentRevision) {
          setState("notReady");
          return;
        }
        adopt(detail.title, detail.currentRevision);
        // US3: surface any localStorage draft against the freshly-loaded revision.
        const current = detail.currentRevision;
        const existing = loadDraft(id);
        const kind = classifyDraft(existing, {
          revision: current.revision,
          createdAt: current.createdAt
        });
        setPendingDraft(kind === "none" || !existing ? null : { draft: existing, kind });
        setState("ready");
      })
      .catch((error) => {
        if (!(error instanceof AuthError)) {
          setState("error");
        }
      });
  }, [id, authFetch, adopt]);

  useEffect(() => {
    load();
  }, [load]);

  // US3 (FR-013): periodic localStorage autosave. A single stable interval reads the
  // latest draft via refs, so editing never resets the timer.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const interval = setInterval(() => {
      const current = draftRef.current;
      if (current && dirtyRef.current) {
        saveDraft({
          deckId: id,
          baseRevision: current.baseRevision,
          slideDeck: current.deck,
          savedAt: new Date().toISOString(),
          chartOperations: [...current.chartOperations]
        });
      }
    }, autosaveIntervalMs);
    return () => clearInterval(interval);
  }, [id, autosaveIntervalMs]);

  // US3 (FR-014 / US2 #5): warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const restoreDraft = useCallback(() => {
    setPendingDraft((pending) => {
      if (!pending) return null;
      const restored = pending.draft.slideDeck;
      setDraft(
        EditableSlideDraft.fromRevision(
          pending.draft.baseRevision,
          restored,
          undefined,
          pending.draft.chartOperations ?? []
        )
      );
      setSelectedId(restored.slides[0]?.id ?? null);
      setDirty(true);
      setSavedHtml(null);
      return null;
    });
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft(id);
    setPendingDraft(null);
  }, [id]);

  // Any structural/text edit clears the post-save authoritative html so the preview
  // returns to the live local render, and marks the draft dirty.
  const edit = useCallback((fn: (d: EditableSlideDraft) => EditableSlideDraft) => {
    setDraft((current) => (current ? fn(current) : current));
    setSavedHtml(null);
    setDirty(true);
    setSaveState({ kind: "idle" });
  }, []);

  // 011: applying a theme is a savable change — like a text edit, it drops the
  // authoritative html (so the live preview shows the re-themed local render) and
  // marks the draft dirty so Save persists it.
  const changeTheme = useCallback((selection: ManualThemeSelection) => {
    setThemeSelection(selection);
    setSavedHtml(null);
    setDirty(true);
    setSaveState({ kind: "idle" });
  }, []);

  const selectedSlide = useMemo(
    () => draft?.slides.find((s) => s.id === selectedId) ?? draft?.slides[0] ?? null,
    [draft, selectedId]
  );

  // 014: the selected slide's chart editor model, derived from the EFFECTIVE
  // placement state (base placeholders + pending ops replayed, R10). A pending
  // user_data add resolves to its deterministic future id, so the preview's render
  // evidence lines up before the save happens.
  const baseIntents = useMemo(
    () => ((base?.chartIntents as ChartIntent[] | null) ?? []) as ChartIntent[],
    [base]
  );
  const canEditCharts = base !== null && base.chartIntents !== null;

  const chartCard = useMemo(() => {
    if (!draft || !selectedSlide || !canEditCharts) return null;
    const placedId = draft.placedChartId(selectedSlide.id);
    if (!placedId) return null;
    const baseIntent = baseIntents.find((candidate) => candidate.id === placedId);
    const pendingUserAdd = draft.chartOperations.find(
      (op): op is Extract<typeof op, { op: "add_chart" }> =>
        op.op === "add_chart" &&
        op.source.kind === "user_data" &&
        draft.placedChartId(op.slideId) === placedId
    );
    const title =
      baseIntent?.title ??
      (pendingUserAdd?.source.kind === "user_data" ? pendingUserAdd.source.title : placedId);
    const sharedPages = draft.deck.slides
      .map((slide, index) => ({ slide, page: index + 1 }))
      .filter(
        ({ slide }) => slide.id !== selectedSlide.id && draft.placedChartId(slide.id) === placedId
      )
      .map(({ page }) => page);
    const renderedChart = previewSummary?.renderedCharts.find(
      (chart) => chart.chartIntentId === placedId && chart.slideId === selectedSlide.id
    );
    // US3: the structured disclosure for THIS placement (n/m user points).
    const disclosure = previewSummary?.userDataDisclosures.find(
      (entry) => entry.chartIntentId === placedId && entry.slideId === selectedSlide.id
    );
    return { chartIntentId: placedId, title, sharedPages, renderedChart, baseIntent, disclosure };
  }, [draft, baseIntents, selectedSlide, previewSummary, canEditCharts]);

  // US2 (FR-005/FR-016): the add entry shows only on a chartless, non-opening slide.
  const showAddChart = Boolean(
    draft && selectedSlide && !chartCard && selectedSlide.slideKind !== "opening" && canEditCharts
  );

  const showLegacyChartNotice = Boolean(
    !canEditCharts &&
    selectedSlide?.contentBlocks.some((block) => block.kind === "chart_placeholder")
  );

  const usedPagesByIntent = useMemo(() => {
    if (!draft) return {};
    const used: Record<string, number[]> = {};
    draft.deck.slides.forEach((slide, index) => {
      const placedId = draft.placedChartId(slide.id);
      if (placedId) {
        used[placedId] = [...(used[placedId] ?? []), index + 1];
      }
    });
    return used;
  }, [draft]);

  const onSave = useCallback(async () => {
    if (!draft) return;
    setSaveState({ kind: "saving" });
    try {
      const revision = await createEditRevision(
        id,
        {
          ...draft.toRequest(),
          ...(hasThemeSelection(themeSelection) ? { themeSelection } : {})
        },
        authFetch
      );
      adopt(deckTitle, revision);
      clearDraft(id); // US3: a persisted revision supersedes the local draft.
      setPendingDraft(null);
      setSavedHtml(revision.html);
      setSaveState({ kind: "saved", revision: revision.revision });
    } catch (error) {
      if (error instanceof AuthError) return;
      if (error instanceof EditConflictError) {
        // Preserve the in-progress edits before reloading the latest revision so they
        // are NOT silently discarded (FR-020). The reload classifies this saved draft
        // as a version conflict and surfaces the restore/discard banner.
        saveDraft({
          deckId: id,
          baseRevision: draft.baseRevision,
          slideDeck: draft.deck,
          savedAt: new Date().toISOString(),
          chartOperations: [...draft.chartOperations]
        });
        load(); // reload + show the latest revision (FR-020)
        setSaveState({ kind: "conflict", revision: error.currentRevision });
      } else if (error instanceof EditInvalidError) {
        setSaveState({ kind: "invalid" });
      } else {
        setSaveState({ kind: "error" });
      }
    }
  }, [draft, id, authFetch, adopt, deckTitle, load, themeSelection]);

  if (state === "loading") {
    return <CenterMessage>{t("editor.loading")}</CenterMessage>;
  }
  if (state === "error") {
    return <CenterMessage tone="error">{t("editor.error")}</CenterMessage>;
  }
  if (state === "notReady") {
    return <CenterMessage>{t("editor.notReady")}</CenterMessage>;
  }
  if (!draft || !base || !selectedSlide) {
    return <CenterMessage>{t("editor.loading")}</CenterMessage>;
  }

  return (
    // h-screen (not min-h-screen): the columns get a FIXED viewport-bound height, so a
    // long edit panel scrolls internally instead of stretching the grid row — which
    // would stretch the preview iframe and with it the slide (100vh of the iframe).
    <div className="flex h-screen flex-col bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-5 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/decks" className="font-medium text-brand-700 hover:underline">
            {t("decks.nav")}
          </Link>
          <DeckSwitcher
            fetchImpl={authFetch}
            confirmNavigate={() => !dirty || window.confirm(t("editor.unsaved"))}
          />
          <span className="truncate font-semibold text-ink">{deckTitle}</span>
          {dirty ? <span className="text-xs text-amber-600">{t("editor.unsaved")}</span> : null}
        </div>
        <div className="flex items-center gap-3">
          {/* 015 US1 (FR-001/FR-002): download the ADOPTED revision's html; while dirty
              the entry is disabled — the download must match what's saved on the server. */}
          <HtmlDownloadEntry base={base} deckTitle={deckTitle} dirty={dirty} />
          <SaveStatus saveState={saveState} />
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saveState.kind === "saving"}
            className="rounded-lg bg-brand-700 px-3 py-1.5 font-medium text-white hover:bg-brand-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            {saveState.kind === "saving" ? t("editor.saving") : t("editor.save")}
          </button>
          {user ? <span className="text-ink-soft">{user.displayName}</span> : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-line px-3 py-1 font-medium text-ink hover:bg-surface"
          >
            {t("decks.logout")}
          </button>
        </div>
      </header>

      {pendingDraft ? (
        <DraftBanner kind={pendingDraft.kind} onRestore={restoreDraft} onDiscard={discardDraft} />
      ) : null}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2 md:overflow-hidden">
        {/* Left half: live preview. */}
        <div className="min-h-0 rounded-2xl border border-line bg-panel p-3 max-md:h-[58vh]">
          <LivePreview
            base={base}
            workingDeck={draft.deck}
            authoritativeHtml={savedHtml}
            {...(hasThemeSelection(themeSelection) ? { themeSelection } : {})}
            themeCandidates={themeCandidates}
            chartOperations={draft.chartOperations}
            onSummary={setPreviewSummary}
            onSlideChange={(index) => {
              const slide = draft.slides[index];
              if (slide) setSelectedId(slide.id);
            }}
            selectedIndex={Math.max(
              0,
              draft.slides.findIndex((s) => s.id === selectedSlide.id)
            )}
          />
        </div>

        {/* Right half: theme picker + tabbed slide edit form / slide ordering. */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-panel p-3 max-md:h-[70vh]">
          {/* 011: re-theme entry (WYSIWYG via the live preview + applyThemeSelection). */}
          <div className="mb-3">
            <ThemePicker
              selection={themeSelection}
              onChange={changeTheme}
              fetchImpl={authFetch}
              warnings={themeWarnings}
              onCatalogLoaded={(catalog: ThemeCatalog) =>
                setThemeCandidates([...catalog.font, ...catalog.palette, ...catalog.style])
              }
            />
          </div>
          <div role="tablist" className="mb-3 flex gap-1 rounded-xl bg-surface p-1">
            <TabButton active={rightTab === "edit"} onClick={() => setRightTab("edit")}>
              {t("editor.tab.edit")}
            </TabButton>
            <TabButton active={rightTab === "slides"} onClick={() => setRightTab("slides")}>
              {t("editor.tab.slides")}
            </TabButton>
          </div>
          <div className="min-h-0 flex-1">
            {rightTab === "edit" ? (
              <SlideEditPanel
                slide={selectedSlide}
                onTitle={(v) => edit((d) => d.setTitle(selectedSlide.id, v))}
                onMessage={(v) => edit((d) => d.setMessage(selectedSlide.id, v))}
                onNotes={(v) => edit((d) => d.setNotes(selectedSlide.id, v))}
                onOutlineText={(i, v) => edit((d) => d.setOutlineText(selectedSlide.id, i, v))}
                onAddBullet={() => edit((d) => d.addBullet(selectedSlide.id))}
                onRemoveBullet={(i) => edit((d) => d.removeBullet(selectedSlide.id, i))}
                onMoveBullet={(from, to) => edit((d) => d.moveBullet(selectedSlide.id, from, to))}
                {...(chartCard
                  ? {
                      chartEditor: (
                        <ChartEditorCard
                          chartIntentId={chartCard.chartIntentId}
                          title={chartCard.title}
                          selectedVisual={draft.chartVisualOf(chartCard.chartIntentId)}
                          {...(chartCard.renderedChart
                            ? { renderedChart: chartCard.renderedChart }
                            : {})}
                          sharedPages={chartCard.sharedPages}
                          {...(chartCard.disclosure ? { disclosure: chartCard.disclosure } : {})}
                          onSetVisual={(visual) =>
                            edit((d) => d.setChartVisual(chartCard.chartIntentId, visual))
                          }
                          onRemove={() =>
                            edit((d) => d.removeChart(selectedSlide.id, chartCard.chartIntentId))
                          }
                        >
                          {/* US3: data-point editing for base intents (a pending
                              user_data chart edits through its add panel instead). */}
                          {chartCard.baseIntent ? (
                            <ChartDataTable
                              intent={chartCard.baseIntent}
                              pendingEdit={draft.chartDataOf(chartCard.chartIntentId)}
                              onEdit={(points, dataTitle) =>
                                edit((d) =>
                                  d.editChartData(chartCard.chartIntentId, points, dataTitle)
                                )
                              }
                              onResetAll={() =>
                                edit((d) => d.resetChartEdits(chartCard.chartIntentId))
                              }
                            />
                          ) : null}
                        </ChartEditorCard>
                      )
                    }
                  : showAddChart
                    ? {
                        chartEditor: (
                          <AddChartPanel
                            intents={baseIntents}
                            usedPagesByIntent={usedPagesByIntent}
                            onAddExisting={(chartIntentId) =>
                              edit((d) => d.addChartFromIntent(selectedSlide.id, chartIntentId))
                            }
                            onAddUserData={(source) =>
                              edit((d) => d.addChartFromUserData(selectedSlide.id, source))
                            }
                          />
                        )
                      }
                    : showLegacyChartNotice
                      ? { chartEditor: <LegacyChartNotice /> }
                      : {})}
              />
            ) : (
              <SlideNavigator
                slides={draft.slides}
                selectedId={selectedSlide.id}
                onSelect={(slideId) => {
                  setSelectedId(slideId);
                  setRightTab("edit"); // jump to the editor for the picked slide
                }}
                onAddSlide={(afterId) => edit((d) => d.addSlide(afterId ?? undefined))}
                onRemoveSlide={(slideId) => edit((d) => d.removeSlide(slideId))}
                onMoveSlide={(from, to) => edit((d) => d.moveSlide(from, to))}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function hasThemeSelection(selection: ManualThemeSelection): boolean {
  return Boolean(selection.fontId || selection.paletteId || selection.styleId);
}

/**
 * 015 US1: header download entry. Renders a real download link only when the deck is
 * clean (dirty=false) — the file is the adopted revision's server html, named
 * `<sanitized-title>-rev<N>-<timestamp>.html` (FR-001). While dirty it degrades to a
 * disabled hint ("save first", FR-002); with no revision html it renders nothing.
 */
function HtmlDownloadEntry({
  base,
  deckTitle,
  dirty
}: {
  base: DeckRevisionContract;
  deckTitle: string;
  dirty: boolean;
}) {
  const { t } = useI18n();
  const download = useMemo(
    () =>
      base.html && !dirty
        ? buildHtmlDownload(base.html, { deckTitle, revision: base.revision })
        : null,
    [base, deckTitle, dirty]
  );
  if (!base.html) {
    return null;
  }
  if (!download) {
    return (
      <span
        title={t("editor.download.needSave")}
        className="cursor-not-allowed rounded-lg border border-line px-3 py-1 font-medium text-ink-soft opacity-50"
      >
        {t("editor.download.html")}
      </span>
    );
  }
  return (
    <a
      download={download.filename}
      href={download.href}
      className="rounded-lg border border-line px-3 py-1 font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
    >
      {t("editor.download.html")}
    </a>
  );
}

function SaveStatus({ saveState }: { saveState: SaveState }) {
  const { t } = useI18n();
  if (saveState.kind === "saved") {
    return (
      <span className="text-xs text-emerald-600">
        {t("editor.saved", { revision: saveState.revision })}
      </span>
    );
  }
  if (saveState.kind === "conflict") {
    return (
      <span className="max-w-xs text-xs text-amber-600">
        {t("editor.conflict", { revision: saveState.revision })}
      </span>
    );
  }
  if (saveState.kind === "invalid") {
    return <span className="text-xs text-red-600">{t("editor.saveError")}</span>;
  }
  if (saveState.kind === "error") {
    return <span className="text-xs text-red-600">{t("editor.saveError")}</span>;
  }
  return null;
}

function LegacyChartNotice() {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
      <p className="font-semibold">{t("editor.chart.legacy.heading")}</p>
      <p className="mt-1 text-amber-700">{t("editor.chart.legacy.body")}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
        active ? "bg-panel text-ink shadow-sm" : "text-ink-soft hover:text-ink"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function DraftBanner({
  kind,
  onRestore,
  onDiscard
}: {
  kind: Exclude<DraftClassification, "none">;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const { t } = useI18n();
  const isConflict = kind === "conflict";
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm"
    >
      <div className="min-w-0">
        <span className="font-semibold text-amber-800">
          {isConflict ? t("draft.conflictTitle") : t("draft.restoreTitle")}
        </span>{" "}
        <span className="text-amber-700">
          {isConflict ? t("draft.conflictBody") : t("draft.restoreBody")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* A version conflict means the draft is based on an OLDER revision; restoring
            it would re-apply a stale base and re-conflict on save. Per the locked
            semantic (FR-020 / US3 #3) the latest revision is already loaded — offer only
            discard; the user redoes on the latest. Restore is for same-base drafts. */}
        {isConflict ? null : (
          <button
            type="button"
            onClick={onRestore}
            className="rounded-lg bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"
          >
            {t("draft.restore")}
          </button>
        )}
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-lg border border-amber-300 px-3 py-1 font-medium text-amber-800 hover:bg-amber-100"
        >
          {t("draft.discard")}
        </button>
      </div>
    </div>
  );
}

function CenterMessage({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <p className={`text-sm ${tone === "error" ? "text-red-600" : "text-ink-soft"}`}>{children}</p>
    </div>
  );
}
