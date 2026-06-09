import type { ThemeCatalog } from "@slides-agent/domain";

/**
 * 011: fetch the builtin theme catalogue (GET /api/themes). Mirrors the other web
 * clients' auth-aware `fetchImpl` convention (a 401 is handled upstream). The
 * catalogue is shared builtin data, so it can be fetched once and reused across the
 * generation form and the editor.
 */
export async function fetchThemeCatalog(fetchImpl: typeof fetch = fetch): Promise<ThemeCatalog> {
  const response = await fetchImpl("/api/themes");
  if (!response.ok) {
    throw new Error(`Theme catalogue unavailable (${response.status})`);
  }
  return (await response.json()) as ThemeCatalog;
}
