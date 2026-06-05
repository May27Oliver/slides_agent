# Implementation Plan: User Auth JWT

**Branch**: `005-user-auth-jwt` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-user-auth-jwt/spec.md`

## Summary

為網站加入 005 v1 的登入保護：站方預先設定可使用服務的帳號，使用者先登入才能進入 HTML 簡報生成工具或呼叫任何會建立／查詢 preview job 的 API。API 端驗證帳號憑證後簽發長效 JWT；前端將 JWT 存在 `localStorage`，以維持同一瀏覽器的長時間登入。所有生成相關入口套用 auth guard，未登入或登入失效時拒絕並讓前端回到登入流程。005 不加入公開註冊、忘記密碼、RBAC、帳號後台、billing 或第三方登入。

**Artifact Language**: 本 plan 與相關 Spec Kit artifacts 使用繁體中文；domain model、schema keys、API field names、code identifiers 使用 English。

## Technical Context

**Language/Version**: TypeScript on Node.js `v20.19.5`

**Package Manager**: pnpm `10.30.3`，workspace 於 `apps/*` 與 `packages/*`。

**Primary Dependencies**: React + TypeScript frontend、NestJS API、shared domain/contracts packages、既有 preview job API。**新增**：`@nestjs/passport` + `passport` + `passport-jwt` + `passport-local` + `@nestjs/jwt`(走 Passport 生態,兩個 strategy:LocalStrategy 登入 + JwtStrategy 保護;為未來 OAuth/多策略產品化鋪路,見 research.md),devDeps `@types/passport-jwt`、`@types/passport-local`。密碼雜湊 v1 使用 Node.js 內建 `crypto.scrypt` / `timingSafeEqual`(未來可換 bcrypt/argon2),並提供一個 pnpm script(`auth:hash`)用同樣的 scrypt 參數產生 `passwordHash`。**前端新增** `react-router-dom`(受保護路由 + 登入導向)。登入端點 `POST /api/auth/login` **重用既有 `RateLimitGuard`**(per-IP 節流,FR-011),不新增節流套件。注意:app 跑在 tsx(無 decorator metadata),Passport strategy/guard 等 provider 一律顯式 `@Inject`。

**Storage**: v1 不新增資料庫。授權帳號由後端 runtime configuration 提供（例如環境變數中的帳號 allowlist 與 password hash）。登入狀態由 stateless JWT 表示；前端依使用者要求存在 `localStorage`。不引入 Redis session store；004 Redis/BullMQ 僅供 preview jobs 使用。

**Testing**: TDD。Domain auth policy tests、API auth contract/integration tests、controller guard tests、frontend auth state/localStorage/route guard tests、Playwright login-to-generate smoke test。既有 preview job 和 rendering tests 只在登入後 smoke 驗證，不重測生成品質。

**Target Platform**: 本機開發與上線 web app。API 與 worker 仍依 004 架構運行；frontend 為 Vite React SPA。

**Project Type**: React frontend + NestJS API + shared domain/contracts packages。

**Performance Goals**:

- 有效帳號使用者 30 秒內完成登入並看到生成工具。
- 登入驗證在正常本機／部署條件下讓使用者感知為即時回應（目標 p95 < 500ms）。
- 每個受保護生成 API 的 auth check 不應對 preview job 建立／輪詢造成可感知延遲（目標額外開銷 < 50ms）。
- 登入後重新整理頁面不應重新呼叫生成流程或遺失正在輪詢的 job 狀態。

**Constraints**:

- JWT 必須依使用者要求存在 browser local storage 以維持長時間登入；plan 必須明確記錄 XSS 風險與防護。
- 不將登入 token、密碼、password hash、JWT secret、帳號 allowlist 或 auth failure 內部分類送入 LLM provider、preview result、review report 或使用者可見錯誤。
- 未登入不得建立 preview job、查詢 preview job 狀態、取得 preview result、執行同步 preview 或下載生成 HTML。
- 005 不改變既有 GeneratePreviewRequest/PreviewJob successful result shape；只新增 auth endpoints 與 protected access requirement。
- 站方帳號設定為 backend runtime configuration；前端不得硬編任何有效帳號或 secret。
- generated HTML preview iframe 必須維持 sandbox 且不得取得 parent origin/storage；JWT 不得注入 `srcDoc` 或 downloaded HTML。

**Scale/Scope**:

- v1 目標為少量受邀使用者或站方自用，帳號數預期 1-20。
- 權限模型只有 authenticated / unauthenticated；無角色、組織、團隊、quota 或 billing。
- JWT 有效期預設 30 天，可由後端設定調整；到期後必須重新登入。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification First**: PASS。Accepted source 為 [spec.md](./spec.md)。無 `[NEEDS CLARIFICATION]` marker；v1 合理預設為站方預先設定帳號、無公開註冊、長效 local JWT。
- **Behavior-Driven User Value**: PASS。三個 user stories 均有 Given/When/Then，可獨立展示登入、未登入阻擋、登出與失效。
- **Source Fidelity**: PASS。005 不改變生成內容，只限制誰能啟動或查看生成流程；既有來源事實保真規則維持不變。
- **Reviewable Generation**: PASS。005 不改變 review report；登入狀態與 auth details 不進入 generation artifacts。
- **Web-First Deliverable**: PASS。self-contained HTML slides 仍為成功產物；登入只保護 web app 與 API 使用。
- **Backend-Configured LLM Boundary**: PASS。provider/model 仍為 backend config；auth token/credentials 永不送入 LLM。
- **Coherent Deck Design System**: PASS。005 不改 design planning 或 deck design system。
- **Semantic Titles and Data Visualization**: PASS。005 不改 semantic title 或 charting rules。
- **Code Quality and Simplicity**: PASS WITH JUSTIFIED COMPLEXITY。新增複雜度限於 auth domain types/policy、API JWT adapter/guard/controller、frontend auth provider/login screen/auth fetch wrappers。拒絕更複雜的 DB-backed users、refresh token rotation、RBAC、OAuth、email flow，因 v1 只需限制少量使用者。所有新增構件有當前消費者：AuthGuard 保護 SlidesController；AuthController 被 LoginForm 使用；AuthProvider 被 App/route guard 使用。
- **TDD and DDD**: PASS。首批 failing tests：auth policy 檢查 active account / sanitized failure、JWT service sign/verify/tamper/expiry、AuthController login/me failure contract、SlidesController protected endpoints 401、frontend localStorage persistence/logout/401 handling、Playwright login-to-preview smoke。
- **Lean Test Scope**: PASS。測試聚焦登入與保護入口，不重複 002/003/004 的 rendering、queue、worker details。
- **Consistent UX and Language**: PASS。統一用語：登入、登出、登入狀態、未授權、登入已失效、重新登入。
- **Performance and Operational Evidence**: PASS。登入與 auth check 目標明確；evidence 包含 auth tests、manual quickstart、多分頁與過期驗證。
- **Manual Verification Path**: PASS。quickstart 包含乾淨瀏覽器、重新整理、關閉重開、多分頁登出、token 到期/竄改、受保護 URL 直連、登入後生成 smoke。
- **Release Verification**: PASS。登入後仍需跑 preview smoke，確認 slide JSON schema、HTML rendering、keyboard navigation、responsive behavior 不受 auth 影響。

## Project Structure

### Documentation (this feature)

```text
specs/005-user-auth-jwt/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-api.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── modules/auth/
│   │   │   ├── auth.controller.ts            # /api/auth/login|me|logout
│   │   │   ├── auth.module.ts                # imports PassportModule + JwtModule.register
│   │   │   ├── auth.service.ts               # 驗證 credential + 簽發 JWT(JwtService)
│   │   │   ├── local.strategy.ts             # passport-local LocalStrategy(登入驗帳密)
│   │   │   ├── local-auth.guard.ts           # extends AuthGuard("local")(套在 POST /login)
│   │   │   ├── jwt.strategy.ts               # passport-jwt JwtStrategy(validate → req.user)
│   │   │   ├── jwt-auth.guard.ts             # extends AuthGuard("jwt")(套在受保護端點)
│   │   │   ├── auth.tokens.ts
│   │   │   └── configured-user-account-store.ts
│   │   ├── config/
│   │   │   └── auth.config.ts
│   │   └── modules/slides/
│   │       └── slides.controller.ts        # add AuthGuard to preview endpoints
│   └── test/
│       ├── auth.controller.test.ts
│       ├── local.strategy.test.ts
│       ├── jwt.strategy.test.ts
│       ├── jwt-auth.guard.test.ts
│       ├── auth-config.test.ts
│       └── slides-auth-protection.test.ts
└── web/
    ├── src/
    │   ├── features/auth/
    │   │   ├── AuthProvider.tsx            # auth state + storage-event 跨分頁同步
    │   │   ├── LoginView.tsx
    │   │   ├── ProtectedRoute.tsx          # 未登入 → 導向 /login(記住 intended path)
    │   │   ├── auth-client.ts              # login/me/logout + 401 攔截清 token
    │   │   ├── auth-storage.ts
    │   │   └── auth.types.ts
    │   ├── features/slide-generation/
    │   │   └── preview-job-polling.ts      # attach Authorization header
    │   ├── App.tsx                         # react-router routes + ProtectedRoute
    │   └── main.tsx                        # wrap with BrowserRouter + AuthProvider
    └── tests/
        └── e2e/
            └── auth-gated-preview.spec.ts

scripts/
└── auth-hash.ts                           # pnpm auth:hash:用 scrypt 產生 passwordHash

packages/
├── domain/
│   ├── src/auth/
│   │   ├── auth.types.ts
│   │   ├── user-account-store.port.ts
│   │   └── auth-policy.service.ts
│   └── test/auth/
│       └── auth-policy.service.test.ts
└── contracts/
    ├── src/auth.ts
    └── test/auth-contract.test.ts
```

**Structure Decision**: Auth 是獨立 bounded context，不放進 slides domain。Domain package 定義帳號、session、failure 與 policy；API module 實作 runtime-configured user store、JWT sign/verify、Nest guard 與 `/api/auth/*` endpoint；web feature 管理 localStorage token、登入畫面、auth-aware fetch wrapper。SlidesController 只套 guard，不混入登入邏輯。

## Complexity Tracking

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------------|------------|-------------------------------------|
| JWT + localStorage | 使用者明確要求長時間登入存在 local；SPA 需要在重新整理後保留登入狀態 | HttpOnly cookie/session 較安全但違反本次明確要求；memory-only token 重新整理即失效 |
| Passport 生態(`@nestjs/passport`/`passport-jwt`/`@nestjs/jwt`,4 個套件) | 使用者決定走 Passport 標準路線以利未來 OAuth/多登入產品化;擴充只需加 strategy | `jose` + 自刻 guard 依賴最少且足夠 v1,但加社群登入時要重造 strategy plumbing;在「想多產品化」前提下不划算 |
| Auth bounded context | 登入會跨 API、web、contracts、domain policy；獨立 auth module 可避免污染 slides generation logic | 直接塞進 SlidesController 較快，但會混合登入、rate limit、preview job orchestration |
| Runtime-configured user store | v1 需要限制少量使用者，且不想引入 DB/user admin | DB-backed users/管理後台是未證實需求，會超出 005 v1 |

## Evidence Plan

- **Automated Evidence**: auth policy tests、auth contract tests、JWT sign/verify/expiry/tamper tests、AuthGuard protection tests、SlidesController unauthorized tests、frontend AuthProvider/localStorage/logout/401 tests、Playwright auth-gated preview smoke。
- **Manual Verification**: clean browser login、reload persistence、close/reopen browser、logout、multi-tab logout、expired/tampered token、direct protected URL、login-to-preview generation。
- **Operational Evidence**: login success/failure sanitized logs、401/403 behavior、token expiry behavior、protected endpoint coverage list、XSS/localStorage risk note。
- **Decision Evidence**: research.md records localStorage JWT tradeoff, rejected HttpOnly cookie/session for v1 due explicit user request, rejected DB users/RBAC/OAuth, selected runtime-configured account allowlist.

## Phase 0 Research Output

See [research.md](./research.md)。

## Phase 1 Design Output

See [data-model.md](./data-model.md)、[contracts/auth-api.md](./contracts/auth-api.md)、[quickstart.md](./quickstart.md)、[auth-flow.md](./auth-flow.md)。

## Post-Design Constitution Check

PASS。Phase 1 artifacts preserve 005 boundaries：只新增登入、登出、本機長效登入狀態與 protected generation access；不新增 public registration、RBAC、user admin、password reset、third-party login、billing 或生成結果 contract 變更。JWT/localStorage 風險已記錄並以 CSP/XSS hygiene、iframe sandbox、token 不注入 generated HTML、401 清除本機狀態、登出清除作為 v1 mitigation。所有新增 domain/module/frontend artifacts 均有當前消費者與測試路徑。
