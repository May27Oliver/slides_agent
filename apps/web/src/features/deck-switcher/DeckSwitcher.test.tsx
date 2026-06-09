// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import type { DeckSummaryContract } from "@slides-agent/contracts";
import { DeckSwitcher } from "@/features/deck-switcher/DeckSwitcher";

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
  { id: "d-new", title: "Newest deck", status: "ready", updatedAt: "2026-06-10T00:00:00.000Z" },
  { id: "d-old", title: "Quarterly Review", status: "ready", updatedAt: "2026-06-01T00:00:00.000Z" }
];

function EditTarget() {
  const { id } = useParams();
  return <div>EDIT {id}</div>;
}

function setup(confirmNavigate?: () => boolean) {
  const fetchImpl = (() => Promise.resolve(new Response())) as unknown as typeof fetch;
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <DeckSwitcher fetchImpl={fetchImpl} {...(confirmNavigate ? { confirmNavigate } : {})} />
          }
        />
        <Route path="/decks/:id/edit" element={<EditTarget />} />
        <Route path="/decks" element={<div>ALL DECKS</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DeckSwitcher (010 US2)", () => {
  it("opens, loads recent decks, and routes to a deck's editor on select", async () => {
    listDecks.mockResolvedValue({ decks });
    setup();

    fireEvent.click(screen.getByRole("button", { name: /切換簡報/ }));
    expect(await screen.findByText("Newest deck")).toBeTruthy();

    fireEvent.click(screen.getByText("Newest deck"));
    expect(await screen.findByText("EDIT d-new")).toBeTruthy();
  });

  it("filters by title across the full set", async () => {
    listDecks.mockResolvedValue({ decks });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /切換簡報/ }));
    await screen.findByText("Newest deck");

    fireEvent.change(screen.getByLabelText("搜尋標題…"), { target: { value: "quarterly" } });
    await waitFor(() => expect(screen.queryByText("Newest deck")).toBeNull());
    expect(screen.getByText("Quarterly Review")).toBeTruthy();
  });

  it("routes to /decks via 'browse all'", async () => {
    listDecks.mockResolvedValue({ decks });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /切換簡報/ }));
    await screen.findByText("Newest deck");
    fireEvent.click(screen.getByText(/瀏覽全部歷史/));
    expect(await screen.findByText("ALL DECKS")).toBeTruthy();
  });

  it("cancels navigation when confirmNavigate returns false (unsaved guard)", async () => {
    listDecks.mockResolvedValue({ decks });
    setup(() => false);
    fireEvent.click(screen.getByRole("button", { name: /切換簡報/ }));
    await screen.findByText("Newest deck");
    fireEvent.click(screen.getByText("Newest deck"));
    // Navigation blocked → still on the switcher, no EDIT target.
    expect(screen.queryByText("EDIT d-new")).toBeNull();
  });
});
