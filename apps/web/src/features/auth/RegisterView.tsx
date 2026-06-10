import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { validateRegisterRequest } from "@slides-agent/contracts";
import { useAuth } from "@/features/auth/AuthProvider";
import { fetchAuthConfig, RegisterError, registerRequest } from "@/features/auth/register-client";

const PASSWORD_HINT = "密碼至少 10 個字元，並包含至少一個字母與一個數字。";

/** Maps a server/client error into a single zh-TW message for the form. */
function messageForError(error: unknown): string {
  if (error instanceof RegisterError) {
    if (error.code === "INVALID_INPUT" && error.fields.length === 0) {
      // A field-less INVALID_INPUT from the API is the duplicate-email 409.
      return "此 email 已被使用。";
    }
    if (error.code === "REGISTRATION_DISABLED") {
      return "目前未開放註冊，請聯絡管理員。";
    }
    if (error.fields.includes("password")) {
      return PASSWORD_HINT;
    }
    if (error.fields.includes("username")) {
      return "請輸入有效的 email。";
    }
    if (error.fields.includes("displayName")) {
      return "請輸入顯示名稱。";
    }
  }
  return "註冊失敗，請稍後再試。";
}

export function RegisterView() {
  const { status } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

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
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);

    const parsed = validateRegisterRequest({ username, displayName, password });
    if (!parsed.ok) {
      setError(messageForError(new RegisterError("INVALID_INPUT", "", parsed.error.fields)));
      return;
    }

    setSubmitting(true);
    try {
      await registerRequest(parsed.value);
      setDone(true);
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-ink">註冊已送出</h1>
        <p className="text-sm text-ink-soft">
          你的帳號已建立，正在等待管理員審核。審核通過後即可使用此帳號登入。
        </p>
        <Link
          to="/login"
          className="block w-full rounded-lg bg-brand-700 px-3 py-2 text-center text-sm font-bold text-white"
        >
          回登入頁
        </Link>
      </Shell>
    );
  }

  if (!registrationEnabled) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-ink">目前未開放註冊</h1>
        <p className="text-sm text-ink-soft">如需帳號，請聯絡管理員。</p>
        <Link to="/login" className="text-sm font-medium text-brand-700 hover:underline">
          回登入頁
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-ink">建立帳號</h1>
          <p className="text-sm text-ink-soft">註冊後需經管理員審核才能登入。</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">顯示名稱</span>
          <input
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="register-password-hint"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            required
          />
        </label>
        <p id="register-password-hint" className="-mt-2 text-xs text-ink-soft">
          {PASSWORD_HINT}
        </p>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? "送出中…" : "註冊"}
        </button>

        <p className="text-center text-sm text-ink-soft">
          已經有帳號？{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            前往登入
          </Link>
        </p>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-panel p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
