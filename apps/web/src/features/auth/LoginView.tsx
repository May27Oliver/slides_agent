import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthError } from "@/features/auth/auth-client";
import { fetchAuthConfig } from "@/features/auth/register-client";

/** Maps a login failure to a zh-TW message. Only pending/disabled (reached with the
 * correct password) get specific text; everything else stays generic (FR-005). */
function loginErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code === "ACCOUNT_PENDING") {
      return "帳號尚待管理員核准，核准後即可登入。";
    }
    if (error.code === "ACCOUNT_DISABLED") {
      return "此帳號已被停用，請聯絡管理員。";
    }
  }
  return "登入失敗，請確認帳號與密碼";
}

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
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchAuthConfig().then((config) => {
      if (active) {
        setRegistrationEnabled(config.registrationEnabled);
      }
    });
    return () => {
      active = false;
    };
  }, []);

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
    } catch (caught) {
      // Generic by default (no enumeration); pending/disabled get specific text.
      setError(loginErrorMessage(caught));
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

        {registrationEnabled ? (
          <p className="text-center text-sm text-ink-soft">
            還沒有帳號？{" "}
            <Link to="/register" className="font-medium text-brand-700 hover:underline">
              註冊
            </Link>
          </p>
        ) : null}
      </form>
    </main>
  );
}
