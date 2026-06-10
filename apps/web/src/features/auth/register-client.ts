import type {
  AuthConfigContract,
  RegisterRequestContract,
  RegisterResponseContract
} from "@slides-agent/contracts";

/** A registration failure carrying the server's public error code (US3-ready). */
export class RegisterError extends Error {
  readonly code: string;
  readonly fields: string[];

  constructor(code: string, message = "Registration failed", fields: string[] = []) {
    super(message);
    this.name = "RegisterError";
    this.code = code;
    this.fields = fields;
  }
}

interface ServerErrorBody {
  code?: string;
  message?: string;
  fields?: string[];
}

/**
 * Posts a registration. On a non-2xx response, parses the sanitized error body
 * into a {@link RegisterError} with its `code` (`INVALID_INPUT` 400,
 * `USERNAME_TAKEN` 409, `REGISTRATION_DISABLED` 403 — see RegisterErrorCode) so
 * the view can show the right message.
 */
export async function registerRequest(
  body: RegisterRequestContract,
  fetchImpl: typeof fetch = fetch
): Promise<RegisterResponseContract> {
  const response = await fetchImpl("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const parsed = await safeJson(response);
    throw new RegisterError(
      parsed.code ?? "REGISTER_FAILED",
      parsed.message ?? "Registration failed",
      parsed.fields ?? []
    );
  }
  return (await response.json()) as RegisterResponseContract;
}

/** Public registration availability (DR-010). Defaults to enabled if unreachable. */
export async function fetchAuthConfig(
  fetchImpl: typeof fetch = fetch
): Promise<AuthConfigContract> {
  try {
    const response = await fetchImpl("/api/auth/config");
    if (!response.ok) {
      return { registrationEnabled: true };
    }
    return (await response.json()) as AuthConfigContract;
  } catch {
    return { registrationEnabled: true };
  }
}

async function safeJson(response: Response): Promise<ServerErrorBody> {
  try {
    return (await response.json()) as ServerErrorBody;
  } catch {
    return {};
  }
}
