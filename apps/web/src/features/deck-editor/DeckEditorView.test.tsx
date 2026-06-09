// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DeckRevisionContract } from "@slides-agent/contracts";
import { DeckEditorView } from "@/features/deck-editor/DeckEditorView";
import { EditConflictError } from "@/features/deck-editor/deck-editor-client";
import { loadDraft, saveDraft } from "@/features/deck-editor/deck-draft-storage";
import { fixtureRevision, fixtureSlideDeck } from "@/features/deck-editor/test-fixtures";

// Stable identities (like the real AuthProvider's useMemo) so the editor's load
// effect doesn't re-fire on every render.
const { authValue } = vi.hoisted(() => {
  const fetchImpl = () => Promise.resolve(new Response());
  return {
    authValue: { authFetch: fetchImpl, logout: () => undefined, user: { displayName: "U" } }
  };
});
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => authValue }));

const getDeck = vi.fn();
vi.mock("@/features/decks/decks-client", () => ({
  getDeck: (...args: unknown[]) => getDeck(...args),
  // AuthError is re-exported from auth-client in the real module; DeckEditorView
  // imports AuthError from auth-client directly, so we don't need it here.
  listDecks: vi.fn()
}));

const createEditRevision = vi.fn();
vi.mock("@/features/deck-editor/deck-editor-client", async (importActual) => {
  const actual = await importActual<typeof import("@/features/deck-editor/deck-editor-client")>();
  return { ...actual, createEditRevision: (...args: unknown[]) => createEditRevision(...args) };
});

afterEach(() => {
  cleanup();
  getDeck.mockReset();
  createEditRevision.mockReset();
  localStorage.clear();
});

function renderEditor(autosaveIntervalMs?: number) {
  return render(
    <MemoryRouter initialEntries={["/decks/deck-1/edit"]}>
      <Routes>
        <Route
          path="/decks/:id/edit"
          element={<DeckEditorView {...(autosaveIntervalMs ? { autosaveIntervalMs } : {})} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

const detail = {
  id: "deck-1",
  title: "PM planning review",
  status: "ready",
  sourceContent: "s",
  deckBrief: { purpose: "p", audience: "a" },
  currentRevision: fixtureRevision
};

describe("DeckEditorView (010 US1)", () => {
  it("loads the deck, edits a field, and saves a new revision", async () => {
    getDeck.mockResolvedValue(detail);
    const saved: DeckRevisionContract = {
      ...fixtureRevision,
      revision: 2,
      slideDeck: fixtureSlideDeck,
      html: "<saved/>"
    };
    createEditRevision.mockResolvedValue(saved);

    renderEditor();

    // Loaded: the first slide's title is in the edit form.
    const titleInput = await screen.findByDisplayValue(/目標: conversion/);
    fireEvent.change(titleInput, { target: { value: "Edited title" } });
    expect(screen.getByText("有未儲存的變更")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => expect(createEditRevision).toHaveBeenCalled());
    const [, body] = createEditRevision.mock.calls[0]!;
    expect(body.baseRevision).toBe(1);
    expect(body.slideDeck.slides[0].title).toBe("Edited title");
    expect(await screen.findByText("已儲存版本 2")).toBeTruthy();
  });

  it("on a 409 conflict reloads and shows the latest revision", async () => {
    getDeck.mockResolvedValue(detail);
    createEditRevision.mockRejectedValue(new EditConflictError(7));

    renderEditor();
    await screen.findByDisplayValue(/目標: conversion/);

    getDeck.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    // Conflict message names the latest revision and a reload is triggered.
    expect(await screen.findByText(/版本 7/)).toBeTruthy();
    await waitFor(() => expect(getDeck).toHaveBeenCalled());
  });

  it("shows the not-ready message when the deck has no current revision", async () => {
    getDeck.mockResolvedValue({ ...detail, currentRevision: null });
    renderEditor();
    expect(await screen.findByText("此簡報沒有可編輯的版本。")).toBeTruthy();
  });

  it("offers to restore a newer same-base draft and applies it (US3)", async () => {
    getDeck.mockResolvedValue(detail);
    // A draft saved against the current base (1), newer than the revision's createdAt.
    saveDraft({
      deckId: "deck-1",
      baseRevision: 1,
      slideDeck: {
        ...fixtureSlideDeck,
        slides: fixtureSlideDeck.slides.map((s) => ({ ...s, title: "Draft restored title" }))
      },
      savedAt: "2026-06-06T00:00:00.000Z"
    });

    renderEditor();
    fireEvent.click(await screen.findByText("還原"));
    expect(await screen.findByDisplayValue("Draft restored title")).toBeTruthy();
    expect(screen.getByText("有未儲存的變更")).toBeTruthy();
  });

  it("a version-conflict draft offers discard only, never restore (US3 #3)", async () => {
    getDeck.mockResolvedValue(detail); // currentRevision.revision === 1
    saveDraft({
      deckId: "deck-1",
      baseRevision: 0, // based on an OLDER revision than current → conflict
      slideDeck: fixtureSlideDeck,
      savedAt: "2026-06-06T00:00:00.000Z"
    });

    renderEditor();
    expect(await screen.findByText("草稿基於較舊版本")).toBeTruthy();
    expect(screen.getByText("捨棄")).toBeTruthy();
    expect(screen.queryByText("還原")).toBeNull(); // stale-base restore is not offered
  });

  it("clears the draft after a successful save (US3)", async () => {
    getDeck.mockResolvedValue(detail);
    createEditRevision.mockResolvedValue({ ...fixtureRevision, revision: 2, html: "<saved/>" });
    saveDraft({
      deckId: "deck-1",
      baseRevision: 1,
      slideDeck: fixtureSlideDeck,
      savedAt: "2026-06-06T00:00:00.000Z"
    });

    renderEditor();
    const titleInput = await screen.findByDisplayValue(/目標: conversion/);
    fireEvent.change(titleInput, { target: { value: "Edited" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => expect(loadDraft("deck-1")).toBeNull());
  });

  it("autosaves the working draft to localStorage on the interval (US3)", async () => {
    getDeck.mockResolvedValue(detail);
    renderEditor(20);
    const titleInput = await screen.findByDisplayValue(/目標: conversion/);
    fireEvent.change(titleInput, { target: { value: "Autosaved title" } });

    await waitFor(() => {
      const saved = loadDraft("deck-1");
      expect(saved).not.toBeNull();
      expect((saved!.slideDeck.slides[0] as { title: string }).title).toBe("Autosaved title");
    });
  });
});
