# Feature Specification: User Auth JWT

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `005-user-auth-jwt`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "設定登入功能；上線後不是每個人都能使用服務；先做好登入功能；使用 JWT 存在 local 以維持長時間登入"

## Clarifications

### Session 2026-06-05

- Q: 登入端點要不要防暴力猜密碼? → A: **套用既有 per-IP rate limit 在 `POST /api/auth/login`**(重用 `RateLimitGuard`),阻擋暴力試密碼。
- Q: 前端登入門禁怎麼做(目前是單頁無 router)? → A: **引入 `react-router`**,做正式路由 + 受保護路由 + 登入後導回原本想去的頁(deep-link return 維持為有效需求)。
- Q: 站方怎麼設定帳號 + 產生密碼 hash? → A: **單一 JSON 環境變數 `AUTH_ACCOUNTS`**(`[{ id, username, displayName, passwordHash, active }]`)+ 一個產 scrypt hash 的 pnpm script(例如 `auth:hash`)供站方產生 `passwordHash`。
- Q: 多分頁登出/登入失效要即時同步嗎? → A: **加 `storage` 事件監聽**,一個分頁登出/清 token 時,其他分頁即時跳回未登入。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 已授權使用者登入後使用服務 (Priority: P1)

已被站方授權的使用者可以在登入頁輸入帳號憑證，成功登入後進入 HTML 簡報生成工具，並可以使用既有的簡報生成流程。

**Why this priority**: 上線後服務不應開放給所有人；登入是保護生成服務與後續使用成本的最低可用切片。

**Independent Test**: 可用一組有效帳號完成登入，重新導向到生成頁，並確認使用者能提交簡報生成請求。

**Independent Demo**: 只需要登入頁、一組有效帳號、以及既有生成頁即可展示，不依賴註冊、角色管理或帳號後台。

**Acceptance Scenarios**:

1. **Given** 使用者尚未登入且擁有有效帳號，**When** 使用者輸入正確憑證並送出，**Then** 系統允許登入並顯示生成工具主畫面。
2. **Given** 使用者已登入，**When** 使用者提交有效簡報生成需求，**Then** 系統接受請求並依既有 preview job 流程處理。
3. **Given** 使用者已登入，**When** 使用者重新整理頁面或重新開啟同一瀏覽器，**Then** 系統保留登入狀態且不要求重新登入。

---

### User Story 2 - 未登入者不得使用生成服務 (Priority: P1)

未登入訪客不能直接開啟生成頁或呼叫生成服務；系統必須要求登入，避免未授權者消耗生成資源。

**Why this priority**: 這是「不是每個人都能用我的服務」的核心保護，必須與登入本身同時成立。

**Independent Test**: 在無登入狀態下直接開啟生成頁、重新整理保護頁、或提交生成請求，均應被導向登入或收到未授權回應。

**Independent Demo**: 使用無登入瀏覽器視窗直接輸入生成頁網址，展示系統阻擋並顯示登入頁。

**Acceptance Scenarios**:

1. **Given** 使用者未登入，**When** 使用者開啟生成工具網址，**Then** 系統顯示登入頁而非生成工具。
2. **Given** 使用者未登入，**When** 使用者直接提交生成請求，**Then** 系統拒絕請求且不啟動 preview job。
3. **Given** 使用者登入狀態已失效，**When** 使用者嘗試使用保護功能，**Then** 系統清除本機登入狀態並要求重新登入。

---

### User Story 3 - 使用者登出與錯誤處理 (Priority: P2)

已登入使用者可以主動登出；登入錯誤、過期、或帳號不被允許時，系統以一致且不洩漏敏感資訊的方式提示。

**Why this priority**: 長時間登入需要可控的結束方式；錯誤訊息不能暴露帳號是否存在、內部驗證規則或安全細節。

**Independent Test**: 登入後點擊登出，頁面回到登入狀態；使用錯誤憑證登入時看到安全的一般錯誤訊息。

**Independent Demo**: 展示登入、登出、錯誤密碼、登入失效四種狀態切換。

**Acceptance Scenarios**:

