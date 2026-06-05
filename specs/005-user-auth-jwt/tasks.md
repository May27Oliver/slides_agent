# 任務：User Auth JWT

**輸入**：`/specs/005-user-auth-jwt/` 內的設計文件

**前置文件**：plan.md、spec.md、research.md、data-model.md、contracts/auth-api.md、auth-flow.md、quickstart.md

**測試要求**：每個任務遵守 TDD：先寫聚焦的 failing test，確認 red，再做最小實作,確認 green,最後 refactor。

**組織方式**：任務依 user story 分組,確保每個 story 可獨立實作、展示、測試。

## 格式：`[ID] [P?] [Story] 任務描述`

- **[P]**：可平行執行(不同檔案、無相依)
- **[Story]**：US1 / US2 / US3

## 現況校正(重要)

004 已把生成端點重構到 **`PreviewJobsController`**(`apps/api/src/modules/preview-jobs/preview-jobs.controller.ts`,路由 `@Controller("slides")` 的 `POST /preview`、`POST /preview-jobs`、`GET /preview-jobs/:jobId`)。005 plan 文字寫的是舊的 `SlidesController`;**實際要保護的是 `PreviewJobsController` 的這三個端點**。

## 設計決策(來自 clarify)

- Passport **兩個 strategy**:`LocalStrategy`(登入)+ `JwtStrategy`(保護),`@nestjs/jwt` 簽發。
- 帳號:單一 JSON env `AUTH_ACCOUNTS`;`auth:hash` script 產 scrypt `passwordHash`。
- `POST /api/auth/login` 重用 `RateLimitGuard`(FR-011)。
- 前端 `react-router` 受保護路由 + 登入導回原頁(FR-013)+ `storage` 事件跨分頁同步(FR-012)。
- **tsx 無 decorator metadata**:所有 provider/strategy 建構子顯式 `@Inject`;Phase 6 須加 module bootstrap smoke 驗證 Passport guard/strategy 在 tsx 下可解析。

---

## Phase 1：Setup

- [ ] T001 在 `apps/api/package.json` 新增 `@nestjs/passport`、`passport`、`passport-jwt`、`passport-local`、`@nestjs/jwt`,devDeps `@types/passport-jwt`、`@types/passport-local`;在 `apps/web/package.json` 新增 `react-router-dom`。
- [ ] T002 [P] 在根 `package.json` 新增 script `auth:hash`(指向 `scripts/auth-hash.ts`,用 tsx 執行)。
- [ ] T003 [P] 更新 `.env.example`:`AUTH_JWT_SECRET`(必要,fail-fast)、`AUTH_JWT_EXPIRES_IN`(預設 `30d`)、`AUTH_ACCOUNTS`(JSON,預設空陣列)、`AUTH_LOGIN_RATE_LIMIT_MAX`/`AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`(預設 10 / 60000)。
- [ ] T004 [P] 把 `RateLimitGuard` 從 `modules/preview-jobs/rate-limit.guard.ts` 搬到共用位置 `apps/api/src/common/rate-limit.guard.ts`(避免 auth → preview-jobs 反向耦合),更新 preview-jobs 的 import 與既有測試路徑。

---

## Phase 2：Foundational(阻塞性前置:domain/contracts/config)

**CRITICAL**:完成前不得開始 user story。

### 測試(先寫)

- [ ] T005 [P] `packages/domain/test/auth/auth-policy.service.test.ts`:failing test,驗證 inactive 帳號不得發 session、失敗分類(invalid_credentials/inactive_account…)、不洩漏帳號存在性。
- [ ] T006 [P] `packages/contracts/test/auth-contract.test.ts`:failing test,覆蓋 login/me/logout 的 request/response 形狀與驗證器。
- [ ] T007 [P] `apps/api/test/auth-config.test.ts`:failing test,驗證缺 `AUTH_JWT_SECRET` fail-fast、`AUTH_ACCOUNTS` JSON 解析(壞 JSON → 安全錯誤)、`AUTH_JWT_EXPIRES_IN` 預設。

### 實作

