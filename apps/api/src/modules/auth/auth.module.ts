import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { loadAuthConfig } from "@/config/auth.config";
import { DbModule } from "@/infra/db/db.module";
import { AUTH_CONFIG, USER_ACCOUNT_STORE } from "@/modules/auth/auth.tokens";
import { AuthController } from "@/modules/auth/auth.controller";
import { AuthService } from "@/modules/auth/auth.service";
import { DbUserAccountStore } from "@/modules/auth/db-user-account-store";
import { LocalStrategy } from "@/modules/auth/local.strategy";
import { JwtStrategy } from "@/modules/auth/jwt.strategy";
import { LoginRateLimitGuard } from "@/modules/auth/login-rate-limit.guard";

/**
 * Login + protection. Provides the account allowlist store, both Passport
 * strategies (local for login, jwt for protection), and the JWT signer. Importing
 * this module registers the "jwt" strategy so JwtAuthGuard works on any
 * controller in the same app process.
 *
 * (loadAuthConfig() is called directly in the JwtModule factory rather than
 * injecting AUTH_CONFIG, to avoid the registerAsync injector-scope gotcha; the
 * call is pure and fails fast identically.)
 */
@Module({
  imports: [
    DbModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const config = loadAuthConfig();
        return {
          secret: config.jwtSecret,
          // Pin algorithm + issuer at sign time to match what JwtStrategy verifies.
          signOptions: {
            algorithm: "HS256",
            expiresIn: config.jwtExpiresIn,
            issuer: config.jwtIssuer
          }
        };
      }
    })
  ],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => loadAuthConfig() },
    { provide: USER_ACCOUNT_STORE, useClass: DbUserAccountStore },
    AuthService,
    LocalStrategy,
    JwtStrategy,
    LoginRateLimitGuard
  ],
  exports: [AuthService]
})
export class AuthModule {}
