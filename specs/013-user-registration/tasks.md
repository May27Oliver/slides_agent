---
description: "Task list — 013 使用者自助註冊 + 管理員審核 dashboard"
---

# Tasks: 使用者自助註冊（管理員審核制 + 使用者管理 dashboard）

<!-- Spec Kit artifacts in Traditional Chinese. -->

**Input**: `/specs/013-user-registration/`（spec / plan）

**範圍**：自助註冊（→pending）+ 管理員 `/admin/users` dashboard（核准/拒絕/停用/重新啟用/升降 admin）。帳號二值 `active` 升級為三態 `status`、引入 `isAdmin` 並貫穿全鏈。**無新 npm 套件**；**有一支 DB migration**（accounts: −active +status +isAdmin）。

**Tests**: TDD——domain 純函式（評估器、admin 變更政策、register 驗證器）先寫失敗測試；API 授權邊界（401/403/409）與一條前端 e2e（註冊→核准→登入）。

**組織**：Foundational = status/isAdmin 跨層重構（BLOCKS 所有 US）；US1/US2/US3 = 對同一基礎可獨立示範的切片（註冊 / dashboard / 狀態 UX）。

---

## Phase 1：Setup
- [ ] T001 確認分支 `013-user-registration`（疊在 main 上）。本批**無新 npm 套件**、**有一支 migration**。
- [ ] T001a 編輯前 impact（CLAUDE.md，**先在新 index 上**——必要時先 `npx gitnexus analyze`）：對將改的高扇出 symbol 跑 `gitnexus_impact`——`UserAccount`、`AuthenticatedUser`、`evaluateLogin`、`evaluateSession`、`AuthFailureCode`、`accounts`（schema）。回報 blast radius；HIGH/CRITICAL 先警示（預期 `AuthenticatedUser` 的高 count 多為 domain barrel 假性放大，真實型別耦合小、靠 TS 編譯器兜底）。

---

## Phase 2：Foundational（status/isAdmin 跨層重構 — BLOCKS 所有 US）

### 2a. domain 三態 + isAdmin + 評估器（先 TDD，DR-001/002/003）
- [ ] T002 [P] **擴充既有** `packages/domain/test/auth/auth-policy.service.test.ts`（**不另開新檔**，並**移除其中舊的 `inactive_account` 斷言**，No-shim）：`evaluateLogin` **新順序**（`!account`→`invalid_credentials`；`!passwordMatches`→`invalid_credentials`；`status='pending'`→`account_pending`；`status='disabled'`→`account_disabled`；active→ok）、`evaluateSession`（非 active→對應 code）、`toAuthenticatedUser` 帶 `isAdmin`（RED）。
- [ ] T003 `packages/domain/src/auth/auth.types.ts` + `auth-policy.service.ts`：新增 `AccountStatus`（`pending|active|disabled`）；`UserAccount.active`→`status`（**移除 active**）；`AuthenticatedUser` 加 `isAdmin`；`AuthFailureCode` **移除** `inactive_account`、**新增** `account_pending`/`account_disabled`；`evaluateLogin`/`evaluateSession` 改順序+新 code；`toAuthenticatedUser` 帶 `isAdmin`（GREEN）。
- [ ] T004 [P] 失敗測試 `packages/domain/test/auth/admin-mutation.test.ts`：`evaluateAdminMutation`——降權/停用會使某 active admin 失能且 `activeAdminCount<=1` → `LAST_ADMIN_PROTECTED`；`targetId===actorId`（停用/降權自己）→ `CANNOT_MODIFY_SELF`；其餘允許（RED）。
- [ ] T005 `packages/domain/src/auth/admin-mutation.policy.ts`：`evaluateAdminMutation({actorId,targetId,activeAdminCount,change})`（GREEN）。
- [ ] T006 `packages/domain/src/auth/account-admin-store.port.ts`（`create`/`listAll`/`updateStatus`/`setAdmin`/`deleteById`/`countActiveAdmins`）+ `bootstrap-account.types.ts`（`BootstrapAccount = {id,username,displayName,passwordHash,active,isAdmin?}`）；`packages/domain/src/index.ts` 匯出。

