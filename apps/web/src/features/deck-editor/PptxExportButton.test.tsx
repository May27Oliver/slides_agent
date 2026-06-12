// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PptxExportButton } from "@/features/deck-editor/PptxExportButton";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

/** 015 US2 (FR-002/FR-003/FR-020): create → poll → done|failed, dirty gate. */
describe("PptxExportButton", () => {
  it("is disabled with a save-first hint while dirty", () => {
    render(<PptxExportButton deckId="d1" revision={3} dirty fetchImpl={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "下載 PPTX" })).toBeNull();
    expect(screen.getByTitle("請先儲存，下載對應已存版本")).toBeTruthy();
  });

  it("creates a job for the adopted revision and shows queued progress", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect(String(url)).toBe("/api/decks/d1/pptx-exports");
        expect(JSON.parse(String(init.body))).toEqual({ revision: 3 });
        return jsonResponse(
          { jobId: "j1", status: "queued", statusUrl: "/api/decks/d1/pptx-exports/j1" },
          { status: 202 }
        );
      }
      return jsonResponse({
        jobId: "j1",
        status: "queued",
        createdAt: "x",
        updatedAt: "x"
      });
    }) as unknown as typeof fetch;

    render(
      <PptxExportButton deckId="d1" revision={3} dirty={false} fetchImpl={fetchImpl} pollIntervalMs={5} />
    );
    fireEvent.click(screen.getByRole("button", { name: "下載 PPTX" }));

    expect(await screen.findByText("PPTX 排隊中…")).toBeTruthy();
  });

  it("shows the failed state with a retry entry when the job fails", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse(
          { jobId: "j1", status: "queued", statusUrl: "/api/decks/d1/pptx-exports/j1" },
          { status: 202 }
        );
      }
      return jsonResponse({
        jobId: "j1",
        status: "failed",
        failure: { reason: "timeout", message: "too slow" },
        createdAt: "x",
        updatedAt: "x"
      });
    }) as unknown as typeof fetch;

    render(
      <PptxExportButton deckId="d1" revision={3} dirty={false} fetchImpl={fetchImpl} pollIntervalMs={5} />
    );
    fireEvent.click(screen.getByRole("button", { name: "下載 PPTX" }));

    expect(await screen.findByText("PPTX 轉檔失敗")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重試" })).toBeTruthy();
  });

  it("fails fast when creation is rejected (e.g. 409 single-flight)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ code: "PPTX_EXPORT_IN_PROGRESS" }, { status: 409 })
    ) as unknown as typeof fetch;

    render(<PptxExportButton deckId="d1" revision={3} dirty={false} fetchImpl={fetchImpl} />);
    fireEvent.click(screen.getByRole("button", { name: "下載 PPTX" }));

    expect(await screen.findByText("PPTX 轉檔失敗")).toBeTruthy();
  });

  it("downloads through the authenticated fetch when the job completes", async () => {
    let downloaded = false;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse(
          { jobId: "j1", status: "queued", statusUrl: "/api/decks/d1/pptx-exports/j1" },
          { status: 202 }
        );
      }
      if (String(url).endsWith("/file")) {
        downloaded = true;
        return new Response(new Blob(["pptx"]), {
          headers: { "Content-Disposition": 'attachment; filename="deck-rev3.pptx"' }
        });
      }
      return jsonResponse({
        jobId: "j1",
        status: "done",
        downloadUrl: "/api/decks/d1/pptx-exports/j1/file",
        createdAt: "x",
        updatedAt: "x"
      });
    }) as unknown as typeof fetch;

    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));

    render(
      <PptxExportButton deckId="d1" revision={3} dirty={false} fetchImpl={fetchImpl} pollIntervalMs={5} />
    );
    fireEvent.click(screen.getByRole("button", { name: "下載 PPTX" }));

    expect(await screen.findByText("PPTX 已完成")).toBeTruthy();
    expect(downloaded).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();
    await act(async () => {}); // flush the revoke
  });
});
