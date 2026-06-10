# Quickstart：使用者自助註冊 + 管理員審核 dashboard（013）

部署與驗證手冊。對應 spec / plan / tasks。

## 1. 設定（env）

新增/相關環境變數（見 `.env.example`）：

| 變數 | 預設 | 說明 |
|------|------|------|
| `REGISTRATION_ENABLED` | `true` | `false`/`0`/`no` 關閉自助註冊（`POST /api/auth/register` 回 403 `REGISTRATION_DISABLED`，登入頁隱藏「註冊」連結）。 |
| `AUTH_REGISTER_RATE_LIMIT_MAX` | `5` | 註冊端點 per-IP 視窗內最大次數。 |
| `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS` | `60000` | 註冊 rate-limit 視窗（毫秒）。 |
| `AUTH_ACCOUNTS` | `[]` | bootstrap 帳號 JSON 陣列。每筆 `active`（true→`active`／false→`disabled`）與可選 `isAdmin` 於**首次** seed 映射到 DB；之後以 DB 為準（reseed 不還原，FR-020）。 |

**上線前務必**：在 `AUTH_ACCOUNTS` 至少放一個 `"isAdmin": true` 的帳號（密碼用 `pnpm auth:hash` 產生），否則 `/admin/users` dashboard 無人可進。範例：

```json
[{ "id":"user_owner","username":"owner@example.com","displayName":"Owner","passwordHash":"<scrypt>","active":true,"isAdmin":true }]
```

> 註：Docker 部署的 `.env.production.example`（feature 012）合併後，請同步補上 `REGISTRATION_ENABLED` 與 `AUTH_ACCOUNTS` 的 `isAdmin` 範例。

## 2. DB migration（一次）

本 feature 有兩段 migration（`0003` 新增 `status`/`is_admin` + backfill `active`→`status`、`0004` drop `active`）：

```bash
pnpm --filter @slides-agent/api db:migrate
pnpm --filter @slides-agent/api db:seed   # 套用 AUTH_ACCOUNTS（含 isAdmin）
```

backfill 規則：既有 `active=true` → `status='active'`、`active=false` → `status='disabled'`。

## 3. 端到端流程

1. **訪客註冊**：登入頁 →「註冊」→ 填 email/顯示名稱/密碼（密碼至少 10 字、含字母與數字）→ 送出 → 顯示「註冊已送出，待管理員審核」。帳號進 DB 為 `pending`，**尚不可登入**。
2. **管理員審核**：以 admin 登入 → 導覽列「使用者管理」→ `/admin/users`。
   - 依狀態篩選（全部／待審核／已啟用／已停用）。
   - 每列動作：**核准**（pending→active）、**拒絕**（刪除 pending）、**停用**（active→disabled）、**重新啟用**（disabled→active）、**設為/取消管理員**。
   - 自己的列不顯示停用／降權（防自鎖）。
3. **核准後登入**：使用者用該帳密登入 → 成功進入 app。

## 4. 行為與保護

- **即時生效（FR-019）**：停用或降權後，目標的**下一個請求**即被擋（每請求 `jwt.strategy → validateSessionUser` 重讀 DB；停用 → 401、降權 → `/api/admin/*` 403）。無需等 token 過期。
- **防鎖死（FR-018）**：停用／降權「最後一位 active 管理員」→ 409 `LAST_ADMIN_PROTECTED`；停用／降權自己 → 409 `CANNOT_MODIFY_SELF`。
- **不可列舉（DR-002）**：未知帳號／錯密碼一律泛用 401 `AUTH_INVALID`；`account_pending`/`account_disabled`（→ 403 `ACCOUNT_PENDING`/`ACCOUNT_DISABLED`）**只有持正確密碼者**會看到。
- **關閉註冊**：`REGISTRATION_ENABLED=false` → 註冊 403、登入頁不顯示註冊入口。

## 5. 手動驗證清單

- [ ] 註冊合法 → 201、DB 出現 `pending` 列、回應**無** `passwordHash`、**無** token。
- [ ] pending 帳密登入 → 403 `ACCOUNT_PENDING`（前端顯示「待管理員核准」）。
- [ ] 弱密碼註冊 → 400；重複 email → 409「此 email 已被使用」。
- [ ] admin `/admin/users` 可列出/篩選；核准後該帳號可登入。
- [ ] 停用某 active 使用者 → 對方下一請求 401。
- [ ] 降權另一 admin → 對方 `/api/admin/*` 403。
- [ ] 最後一位 active admin 停用/降權 → 409；停用/降權自己 → 409。
- [ ] 非 admin 打 `/api/admin/*` → 403；未登入 → 401。
- [ ] web bundle 與所有回應皆無 `passwordHash`。

## 6. API 摘要

| Method | Path | 權限 | 說明 |
|--------|------|------|------|
| `POST` | `/api/auth/register` | 公開（rate-limited） | 建 pending 帳號，回 `PublicAccount`（無 token） |
| `GET` | `/api/auth/config` | 公開 | `{ registrationEnabled }` |
| `GET` | `/api/admin/users?status=` | admin | 列出/篩選（`pending|active|disabled|all`） |
| `PATCH` | `/api/admin/users/:id` | admin | `{ status?, isAdmin? }`，idempotent |
| `DELETE` | `/api/admin/users/:id` | admin | 僅 `pending` 可刪 |
