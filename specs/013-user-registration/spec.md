# Feature Specification: 使用者自助註冊（管理員審核制，無 email 驗證）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `013-user-registration`

**Created**: 2026-06-10

**Status**: Draft

**Input**: 「規劃 013 註冊功能，參考 NestJS 註冊 best practice」。

**澄清第一輪（2026-06-10）**：①閘門＝**管理員審核**（任何人可送註冊，進來為 pending，管理員核准後才能登入）；②**不做 email 驗證**（不引進寄信基礎設施）；③範圍＝**前端 + 後端都做**。

**澄清第二輪（2026-06-10）**：①審核 UI＝**完整的使用者管理 dashboard**（列出所有 user + 動作，非僅待審清單）；②密碼政策＝**最小 10 字、含字母+數字**；③重複 email＝**明說「已被使用」**；④admin＝**可在 dashboard 升/降**（env 僅 bootstrap，DB 為即時真實狀態）；⑤停用＝**即刻全站踢出**（每請求伺服器端再驗證）。

---

## 背景與現況（為什麼這是個有風險的變更）

目前（feature 005）帳號是**刻意封閉的 allowlist**：只能由後端 `AUTH_ACCOUNTS`（env）宣告、經 `migrate`/seed upsert 進 `accounts` 表。本 feature **開放自助註冊**，等於把帳號來源從「純後端宣告」擴張為「外部使用者也能新增」。為守住原本的安全姿態，採**管理員審核**：自助註冊只能產生 **`status='pending'`** 帳號，**唯有管理員核准（`status='active'`）才能登入**。

**槓桿既有實作**（降低新碼面）：
- `accounts` 表已有 `active boolean`、`evaluateLogin()`/`evaluateSession()` 已擋非 active 帳號、`jwt.strategy` 已每請求 DB 再驗證 → 「擋未核准帳號」與「即時停用」的骨架現成；本 feature 把這層的 `active boolean` 升級為 `status` 三態（pending/active/disabled，見 Key Entities），並新增「建立 pending」「管理員審核」兩端與 UI 對應訊息。
- `hashPassword`/`verifyPassword`（scrypt）現成；`DbUserAccountStore` 即時查 DB；contracts 有 `validateLoginRequest` 慣例可仿。

**與既有 allowlist 的調和（單一真實來源，避免 drift）**：
- `AUTH_ACCOUNTS`（env）＝**bootstrap** 帳號來源（含初始管理員，擴充 `isAdmin` 旗標）；seed 照舊 upsert，且**只 upsert env 列出的、不刪除其他列** → 自助註冊進來的 DB 帳號不受 reseed 影響。
- **自助註冊**＝寫進 `accounts` 表、`status='pending'`、`isAdmin=false` 的 DB 帳號。
- **帳號的即時狀態（`status`/`isAdmin`）以 DB 為唯一真實來源**：env 只負責 bootstrap，之後管理員在 dashboard 的核准／停用／升降權都直接改 DB（FR-010/019）。為避免矛盾，**seed 對 `status`/`isAdmin` 只在「初次建立該 env 帳號」時套用 env 值；對既有列（conflict）只更新身分/憑證欄（`username`/`displayName`/`passwordHash`），不再覆蓋 `status`/`isAdmin`**（見 FR-020 與 Clarifications #8）。如此 reseed 不會把 dashboard 的改動改回去；旋轉 env admin 的密碼仍會生效。
- 兩者共用同一張 `accounts` 表與同一條登入路徑；差別只在「初始來源」。

---

## 參考的 NestJS 註冊 Best Practices（本 spec 遵循）

