/** An owner-approved identity allowed to use the service. */
export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  /** Password verifier (e.g. scrypt). Never returned to the frontend. */
  passwordHash: string;
  active: boolean;
}

/** Public-safe subset of a user, returned to the frontend / put in the JWT. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
}

/** Internal failure classification. Public responses collapse these to a generic message. */
export type AuthFailureCode =
  | "invalid_credentials"
  | "inactive_account"
  | "expired_session"
  | "invalid_token"
  | "missing_token"
  | "unavailable";
