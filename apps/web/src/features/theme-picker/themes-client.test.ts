import { describe, expect, it, vi } from "vitest";
import { fetchThemeCatalog } from "@/features/theme-picker/themes-client";

describe("fetchThemeCatalog", () => {
  it("GETs /api/themes and returns the catalogue", async () => {
    const catalog = { font: [], palette: [], style: [] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => catalog });

    const result = await fetchThemeCatalog(fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith("/api/themes");
    expect(result).toEqual(catalog);
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchThemeCatalog(fetchImpl as unknown as typeof fetch)).rejects.toThrow();
  });
});
