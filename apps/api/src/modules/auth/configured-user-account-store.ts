import { Inject, Injectable } from "@nestjs/common";
import type { UserAccount, UserAccountStore } from "@slides-agent/domain";
import type { AuthConfig } from "@/config/auth.config";
import { AUTH_CONFIG } from "@/modules/auth/auth.tokens";

/**
 * Reads the allowlisted accounts from runtime config (AUTH_ACCOUNTS) into
 * lookup maps. Username lookup is case-normalized.
 */
@Injectable()
export class ConfiguredUserAccountStore implements UserAccountStore {
  private readonly byUsername: Map<string, UserAccount>;
  private readonly byId: Map<string, UserAccount>;

  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    this.byUsername = new Map(config.accounts.map((account) => [normalize(account.username), account]));
    this.byId = new Map(config.accounts.map((account) => [account.id, account]));
  }

  async findByUsername(username: string): Promise<UserAccount | undefined> {
    return this.byUsername.get(normalize(username));
  }

  async findById(id: string): Promise<UserAccount | undefined> {
    return this.byId.get(id);
  }
}

function normalize(username: string): string {
  return username.trim().toLowerCase();
}
