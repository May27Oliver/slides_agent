import { Module } from "@nestjs/common";
import { AuthModule } from "@/modules/auth/auth.module";
import { AdminGuard } from "@/modules/admin/admin.guard";
import { AdminUsersController } from "@/modules/admin/admin-users.controller";

/**
 * Admin user-management module (US2). Imports AuthModule for the registered "jwt"
 * strategy (JwtAuthGuard) and the exported ACCOUNT_ADMIN_STORE provider. Kept
 * separate from AuthModule so the admin authorization boundary is explicit.
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminGuard]
})
export class AdminModule {}
