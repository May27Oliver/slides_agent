import type {
  AccountStatusContract,
  AdminMutationErrorCode,
  AdminUpdateUserRequest,
  AdminUserListResponse,
  PublicAccount
} from "@slides-agent/contracts";

/** The codes the admin API can return, plus a transport fallback. */
export type AdminErrorCode = AdminMutationErrorCode | "REQUEST_FAILED";

/** An admin API failure carrying the server's public error code (FR-018 etc.). */
export class AdminApiError extends Error {
  readonly code: AdminErrorCode;

  constructor(code: AdminErrorCode, message = "Request failed") {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
  }
}

export type StatusFilter = AccountStatusContract | "all";

/** Lists users, optionally filtered by status (DR-005). */
export async function listUsers(
  status: StatusFilter,
  authFetch: typeof fetch
): Promise<PublicAccount[]> {
  const query = status === "all" ? "" : `?status=${status}`;
  const response = await authFetch(`/api/admin/users${query}`);
  if (!response.ok) {
    throw await toError(response);
  }
  const body = (await response.json()) as AdminUserListResponse;
  return body.users;
}

/** Updates a user's status and/or admin flag (idempotent). */
export async function updateUser(
  id: string,
  patch: AdminUpdateUserRequest,
  authFetch: typeof fetch
): Promise<PublicAccount> {
  const response = await authFetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!response.ok) {
    throw await toError(response);
  }
  return (await response.json()) as PublicAccount;
}

/** Rejects (deletes) a pending registration. */
export async function deleteUser(id: string, authFetch: typeof fetch): Promise<void> {
  const response = await authFetch(`/api/admin/users/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await toError(response);
  }
}

async function toError(response: Response): Promise<AdminApiError> {
  try {
    const body = (await response.json()) as { code?: AdminErrorCode; message?: string };
    return new AdminApiError(body.code ?? "REQUEST_FAILED", body.message ?? "Request failed");
  } catch {
    return new AdminApiError("REQUEST_FAILED");
  }
}
