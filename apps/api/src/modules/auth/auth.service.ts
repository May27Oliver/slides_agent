import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedUser, AuthEvaluation, UserAccountStore } from "@slides-agent/domain";
import { evaluateLogin, evaluateSession } from "@slides-agent/domain";
import type { LoginResponseContract } from "@slides-agent/contracts";
import { hashPassword, verifyPassword } from "@/common/scrypt-password";
import { USER_ACCOUNT_STORE } from "@/modules/auth/auth.tokens";

interface SessionClaims {
  sub: string;
  username: string;
  displayName: string;
  // UI hint only; never used for authorization (the JWT strategy re-reads the DB).
  isAdmin: boolean;
}

/**
 * Auth application service: credential validation (delegates the decision to the
 * pure domain policy, does the scrypt check here), JWT issuance, and session
 * (token subject) validation.
 *
 * `validateCredentials` returns the full {@link AuthEvaluation} (with its failure
 * `code`) so the strategy/guard layer can distinguish a generic 401 (no
 * enumeration) from a 403 for a pending/disabled owner (DR-002). Session
 * validation stays `user | null` — any non-active session collapses to 401.
 */
@Injectable()
export class AuthService {
  // Computed once (lazily, then cached) so an unknown username still incurs the
  // full scrypt cost — keeps login timing constant whether or not the account
  // exists, closing the side-channel that would otherwise leak valid usernames.
  private dummyPasswordHash?: Promise<string>;

  constructor(
    @Inject(USER_ACCOUNT_STORE) private readonly accounts: UserAccountStore,
    @Inject(JwtService) private readonly jwt: JwtService
  ) {}

  async validateCredentials(username: string, password: string): Promise<AuthEvaluation> {
    const account = await this.accounts.findByUsername(username);
    // Always run scrypt (against a dummy hash for unknown users) for constant timing.
    const stored = account?.passwordHash ?? (await this.dummyHash());
    const passwordMatches = await verifyPassword(password, stored);
    return evaluateLogin(account, passwordMatches);
  }

  private dummyHash(): Promise<string> {
    return (this.dummyPasswordHash ??= hashPassword("__no_such_account__"));
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
      displayName: user.displayName,
      isAdmin: user.isAdmin
    };
    const token = await this.jwt.signAsync(claims);
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    if (typeof decoded?.exp !== "number") {
      throw new Error("Signed JWT is missing an expiry claim.");
    }
    return { token, expiresAt: new Date(decoded.exp * 1000).toISOString(), user };
  }
}
