import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * Gate for admin-only routes (US2). Unauthenticated → /login (preserving the
 * intended path); authenticated non-admins → home. Authorization is still
 * enforced server-side by AdminGuard; this only controls client navigation.
 */
export function AdminRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return null;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
