# Feature Specification: Async Preview Jobs

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `003-async-preview-jobs`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "Preview API 目前同步等待 LLM 生成會超時或長時間無回應；需要 worker 和 polling 機制。將 preview generation 改為非同步 job，讓前端送出後取得 job id，之後查詢進度、完成結果或失敗原因。"

## Clarifications

### Session 2026-06-02

- Q: job 最長可以 running 多久才必須 failed？ → A: 5 分鐘內未完成就標記 failed。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 送出 preview job 並立即取得追蹤資訊 (Priority: P1)

使用者在前端送出 slide preview request 後，不需要等待完整 HTML 生成完成；系統會快速接受請求並回傳可追蹤的 job 狀態，讓前端可以進入進度畫面。

**Why this priority**: 目前同步 preview request 可能因多段 LLM 生成而超時，這是阻塞使用者完成主要流程的最高優先問題。

**Independent Test**: 可以只實作「建立 job」行為，透過送出有效 preview request 驗證系統在短時間內回傳 job id、初始狀態和狀態查詢資訊，不需要等待 HTML 實際完成。

**Independent Demo**: 在前端送出來源內容、brief 和 style direction 後，畫面立即切換到「生成中」狀態並顯示 job id 或等價追蹤狀態。

**Acceptance Scenarios**:

1. **Given** 使用者已填妥有效的來源內容與 deck brief，**When** 使用者送出 preview generation，**Then** 系統會在 2 秒內接受請求並回傳可查詢的 preview job。
2. **Given** 使用者送出缺少必要欄位或含不支援欄位的 request，**When** 系統驗證輸入，**Then** 系統會拒絕建立 job 並回傳可理解的驗證錯誤。
3. **Given** 使用者送出有效 request，**When** 系統建立 job，**Then** job 會保留原始 request 驗證結果與生成追蹤所需的 evidence，而不改寫來源內容語意。

---

### User Story 2 - 查詢生成進度並取得完成結果 (Priority: P2)

使用者送出 preview job 後，可以看到目前處理階段，例如排隊中、內容規劃、deck 規劃、design planning、HTML generation、validation，並在完成後看到與既有 preview response 相同的可檢視 artifacts。

**Why this priority**: 使用者需要知道系統仍在工作，並能在完成後取得 slide deck、design planning result、HTML preview artifact、validation summary 和 review report。

**Independent Test**: 可以使用一個可控的長時間生成流程，驗證狀態查詢會依序回報階段，完成後回傳完整 preview result。

**Independent Demo**: 建立一個 preview job 後，前端顯示目前階段；完成後自動呈現 HTML preview、design planning、validation、summary、review report 和 downloadable HTML。

**Acceptance Scenarios**:

1. **Given** preview job 正在處理，**When** 使用者或前端查詢 job 狀態，**Then** 系統會回傳目前狀態、目前階段、建立時間與最近更新時間。
2. **Given** preview job 已成功完成，**When** 使用者查詢 job 狀態，**Then** 系統會回傳 `succeeded` 狀態與完整 preview result。
3. **Given** preview job 完成且包含 HTML artifact，**When** 前端呈現結果，**Then** 使用者可以檢視 self-contained HTML slides、鍵盤導覽、基本 responsive preview 和 review artifacts。

---

### User Story 3 - 失敗時回報安全、可追溯的錯誤狀態 (Priority: P3)

當 preview job 在內容規劃、design planning、HTML generation 或 validation 任一階段失敗時，使用者會看到安全的失敗狀態，而開發者或 reviewer 可以從 artifacts/evidence 追溯失敗階段。

**Why this priority**: 非同步流程不能讓使用者永久停在 loading；也不能將 provider 原始錯誤、API key、prompt 或敏感內部細節洩漏到 UI。

**Independent Test**: 可以使用可控失敗的生成流程，驗證 job 轉為 failed、錯誤訊息安全、失敗階段可見，且不回傳 provider 原始錯誤。

**Independent Demo**: 觸發一個失敗 job 後，前端顯示失敗狀態、可重試的使用者訊息，以及可供 reviewer 使用的非敏感 evidence。

**Acceptance Scenarios**:

1. **Given** preview job 在任一生成階段失敗，**When** 使用者查詢 job 狀態，**Then** 系統會回傳 `failed` 狀態、安全錯誤碼、安全錯誤訊息與失敗階段。
2. **Given** provider 或生成器回傳含內部細節的錯誤，**When** 系統產生 job failure response，**Then** 使用者可見 response 不包含 API key、provider 原始錯誤、完整 prompt 或 stack trace。
3. **Given** preview job 失敗，**When** reviewer 檢查 evidence，**Then** reviewer 可以知道最後成功階段、失敗階段、可安全揭露的錯誤分類與是否曾啟用 fallback。