- [ ] T008 `packages/domain/src/auth/auth.types.ts`:`UserAccount`、`LoginCredential`、`AuthSession`、`AuthFailure`、`ProtectedGenerationAccess`(types only)。
- [ ] T009 `packages/domain/src/auth/user-account-store.port.ts`:`UserAccountStore` port(findByUsername / active 檢查)。
- [ ] T010 `packages/domain/src/auth/auth-policy.service.ts`:純規則(帳號可否登入、失敗分類);從 `packages/domain/src/index.ts` 匯出 auth artifacts。
- [ ] T011 `packages/contracts/src/auth.ts`:login/me/logout contract types + validators;從 contracts index 匯出。
- [ ] T012 `apps/api/src/config/auth.config.ts`:`loadAuthConfig()`(JWT secret fail-fast、expiresIn、解析 `AUTH_ACCOUNTS`)。
- [ ] T013 `apps/api/src/modules/auth/configured-user-account-store.ts`:實作 `UserAccountStore`(讀 config 帳號、scrypt + timingSafeEqual 驗密碼);`apps/api/src/modules/auth/auth.tokens.ts` 定義 DI tokens。
- [ ] T014 `scripts/auth-hash.ts`:CLI 用同樣 scrypt 參數產生 `passwordHash`(供站方填入 `AUTH_ACCOUNTS`)。

**Checkpoint**:auth domain/contracts/config/帳號 store 就緒。

---

## Phase 3：User Story 1 - 已授權使用者登入後使用服務(P1)MVP

**目標**:有效帳號登入 → 取得 JWT → 前端持久化 → 進入受保護的生成頁。

### 測試(先寫)

- [ ] T015 [P] [US1] `apps/api/test/local.strategy.test.ts`:LocalStrategy.validate 成功回 user、帳密錯/停用丟 Unauthorized。
- [ ] T016 [P] [US1] `apps/api/test/auth.controller.test.ts`:`POST /api/auth/login` 200 回 `{ token, expiresAt, user }`;錯誤回 `401 AUTH_INVALID`(訊息一致);超限 `429`。
- [ ] T017 [P] [US1] `apps/web/src/features/auth/auth-provider.test.tsx`:登入成功寫 localStorage、AuthProvider 進 authenticated;reload 從 localStorage 還原。

### 實作

- [ ] T018 [US1] `apps/api/src/modules/auth/local.strategy.ts` + `local-auth.guard.ts`(`AuthGuard("local")`,顯式 `@Inject`)。
- [ ] T019 [US1] `apps/api/src/modules/auth/auth.service.ts`:驗證委派 domain policy + `JwtService` 簽 JWT。
- [ ] T020 [US1] `apps/api/src/modules/auth/auth.controller.ts`:`POST /login`(`@UseGuards(RateLimitGuard, LocalAuthGuard)`)。
- [ ] T021 [US1] `apps/api/src/modules/auth/auth.module.ts`:`PassportModule` + `JwtModule.register`(secret/expiry from auth.config);wire store/strategies。`AppModule` import `AuthModule`。
- [ ] T022 [US1] 前端:`auth.types.ts`、`auth-storage.ts`(localStorage 讀寫)、`auth-client.ts`(login)、`AuthProvider.tsx`(狀態 + reload 還原)。
- [ ] T023 [US1] 前端:`main.tsx` 包 `BrowserRouter` + `AuthProvider`;`App.tsx` 設路由;`LoginView.tsx` 登入畫面。

**Checkpoint**:US1 可獨立展示:有效帳號登入後看到生成工具。

---

## Phase 4：User Story 2 - 未登入者不得使用生成服務(P1)

**目標**:未登入直接開生成頁或打生成 API 一律被擋(前端路由 + API guard 雙層)。

### 測試(先寫)

- [ ] T024 [P] [US2] `apps/api/test/jwt.strategy.test.ts`:有效 token 過、過期/竄改/缺 token/帳號停用 → 失敗。
- [ ] T025 [P] [US2] `apps/api/test/slides-auth-protection.test.ts`:未帶 token 呼叫 `POST /preview`、`POST /preview-jobs`、`GET /preview-jobs/:id` → `401 AUTH_REQUIRED`,且**生成/入列未被觸發**。
- [ ] T026 [P] [US2] `apps/web/.../protected-route.test.tsx`:未登入訪問受保護路由 → 導 `/login`;記住 intended path;401 攔截清 token。