1. **邊界輸入驗證**：`POST /api/auth/register` 在進入服務前以契約驗證器（仿 `validateLoginRequest`）驗 email 格式、必填、長度上限、密碼強度——不信任任何外部輸入。
2. **強雜湊、永不存明文**：沿用既有 scrypt `hashPassword`；DB 只存 `passwordHash`，回應與日誌**永不**含明文或 hash。
3. **唯一性以 DB 約束把關**：`username` 唯一（大小寫正規化）；重複註冊回 **409**，不可建立重複帳號（防 race 用 DB unique constraint，而非僅應用層檢查）。
4. **不自動登入未核准帳號**：註冊**不**簽發 JWT、**不**自動登入（帳號尚 pending）。回「已收到、待審核」狀態。
5. **最小公開資訊**：註冊／核准的回應只含 public-safe 欄位（`id`/`username`/`displayName`/`status`/`isAdmin`），**不**回 `passwordHash` 等內部欄位。
6. **節流防濫用**：register 端點套用 per-IP rate limit（仿既有 `LoginRateLimitGuard` 模式）。
7. **最小權限**：審核屬**管理員專屬**能力，以 admin guard 保護；一般登入者存取回 403。
8. **可關閉**：提供 `REGISTRATION_ENABLED` 開關（預設開）讓維運者能一鍵停掉公開註冊而不需改碼。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 訪客自助註冊，建立待審核帳號（Priority: P1）🎯 MVP

訪客在註冊頁填 email、顯示名、密碼並送出。系統驗證後建立一個 **`status='pending'`** 帳號，回覆「註冊成功，等待管理員核准」。此時**還不能登入**。

**Why this priority**：這是「註冊功能」的核心切片——沒有它就沒有自助加入。即使 US2/US3 尚未完成，本切片已能獨立示範「外部使用者能把自己登記進系統（待審）」。

**Independent Test**：對 `POST /api/auth/register` 送合法 body → 回 201 + public-safe 帳號（`status:"pending"`）；DB `accounts` 多一列 `status='pending'`、`passwordHash` 為 scrypt、無明文；用該帳密打 `POST /api/auth/login` → 被擋（pending）。前端註冊頁送出後顯示「待審核」訊息。

**Independent Demo**：開註冊頁 → 填表送出 → 看到「待審核」成功畫面 → DB 出現該 pending 帳號。

**Acceptance Scenarios**：

1. **Given** 註冊開啟且 email 未被使用，**When** 送出合法的 email/顯示名/合規密碼，**Then** 回 201、建立 `status='pending'` 帳號、回應只含 public-safe 欄位、且**未**簽發 JWT。
2. **Given** email 已存在（含既有 env 帳號或先前註冊），**When** 再次以該 email 註冊，**Then** 回 409，**不**建立重複帳號。
3. **Given** 密碼不符強度政策或 email 格式錯誤，**When** 送出，**Then** 回 400 並指出問題欄位，不建立帳號。
4. **Given** 一個剛註冊的 pending 帳號，**When** 用正確帳密登入，**Then** 登入被拒（pending／inactive），**不**發 token。
5. **Given** 短時間內同一 IP 大量送註冊，**When** 超過上限，**Then** 被 rate limit 擋（429）。

---

### User Story 2 - 管理員的使用者管理後台（dashboard）（Priority: P2）

管理員（env 宣告、`isAdmin=true`）在一個**受保護的後台頁面**看到**所有使用者的清單**（一個表格 dashboard），每列顯示 email／顯示名／**狀態（pending 待審核／active 已啟用／disabled 已停用）**／**是否 admin**／註冊時間，並可依狀態篩選。針對每個使用者，管理員可執行對應動作：

- **核准** pending → `status='active'`（之後可登入）
- **拒絕** pending → 移除該帳號（email 可重新註冊）
- **停用** active 使用者 → `status='disabled'`（即時撤銷其登入能力）
- **重新啟用** 已停用者 → `status='active'`

這是管理員「從哪裡審核」的答案：**就在這個 dashboard**，審核只是它的其中一個動作；它同時是日常的使用者存取管理介面。

**Why this priority**：US1 把人收進來，但沒有 US2 就沒人能真正進場，也沒有地方管理既有使用者。dashboard 是「管理員審核制」的閉環，也是維運使用者的單一入口。

**Independent Test**：以 admin token 打 `GET /api/admin/users`（可帶 `?status=pending`）→ 回所有／篩選後的使用者 public-safe 摘要；`PATCH .../:id {status:"active"}` → 該帳號可登入；`PATCH .../:id {status:"disabled"}` → 該帳號立即無法再登入；`DELETE .../:id`（pending）→ 被移除。非 admin token 打這些端點 → 403；未登入 → 401。前端以 admin 身分進 `/admin/users` 看到表格與動作按鈕；非 admin 看不到此入口／路由。