### 2b. contracts（先 TDD，DR-008）
- [ ] T007 [P] 失敗測試 `packages/contracts/test/auth-contract.test.ts`（或既有檔擴充）：`validateRegisterRequest`——email 格式、必填、長度上限、**密碼最小 10 字且至少一字母一數字**；錯誤回 `{code:"INVALID_INPUT",fields}`（RED）。
- [ ] T008 `packages/contracts/src/auth.ts`：`validateRegisterRequest` + `RegisterRequestContract`/`RegisterResponse`（= `PublicAccount`，無 token）；`PublicAccount`（`id/username/displayName/status/isAdmin/createdAt`）；`AuthUserContract` 加 `isAdmin`（連帶 Login/Me）；`AuthErrorContract.code` 擴充 `"ACCOUNT_PENDING"|"ACCOUNT_DISABLED"`；admin 端點 request/response 契約（GREEN）。

### 2c. DB migration（DR-001）
- [ ] T009 `apps/api/src/infra/db/schema.ts`：`accounts` **移除** `active`、**新增** `status text`（CHECK in `pending|active|disabled`，register 預設 `pending`）+ `isAdmin boolean not null default false`。`pnpm db:generate`（drizzle-kit）產生 migration 後**手動補 backfill**：`ADD status/is_admin` → `UPDATE accounts SET status = CASE WHEN active THEN 'active' ELSE 'disabled' END` → `DROP COLUMN active`（順序確保不丟資料）。本機 `pnpm db:migrate` 套用並驗證。

### 2d. store 寫入 + seed（DR-004/007）
- [ ] T010 `apps/api/src/modules/auth/db-user-account-store.ts`：實作 `AccountAdminStore`（`create`/`listAll(filter?)`/`updateStatus`/`setAdmin`/`deleteById`/`countActiveAdmins`）；`toUserAccount` 改讀 `status`/`isAdmin`。整合測試（pglite 或真 DB）。
- [ ] T011 seed FR-020：`apps/api/src/config/auth.config.ts` `loadSeedAccounts()` 回 `BootstrapAccount[]`（解析可選 `isAdmin`）；`apps/api/src/infra/db/seed-accounts.ts` `seedAccounts(db, BootstrapAccount[])` insert 映射 `active`→`status`、`onConflictDoUpdate` **只**更新 `username`/`displayName`/`passwordHash`/`updatedAt`（**不**覆蓋 `status`/`isAdmin`）。測試：reseed 不還原 dashboard 改過的 env 帳號狀態。

### 2e. auth pipeline：isAdmin + 登入錯誤 code（DR-002/003）
- [ ] T012 `apps/api/src/modules/auth/`：`auth.service.validateCredentials` 回傳**帶 code 的結果**（`AuthEvaluation`，不丟 pending/disabled）；`validateSessionUser`/`issueSession` 帶 `isAdmin`（JWT claim + 回傳）；`jwt.strategy` 回傳含 `isAdmin`；`local.strategy`（API 邊界）對 `account_pending`/`account_disabled` 丟 `ForbiddenException`、`invalid_credentials` 丟泛用 `UnauthorizedException`（401）；`auth.controller` login/me 回 `isAdmin`。
  - **邊界 code 映射（domain 小寫 → public 大寫，必做）**：`local.strategy`/guard 邊界 MUST 把 domain 的 `account_pending`/`account_disabled` 映射為 response `{ code: "ACCOUNT_PENDING" }`／`{ code: "ACCOUNT_DISABLED" }`（對齊 `AuthErrorContract.code`，T008）；`invalid_credentials` → 泛用 `AUTH_INVALID`（401，不可列舉）。前端與契約只見大寫 public code。
  - API 測試（401 `AUTH_INVALID` / 403 `ACCOUNT_PENDING`・`ACCOUNT_DISABLED` / me 帶 isAdmin / 停用後下一請求 401）。

**✅ Checkpoint A**：domain/contracts 測試綠；migration 套用；`isAdmin`/`status` 端到端在 API 可觀察；登入對 pending/disabled 回可區分 403。

---

## Phase 3：User Story 1 — 自助註冊建立待審核帳號（Priority: P1）🎯 MVP

**Goal**：訪客能註冊並得到「待審核」回饋；帳號進 DB 為 pending、尚不可登入。
**Independent Test**：`POST /api/auth/register` 合法 body → 201 PublicAccount(`status:pending`)、無 token；DB 多一列 pending；該帳密登入 → 403 `ACCOUNT_PENDING`。

