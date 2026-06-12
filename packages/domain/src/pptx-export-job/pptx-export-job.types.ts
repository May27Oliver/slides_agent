/**
 * 015 US2 (FR-020): the PPTX export job — an async, account-scoped export of ONE
 * specific deck revision into a screenshot-per-slide .pptx. Mirrors the preview-job
 * model (003/004) with a simpler four-state machine; timeouts land in `failed` with
 * `failure.reason = "timeout"`.
 */
export type PptxExportJobStatus = "queued" | "processing" | "done" | "failed";

export interface PptxExportJobRequest {
  /** Owner account — the scope key for status reads and artifact downloads (FR-017). */
  accountId: string;
  deckId: string;
  /** The EXACT revision to export (FR-003a) — never "latest". */
  revision: number;
  /** Slide count, validated ≤ PPTX_MAX_PAGES at creation (FR-019). */
  pageCount: number;
}

export interface PptxExportResult {
  /** Opaque artifact reference (e.g. a file key); resolved by the artifact store. */
  artifactRef: string;
  byteSize: number;
  pageCount: number;
}

export interface PptxExportFailure {
  reason: "timeout" | "export";
  message: string;
}

export interface PptxExportJob extends PptxExportJobRequest {
  id: string;
  status: PptxExportJobStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Job + artifact TTL (FR-018): past this, status reads 404 and the file is purged. */
  expiresAt: Date;
  result?: PptxExportResult;
  failure?: PptxExportFailure;
}

export function isTerminalPptxStatus(status: PptxExportJobStatus): boolean {
  return status === "done" || status === "failed";
}