**Independent Demo**：訪客先註冊（US1）→ 管理員打開 `/admin/users` dashboard 看到他（狀態＝待審核）→ 按「核准」→ 狀態變「已啟用」→ 該使用者隨即能登入；管理員再對另一個 active 使用者按「停用」→ 對方下次操作被擋。

**Acceptance Scenarios**：

1. **Given** 系統有 env 帳號 + 數個註冊帳號（pending/active/disabled 混合），**When** admin 載入 dashboard，**Then** 回傳**所有**使用者的 public-safe 摘要（`id/username/displayName/status/isAdmin/createdAt`，**不含** hash），可依狀態篩選。
2. **Given** 一個 pending 帳號，**When** admin 核准，**Then** 該帳號 `status='active'`，該使用者用原帳密可成功登入並取得 JWT，dashboard 該列狀態更新為「已啟用」。
3. **Given** 一個 pending 帳號，**When** admin 拒絕，**Then** 該帳號被移除，後續以該帳密登入失敗，且該 email 可重新註冊。
4. **Given** 一個 active 使用者，**When** admin 停用，**Then** 該帳號 `status='disabled'`，其既有登入即時失效（下一個請求被擋），dashboard 顯示「已停用」。
5. **Given** 一個**非** admin 的已登入使用者，**When** 存取任何 `/api/admin/*` 端點或 `/admin/*` 路由，**Then** 後端回 403、前端不顯示入口。
6. **Given** 未帶有效 JWT，**When** 存取審核端點，**Then** 回 401。
7. **Given** 系統有多個 admin，**When** 某 admin 對**另一個（非最後一個）** admin 停用或降權，**Then** **允許**（admin 可互管）。
8. **Given** 只剩一個 admin（或對象就是自己），**When** 嘗試停用／降權該唯一 admin 或自己，**Then** 被擋（回 409 `LAST_ADMIN_PROTECTED`／`CANNOT_MODIFY_SELF`），確保管理權不真空（FR-018）。

---

### User Story 3 - 各狀態的清楚回饋（Priority: P3）

註冊與登入在各種狀態下給使用者清楚、一致（zh-TW）的回饋：待審核、重複 email、密碼太弱、被拒絕／停用。

**Why this priority**：屬體驗打磨；P1/P2 已可運作，但好的狀態訊息降低支援成本、避免使用者卡住。

**Independent Test**：分別觸發 pending 登入、disabled 登入、重複 email 註冊、弱密碼註冊 → 前端顯示對應且不洩漏敏感資訊的訊息；登入頁對 `account_pending` 顯示「帳號待管理員核准」、對 `account_disabled` 顯示「帳號已停用」。

**Acceptance Scenarios**：

1. **Given** pending 使用者嘗試登入，**When** 失敗，**Then** 登入頁顯示「帳號待管理員核准」而非泛用「帳密錯誤」。
2. **Given** 註冊用了已存在 email，**When** 失敗，**Then** 顯示「此 email 已被使用」等可行動訊息（內部工具情境下可揭露存在性；見 Clarifications）。
3. **Given** 密碼不符政策，**When** 失敗，**Then** 即時顯示規則（如最小長度）。

---

### Edge Cases