- [ ] T013 [US1] `apps/api/src/modules/auth/register.controller.ts`：`POST /api/auth/register`（公開、套 per-IP rate-limit guard 模式）→ 驗證（`validateRegisterRequest`）→ `AccountAdminStore.create`（`status='pending'`,`isAdmin=false`,scrypt hash）→ 201 `PublicAccount`（無 token）；重複 email → **409「此 email 已被使用」**；`REGISTRATION_ENABLED=false` → **403 `REGISTRATION_DISABLED`**。註冊進 `auth.module`。API 測試（201/400/409/403/429；回應無 `passwordHash`）。
- [ ] T014 [US1] public `GET /api/auth/config` → `{ registrationEnabled }`（免登入，供前端決定是否顯示註冊入口，DR-010）。
- [ ] T015 [US1] 前端：`apps/web/src/features/auth/RegisterView.tsx`（鏡像 `LoginView`）+ `register-client.ts`；`App.tsx` 加 `/register`（公開）；註冊成功顯示**「待管理員審核」確認畫面**（FR-013a，不自動登入、不導向 app、附「回登入頁」）；`LoginView` 顯示「註冊」連結（`/api/auth/config` 關閉時隱藏）。元件測試。
- [ ] T016 [US1] smoke/e2e：填註冊頁送出 → 待審畫面 → DB pending 列 → 用該帳密登入被擋（403 `ACCOUNT_PENDING`）。

**✅ Checkpoint B**：可自助註冊、進 pending、尚不可登入。

---

## Phase 4：User Story 2 — 管理員使用者管理 dashboard（Priority: P2）

**Goal**：管理員在 `/admin/users` 列出所有 user 並核准/拒絕/停用/重新啟用/升降 admin；即時生效；防鎖死。
**Independent Test**：admin token 打 `GET /api/admin/users?status=` + `PATCH/DELETE` 動作生效；非 admin 403、未登入 401；停用/降權目標下一請求被擋；最後一個 active admin/自己受保護(409)。

- [ ] T017 [US2] `apps/api/src/modules/admin/`：`admin.guard.ts`（`AdminGuard` 讀 `req.user.isAdmin` 即時值）+ `admin-users.controller.ts`（`GET /api/admin/users?status=pending|active|disabled|all`；`PATCH /api/admin/users/:id {status?,isAdmin?}` **idempotent**；`DELETE /api/admin/users/:id` 僅 pending 可刪）+ `admin.module.ts`（註冊到 AppModule）。停用/降權前以 `countActiveAdmins`+`evaluateAdminMutation` 判 FR-018 → 409 `LAST_ADMIN_PROTECTED`/`CANNOT_MODIFY_SELF`；非 pending 刪 → 409 `CANNOT_REJECT_NON_PENDING`；找不到 → 404。API 測試（401/403/409、核准/停用/重新啟用/升降、即時生效、idempotent）。
- [ ] T018 [US2] 前端：`apps/web/src/features/admin/AdminUsersView.tsx`（表格列全部 user：email/顯示名/狀態徽章/是否 admin/註冊時間；依 status 篩選；每列核准/拒絕/停用/重新啟用/升降 admin 動作）+ `admin-users-client.ts` + `AdminRoute.tsx`（`ProtectedRoute` + `user.isAdmin`，非 admin 導開）；`App.tsx` 加 `/admin/users`；導覽列 admin 時顯示入口。元件測試（含非 admin 不見入口）。
- [ ] T019 [US2] e2e：訪客註冊 → admin 在 dashboard 核准 → 該使用者登入成功；admin 停用某 active 使用者 → 對方下一請求被擋；admin 降權另一 admin → 對方 `/api/admin/*` 403。

**✅ Checkpoint C**：完整審核閉環 + 即時停用/降權 + 防鎖死。

---

## Phase 5：User Story 3 — 各狀態清楚回饋（Priority: P3）

**Goal**：註冊/登入在 pending/disabled/重複/弱密碼各狀態給清楚、不洩漏的 zh-TW 訊息。
**Independent Test**：pending 登入顯示「待管理員核准」、disabled 顯示「帳號已停用」、重複 email 顯示「已被使用」、弱密碼即時提示。

