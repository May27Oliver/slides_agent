// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import type { DeckSummaryContract } from "@slides-agent/contracts";
import { MyDecksView } from "@/features/decks/MyDecksView";

const { authValue } = vi.hoisted(() => ({
  authValue: {
    authFetch: () => Promise.resolve(new Response()),
    logout: () => undefined,
    user: { displayName: "U" }
  }
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => authValue }));

const listDecks = vi.fn();
vi.mock("@/features/decks/decks-client", () => ({
  listDecks: (...args: unknown[]) => listDecks(...args),
  getDeck: vi.fn()
}));

afterEach(() => {
  cleanup();
  listDecks.mockReset();
});

const decks: DeckSummaryContract[] = [
  { id: "d1", title: "Quarterly Review", status: "ready", updatedAt: "2026-06-10T00:00:00.000Z" },
  { id: "d2", title: "Onboarding Deck", status: "ready", updatedAt: "2026-06-09T00:00:00.000Z" }
];

function EditTarget() {
  const { id } = useParams();
  return <div>EDIT {id}</div>;
}

function setup() {
  return render(
    <MemoryRouter initialEntries={["/decks"]}>
      <Routes>
        <Route path="/decks" element={<MyDecksView />} />
        <Route path="/decks/:id/edit" element={<EditTarget />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MyDecksView all-history upgrade (010 US2)", () => {
  it("filters the list by title and routes to the editor via the edit action", async () => {
    listDecks.mockResolvedValue({ decks });
    setup();

    expect(await screen.findByText("Quarterly Review")).toBeTruthy();
    expect(screen.getByText("Onboarding Deck")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("搜尋標題…"), { target: { value: "onboarding" } });
    expect(screen.queryByText("Quarterly Review")).toBeNull();

    fireEvent.click(screen.getAllByText("編輯")[0]!);
    expect(await screen.findByText("EDIT d2")).toBeTruthy();
  });
});