- 自助註冊用了**既有 env admin** 的 email → 撞唯一約束 → 409（不可借註冊覆蓋 admin）。
- 同一 email 在仍 pending 時重複註冊 → 409（已存在）。
- 管理員核准一個**已是** active 的帳號 → **idempotent no-op，回 200**（FR-010 PATCH，不回 409）；拒絕（DELETE）一個非 pending 帳號 → 409 `CANNOT_REJECT_NON_PENDING`。
- 註冊被 `REGISTRATION_ENABLED=false` 全域關閉 → register 端點回 `403 { code:"REGISTRATION_DISABLED" }`（明確「目前不開放註冊」，非 404）。
- 競態：兩個請求同 email 幾乎同時註冊 → DB unique constraint 確保只成立一筆，另一筆回 409。
- 密碼極長／極短、email 超長 → 由長度上限與強度政策擋下（400）。
- 拒絕後同 email 再註冊 → 應可成立（前一筆已移除）。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**：系統 MUST 提供 `POST /api/auth/register`（公開、免 JWT），接受 `{ username（email）, displayName, password }`。
- **FR-002**：系統 MUST 在邊界以契約驗證器驗證輸入：email 格式、必填、長度上限、**密碼強度政策＝最小 10 字、至少含一個字母與一個數字**；失敗回 400 並標明欄位。
- **FR-003**：合法註冊 MUST 建立一筆 `accounts`：`id`=新生成、`username`=正規化（小寫 trim）、`displayName`、`passwordHash`=scrypt、**`status='pending'`**、`isAdmin=false`、時間戳。
- **FR-004**：`username` MUST 唯一，並以 **DB 唯一約束**把關；重複（含既有 env 帳號）回 **409**，且回應訊息**明說「此 email 已被使用」**（內部工具情境，體驗優先；不得建立重複帳號）。
- **FR-005**：register MUST **不**簽發 JWT、**不**自動登入（帳號 pending）。回應為「已註冊、待審核」+ public-safe 帳號表示。
- **FR-006**：任何註冊／審核回應與日誌 MUST NOT 含 `passwordHash`、明文密碼或其他內部欄位。
- **FR-007**：register 端點 MUST 套用 per-IP rate limit（仿既有登入 rate-limit 模式），超限回 429。
- **FR-008**：僅 `status='active'` 帳號可登入；`pending` 與 `disabled` MUST 被擋。登入評估沿用既有 `evaluateLogin`/`evaluateSession`（改讀 `status`），並回**兩個固定且可區分的 code**：**`account_pending`**（待核准）與 **`account_disabled`**（已停用），供前端顯示不同訊息（不洩漏其他資訊）。舊的 `inactive_account` code **MUST 由這兩個取代**（不再作為對外判斷依據；如需保留則僅作 legacy internal、不得用於 UI 分流）。
- **FR-009**：系統 MUST 引入**管理員角色**：`accounts` 增加 `isAdmin` 欄位（預設 false）。**初始（bootstrap）管理員**由 `AUTH_ACCOUNTS`（env）宣告（擴充該 JSON 形狀加入 `isAdmin`）；自助註冊者恆以 `isAdmin=false` 進來。`isAdmin` 之後**可由管理員在 dashboard 升/降**（見 FR-010），即 admin 身分以 DB 為即時真實狀態、env 僅負責 bootstrap。
- **FR-010**：系統 MUST 提供**管理員專屬**的使用者管理能力，以 admin guard 保護的 `/api/admin/*` 端點群，**契約固定如下**（回應一律 public-safe，**不含** hash）：
  - `GET /api/admin/users?status=pending|active|disabled|all`（預設 `all`）→ `200 { users: PublicAccount[] }`。
  - `PATCH /api/admin/users/:id` body `{ status?: "active"|"disabled", isAdmin?: boolean }`（部分更新、**idempotent**）→ `200 PublicAccount`。語意：核准＝`{status:"active"}`（pending→active）；停用＝`{status:"disabled"}`；重新啟用＝`{status:"active"}`（disabled→active）；升/降 admin＝`{isAdmin:true|false}`。對已是該值者為 no-op（仍回 200，**不**回 409）。
  - `DELETE /api/admin/users/:id` → 拒絕（**僅** `status='pending'` 可刪）→ `204`；非 pending 回 `409 { code:"CANNOT_REJECT_NON_PENDING" }`。
  - 違反 FR-018 的操作回 `409 { code:"LAST_ADMIN_PROTECTED" | "CANNOT_MODIFY_SELF" }`。
  - 找不到 id 回 `404 { code:"ACCOUNT_NOT_FOUND" }`。