- [ ] T020 [US3] 前端：`auth-client.ts` `AuthError` **帶 `code`**（解析回應 body）；`LoginView` 依 `code` 分流（`ACCOUNT_PENDING`→待審核、`ACCOUNT_DISABLED`→已停用、其餘→泛用「帳密錯誤」）；`RegisterView` 錯誤狀態（重複「此 email 已被使用」、弱密碼規則、註冊關閉）；`AuthProvider`/`auth.types.ts`/`auth-storage` 帶 `isAdmin`；i18n（`apps/web/src/i18n`）新增字串。
- [ ] T021 [US3] e2e/元件測試：pending 登入→「待管理員核准」；disabled 登入→「帳號已停用」；重複 email 註冊→「此 email 已被使用」；弱密碼→即時規則提示。

---

## Phase 6：收尾（設定 / 安全 evidence / 反模式稽核 / scope）
- [ ] T022 [P] 設定/文件：`.env.example` + `.env.production.example` 加 `REGISTRATION_ENABLED`（預設 true）與 `AUTH_ACCOUNTS` 的 `isAdmin` 範例；`specs/013-user-registration/quickstart.md`（註冊→核准流程、`/admin/users` 操作、**上線前至少一個 `isAdmin:true` admin** 維運注意、`REGISTRATION_ENABLED` 關閉行為）。
- [ ] T023 [P] 安全 evidence：**不可列舉**——未知帳號/錯密碼一律泛用 401，pending/disabled 訊息**只**在持正確密碼時出現；web bundle 與所有回應無 `passwordHash`；register 套 rate-limit（429）。
- [ ] T024 **反模式稽核（drift/dead-code/shim/legacy，對齊 plan）**：
  - **shim/legacy 徹底移除**：grep 全 repo **無** `account.active`／domain `UserAccount.active`／`inactive_account` 殘留（已換成 `status`/`account_pending`/`account_disabled`）；env `BootstrapAccount.active` 為刻意保留之 bootstrap 輸入（標明）。
  - **drift**：單一 `accounts` 表；`status` 單一狀態欄；admin 即時值單一來源＝DB（JWT claim 僅 UI 初判）；admin 授權單一 `AdminGuard`。
  - **dead code**：每個新 port 方法/contract 欄位/i18n key/路由都有消費者。
  - 產出：稽核 checklist 記於 PR。
- [ ] T025 `gitnexus_detect_changes()` 確認影響範圍（預期：auth domain/contracts/api + 新 admin module + 前端 auth/admin + accounts schema migration）。提交前執行（CLAUDE.md）。

**✅ Checkpoint D**：文件齊備、安全 evidence 通過、反模式稽核全綠、影響範圍符合預期。

---

## Dependencies & Execution Order
- **Phase 1** → **Phase 2 Foundational（BLOCKS 所有 US）** → **Phase 3–5 US1/US2/US3** → **Phase 6 收尾**。
- Phase 2 內：2a（domain TDD：T002→T003、T004→T005、T006）先；2b（contracts）可與 2a 平行；2c migration 需 schema 改定；2d store/seed 需 2a 型別 + 2c migration；2e pipeline 需 2a（評估器/型別）+ 2b（AuthErrorContract）。
- US1（T013–T016）需 Foundational（register 用 `AccountAdminStore.create` + `validateRegisterRequest` + PublicAccount）。
- US2（T017–T019）需 Foundational（admin store 方法 + `evaluateAdminMutation` + `isAdmin` 即時值 + AdminGuard）。
- US3（T020–T021）需 2e（登入 code pipeline）+ US1/US2 前端就位。

## Parallel Opportunities
- `[P]`：T002/T004（domain 測試）、T007（contracts 測試）、T022（設定/quickstart）、T023（安全 evidence）可與相鄰任務平行（不同檔、無依賴）。

## 明確不在本批
- Email 驗證/寄信、密碼重設/忘記密碼、OAuth/社群登入、2FA、CAPTCHA、profile 自助管理、角色擴張（除 `isAdmin`）、dashboard 分頁。
- 任何投影片生成/設計系統/領域邏輯變更（除 auth/帳號相關外不動）。

## Notes
- 編輯高扇出 symbol 前跑 `gitnexus_impact`（T001a）；提交前跑 `gitnexus_detect_changes`（T025）。
- 每個任務或邏輯群組完成後 commit；可在任一 Checkpoint 停下獨立驗證。
- `active`→`status` 與 `inactive_account`→新 code 為**同次徹底替換**（No shim）：改完即 grep 確認無殘留（T024）。
