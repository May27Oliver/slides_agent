import type {
  CreatePreviewJobResponse,
  PreviewJobStatusResponse,
  SlideGenerationRequest
} from "@/features/slide-generation/slide-generation.types";

export async function createPreviewJob(
  request: SlideGenerationRequest,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<CreatePreviewJobResponse> {
  const response = await fetchImpl("/api/slides/preview-jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request),
    ...(signal ? { signal } : {})
  });

  if (!response.ok) {
    throw new Error("Preview job creation failed");
  }

  return (await response.json()) as CreatePreviewJobResponse;
}

export async function fetchPreviewJobStatus(
  statusUrl: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<PreviewJobStatusResponse> {
  const response = await fetchImpl(statusUrl, signal ? { signal } : {});

  if (!response.ok) {
    throw new Error("Preview job is unavailable");
  }

  return (await response.json()) as PreviewJobStatusResponse;
}

export function isTerminalPreviewJobStatus(status: PreviewJobStatusResponse["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "expired";
}
