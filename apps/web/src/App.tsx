import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { LoginView } from "@/features/auth/LoginView";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { SlideGenerationFeature } from "@/features/slide-generation";

// Injects the auth-aware fetch so protected generation calls carry the bearer
// token and a 401 clears the session, plus a thin top bar with logout.
function GenerationRoute() {
  const { authFetch, logout, user } = useAuth();
  return (
    <>
      <div className="flex items-center justify-end gap-3 border-b border-line bg-panel px-5 py-2 text-sm">
        {user ? <span className="text-ink-soft">{user.displayName}</span> : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-line px-3 py-1 font-medium text-ink hover:bg-canvas"
        >
          登出
        </button>
      </div>
      <SlideGenerationFeature fetchImpl={authFetch} />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<GenerationRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