---

### Edge Cases

- 使用者查詢不存在、已過期或不屬於目前工作階段的 job。
- 使用者重複送出相同 request，系統應建立可獨立追蹤的 job，而不是混淆結果。
- job 已完成後使用者重複查詢，系統應穩定回傳同一個結果，不重新生成內容。
- job 失敗後使用者重試，新的 job 不得覆蓋舊 job 的狀態或 evidence。
- 使用者在 job 處理期間重新整理頁面，仍可透過 job id 重新查詢狀態。
- 系統同時處理多個 preview jobs 時，不得讓不同 job 的狀態、結果或 errors 互相污染。
- 長時間無回應的生成階段必須有明確 timeout 或 failure path，不能永久停留在 running；整體 job 自建立後 5 分鐘內未完成必須標記 failed。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a valid preview generation request to be accepted as a trackable preview job without waiting for full HTML generation to complete.
- **FR-002**: System MUST reject invalid preview generation requests before creating a job, using the same boundary validation rules as preview generation.
- **FR-003**: System MUST assign each accepted preview job a stable identifier that can be used to query status until the job is no longer available.
- **FR-004**: System MUST expose job status values that distinguish at least queued, running, succeeded, failed, and expired or unavailable jobs.
- **FR-005**: System MUST expose the current generation stage for queued or running jobs using consistent user-facing terminology.
- **FR-006**: System MUST preserve the validated request semantics for each job and MUST NOT change source content, slide order, title/message meaning, outline meaning, or speaker-note factual content during asynchronous processing.
- **FR-007**: System MUST return the same successful preview result shape as the completed synchronous preview response, including slide deck, design planning result, preview artifact, validation summary, generation summary, and review report.
- **FR-008**: System MUST provide a bounded failure path for long-running or stalled jobs and MUST mark a job as failed when it has not completed within 5 minutes of creation.
- **FR-009**: System MUST return sanitized failure information that identifies the failed stage and safe error category without leaking provider raw messages, prompts, API keys, stack traces, or unrelated internal state.
- **FR-010**: Users MUST be able to retry after a failed job by creating a new job; the retry MUST be independently traceable from the failed job.
- **FR-011**: System MUST preserve completed job results long enough for normal user review after generation completes.
- **FR-012**: System MUST provide evidence that links each job decision and output to the job id, request validation result, generation stages, fallback usage, and final result or failure.
- **FR-013**: Frontend MUST transition from submit state to a job progress state after job acceptance, then to completed or failed state based on job status.
- **FR-014**: Frontend MUST avoid blocking the page while a job is running and MUST show clear progress, retry, and final-result states.
- **FR-015**: System MUST keep provider and model selection as backend runtime configuration and MUST NOT expose model selection as user request fields or public response fields.
- **FR-016**: The feature specification MUST preserve an explicit future enhancement path for durable queue infrastructure using Redis and BullMQ when deployment requires persistence, multi-process workers, retries across process restarts, or distributed processing.

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: Preview jobs MUST preserve source facts from the accepted request, including numbers, dates, named entities, decisions, risks, constraints, owners, deadlines, and stated tradeoffs. Job processing MUST NOT invent unsupported facts while running asynchronously.
- **CR-002 Review Report**: Successful job results MUST include assumptions, omitted or compressed content, uncertain claims, charting decisions, human review notes, and design review notes where available.
- **CR-003 Web-First Output**: Successful job results MUST continue to produce self-contained HTML slides as the primary v1 deliverable.
- **CR-004 Backend-Configured LLM Boundary**: Provider and model selection remain backend runtime configuration. Public job creation, status, result, and failure responses MUST NOT expose model identifiers, API keys, full prompts, or provider raw errors.
- **CR-005 Design System**: Successful job results MUST preserve the design planning contract from 002: deck-level design system, visual density, typography/palette/spacing/layout grid, slide pattern assignments, chart treatment, visual hierarchy, accessibility notes, and design review notes.
- **CR-006 Semantic Titles**: Async processing MUST preserve the semantic-title rules from 002: titles summarize paragraph or slide meaning only when grounded in source content.
- **CR-007 Data Visualization**: Async processing MUST preserve ChartIntent-driven decisions for charts, metric cards, tables, or text preservation, including numeric fidelity for units, periods, denominators, and values.
- **CR-008 TDD Coverage**: Tests MUST cover job creation validation, status progression, successful result retrieval, failure status, timeout behavior, frontend progress state, and retry behavior before implementation is considered complete.
- **CR-009 Domain Model**: The domain model or equivalent boundary concepts MUST represent PreviewJob, JobStatus, JobStage, PreviewResult, JobFailure, and JobEvidence without mixing unrelated rendering or editor responsibilities.
- **CR-010 Lean Test Scope**: Tests MUST focus on observable job behavior and domain rules, avoiding redundant tests that duplicate lower-level 002 rendering/design/content tests unless job behavior changes them.
- **CR-011 Behavior-Driven Value**: Each user story above includes Given/When/Then scenarios and must be independently demonstrable and independently testable.
- **CR-012 Code Simplicity**: Scope excludes durable persistence, multi-user permissions, distributed queues, full editor, publish-to-URL, PPTX export, and revision loops for 003 v1. Future PRs SHOULD introduce Redis and BullMQ when durable persistence, multi-process workers, restart-safe retries, or distributed processing become required.
- **CR-013 Consistent Language**: UI, status responses, review notes, quickstart, and evidence MUST consistently use the terms preview job, queued, running, succeeded, failed, expired, stage, retry, and result.
- **CR-014 Performance and Evidence**: Job creation acknowledgement should be visible within 2 seconds; progress state should be visible without blocking the UI; evidence must record acceptance, stage transitions, completion/failure, timeout, and manual verification.
- **CR-015 Manual Verification**: Manual verification must cover a real long-running generation request, visible progress updates, completed preview rendering, failure state, retry behavior, and no sensitive error leakage.
- **CR-016 Verification**: Successful job results MUST retain acceptance coverage for slide JSON schema validity, HTML rendering, keyboard navigation, and basic responsive behavior.

