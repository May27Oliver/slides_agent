import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { LoginView } from "@/features/auth/LoginView";
import { RegisterView } from "@/features/auth/RegisterView";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AdminRoute } from "@/features/admin/AdminRoute";
import { AdminUsersView } from "@/features/admin/AdminUsersView";
import { DeckEditorView } from "@/features/deck-editor/DeckEditorView";
import { DeckSwitcher } from "@/features/deck-switcher/DeckSwitcher";
import { MyDecksView } from "@/features/decks/MyDecksView";
import { SlideGenerationFeature } from "@/features/slide-generation";
import { useI18n } from "@/i18n";

// Injects the auth-aware fetch so protected generation calls carry the bearer
// token and a 401 clears the session, plus a thin top bar with the "my decks"
// link and logout.
function GenerationRoute() {
  const { authFetch, logout, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-2 text-sm">
        <div className="flex items-center gap-3">
          <Link to="/decks" className="font-medium text-brand-700 hover:underline">
            {t("decks.nav")}
          </Link>
          <DeckSwitcher fetchImpl={authFetch} />
        </div>
        <div className="flex items-center gap-3">
          {user?.isAdmin ? (
            <Link to="/admin/users" className="font-medium text-brand-700 hover:underline">
              使用者管理
            </Link>
          ) : null}
          {user ? <span className="text-ink-soft">{user.displayName}</span> : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-line px-3 py-1 font-medium text-ink hover:bg-surface"
          >
            {t("decks.logout")}
          </button>
        </div>
      </div>
      <SlideGenerationFeature
        fetchImpl={authFetch}
        onGenerated={(deckId) => navigate(`/decks/${deckId}/edit`)}
      />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route path="/register" element={<RegisterView />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<GenerationRoute />} />
        <Route path="/decks" element={<MyDecksView />} />
        <Route path="/decks/:id/edit" element={<DeckEditorView />} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/admin/users" element={<AdminUsersView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