### 實作

- [ ] T027 [US2] `apps/api/src/modules/auth/jwt.strategy.ts` + `jwt-auth.guard.ts`(`AuthGuard("jwt")`,validate 再查 allowlist active)。
- [ ] T028 [US2] `apps/api/src/modules/auth/auth.controller.ts` 新增 `GET /api/auth/me`(`@UseGuards(JwtAuthGuard)`)。
- [ ] T029 [US2] 在 `apps/api/src/modules/preview-jobs/preview-jobs.controller.ts` 對三個端點套 `@UseGuards(JwtAuthGuard)`(在 rate-limit 之外);`PreviewJobsModule` import `AuthModule`(取得 guard 所需 provider)。
- [ ] T030 [US2] 前端:`ProtectedRoute.tsx`(未登入導 /login + intended path);`auth-client.ts` 對受保護請求帶 `Authorization`、攔 401 清 token;`preview-job-polling.ts` 帶 token。

**Checkpoint**:US2 可獨立展示:未登入無法用生成,直接打 API 也擋。

---

## Phase 5：User Story 3 - 登出與錯誤處理(P2)

**目標**:登出清狀態、錯誤訊息安全一致、多分頁即時同步。

### 測試(先寫)

- [ ] T031 [P] [US3] `apps/api/test/auth.controller.test.ts` 擴充:`POST /api/auth/logout` 回 `204`(stateless)。
- [ ] T032 [P] [US3] 前端 `auth-provider.test.tsx` 擴充:登出清 localStorage + 導 /login;模擬 `storage` 事件 → 其他分頁即時轉未登入(FR-012)。
- [ ] T033 [P] [US3] 錯誤訊息測試:帳號不存在/密碼錯/停用 → 一致 `AUTH_INVALID`,不揭露帳號存在性(FR-005)。

### 實作

- [ ] T034 [US3] `auth.controller.ts` 新增 `POST /logout`(204);`auth-client.ts` logout(先清本機再呼叫)。
- [ ] T035 [US3] `AuthProvider.tsx` 加 `window` `storage` 事件監聽,跨分頁同步登出/失效。
- [ ] T036 [US3] 前端錯誤呈現:登入失敗/失效統一安全文案(i18n key),不洩漏內部分類。

**Checkpoint**:US3 可獨立展示:登出、錯誤、失效、多分頁四種狀態正確。

---

## Phase 6：Polish(驗證、E2E、文件)

- [ ] T037 `apps/api/test/auth-module-bootstrap.test.ts`:用 `@nestjs/testing` 驗證 `AuthModule`/`AppModule` 能解析 `LocalStrategy`、`JwtStrategy`、guards、controller(**確認 Passport 在 tsx 下 DI 正常**,比照先前 metadata 雷)。
- [ ] T038 `apps/web/tests/e2e/auth-gated-preview.spec.ts`:Playwright,未登入被擋 → 登入 → 生成 happy path smoke(SC-006)。
- [ ] T039 執行全套:`pnpm -r test`、各 `tsc --noEmit`、登入後既有 preview smoke,確認全綠。
- [ ] T040 [P] 更新 `specs/005-user-auth-jwt/quickstart.md` evidence;README(中/英)補登入設定(`AUTH_*` env、`auth:hash`)與「登入後才能用」說明。

---

## Dependencies & 執行順序

- Setup(T001–T004)→ Foundational(T005–T014)阻塞所有 story。
- US1(T015–T023)為 MVP;US2(T024–T030)依賴 US1 的 AuthModule/JWT 簽發 + Foundational;US3(T031–T036)依賴 US1/US2。
- Polish(T037–T040)最後。
- T004(搬 RateLimitGuard)需在 T020(login 套 guard)之前。

## 平行建議

- 同 story 內標 [P] 測試可平行(不同檔)。
- domain(T008–T010)、contracts(T011)、config(T012)可平行起草。
- 前端與後端任務多數可平行(契約已定於 contracts/auth-api.md)。

## MVP 範圍

- 最小可交付:Setup + Foundational + US1 → 有效帳號登入並進入生成工具。
- 完整保護:加 US2(未登入全擋)。
- 完整體驗:加 US3(登出/錯誤/多分頁)。
