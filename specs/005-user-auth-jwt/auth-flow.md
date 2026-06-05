# Auth Flow: User Auth JWT

> 005 登入相關流程圖,作為設計參考。對應 [spec.md](./spec.md)、[plan.md](./plan.md)(方案 C:Passport `LocalStrategy` 登入 + `JwtStrategy` 保護、`@nestjs/jwt` 簽發、帳號 allowlist、JWT 存 localStorage)、[contracts/auth-api.md](./contracts/auth-api.md)、[data-model.md](./data-model.md)。
>
> 狀態:規劃中(specify + plan 完成,尚未實作)。

## A. 登入(POST /api/auth/login)

```
[使用者] 在 LoginView 輸入 username / password
   │
   ▼ POST /api/auth/login { username, password }
[API] @UseGuards(RateLimitGuard, AuthGuard("local"))   ← 先 per-IP 節流(FR-011),再驗帳密
   │
   ▼ LocalStrategy.validate(username, password)
   │     ├─ ConfiguredUserAccountStore 查 allowlist(username 正規化)
   │     ├─ 帳號不存在 / inactive ─────────────┐
   │     └─ scrypt + timingSafeEqual 比對密碼 ──┤ 任一失敗
   │                                            ▼
   ▼ 通過 → req.user = { id, username, displayName }   401 { code:"AUTH_INVALID",
[AuthController.login]                                       message:"Login failed." }
   │  AuthService 用 JwtService 簽 JWT(sub=id, exp=+30d)   (帳號不存在/密碼錯/停用 → 訊息一致)
   ▼ 200 { token, expiresAt, user{ id, username, displayName } }
[前端] auth-storage 寫入 localStorage:{ token, expiresAt, user }
   └─▶ AuthProvider → authenticated → 導回原本想去的頁(或生成頁)
```

## B. 受保護請求 + 失效處理(/api/slides/* 與 /api/auth/me)

```
[前端] 呼叫受保護 API,auth-client 自動帶 Header:
        Authorization: Bearer <token>(從 localStorage)
   │
   ▼
[API] @UseGuards(AuthGuard("jwt"))   ← 在 expensive 生成 / 入列之前先擋
   │
   ▼ JwtStrategy
   │   ├─ ExtractJwt fromAuthHeaderAsBearerToken
   │   ├─ JwtService 驗章 + exp(過期 / 竄改 / 缺 token → 失敗)
   │   └─ validate(payload):再查 allowlist 該帳號 active?
   │         (簽章有效但帳號已停用 → 視為失效)
   │
   ├─ 通過 → req.user 注入 → 進入 controller(preview / preview-jobs …)
   │
   └─ 失敗 → 401 { code:"AUTH_REQUIRED", message:"Login required." }
                │
                ▼ 前端攔到 401
                  清除 localStorage → AuthProvider → unauthenticated
                  → 導回登入頁(提示「登入已失效,請重新登入」)
```

## C. 重新整理 / 重開瀏覽器後還原登入(長效登入,react-router)

```
[App 啟動 / 重新整理] (react-router)
   │
   ▼ AuthProvider 讀 localStorage
   ├─ 無 token ───────────────────────────▶ ProtectedRoute 導向 /login
   └─ 有 token
        │ (可選) GET /api/auth/me  Authorization: Bearer <token>
        ▼
        ├─ 200 { authenticated:true, user } ─▶ 維持登入,進入受保護路由(生成工具)
        └─ 401 ─────────────────────────────▶ 清 localStorage → 導向 /login
   (未登入直接開受保護深層網址 → 導 /login,登入成功後導回原本 intended path)
```

## C2. 跨分頁同步(storage 事件)

```
[分頁 A] 登出 / 收到 401 → 清 localStorage
   │  瀏覽器對「其他分頁」觸發 window 'storage' 事件
   ▼
[分頁 B] AuthProvider 監聽到 storage 事件 → token 不見了
   └─▶ 即時轉未登入 → ProtectedRoute 導向 /login(不需等下次 API 呼叫)
```

## D. 登出(POST /api/auth/logout)

```
[使用者] 點登出
   │
   ├─ 前端先清 localStorage(token / user)→ AuthProvider unauthenticated
   ▼
   POST /api/auth/logout (Bearer) → 204(stateless 確認;server 不存 session)
   │
   ▼ 導回 LoginView

註:JWT 為 stateless,server 端不主動撤銷;真正失效靠 token 過期 + 每次請求的帳號 active 檢查
   (server-side revocation 已 deferred,見 research.md)。
```

## E. 狀態機(對應 data-model.md)

```
                 login_success
unauthenticated ───────────────▶ authenticated
       ▲                              │
       │ login_failure                │ logout / token_expired
       │ (留在登入頁)                  │ / token_invalid / account_disabled
       └──────────────────────────────┘
                 (清 localStorage,回 unauthenticated)
```

## 安全設計對照(spec / plan)

- **未登入一律擋**:前端 route guard **＋** API `AuthGuard("jwt")` 雙層;直接打 API 也擋(FR-002 / FR-007)。
- **錯誤訊息一致**:帳號不存在 / 密碼錯 / 停用 → 一律 `AUTH_INVALID`,不洩漏帳號是否存在(FR-005)。
- **token 不外洩**:JWT 絕不進 generated HTML / 下載檔 / preview result / log;iframe 維持 sandbox(plan Constraints)。
- **長效登入取捨**:localStorage 有 XSS 風險;mitigation = 401/登出都清 token、token 不注入 HTML、CSP + 手動驗證(research.md)。
- **登入節流**:`POST /api/auth/login` 套 per-IP `RateLimitGuard` 擋暴力試密碼(FR-011)。
- **跨分頁同步**:`storage` 事件監聽,一分頁登出/失效,其他分頁即時跳未登入(FR-012)。
- **provider/model 邊界**:auth token/credentials 永不送入 LLM provider(CR-004)。

## 涉及的元件(plan 結構)

| 層 | 元件 |
|----|------|
| API | `auth.controller`、`auth.service`、`local.strategy` / `local-auth.guard`、`jwt.strategy` / `jwt-auth.guard`、`configured-user-account-store`、`auth.config`(`JwtModule.register`)|
| domain | `auth.types`、`user-account-store.port`、`auth-policy.service` |
| contracts | `auth.ts`(login/me/logout 形狀)|
| web | `AuthProvider`、`LoginView`、`auth-client`、`auth-storage` |
| 既有 | `SlidesController`(preview / preview-jobs)套上 `AuthGuard("jwt")` |