- **FR-011**：所有 `/api/admin/*` 端點 MUST 對未登入回 401、對非管理員登入者回 403（最小權限）。
- **FR-012**：核准／重新啟用 MUST 使該帳號之後能以原帳密登入並取得 JWT；拒絕 MUST 使該 email 可重新註冊；停用 MUST 即時使該帳號無法再通過登入。
- **FR-013**：前端 MUST 提供**註冊頁**：表單驗證、送出、與錯誤狀態（重複 email「此 email 已被使用」／弱密碼／註冊已關閉）；與既有 `LoginView` 風格一致、語言一致（zh-TW）。
- **FR-013a**：註冊成功後，前端 MUST 顯示一個**明確的「待管理員審核」確認畫面/訊息**（例如「註冊成功！你的帳號正在等待管理員核准，核准後即可登入。」），並**不**自動登入、**不**導向 app；提供「回登入頁」連結。登入頁對 pending 帳號（code `account_pending`）亦 MUST 顯示「帳號尚待管理員核准」、對 disabled 帳號（code `account_disabled`）顯示「帳號已停用」，而非泛用錯誤（對齊 US3 AC1）。
- **FR-014**：前端 MUST 提供**管理員使用者管理 dashboard**（受保護路由，如 `/admin/users`）：以表格列出所有使用者（email／顯示名／狀態／是否 admin／註冊時間）、可依狀態篩選、每列提供核准／拒絕／停用／重新啟用動作；**僅** `isAdmin` 使用者可見此入口與路由（非 admin 直接導開或 403）。
- **FR-015**：系統 MUST 提供 `REGISTRATION_ENABLED`（預設開）；關閉時 `POST /api/auth/register` MUST 回 **`403 { code:"REGISTRATION_DISABLED" }`**（明確告知、非 404 隱藏），且前端 MUST 隱藏／停用註冊入口。
- **FR-016**：本 feature MUST NOT 引入 email 驗證、寄信服務、密碼重設、OAuth／社群登入或任何新外部基礎設施／npm 套件（除非 plan 另證必要）。
- **FR-017**：`isAdmin` MUST 貫穿以下各層（plan 須逐一處理，否則前端拿不到）：
  - domain `AuthenticatedUser`（`packages/domain/src/auth/auth.types.ts`）、`evaluateSession`/`evaluateLogin` 回傳的 user。
  - contracts `AuthUserContract` → 連帶 `LoginResponseContract`/`MeResponseContract`（`packages/contracts/src/auth.ts`）。
  - 後端 `validateSessionUser`（已每請求查 DB，見現有 `jwt.strategy`）回傳含當下 `isAdmin`。
  - 前端 auth state（`AuthProvider`/stored session/`auth.types.ts`），據此顯示／隱藏 dashboard 入口。
- **FR-017a**：前端 admin 介面可見性 MUST 依**伺服器端即時的 `isAdmin`** 判定：JWT 的 `isAdmin` claim 僅供 UI 初判，任何 `/api/admin/*` 授權 MUST 以 DB 當下值為準（不可只信 token claim，避免降權後舊 token 越權）。降權後，目標使用者下一次 `/api/auth/me` 或任何受保護請求 MUST 反映新狀態（測試須涵蓋）。
- **FR-018**：系統 MUST 防止管理權真空：**最後一個 admin** 不可被取消管理員或停用；管理員**不可對自己**執行停用或取消管理員。違反時回 409 並提示原因。
- **FR-019**：停用與取消管理員 MUST **即時生效（全站踢出／即時降權）**。系統已在每個已驗證請求以 `id` 查 DB 再驗證（現有 `jwt.strategy` → `validateSessionUser`）；本 feature MUST 確保該再驗證讀的是 `status`（非 active 即回 401）並帶出當下 `isAdmin`，且 `/api/admin/*` 以 DB 當下 `isAdmin` 授權。停用／降權後，目標使用者的**下一個請求**即被擋（無需等 JWT 到期、無需 token 黑名單）。
- **FR-020**：seed（`db-seed.ts`/`seedAccounts`）MUST 改為：對 `status`/`isAdmin` **僅在初次建立 env 帳號時**套用 env 宣告值；對既有列只更新 `username`/`displayName`/`passwordHash`，**不覆蓋** `status`/`isAdmin`（讓 dashboard 對 env 帳號的狀態改動不被 reseed 還原）。自助註冊帳號（不在 `AUTH_ACCOUNTS`）完全不受 seed 影響。

### Key Entities

