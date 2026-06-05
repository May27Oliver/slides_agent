import type { UserAccount } from "@/auth/auth.types";

/** Capability boundary for looking up allowlisted accounts. */
export interface UserAccountStore {
  findByUsername(username: string): Promise<UserAccount | undefined>;
  findById(id: string): Promise<UserAccount | undefined>;
}
