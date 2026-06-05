# Research: User Auth JWT

**Feature**: 005-user-auth-jwt  
**Date**: 2026-06-03

## Decision: 採 runtime-configured account allowlist，不新增使用者資料庫

**Rationale**: 005 的目的只是「上線後不是每個人都能用」，不是完整帳號產品。站方預先設定少量帳號即可滿足 v1，並保持部署與測試簡單。

**Alternatives considered**:

- **資料庫 users table**: 可支援動態停用與未來管理後台，但 005 沒有管理 UI 或自助註冊需求，會增加 migration、seed、管理流程與測試成本。
- **單一 shared password**: 最簡單，但缺少使用者識別，無法在 evidence 中知道是哪個授權使用者操作。
- **第三方 OAuth**: 安全成熟，但會引入 provider 設定、redirect URI、callback、外部帳號依賴，超出 v1。

## Decision: JWT 存在 browser localStorage，預設長效 30 天

**Rationale**: 使用者明確要求「JWT 存在 local，以維持長時間登入」。前端可在 reload / close-reopen 後讀取 token 並恢復登入狀態。

**Security note**: OWASP resources note that browser local/session storage is accessible to JavaScript and can be exposed by XSS. 005 接受此 v1 取捨，但必須以嚴格 XSS hygiene、避免 token 進入 generated HTML、iframe sandbox、logout clear、401 clear、CSP/manual verification 作為 mitigation。

**Alternatives considered**:

- **HttpOnly secure cookie session**: 較能防止 JavaScript 讀取 token，但不符合本次明確 local JWT 要求，且需 CSRF 策略。
- **Memory-only access token + refresh cookie**: 安全性較佳但實作複雜，且 reload 後需 refresh flow，超出 005 v1。
- **sessionStorage**: 降低長期殘留但關閉瀏覽器即失效，不符合「長時間登入」。

## Decision: 採 NestJS Passport 生態(`@nestjs/passport` + `passport-jwt` + `@nestjs/jwt`)

**Rationale**: **走 Passport 標準路線以利未來產品化**——之後要加 Google/GitHub 等 OAuth 社群登入、多登入策略或更完整的帳號產品時,Passport 是 Nest 官方主推、生態成熟,擴充只是新增 strategy 而非重寫 guard。v1 採**兩個 strategy**(Nest 官方教科書結構):

- **LocalStrategy**(`passport-local`):登入 `POST /api/auth/login` 用 `AuthGuard("local")` → `LocalStrategy.validate(username, password)` 驗證帳密 → 通過後由 `AuthService` 以 `JwtService` 簽發 JWT。
- **JwtStrategy**(`passport-jwt`):受保護端點用 `AuthGuard("jwt")` → 從 Bearer 取 token、`JwtService` 驗章/`exp` → 查 allowlist active → 放行並填入 `req.user`。

`@nestjs/jwt` 負責 JWT 簽發/驗證(`exp`/`iat`/簽章)。密碼雜湊 v1 先用 Node.js `crypto.scrypt` + `timingSafeEqual`(未來要更標準可換 bcrypt/argon2)。

**Implementation note**: 本專案跑在 `tsx`(esbuild,**不 emit decorator metadata**),所以 `JwtStrategy` 等 provider 的建構子注入一律顯式 `@Inject`(與既有 codebase 一致);`AuthGuard("jwt")` 是 mixin、不需 metadata。`/tasks` 與實作時須加一個 bootstrap smoke 確認 Passport guard/strategy 在 tsx 下解析正常(比照先前 Swagger 踩到的 metadata 問題)。

**Alternatives considered**:

- **`jose` + 自刻 AuthGuard(原 v1 選項)**: 依賴最少、足夠 v1,但要加 OAuth/多策略時得自行重造 strategy plumbing;在「想多產品化」前提下,前期省的會在後期還回去,故改採 Passport。
- **`@nestjs/jwt` + 自刻 guard(不含 Passport)**: 介於兩者之間;但仍缺 strategy 抽象,擴充社群登入時不如 Passport 直接。
- **手刻 JWT / `jsonwebtoken`**: 安全風險高或 ESM/typed ergonomics 不佳。
- **bcrypt dependency**: v1 用 Node crypto 已足夠;未來可換。

## Decision: AuthGuard 保護所有生成相關 endpoints

**Rationale**: 保護 UI route 不足以防止直接 API 呼叫消耗生成資源。API 必須在 controller/guard 層拒絕未登入的 preview、preview-jobs create/status/result access。

**Alternatives considered**:

- **只在前端 route guard**: 容易被直接 API request 繞過，不符合 FR-002/FR-007。
- **只保護 POST create，不保護 GET status**: 未授權者仍可能輪詢或取得 result；所有 preview job 讀寫都應保護。

## Decision: 登出採 client clear；server-side revocation deferred

**Rationale**: v1 JWT stateless，無 session store。登出清除 localStorage token 即可讓使用者本機回到未登入狀態；伺服器端失效以 token expiry 與 account active check 控制。

**Alternatives considered**:

- **JWT denylist / Redis revocation**: 可立即撤銷已簽發 token，但引入 session state，複雜度高；若未來需要強制撤銷可另開 spec。
- **短 access token + refresh token rotation**: 安全性更佳，但超出「先做好登入」v1。