1. **Given** 使用者已登入，**When** 使用者點擊登出，**Then** 系統清除登入狀態並返回登入頁。
2. **Given** 使用者輸入錯誤憑證，**When** 使用者送出登入表單，**Then** 系統拒絕登入並顯示一般性錯誤訊息。
3. **Given** 使用者登入狀態已過期，**When** 系統收到保護功能拒絕，**Then** 前端清除本機狀態並提示重新登入。

### Edge Cases

- 使用者直接開啟受保護的深層網址時，登入成功後應回到原本想進入的頁面。
- 使用者在多個分頁開啟網站時，登出或登入失效後其他分頁不應繼續顯示可用狀態。
- 使用者網路中斷或登入請求失敗時，表單應保留可重試狀態，不應顯示內部錯誤。
- 使用者已登入但帳號後續被停用時，下一次保護功能檢查應拒絕使用並要求重新登入。
- 瀏覽器清除本機資料後，使用者應回到未登入狀態。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 提供登入頁，讓已授權使用者輸入帳號憑證並取得登入狀態。
- **FR-002**: 系統 MUST 拒絕未登入使用者存取生成工具主畫面與所有會消耗生成資源的操作。
- **FR-003**: 系統 MUST 在登入成功後維持同一瀏覽器的長時間登入狀態，直到使用者登出、登入狀態失效、或本機資料被清除。
- **FR-004**: 系統 MUST 提供登出功能，並在登出後清除本機登入狀態與保護頁可用狀態。
- **FR-005**: 系統 MUST 對錯誤憑證、未授權、登入失效、帳號停用使用一致且不洩漏敏感資訊的錯誤訊息。
- **FR-006**: 系統 MUST 讓前端在登入失效後自動返回登入流程，且不保留可提交生成請求的 UI 狀態。
- **FR-007**: 系統 MUST 保護既有同步 preview 與非同步 preview job 建立、查詢、結果取得等生成相關入口。
- **FR-008**: 系統 MUST 保留登入與登出相關的最小操作證據，供開發者確認未授權使用被阻擋，但不得在使用者可見回應中揭露內部安全細節。
- **FR-009**: 系統 MUST 不提供公開註冊、忘記密碼、使用者自助管理、第三方登入或多角色授權作為 005 v1 範圍。
- **FR-010**: 系統 MUST 確保登入功能不改變既有簡報生成輸入、輸出、review report、HTML preview result 或 preview job result contract。
- **FR-011**: 系統 MUST 對 `POST /api/auth/login` 套用 per-IP 速率限制(重用既有 `RateLimitGuard`),以限制暴力猜測憑證,且超限回應不得洩漏帳號是否存在。
- **FR-012**: 前端 MUST 監聽本機登入狀態的跨分頁變化(`storage` 事件):任一分頁登出或登入失效清除 token 時,其他分頁 MUST 即時轉為未登入,不得繼續顯示可用狀態。
- **FR-013**: 前端 MUST 使用路由保護受保護頁面,未登入存取受保護路由時導向登入頁,並在登入成功後導回使用者原本要進入的頁面。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: 005 不改變簡報生成內容；登入只決定誰可以啟動或查看生成流程。既有來源事實、數字、日期、決策、風險、限制、owner、deadline 保真規則維持不變。
- **CR-002 Review Report**: 005 不新增或修改生成 review report；成功登入後的 report 仍由既有生成流程產生。
- **CR-003 Web-First Output**: 005 不改變 self-contained HTML slides 作為 v1 主要 deliverable。
- **CR-004 Backend-Configured LLM Boundary**: 005 不新增使用者可選 provider/model 欄位；登入狀態不得出現在生成 request/response 的 provider/model evidence 中。
- **CR-005 Design System**: 005 不改變 deck-level palette、typography、spacing、density 或 slide pattern 規則。
- **CR-006 Semantic Titles**: 005 不改變 slide title 生成規則。
- **CR-007 Data Visualization**: 005 不改變數字轉圖表、metric card、table 或文字保留規則。
- **CR-008 TDD Coverage**: 005 測試需覆蓋登入成功、未登入阻擋、登入持久化、登出、登入失效、受保護生成入口拒絕、錯誤訊息安全性。
- **CR-009 Domain Model**: 005 domain concepts 包含 `UserAccount`、`LoginCredential`、`AuthSession`、`AuthFailure`、`ProtectedGenerationAccess`。
- **CR-010 Lean Test Scope**: 測試聚焦 observable auth behavior 與受保護入口，不重測簡報生成品質。
- **CR-011 Behavior-Driven Value**: 所有登入與保護行為以上方 Given/When/Then 場景為準。
- **CR-012 Code Simplicity**: 005 v1 僅做基本登入與保護；排除公開註冊、RBAC、團隊管理、邀請信、密碼重設與 billing。
- **CR-013 Consistent Language**: UI 與文件統一使用「登入」、「登出」、「登入狀態」、「未授權」、「登入已失效」、「重新登入」。
- **CR-014 Performance and Evidence**: 登入與保護檢查需有自動測試與 quickstart 證據；生成流程性能目標維持 003/004 定義。
- **CR-015 Manual Verification**: 手動驗證包含瀏覽器重新整理、關閉重開、多分頁登出、受保護 URL 直連、登入失效後重試。
- **CR-016 Verification**: 005 不改變 slide JSON schema、HTML rendering、keyboard navigation、responsive behavior；release verification 必須確認登入後既有生成 smoke test 仍可執行。

