import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AccountStatusContract, PublicAccount } from "@slides-agent/contracts";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  AdminApiError,
  deleteUser,
  listUsers,
  updateUser,
  type AdminErrorCode,
  type StatusFilter
} from "@/features/admin/admin-users-client";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待審核" },
  { value: "active", label: "已啟用" },
  { value: "disabled", label: "已停用" }
];

const STATUS_LABEL: Record<AccountStatusContract, string> = {
  pending: "待審核",
  active: "已啟用",
  disabled: "已停用"
};

const STATUS_BADGE: Record<AccountStatusContract, string> = {
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  disabled: "bg-zinc-200 text-zinc-700"
};

const ERROR_MESSAGE: Partial<Record<AdminErrorCode, string>> = {
  LAST_ADMIN_PROTECTED: "無法移除最後一位啟用中的管理員。",
  CANNOT_MODIFY_SELF: "無法停用或降權自己的帳號。",
  CANNOT_REJECT_NON_PENDING: "只有待審核的帳號可以刪除。",
  ACCOUNT_NOT_FOUND: "找不到該帳號（可能已被其他人處理）。"
};

export function AdminUsersView() {
  const { authFetch, user } = useAuth();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [users, setUsers] = useState<PublicAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setUsers(await listUsers(filter, authFetch));
    } catch (caught) {
      if (!(caught instanceof Error && caught.name === "AuthError")) {
        setError("載入失敗，請稍後再試。");
      }
    } finally {
      setLoading(false);
    }
  }, [authFetch, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(action: () => Promise<unknown>, id: string): Promise<void> {
    setBusyId(id);
    setError(undefined);
    try {
      await action();
      await refresh();
    } catch (caught) {
      if (caught instanceof AdminApiError) {
        setError(ERROR_MESSAGE[caught.code] ?? "操作失敗，請稍後再試。");
      } else if (!(caught instanceof Error && caught.name === "AuthError")) {
        setError("操作失敗，請稍後再試。");
      }
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">使用者管理</h1>
          <p className="text-sm text-ink-soft">核准、停用、調整管理員權限。</p>
        </div>
        <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
          返回
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="狀態篩選">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={`rounded-lg border px-3 py-1 text-sm font-medium ${
              filter === option.value
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-line bg-panel text-ink hover:bg-surface"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-ink-soft">載入中…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-ink-soft">沒有符合條件的使用者。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">顯示名稱</th>
                <th className="px-3 py-2 font-medium">狀態</th>
                <th className="px-3 py-2 font-medium">管理員</th>
                <th className="px-3 py-2 font-medium">註冊時間</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2 text-ink">{row.username}</td>
                  <td className="px-3 py-2 text-ink">{row.displayName}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{row.isAdmin ? "是" : "—"}</td>
                  <td className="px-3 py-2 text-ink-soft">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <RowActions
                      row={row}
                      isSelf={row.id === user?.id}
                      busy={busyId === row.id}
                      onApprove={() =>
                        act(() => updateUser(row.id, { status: "active" }, authFetch), row.id)
                      }
                      onReject={() => act(() => deleteUser(row.id, authFetch), row.id)}
                      onDisable={() =>
                        act(() => updateUser(row.id, { status: "disabled" }, authFetch), row.id)
                      }
                      onEnable={() =>
                        act(() => updateUser(row.id, { status: "active" }, authFetch), row.id)
                      }
                      onToggleAdmin={() =>
                        act(() => updateUser(row.id, { isAdmin: !row.isAdmin }, authFetch), row.id)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

interface RowActionsProps {
  row: PublicAccount;
  isSelf: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onToggleAdmin: () => void;
}

function RowActions({
  row,
  isSelf,
  busy,
  onApprove,
  onReject,
  onDisable,
  onEnable,
  onToggleAdmin
}: RowActionsProps) {
  const base =
    "rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.status === "pending" ? (
        <>
          <button type="button" className={base} disabled={busy} onClick={onApprove}>
            核准
          </button>
          <button type="button" className={base} disabled={busy} onClick={onReject}>
            拒絕
          </button>
        </>
      ) : null}
      {row.status === "active" && !isSelf ? (
        <>
          <button type="button" className={base} disabled={busy} onClick={onDisable}>
            停用
          </button>
          <button type="button" className={base} disabled={busy} onClick={onToggleAdmin}>
            {row.isAdmin ? "取消管理員" : "設為管理員"}
          </button>
        </>
      ) : null}
      {row.status === "disabled" ? (
        <button type="button" className={base} disabled={busy} onClick={onEnable}>
          重新啟用
        </button>
      ) : null}
      {isSelf ? <span className="self-center text-xs text-ink-soft">（你自己）</span> : null}
    </div>
  );
}
