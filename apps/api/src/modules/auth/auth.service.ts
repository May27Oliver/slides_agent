import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedUser, UserAccountStore } from "@slides-agent/domain";
import { evaluateLogin, evaluateSession } from "@slides-agent/domain";
import type { LoginResponseContract } from "@slides-agent/contracts";
import { hashPassword, verifyPassword } from "@/common/scrypt-password";
import { USER_ACCOUNT_STORE } from "@/modules/auth/auth.tokens";

interface SessionClaims {
  sub: string;
  username: string;
  displayName: string;
}

// Precomputed once so an unknown username still incurs the full scrypt cost.
// Keeps login timing constant whether or not the account exists, closing the
// timing side-channel that would otherwise leak which usernames are valid.
const DUMMY_PASSWORD_HASH = hashPassword("__no_such_account__");

/**
 * Auth application service: credential validation (delegates the decision to the
 * pure domain policy, does the scrypt check here), JWT issuance, and session
 * (token subject) validation. Returns `null` on failure so the strategy/guard
 * layer can map it to a sanitized 401 — no internal classification leaks out.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_ACCOUNT_STORE) private readonly accounts: UserAccountStore,
    @Inject(JwtService) private readonly jwt: JwtService
  ) {}

  async validateCredentials(username: string, password: string): Promise<AuthenticatedUser | null> {
    const account = await this.accounts.findByUsername(username);
    // Always run scrypt (against a dummy hash for unknown users) for constant timing.
    const passwordMatches = verifyPassword(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
    const result = evaluateLogin(account, passwordMatches);
    return result.ok ? result.user : null;
  }

  async validateSessionUser(userId: string): Promise<AuthenticatedUser | null> {
    const account = await this.accounts.findById(userId);
    const result = evaluateSession(account);
    return result.ok ? result.user : null;
  }

  async issueSession(user: AuthenticatedUser): Promise<LoginResponseContract> {
    const claims: SessionClaims = {
      sub: user.id,
      username: user.username,
      displayName: user.displayName
    };
    const token = await this.jwt.signAsync(claims);
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    if (typeof decoded?.exp !== "number") {
      throw new Error("Signed JWT is missing an expiry claim.");
    }
    return { token, expiresAt: new Date(decoded.exp * 1000).toISOString(), user };
  }
}