### Key Entities *(include if feature involves data)*

- **PreviewJob**: Represents one accepted preview generation request and its lifecycle. Key attributes include job id, status, current stage, created time, updated time, request summary, and result or failure reference.
- **JobStatus**: Represents the user-visible lifecycle state: queued, running, succeeded, failed, expired, or unavailable.
- **JobStage**: Represents the current generation stage, such as request accepted, content planning, deck planning, design planning, HTML generation, validation, repair/fallback, and completed.
- **PreviewResult**: Represents the successful completed result from 002: slide deck, design planning result, preview artifact, validation summary, generation summary, and review report.
- **JobFailure**: Represents a sanitized failure outcome with safe error code, safe message, failed stage, retry guidance, and reviewer-safe evidence.
- **JobEvidence**: Represents traceability artifacts for a job, including validation result, stage transitions, fallback usage, timing, and final outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of valid preview submissions receive job acceptance feedback within 2 seconds under normal local development conditions.
- **SC-002**: A user can submit a preview job and continue seeing progress without the page appearing frozen for the full generation duration.
- **SC-003**: Completed jobs return a preview result that passes the existing slide JSON, HTML self-contained, keyboard navigation, and responsive smoke checks.
- **SC-004**: Failed or timed-out jobs surface a safe user-facing failure state within 5 minutes and never expose API keys, provider raw errors, full prompts, or stack traces.
- **SC-005**: A user can retry a failed job as a new independently traceable job in under 30 seconds after failure is visible.
- **SC-006**: Manual verification can trace one successful job and one failed job from submission through final state using recorded evidence without rerunning the entire demo.

## Assumptions

- Preview generation remains a backend-owned operation; users do not choose provider or model.
- Job results are needed for immediate preview review, not long-term storage or publishing.
- v1 may keep job availability bounded to the current local/runtime context; durable persistence is out of scope unless later planning proves it necessary.
- Future PRs should introduce Redis and BullMQ as the durable queue/worker path once preview jobs need persistence across restarts, multiple API instances, worker pools, or production-grade retry handling.
- Cancellation is out of scope for this feature unless added by a later clarification or feature.
- Authentication and multi-user authorization are out of scope for this local preview workflow.
- The existing 002 preview generation result contract remains the successful result payload for completed jobs.
- The frontend can retain the latest job id locally while the user remains on the preview page.

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: Successful job results must continue surfacing generation assumptions from the slide review report and design review notes.
- **Omitted or Compressed Content Policy**: Async job processing must preserve the 002 reporting policy for omitted or compressed source content and must not hide omitted content merely because generation is asynchronous.
- **Uncertain Claims Policy**: Unsupported or ambiguous claims must remain visible in review artifacts; failed jobs must not present partial generated content as final truth.
- **Sensitive Content Handling**: Source content may be sent only through backend-configured generation providers already approved for preview generation. Public job responses must not include API keys, raw provider errors, full prompts, model identifiers, stack traces, or hidden internal state.
- **Evidence and Traceability**: Every job must preserve enough evidence to trace accepted input, validation, stage transitions, fallback usage, timeout/failure, and final result without changing slide semantics or rerunning the job.
- **Manual Verification Path**: Manual verification must submit one long-running successful request and one controlled failure request, observe progress transitions, inspect completed artifacts, inspect failure messaging, verify retry creates a separate job, and confirm no sensitive provider details are visible.