- **Account（既有 `accounts` 表，擴充）**：`id`、`username`(unique)、`displayName`、`passwordHash`、**`status`**（新增，三態：見下）、**`isAdmin`（新增，預設 false）**、`createdAt`/`updatedAt`。自助註冊與 env 宣告共用此表。
- **帳號狀態模型（三態，取代 `active` 一值兼二義）**：
  - `pending`：自助註冊尚待管理員核准；**不可登入**。
  - `active`：已核准／正常；**可登入**。
  - `disabled`：曾啟用後被管理員停用；**不可登入**。
  - 「拒絕（reject）」**不是**一個狀態——拒絕＝**刪除該 pending 列**（Clarifications #2），email 可重註冊。
  - **登入閘門**：僅 `status === 'active'` 可登入；`pending`/`disabled` 由 `evaluateLogin`/`evaluateSession` 擋下並回對應 code（`pending` → 前端顯示「待管理員核准」；`disabled` → 「帳號已停用」）。
  - **既有 `active:boolean` 的銜接**：migration 將既有 `active=true`→`status='active'`、`active=false`→`status='disabled'`（既有資料無 pending）；domain `UserAccount`/`evaluateLogin`/`evaluateSession` 由讀 `active` 改讀 `status`（plan 決定保留 `active` 為衍生欄或完全以 `status` 取代）。
  - **dashboard 篩選**：`?status=pending|active|disabled|all`；顯示徽章：待審核／已啟用／已停用（＋`isAdmin` → 管理員）。
- **RegisterRequest（新契約）**：`{ username（email）, displayName, password }`；對應一個 `validateRegisterRequest` 驗證器（仿 `validateLoginRequest`）。
- **PublicAccount（新 public-safe 表示）**：`{ id, username, displayName, status, isAdmin, createdAt }`（`status` ∈ pending|active|disabled）——註冊回應、（admin）dashboard 清單共用；永不含 `passwordHash`。登入／`/me` 的 `AuthUserContract` 至少含 `{ id, username, displayName, isAdmin }`（登入者必為 active，故其 `status` 隱含）。dashboard 以 `status`/`isAdmin` 顯示徽章（待審核／已啟用／已停用／管理員）。

---

## Success Criteria *(mandatory)*

- **SC-001**：訪客能在前端完成註冊，並在 DB 看到一筆 `status='pending'`、`passwordHash` 非明文的帳號；該帳號此時無法登入。
- **SC-002**：管理員核准後，該使用者能用原帳密登入並取得有效 JWT；端到端（註冊→核准→登入）可獨立示範。
- **SC-003**：重複 email 註冊 100% 回 409 且**零**重複帳號（含並發情境，由 DB unique constraint 保證）。
- **SC-004**：所有註冊／審核回應與伺服器日誌經檢查**無**明文密碼或 `passwordHash`。
- **SC-005**：非管理員或未登入者存取任何 `/api/admin/*` 端點 100% 被擋（403／401）；非 admin 前端看不到 dashboard 入口。
- **SC-006**：`REGISTRATION_ENABLED=false` 時，register 端點一律拒絕、前端不顯示註冊入口。
- **SC-007**：register 端點在超過 per-IP 上限時回 429（與既有登入節流一致）。
- **SC-008**：管理員能在 dashboard 看到**所有**使用者（env + 註冊；pending + active + disabled 三態皆含）並正確顯示狀態；對某使用者執行核准／停用後，狀態於 dashboard 即時更新。
- **SC-009**：系統不允許停用或降權最後一個 admin、亦不允許管理員對自己停用／降權（嘗試時回 409 並提示）。
- **SC-010**：停用或取消管理員後，目標使用者的**下一個請求**即被擋（停用→401 導回登入；降權→`/api/admin/*` 回 403），無需等 JWT 到期。
- **SC-011**：管理員可在 dashboard 將一般使用者升為 admin、或將 admin 降為一般使用者，且即時生效（SC-010）。

---

## 明確不在本 feature（Non-Goals）

- Email 驗證 / 寄信（SMTP/SendGrid 等）、雙因素（2FA）。
- 密碼重設 / 忘記密碼流程。
- OAuth / 社群登入（Google、GitHub…）。
- 角色系統擴張（除 `isAdmin` 外的細緻權限／群組）。
- 使用者自助改個資 / 改密碼 / 刪帳號（profile 自助管理）。
- CAPTCHA / 機器人防護（節流以外）；可列為未來強化。
- 多租戶 / 組織概念。

