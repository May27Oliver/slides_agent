import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * Only follow the stored post-login destination if it is a same-origin relative
 * path. Rejects protocol-relative ("//evil.com") and absolute URLs so a tampered
 * router state can't turn login into an open redirect.
 */
function safeRedirectPath(from: string | undefined): string {
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
    return from;
  }
  return "/";
}

export function LoginView() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeRedirectPath((location.state as { from?: string } | null)?.from);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch {
      // Sanitized: never reveal whether the account exists (FR-005).
      setError("登入失敗，請確認帳號與密碼");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-panel p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold text-ink">登入</h1>
        <p className="text-sm text-ink-soft">請使用站方提供的帳號登入以使用簡報生成工具。</p>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">帳號</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">密碼</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            required
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? "登入中…" : "登入"}
        </button>
      </form>
    </main>
  );
}