### Key Entities *(include if feature involves data)*

- **UserAccount**: 被允許使用服務的帳號；包含使用者識別、登入名稱、驗證狀態、啟用/停用狀態。
- **LoginCredential**: 使用者登入時提供的識別資訊；只用於驗證，不應出現在一般回應或前端持久狀態中。
- **AuthSession**: 使用者成功登入後的有效狀態；包含使用者識別、簽發時間、到期時間、使用範圍。
- **AuthFailure**: 登入或保護功能拒絕的原因分類；對使用者顯示一般訊息，對內部測試保留可驗證分類。
- **ProtectedGenerationAccess**: 對生成頁、preview job 建立、狀態查詢、結果讀取、HTML 下載等受保護功能的授權檢查。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 有效帳號使用者可在 30 秒內完成登入並看到生成工具主畫面。
- **SC-002**: 未登入使用者 100% 無法建立 preview job 或取得受保護 preview result。
- **SC-003**: 使用者登入後重新整理頁面或重新開啟同一瀏覽器，至少在設定的有效期間內不需要重新登入。
- **SC-004**: 使用者登出後，重新整理頁面與直接呼叫受保護入口都維持未登入狀態。
- **SC-005**: 錯誤憑證、帳號停用、登入失效的使用者可見訊息不揭露帳號存在性、內部驗證策略或敏感錯誤。
- **SC-006**: 登入功能加入後，既有登入後生成 preview 的 happy path smoke test 仍通過。

## Assumptions

- 005 v1 採站方預先允許的帳號，不提供公開註冊；帳號以單一 JSON 環境變數 `AUTH_ACCOUNTS` 設定(`id`/`username`/`displayName`/`passwordHash`/`active`),並提供一個產 scrypt hash 的 script 供站方產生 `passwordHash`。
- 005 v1 只有「可使用服務」與「不可使用服務」兩種權限，不做多角色管理。
- 前端引入 `react-router` 做受保護路由與登入導向(deep-link return);這是 005 新增的前端依賴。
- 長時間登入以同一瀏覽器為範圍；使用者清除瀏覽器資料後需要重新登入。
- 初版不處理忘記密碼、email 驗證、邀請流程、billing 或團隊/組織管理。
- 本功能會接受「前端持久化登入狀態」帶來的安全取捨，並在 implementation plan 中明確列出 XSS 風險與防護要求。
- 既有簡報生成 contract 與 preview job contract 不因登入功能改變，只新增前置授權要求。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: 005 不改生成內容；使用者不會在生成結果中看到登入實作細節。
- **Omitted or Compressed Content Policy**: 不適用；005 不新增內容摘要或壓縮行為。
- **Uncertain Claims Policy**: 不適用；005 不產生新的簡報聲明。
- **Sensitive Content Handling**: 登入憑證不得出現在前端持久狀態、生成 request、preview result、review report 或一般錯誤訊息中。登入狀態不得被送入 LLM provider。
- **Evidence and Traceability**: 需保留 auth contract tests、API protection tests、frontend route guard tests、manual verification notes。
- **Manual Verification Path**: 在乾淨瀏覽器、已登入瀏覽器、多分頁、登入失效狀態下驗證登入、登出、直接開 protected URL、生成請求阻擋與登入後生成 smoke path。