---

## Clarifications

> 第二輪（2026-06-10）已定案 #1/#3/#6/#7；#2/#4/#5 採預設；#8 為 #6 放寬後新生的決策。

1. **密碼強度政策** ✅ **定案**：最小 10 字、至少含一個字母與一個數字（FR-002）。
2. **拒絕的資料模型**（採預設）：拒絕＝刪除該 pending 列（最小、email 可重註冊）。若日後需審核軌跡再改 `status` 列舉。
3. **重複 email 的揭露** ✅ **定案**：明說「此 email 已被使用」（體驗優先，FR-004）。
4. **管理員入口位置**（採預設）：前端受保護路由 `/admin/users`（dashboard），僅 `isAdmin` 可見；沿用 `ProtectedRoute` + admin 判定，導覽列於 admin 登入時顯示。
5. **既有 env 帳號的 `isAdmin` 預設**（採預設）：env 帳號維持非 admin，除非在 `AUTH_ACCOUNTS` 明標 `isAdmin:true`；上線前至少標一個 admin，否則沒人能進 dashboard（與 012「至少要有一組帳號」同類維運注意）。
6. **admin 能否在 dashboard 升/降？** ✅ **定案：可以**。dashboard 可升/降 `isAdmin`（FR-010）。隨之放寬「admin 只由 env」不變式 → admin 即時狀態以 DB 為準（FR-009/017/019），並以 FR-018 防最後一個 admin 被降/停與自我降權。
7. **停用即時性** ✅ **定案：即刻全站踢出**。以每請求伺服器端再驗證達成（FR-019，現有 `jwt.strategy`→`validateSessionUser` 已具骨架），不採 token 黑名單（per-request DB `status`/`isAdmin` 檢核已足夠達到「下一個請求即被擋」）。
8. **reseed 與 dashboard 狀態的衝突** ✅ **定案（採選項 a，與「DB 即時真實來源」一致）**：seed 對 `status`/`isAdmin` **只在初次建立 env 帳號時**套用，既有列只更新身分/憑證欄、不覆蓋狀態（FR-020）。故 dashboard 對 env 帳號的核准/停用/升降權**不會**被 reseed 還原；旋轉 env admin 密碼仍生效。dashboard 可對 env 帳號標「由設定檔 bootstrap」作為提示（非必要）。

---

## Review & Safety Notes

- **安全姿態**：自助註冊只產生 `pending` 帳號；登入由 `status` 把關。FR-019 的「每請求 DB 再驗證」**現有 `jwt.strategy` 已具備**（每次 `validate` 呼叫 DB-backed `validateSessionUser`，對 disabled/移除帳號即拒）；本 feature 只需把該再驗證從讀 `active` 改讀 `status` 並帶出 `isAdmin`，**不是**從零打造，風險低。
- **CR-004 後端邊界**：密碼／hash 只在後端；回應與前端 bundle 零敏感欄位（FR-006）。
- **最小權限 / 提權風險**：admin 升降為高權限動作，須 admin guard + FR-018 防鎖死；JWT 的 `isAdmin` claim 僅供 UI 初判，授權一律以 DB 當下值為準（FR-017a），避免降權後舊 token 越權。
- **單一真實來源 / No drift**：帳號即時狀態（`status`/`isAdmin`）以 DB 為唯一真實來源、env 僅 bootstrap；seed **不覆蓋**既有列的 `status`/`isAdmin`（FR-020），故無「dashboard 改完被 reseed 還原」的 drift。共用同表同登入路徑，不另立平行帳號系統。
- **`isAdmin` 跨層**：DB schema → domain `AuthenticatedUser`/評估器 → contracts（`AuthUserContract`/login/me）→ JWT/`validateSessionUser` → 前端 auth state（FR-017）。plan 須逐層處理，漏一層前端就拿不到 admin 旗標。
- **資料庫變更**：新增 `accounts.isAdmin` + `accounts.status`（並 migrate 既有 `active`→`status`）需一支 migration（與 012「無 migration」不同）。
- **維運注意**：上線前確保 `AUTH_ACCOUNTS` 至少有一個 `isAdmin:true`，否則無人能進 dashboard。
