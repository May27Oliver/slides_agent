# Implementation Plan: 使用者自助註冊（管理員審核制 + 使用者管理 dashboard）

**Branch**: `013-user-registration` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-user-registration/spec.md`

## Summary

在既有 JWT 登入（feature 005/006）上加**自助註冊**：訪客註冊 → 建 `status='pending'` 帳號 → **管理員在 `/admin/users` dashboard 審核**（核准/拒絕/停用/重新啟用/升降 admin）→ 核准後可登入。**不做 email 驗證**。前後端都做。

技術主軸：把帳號的二值 `active` 升級為**三態 `status`**（pending/active/disabled）、引入 **`isAdmin`** 並讓它貫穿 domain→contracts→JWT/me→前端、新增**寫入能力**到帳號 store、加 **register** 與 **`/api/admin/*`** 兩組端點與一個 **admin guard**。停用/降權的「即刻生效」**沿用既有** `jwt.strategy`→`validateSessionUser` 每請求 DB 再驗證的骨架。

**Artifact Language**: 本 plan 及相關 Spec Kit 產物以繁體中文撰寫。

## Technical Context

**Language/Runtime**：沿用既有 monorepo（TypeScript；NestJS via tsx；React 19 + Vite + Tailwind v4）。Node 20.19.5 / pnpm 10.30.3。

**Primary Dependencies**：**無新增 npm 套件**。沿用 `@nestjs/passport`/`passport-jwt`（既有 JWT）、`drizzle-orm`/`pg`（既有 DB）、既有 scrypt（`apps/api/src/common/scrypt-password.ts`）、既有 rate-limit guard 模式。

**Storage**：PostgreSQL，既有 `accounts` 表。**本 feature 有一支 migration**：新增 `status`、`isAdmin` 欄位、backfill 既有 `active`、移除 `active`。

**Testing**：vitest（domain/contracts/api）+ Playwright（web e2e）。TDD：domain 純函式（評估器、admin 變更政策、register 驗證器）先寫測試。

**Target Platform**：與既有相同（單機/容器；012 的 compose 可直接帶起本 feature）。

**Project Type**：Web（apps/api + apps/web + packages/domain + packages/contracts）。

**Performance/Constraints**：每個受保護請求已有一次 `findById`（既有 `validateSessionUser`）；本 feature 不新增 per-request 成本（只是讓它多讀 `status`/`isAdmin`，同一列）。register/admin 端點 per-IP rate limit。

**Scale/Scope**：內部工具規模（數十～數百帳號）；dashboard 一次列出全部可接受（無分頁需求；若日後超量再加分頁，非本批）。

---

## 關鍵技術決策（research，內聯）

> 本 feature 有領域型別/政策變更但無複雜資料模型；`data-model.md` 內容併入此處與 spec Key Entities。

### DR-001：帳號狀態＝三態 `status` 欄位，**完全取代** `active` boolean（No shim）
- `accounts` schema：移除 `active boolean`，新增 `status text`（值 `pending|active|disabled`，加 CHECK 約束；register 預設 `pending`）+ `isAdmin boolean not null default false`。
- migration（`drizzle-kit generate` 產生 DDL 後**手動補 backfill**）：`ALTER TABLE ... ADD status/is_admin` → `UPDATE accounts SET status = CASE WHEN active THEN 'active' ELSE 'disabled' END` → `ALTER TABLE ... DROP COLUMN active`。順序確保不丟資料。
- domain `UserAccount`：`active: boolean` → `status: AccountStatus`（**無 `active`**）；讀 `account.active` 的 domain/store 處（`evaluateLogin`/`evaluateSession`/`toAuthenticatedUser`/`db-user-account-store` 的 `toUserAccount`）改讀 `status`。env bootstrap 端不走 `UserAccount`，改用 `BootstrapAccount` 並由 `seedAccounts` 映射 `active`→`status`（見 DR-007）。
- **Rejected**：保留 `active` 再加 `pending` 旗標（正是 review HIGH-1 指出的二義 overload）；或 `active` 與 `status` 並存（shim/drift）。

### DR-002：登入評估**先驗密碼、再揭露狀態**；以 `account_pending`/`account_disabled` 取代 `inactive_account`（防列舉）
- 現況 `evaluateLogin` **先**檢查 `active` 再檢查密碼 → pending 帳號用錯密碼也回 `inactive_account`，洩漏帳號存在＋狀態。改為：`!account`→`invalid_credentials`；`!passwordMatches`→`invalid_credentials`；`status==='pending'`→`account_pending`；`status==='disabled'`→`account_disabled`；否則 ok。**只有持正確密碼者（本人）**才看到待審/停用訊息。
- `evaluateSession`（已持有效 token）：`status!=='active'` → 回對應 code（pending 理論上拿不到 token；disabled 為核心情境）。
- `AuthFailureCode`：**移除** `inactive_account`，**新增** `account_pending`、`account_disabled`（No shim：不保留舊 code 作對外用；若程式他處仍引用則一併改）。
- **登入 pipeline 必須把 code 一路帶到前端**（現況會壓平，需逐點改）：
  - `auth.service.validateCredentials`：回傳型別由 `AuthenticatedUser | null` 改為**帶 code 的結果**（`AuthEvaluation`：`{ok:true,user}` 或 `{ok:false,code}`），不要丟失 `account_pending`/`account_disabled`。
  - `LocalStrategy.validate`（`apps/api/src/modules/auth/local.strategy.ts`）：`invalid_credentials` → `UnauthorizedException`（泛用 401，不可列舉）；`account_pending`/`account_disabled` → **`ForbiddenException({ code })`**（403；密碼已正確，屬「已驗身但不允許」）。`LocalAuthGuard` 會把該例外的 body 帶進 HTTP 回應。
  - contracts `AuthErrorContract.code`：由 `"AUTH_INVALID"|"AUTH_REQUIRED"` **擴充**為加上 `"ACCOUNT_PENDING"|"ACCOUNT_DISABLED"`（sanitized、對外）。
  - 前端 `auth-client`（`apps/web/src/features/auth/auth-client.ts`）：`AuthError` **帶 `code`**（從回應 body 解析），不要再壓成 `AuthError("Login failed")`；`LoginView` 依 `code` 顯示「待管理員核准／帳號已停用／帳密錯誤」。
- 跨段落歸屬：上述後端改動屬 **Phase E**、前端屬 **Phase G**。
- **Rejected**：保留 `inactive_account` 在 controller 再分流（code 與語意分離、易 drift）；或前端只認泛用失敗（拿不到 pending/disabled、體驗無法分流）。

### DR-003：`isAdmin` 貫穿全鏈（單一即時來源＝DB）
- domain：`AuthenticatedUser` + `toAuthenticatedUser()` 帶 `isAdmin`。
- contracts：`AuthUserContract` 加 `isAdmin` → 連帶 `LoginResponseContract`/`MeResponseContract`。
- 後端：`issueSession` 的 JWT claims 加 `isAdmin`（僅供前端初判 UI）；`validateSessionUser`（每請求查 DB）回傳當下 `isAdmin` → `req.user.isAdmin` 為**即時值**。
- 前端：auth state（`AuthProvider`/`auth.types.ts`/stored session）帶 `isAdmin`，據此顯示 dashboard 入口。
- **授權一律以 `req.user.isAdmin`（DB 即時值）為準**，不信 JWT claim（FR-017a）。
- **Rejected**：另開 `/api/auth/permissions` round-trip（多一跳；isAdmin 極小且已在同一列載入）。

### DR-004：帳號 store 由唯讀擴為可寫（新 port，DbUserAccountStore 一併實作）
- 現 `UserAccountStore`（`findByUsername`/`findById`）**唯讀**。新增一個 **`AccountAdminStore` port**（domain）：`create(input)`（註冊）、`listAll(filter?)`、`updateStatus(id, status)`、`setAdmin(id, isAdmin)`、`deleteById(id)`、**`countActiveAdmins()`**（＝`isAdmin=true AND status='active'` 的數量，給 FR-018 用；**不算** disabled admin，避免誤放行停用唯一 active admin）。
- `DbUserAccountStore`（已包 `accounts` 表）**一併實作** `AccountAdminStore`，避免第二個 store/表。
- **Rejected**：另立帳號管理表或第二個 store（drift、雙真實來源）。

### DR-005：register 與 admin 兩條 API；admin 以 guard 保護
- `POST /api/auth/register`（公開、免 JWT、套既有 per-IP rate-limit guard 模式）→ 201 + `PublicAccount`（無 token）。`REGISTRATION_ENABLED=false` → 403 `REGISTRATION_DISABLED`。
- `/api/admin/*`（`GET /api/admin/users?status=`、`PATCH /api/admin/users/:id`、`DELETE /api/admin/users/:id`）：`@UseGuards(JwtAuthGuard, AdminGuard)`。**`AdminGuard`** 讀 `req.user.isAdmin`（DR-003 即時值），非 admin → 403、未登入 → 401。
- 落點：`apps/api/src/modules/auth/`（register 併入 AuthController 或新 `RegisterController`）；`apps/api/src/modules/admin/`（新 `AdminUsersController` + `AdminGuard` + module）。
- **Rejected**：把 admin 動作塞進現有 controller（職責混雜）。

### DR-006：FR-018 防鎖死＝純 domain 政策函式
- `evaluateAdminMutation({ actorId, targetId, activeAdminCount, change })` → 允許/拒絕（`CANNOT_MODIFY_SELF`/`LAST_ADMIN_PROTECTED`）。停用/降權前，service 先 `countActiveAdmins()`（DR-004，僅算 `isAdmin && status='active'`）再呼叫此純函式判定：當 `change` 會使某 active admin 失去管理能力（降權或停用）且 `activeAdminCount<=1` 或 `targetId===actorId` → 拒絕。
- **Rejected**：DB trigger（不透明、難測）；以「全部 admin 數」判定（會把 disabled admin 誤算，放行停用唯一 active admin——本 review MEDIUM 指出）。

### DR-007：seed 改為「初次建立才套 status/isAdmin」（FR-020，No drift）+ **bootstrap 型別與 domain 型別分離**
- **型別分離（修正 DR-001 與 env 的張力）**：domain `UserAccount` **只有 `status`、無 `active`**；env 解析另立 **`BootstrapAccount` 型別**＝`{ id, username, displayName, passwordHash, active: boolean, isAdmin?: boolean }`（保留既有 `.env` 的 `active` 欄位作 bootstrap 輸入）。`loadSeedAccounts()` 回傳 **`BootstrapAccount[]`（非 `UserAccount[]`）**；`seedAccounts(db, source: BootstrapAccount[])` 在 **insert** 時把 `active`→`status`（true→`active`/false→`disabled`）、`isAdmin ?? false` 寫入 DB。
- `seedAccounts` 的 `onConflictDoUpdate`：**只**更新 `username`/`displayName`/`passwordHash`/`updatedAt`，**不**覆蓋 `status`/`isAdmin`（FR-020）。
- 即 env `active`/`isAdmin` 是 `BootstrapAccount` 的 bootstrap 輸入，seed 時一次映射到 DB；之後以 DB `status`/`isAdmin` 為準。domain 不再有 `active` 概念。
- **Rejected**：(a) `loadSeedAccounts` 仍回 `UserAccount[]`（與「`UserAccount` 無 `active`」型別衝突——本 review MEDIUM 指出）；(b) env 改用 `status` 字串（破壞既有 `.env` 格式、與 005 漂移）。

### DR-008：contracts 新驗證器與型別
- `validateRegisterRequest`（仿 `validateLoginRequest`）：email 格式 + 必填 + 長度上限 + **密碼最小 10 字且至少含一字母一數字**；失敗回 `{code:"INVALID_INPUT", fields}`。
- `PublicAccount` 型別 `{ id, username, displayName, status, isAdmin, createdAt }`；register/admin 回應與 admin 清單共用。
- admin 端點 request/response 契約固定（見 spec FR-010）。
- **Rejected**：用 class-validator DTO（與既有「contracts 驗證器」慣例漂移）。

### DR-009：前端——註冊頁 + 待審確認 + admin dashboard
- `apps/web/src/features/auth/`：`RegisterView.tsx`（鏡像 `LoginView`）、註冊成功的**待審確認畫面/狀態**（FR-013a）、`register` client；`AuthProvider`/`auth.types.ts`/`auth-storage` 帶 `isAdmin`；登入錯誤分流 `account_pending`/`account_disabled` 文案。
- `apps/web/src/features/admin/`：`AdminUsersView.tsx`（表格 dashboard，列全部 user、狀態徽章、依 status 篩選、每列動作）、`admin-users-client.ts`。
- 路由（`App.tsx`）：加 `/register`（公開）；`/admin/users` 包在新的 `AdminRoute`（`ProtectedRoute` + `user.isAdmin` 判定，非 admin 導開）。導覽列 admin 時顯示入口；登入頁顯示「註冊」連結（`REGISTRATION_ENABLED` 關閉時隱藏——前端可由 register 端點回應或一個 public flag 得知，見 DR-010）。
- i18n（`apps/web/src/i18n`）：新增註冊/審核/狀態相關字串（zh-TW + 既有語系一致）。
- **Rejected**：admin 表格塞進現有 MyDecks 頁（職責混雜、權限邊界不清）。

### DR-010：`REGISTRATION_ENABLED` 開關與前端可見性
- 後端：env `REGISTRATION_ENABLED`（預設 `true`）；register 端點關閉時回 403 `REGISTRATION_DISABLED`。
- 前端如何知道要不要顯示「註冊」入口：**最小做法**＝在既有 `GET /api/auth/me`/或一個極小 public `GET /api/auth/config` 回 `{ registrationEnabled }`。**預設選 public config 端點**（不需登入即可決定登入頁是否顯示註冊連結）。
- **Rejected**：前端硬編顯示、靠 register 失敗才知道（體驗差）。

---

## Constitution Check

*GATE：投影片生成相關原則對本 auth feature 多數 N/A。*

- **Specification First**：spec 已定案、經 3 輪 analyze（3 HIGH+5 MEDIUM+2 LOW 全消），無阻擋性 `NEEDS CLARIFICATION`。
- **Behavior-Driven User Value**：3 User Story 皆有 Given/When/Then 且可獨立示範（註冊建 pending／dashboard 審核管理／狀態回饋）。
- **Source Fidelity / Reviewable Generation / Web-First / Design System / Semantic Titles / Data Viz**：**N/A** — 不觸及內容生成。
- **Backend-Configured LLM Boundary（CR-004）**：**適用** — 密碼/hash 只在後端；回應與前端 bundle 零敏感欄位；`isAdmin`/`status` 為 public-safe 授權資訊，非 LLM 機密。
- **Code Quality and Simplicity**：最小可讀方案 + 反模式不變式（下節）。domain 維持型別/port/政策分檔（`auth.types.ts`/`*-store.port.ts`/`auth-policy.service.ts`）。每個新型別/欄位/port 方法皆有近期消費者（見各 DR）。
- **TDD / DDD**：第一批失敗測試＝domain 純函式——`evaluateLogin`/`evaluateSession`（新順序 + 新 code）、`evaluateAdminMutation`（FR-018）、`validateRegisterRequest`（密碼政策）。再往外接 store/API/前端。
- **Lean Test Scope**：測 domain 政策 + contracts 驗證 + API 授權邊界（401/403/409）+ 一條前端 e2e（註冊→審核→登入）；不對每個 CRUD 寫冗餘斷言。
- **Consistent UX and Language**：服務名/欄位沿用既有；前端 zh-TW + 既有語系；錯誤訊息一致、不洩漏。
- **Security（CR + 全域 security 規則）**：密碼 scrypt 不存明文；register/admin rate-limit / guard；最小權限（admin guard + FR-018）；**不可列舉**（DR-002 先驗密碼）；輸入邊界驗證（DR-008）。
- **Performance / Operational Evidence**：無新 per-request 成本；evidence 見下節。
- **Manual Verification Path**：端到端 register→approve→login、停用即刻踢出、降權即時、最後一個 admin 保護、web bundle 無密鑰 → quickstart 檢查清單。

### 反模式不變式（實作與收尾稽核強制）

- **No drift（單一真實來源）**：帳號單一 `accounts` 表；狀態單一 `status` 欄位；admin 即時值單一來源＝DB（JWT claim 僅 UI 初判）；admin 授權單一 `AdminGuard`；env `active` 僅 bootstrap 一次映射（標明）。
- **No dead code**：每個新 port 方法（create/listAll/updateStatus/setAdmin/deleteById/countAdmins）、新 contract 欄位（`isAdmin`/`status`/`PublicAccount`）、新 i18n key、新路由都有消費者。
- **No shim（同次移除舊路徑）**：`active boolean` **完全移除**（不與 `status` 並存）；`inactive_account` code **完全移除**（不別名、不「同時支援」）；無「同時吃 active 與 status」的雙路徑參數。
- **No unlabeled legacy**：env `AUTH_ACCOUNTS` 仍含 `active`（bootstrap 輸入）= **刻意保留並標明**用途（一次映射到 DB `status`）；非殘留。

## Project Structure

### 來源變更（repository）

```text
# domain
packages/domain/src/auth/
  auth.types.ts            # （改）UserAccount.active→status；AuthenticatedUser/AuthFailureCode 改；加 AccountStatus
  auth-policy.service.ts   # （改）evaluateLogin/Session 順序+新 code；toAuthenticatedUser 帶 isAdmin
  account-admin-store.port.ts   # （新）寫入/列出/計數 port：create/listAll/updateStatus/setAdmin/deleteById/countActiveAdmins（DR-004）
  admin-mutation.policy.ts      # （新）evaluateAdminMutation 純函式（DR-006）
  bootstrap-account.types.ts    # （新）BootstrapAccount 型別（env 解析用，與 domain UserAccount 分離；DR-007）

# contracts
packages/contracts/src/auth.ts # （改）AuthUserContract+isAdmin；AuthErrorContract.code +ACCOUNT_PENDING/ACCOUNT_DISABLED；（新）RegisterRequest/PublicAccount/admin 契約 + validateRegisterRequest

# api
apps/api/src/infra/db/
  schema.ts                # （改）accounts：-active +status +isAdmin
  migrations/00xx_*.sql     # （新）add status/is_admin + backfill + drop active（手動補 backfill）
apps/api/src/modules/auth/
  auth.service.ts          # （改）validateSessionUser/issueSession 帶 isAdmin；register 邏輯
  jwt.strategy.ts          # （改）回傳含 isAdmin（經 validateSessionUser）
  db-user-account-store.ts # （改）實作 AccountAdminStore（create/list/update/delete/countActiveAdmins）
  register.controller.ts   # （新）POST /api/auth/register（rate-limited）
  local.strategy.ts        # （改）pending/disabled → ForbiddenException({code})（DR-002）
apps/api/src/config/
  auth.config.ts           # （改）loadSeedAccounts 回 BootstrapAccount[]（解析可選 isAdmin）；REGISTRATION_ENABLED；public config
apps/api/src/modules/admin/
  admin-users.controller.ts # （新）GET/PATCH/DELETE /api/admin/users
  admin.guard.ts            # （新）AdminGuard（讀 req.user.isAdmin）
  admin.module.ts           # （新）
apps/api/scripts/db-seed.ts / src/infra/db/seed-accounts.ts # （改）FR-020：conflict 不覆蓋 status/isAdmin

# web
apps/web/src/features/auth/
  RegisterView.tsx, register-client.ts   # （新）
  AuthProvider.tsx, auth.types.ts, auth-storage.ts # （改）帶 isAdmin
  LoginView.tsx            # （改）account_pending/disabled 文案 + 註冊連結
apps/web/src/features/admin/
  AdminUsersView.tsx, admin-users-client.ts, AdminRoute.tsx # （新）
apps/web/src/App.tsx       # （改）/register、/admin/users 路由
apps/web/src/i18n/*        # （改）新字串

# 設定/文件
.env.example / .env.production.example # （改）REGISTRATION_ENABLED、AUTH_ACCOUNTS 加 isAdmin 範例
specs/013-user-registration/quickstart.md # （新）部署/驗證手冊
```

**Structure Decision**：admin 自成 `modules/admin/`（清楚的權限邊界）；register 併入既有 auth module（同屬認證域）。domain 維持型別/port/政策分檔慣例。

## 實作階段（供 /tasks 展開）

- **Phase A — domain（先 TDD）**：`AccountStatus` + `UserAccount.status` + `AuthenticatedUser.isAdmin`；`evaluateLogin`/`evaluateSession` 新順序與 `account_pending`/`account_disabled`（移除 `inactive_account`）；`evaluateAdminMutation`（FR-018）；測試先紅後綠。
- **Phase B — contracts（先 TDD）**：`validateRegisterRequest`（密碼政策）、`PublicAccount`、`AuthUserContract.isAdmin`、admin 契約；contract 測試。
- **Phase C — DB migration**：schema 改（-active +status +isAdmin）→ `drizzle-kit generate` → 手動補 backfill（active→status）與 drop；本機套用驗證。
- **Phase D — store 寫入**：`AccountAdminStore` port + `DbUserAccountStore` 實作（create/listAll/updateStatus/setAdmin/deleteById/countAdmins）+ 整合測試（pglite/真 DB）。
- **Phase E — API**：register controller（+rate limit, REGISTRATION_ENABLED 403）；admin module + `AdminGuard` + users controller（list/patch/delete，idempotent，FR-018 409 用 `countActiveAdmins`）；**登入錯誤 pipeline**（DR-002）：`validateCredentials` 回帶 code 結果、`local.strategy` pending/disabled→`ForbiddenException({code})`、`AuthErrorContract.code` 擴充；`validateSessionUser`/`issueSession`/`jwt.strategy` 帶 `isAdmin`；login/me 回 `isAdmin`；public `GET /api/auth/config`。API 授權測試（401 invalid / 403 pending/disabled / 403 非 admin / 409 FR-018、即時降權/停用）。
- **Phase F — seed（FR-020）**：`BootstrapAccount` 型別 + `loadSeedAccounts` 回 `BootstrapAccount[]`（解析 isAdmin）；`seedAccounts` insert 映射 `active`→`status`、conflict **不覆蓋** status/isAdmin；seed 測試（既有 dashboard 狀態不被 reseed 還原）。
- **Phase G — 前端**：RegisterView + 待審確認、AdminUsersView dashboard + AdminRoute、auth state isAdmin、clients、i18n、登入頁文案/註冊連結、路由；元件測試 + 一條 e2e（註冊→approve→login）。
- **Phase H — 設定/文件**：`.env*` 加 `REGISTRATION_ENABLED` + `AUTH_ACCOUNTS` isAdmin 範例；quickstart（含「上線前至少一個 isAdmin admin」維運注意）。
- **Phase I — 收尾/Evidence**：安全（不可列舉、web bundle/回應無密鑰、停用即刻踢出、降權即時、最後一個 admin 保護）；反模式稽核（active/inactive_account 已徹底移除）；`gitnexus_impact`（改 `evaluateLogin`/`AuthenticatedUser`/`accounts` 等高扇出 symbol，**編輯前跑**）+ `gitnexus_detect_changes`（提交前）。

## Evidence Plan

- **Automated**：domain 政策測試（評估器新順序/新 code、admin mutation）、contracts 驗證測試、API 授權測試（401/403/409、即時降權/停用）、seed 不覆蓋測試、前端 e2e（register→approve→login）。
- **Manual / Operational**：dashboard 截圖（三態 + 動作）；停用後目標下一請求被擋；降權後 `/api/admin/*` 403；最後一個 admin 保護 409。
- **Security**：register 對未知/錯密碼帳號不可列舉；web bundle / 回應無 `passwordHash`；pending/disabled 訊息只在持正確密碼時出現。
- **Decision**：本 plan DR-001~010（含 rejected alternatives）。

## Complexity Tracking

無憲章違反需豁免。新增 `modules/admin/` 與 `AccountAdminStore` 為必要（清楚權限邊界 + 帳號寫入），未引入投機抽象；`active`→`status` 為一次性升級且同次移除舊欄位（無 shim）。**唯一較重處**＝`isAdmin` 跨層，已在 DR-003/反模式不變式明列各層消費者，避免漏接。
