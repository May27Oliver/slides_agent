import type {
  CreatePptxExportResponseContract,
  PptxExportJobStatusResponseContract
} from "@slides-agent/contracts";

/** 409: another export is already running for this account (single-flight). */
export class PptxExportInProgressError extends Error {
  constructor() {
    super("A PPTX export is already in progress.");
    this.name = "PptxExportInProgressError";
  }
}

/** 400: revision mismatch / page limit / malformed body. */
export class PptxExportRejectedError extends Error {
  constructor() {
    super("PPTX export was rejected.");
    this.name = "PptxExportRejectedError";
  }
}

export class PptxExportRequestError extends Error {
  constructor(status: number) {
    super(`PPTX export request failed (${status})`);
    this.name = "PptxExportRequestError";
  }
}

/**
 * 015 US2 (FR-003): create an export job for ONE exact revision. Mirrors the other
 * web clients' fetch/auth convention (the auth-aware fetchImpl handles 401).
 */
export async function createPptxExport(
  deckId: string,
  revision: number,
  fetchImpl: typeof fetch = fetch
): Promise<CreatePptxExportResponseContract> {
  const response = await fetchImpl(`/api/decks/${encodeURIComponent(deckId)}/pptx-exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision })
  });
  if (response.ok) {
    return (await response.json()) as CreatePptxExportResponseContract;
  }
  if (response.status === 409) {
    throw new PptxExportInProgressError();
  }
  if (response.status === 400) {
    throw new PptxExportRejectedError();
  }
  throw new PptxExportRequestError(response.status);
}

export async function fetchPptxExportStatus(
  statusUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<PptxExportJobStatusResponseContract> {
  const response = await fetchImpl(statusUrl);
  if (!response.ok) {
    throw new PptxExportRequestError(response.status);
  }
  return (await response.json()) as PptxExportJobStatusResponseContract;
}

export function isTerminalPptxExportStatus(
  status: PptxExportJobStatusResponseContract["status"]
): boolean {
  return status === "done" || status === "failed";
}

/**
 * The download endpoint requires the Authorization header, so a plain <a href>
 * cannot fetch it — pull the bytes through the auth-aware fetch and hand the
 * browser an object URL instead.
 */
export async function downloadPptxArtifact(
  downloadUrl: string,
  fetchImpl: typeof fetch = fetch,
  documentRef: Document = document
): Promise<void> {
  const response = await fetchImpl(downloadUrl);
  if (!response.ok) {
    throw new PptxExportRequestError(response.status);
  }
  const blob = await response.blob();
  const filename =
    contentDispositionFilename(response.headers.get("Content-Disposition")) ?? "deck.pptx";
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function contentDispositionFilename(header: string | null): string | undefined {
  const match = header?.match(/filename="([^"]+)"/u);
  return match?.[1];
}
