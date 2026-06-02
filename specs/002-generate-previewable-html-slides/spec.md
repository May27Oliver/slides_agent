# Feature Specification: Generate Previewable HTML Slides

**Feature Branch**: `002-generate-previewable-html-slides`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "使用者貼上 source content，填寫 purpose、audience、style direction、chart emphasis。系統產生 slide JSON、review report、self-contained HTML slides，並能在本機 preview。"

## Clarifications

### Session 2026-05-30

- Q: 第一個 implementation slice 要採用哪種 app 形態？ → A: Local web app：前端表單 + 本機 API/agent endpoint + browser preview route + 可下載 self-contained HTML。

### Session 2026-05-31

- Q: 第一版 agent generation 要採用哪種策略？ → A: Deterministic content core + ui-ux-pro-max design layer：內容事實、chart decisions 與 review report 維持可測與可追溯；visual hierarchy、layout/design planning 與 critique 由 ui-ux-pro-max 參與。2026-06-01 補充：source sectioning 改由 LLM-assisted semantic segmentation + deterministic validation/fallback 處理；downstream facts/chart/review 仍維持可測與可追溯。2026-06-02 補充：ui-ux-pro-max 不進 DeckPlanner，也不在 v1 改寫 title/message wording。
- Q: `chart emphasis` 的輸入形式第一版要怎麼設計？ → A: 分層處理：content core 先檢查 source content 是否有數字描述與可視覺化邏輯；若有，必須針對可支持的數字內容產生 chart intent。接著再結合使用者自由文字 chart emphasis 與自動偵測結果，統一轉成 `ChartIntent`。
- Q: local preview 的產物生命週期要怎麼處理？ → A: Session-only preview：本次生成結果只存在 local web app session/browser state，使用者可在同一頁看到 preview、review report、slide JSON、generation summary，並下載 self-contained HTML；不做 persistence、歷史紀錄或自動 artifact storage。
- Q: 第一版技術架構要偏哪個 stack 方向？ → A: Preferred stack 為 React + TypeScript frontend 搭配 NestJS backend，因為新公司技術線以此為主；Next.js 不作為第一選擇，因為此 feature 不需要 SEO/SSR 作為核心能力。

### Session 2026-06-01

- Q: Source content 的段落切分是否應只用 deterministic parser？ → A: 不應只靠固定 regex 規則。第一版應加入 backend-configured LLM-assisted semantic segmentation，由 LLM 依語意切段、命名 section 並輸出符合 schema 的 segmentation result；程式端必須驗證每個 section 的 source quotes 都能 exact match 原文、順序可追溯、不得改寫 source text，驗證失敗時 fallback deterministic parser 並在 review notes/evidence 中揭露。
- Q: 使用者是否可以提供切段建議？ → A: 可以。第一版在 `deckBrief` 加入 optional `segmentationGuidance`，作為 LLM semantic segmentation 的切段偏好，例如「依照目標、決策、風險、限制、下一步切段」。它不是 source truth，不得新增或改寫來源事實；若 guidance 與 source content 或系統規則衝突，系統必須忽略衝突部分並以 warning/evidence 記錄。
- Q: LLM semantic segmentation output 不符合 schema 時要怎麼處理？ → A: 系統不得直接把 raw schema error 顯示給使用者，也不得無限 retry。第一版允許一次 format repair：將 validation errors 與原始 LLM output 交給 backend-configured LLM，只要求修正 JSON 結構，不得重新理解、擴寫、摘要或改變來源語意。修復後仍未通過 schema、quote grounding、source order 或 coverage validation 時，必須使用 deterministic fallback segmentation，並在 review notes/evidence 中記錄 repair/fallback 原因。

### Session 2026-06-02

- Q: Deck planning v1 是否需要導入 LLM？ → A: 不導入。第一版 deck planning 必須採 deterministic rules，並拆成 `DeckPlanner` 與 `DeckCompiler`。`DeckPlanner` 由 validated `SourceSection`、`SourceFact`、`ChartIntent` 與 `DeckBrief` 產生 `DeckPlanProposal`；`DeckCompiler` 驗證 proposal references 後產出 final `SlideDeck`。未來可以讓 LLM 輔助產生 `DeckPlanProposal`，但 v1 不呼叫 LLM，且 `SlideDeck` 必須始終由 deterministic compiler 產出。
- Q: Deck 結構第一版要怎麼限制？ → A: v1 目標輸出 3-8 張 slides；內容太短時可少於 3 張但仍需可展示，8 張是 hard cap。Deck 必須有 opening slide；closing slide 只在來源內容包含 next steps、action、owner 或 deadline 時產生。短 source sections 可以合併，長 source sections 可以保守拆分；v1 不產生 appendix，省略或壓縮的重要內容進 review report。
- Q: Deck 是否需要 narrative type 或複雜 slide role？ → A: 不需要。因 v1 deck planning 不導入 LLM，且重點是忠實呈現 user source content，DeckPlanner 不使用 `narrativeType` 或複雜 role 分類。v1 只使用 `slideKind: "opening" | "content" | "closing"`。Slide 順序必須維持 opening -> 來源順序 content slides -> conditional closing；不得自動把 metrics、risk 或 decision 移到前面，除非使用者明確要求。
- Q: Deck 是否要產出每頁 slides 的大綱或講稿？ → A: 要。第一版每張 slide 必須包含 source-grounded `outline`，用於表示該頁要講的重點、證據、風險、決策或行動。每張 slide 的 outline 目標為 2-4 個 items，來源太薄時至少 1 個 item；每個 item 必須有 `emphasis` 與 source trace。每張 slide 也必須包含 `speakerNotesDraft`，作為 2-4 句、最多 400 字元的 presenter cue；notes 必須保守、不得新增來源未支持內容，並且必須可由 outline/source trace 追溯。HTML rendering v1 不呈現 `speakerNotesDraft`。
- Q: DeckCompiler 驗證失敗時怎麼處理？ → A: Compiler 不補齊 missing fields；它只驗證並編譯。若 `DeckPlanProposal` reference invalid，compiler 回傳 validation failure，application flow 改用 deterministic fallback plan。Fallback 使用 opening -> source-order content -> conditional closing，並在 review report 寫入人能理解的 fallback note；raw validation errors 保留在 evidence。空 `chartIntentIds` 合法；content slide 必須至少 trace 到 source section。
- Q: ui-ux-pro-max 應放在 agent flow 哪一層？ → A: 不放在 DeckPlanner。`ui-ux-pro-max` 是 design planning / critique advisor，不是 deck source truth。它應在 `DeckCompiler` 產出 valid `SlideDeck` 後、HTML renderer 前產生 design planning；HTML renderer 後再用於 design critique/verification。它只能影響 `DesignSystem`、slide pattern mapping、chart treatment、visual hierarchy、density、accessibility/critique notes，不得改變 deck order、source facts、outline meaning、title/message wording、speakerNotesDraft factual content 或 review warnings。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 產生可審查的 Slide Deck (Priority: P1)

使用者貼上要做成 slides 的 source content，填寫 deck purpose、audience、style direction、chart emphasis，並可選填 segmentation guidance 後，系統先透過 LLM-assisted semantic segmentation 理解內容結構，再用 deterministic deck planner/compiler 產生 structured slide JSON、每頁 source-grounded outline、保守 speaker notes draft 與 review report。

**Why this priority**: 這是後續 HTML rendering 與 preview 的基礎。若沒有可信任、可審查的 slide JSON 與 review report，任何視覺呈現都無法驗證來源忠實度與 agent decision flow。

**Independent Test**: 使用一份包含段落、數字、日期、決策、風險與限制的範例 source content，提交完整 brief；驗證輸出包含 slide JSON、review report、語意標題、每頁 outline、保守 speaker notes draft、來源重點保留與圖表化決策。

**Independent Demo**: 在本機 web app 表單輸入範例內容後，展示系統產生的 slide JSON 與 review report，不需要發布功能。

**Acceptance Scenarios**:

1. **Given** 使用者提供 source content、deck purpose、audience、style direction 與 chart emphasis，**When** 使用者要求生成，**Then** 系統產生包含 deck metadata、design system、slides 與 content blocks 的 slide JSON。
2. **Given** source content 的格式不規則或沒有明確 heading，**When** 系統分析內容，**Then** backend-configured LLM 會依語意產生 section segmentation，且每個 section 必須引用原文 exact source quotes。
3. **Given** 使用者提供 segmentation guidance，例如「依照目標、決策、風險、限制、下一步切段」，**When** 系統產生 semantic segmentation，**Then** segmentation 可以依 guidance 調整分組角度，但不得把 guidance 當成 source content 或新增來源未支持的事實。
4. **Given** segmentation guidance 與 source content 或系統規則衝突，**When** 系統產生 semantic segmentation，**Then** 系統必須忽略衝突部分，並在 `globalWarnings`、review notes 或 evidence 中標示。
5. **Given** LLM segmentation output 無法通過 schema 驗證，**When** 系統繼續生成，**Then** 系統必須最多嘗試一次 format repair；若 repair 後仍無法通過 schema、exact quote、coverage 或順序驗證，系統必須 fallback deterministic parser，並在 review notes 或 evidence 中標示 segmentation repair/fallback reason。
6. **Given** source content 包含數字、日期、決策、風險與限制，**When** 系統產生 slide JSON，**Then** 這些重要來源事實會被保留在 slides、source trace 或 review report 中。
7. **Given** source content 有可摘要的段落，**When** 系統產生 slides，**Then** slide title 會總結該 slide 或段落的核心意思，而不是只複製原文 heading。
8. **Given** source content 包含數字描述與可視覺化邏輯，**When** 系統分析內容，**Then** content core 會先自動偵測可圖表化的數字內容，再結合使用者自由文字 chart emphasis 產生 chart intent，並保留原始數字與上下文。
9. **Given** 使用者指定 chart emphasis 但來源資料不足，**When** 系統產生 review report，**Then** 系統不得捏造資料，並說明改以文字、表格或 review note 呈現的原因。
10. **Given** validated source sections、source facts、chart intents 與 deck brief，**When** 系統進行 deck planning，**Then** `DeckPlanner` 必須 deterministic 產生 `DeckPlanProposal`，v1 不呼叫 LLM，且輸出目標為 3-8 張 slides。
11. **Given** 系統產生 deck plan，**When** 使用者 review slide order，**Then** deck 必須以 opening slide 開始，content slides 必須維持來源順序，且 closing slide 只在來源包含 next steps、action、owner 或 deadline 時產生。
12. **Given** `DeckPlanProposal` 引用 source section、source fact 或 chart intent，**When** `DeckCompiler` 產生 `SlideDeck`，**Then** compiler 必須驗證所有 reference 存在，invalid proposal 必須回傳 validation failure 並觸發 deterministic fallback planning。
13. **Given** 系統產生每張 slide，**When** 使用者 review slide JSON，**Then** 每張 slide 必須包含 `slideKind`、source-grounded `outline`、`layoutIntent` 與 source trace；每個 outline item 必須標示 emphasis 與 source trace。
14. **Given** 系統產生 `speakerNotesDraft`，**When** 使用者 review notes，**Then** notes 必須保守描述該頁 outline 與來源事實，不得新增 unsupported claim，且必須是短 presenter cue。

---

### User Story 2 - Render Self-Contained HTML Slides (Priority: P2)

使用者取得 slide JSON 與 design system 後，系統將其 render 成 self-contained HTML slides，能在沒有 backend 的情況下於 browser 開啟。

**Why this priority**: Web-first HTML deck 是本產品的核心交付物。即使暫時不發布到網域，使用者也必須能在本機 preview 並確認 deck 是否可展示。

**Independent Test**: 使用固定的 slide JSON fixture，執行 HTML rendering；驗證輸出是單一可開啟 HTML artifact，且包含 slides、樣式、navigation script 與 review report reference。

**Independent Demo**: 開啟本機 web preview route 或下載後的 self-contained HTML 檔，展示 slides 可在 browser 中顯示，不需要重新執行 agent generation。

**Acceptance Scenarios**:

1. **Given** 有一份有效 slide JSON 與 design system，**When** 系統 render HTML，**Then** 系統產生 self-contained HTML slides。
2. **Given** HTML deck 在 browser 中開啟，**When** 使用者按下一頁或上一頁按鍵，**Then** deck 會在 slides 之間切換。
3. **Given** HTML deck 在常見 laptop 或 projector 尺寸開啟，**When** 使用者 preview，**Then** slides 保持 16:9 presentation format，且主要文字與 UI 不互相重疊。
4. **Given** slide JSON 包含 chart intent 或 metric content block，**When** 系統 render HTML，**Then** 對應內容會以 chart、metric card、table 或 fallback text 呈現。
5. **Given** slide JSON 包含 `speakerNotesDraft`，**When** 系統 render HTML，**Then** HTML deck v1 不得呈現 speaker notes，但 slide JSON/review path 仍可供審查。
6. **Given** 使用者在本機 web app 完成生成，**When** 生成結果顯示，**Then** 使用者在同一個 session 可以看到 slides preview、review report、slide JSON、generation summary，並下載 self-contained HTML。

---

### User Story 3 - Apply Design Planning and Critique (Priority: P3)

系統依據使用者的 style direction 產生 deck-level design system，並使用 deterministic content core 保護來源事實，同時使用 ui-ux-pro-max 進行 design planning、layout selection、chart treatment 與 critique，確保 slides 視覺一致且適合會議展示。

**Why this priority**: 使用者期待的不只是摘要，而是能加速同步與理解的 slides。設計系統讓 deck 更可讀、更一致，也讓 renderer 不需要每頁重新發明風格。

**Independent Test**: 使用同一份 slide JSON，提供明確 style direction，例如「高密度 PM planning deck，強調風險、里程碑與 KPI」；驗證 design system、slide pattern mapping、chart treatment 與 layout decisions 符合風格且未新增來源未支持的內容。

**Independent Demo**: 展示 design system planning output 與 critique report，指出 palette、typography、visual density、layout patterns 與 chart style 的選擇理由。

**Acceptance Scenarios**:

1. **Given** 使用者提供 style direction，**When** 系統產生 design system，**Then** output 包含 palette、typography、spacing、visual density、layout grid、reusable slide patterns 與 chart style。
2. **Given** 系統使用 ui-ux-pro-max 輔助 design planning、layout selection 或 critique，**When** skill 產生建議，**Then** 建議只能影響 design system、slide pattern mapping、visual hierarchy、density、chart treatment、accessibility 與 design consistency，不得新增或改寫來源事實。
3. **Given** design planning 發生在 valid `SlideDeck` 之後，**When** ui-ux-pro-max 產生建議，**Then** 它不得改變 deck order、title/message wording、outline meaning、speakerNotesDraft factual content 或 review warnings。
4. **Given** deck 有多張 slides，**When** 系統 render HTML preview，**Then** slides 的視覺語言、元件樣式與資訊密度保持一致。

### Edge Cases

- Source content 太短，無法支撐多張 slides 或 chart emphasis。
- Source content 太長，超過單次生成可合理處理的內容量。
- Source content 沒有明確 heading、使用 markdown heading、inline heading、英文冒號、混合 bullet 或多主題長段落。
- LLM segmentation output schema invalid、source quote 無法對回原文、section 順序錯誤或 coverage 不足。
- LLM format repair 後仍輸出 invalid schema、額外欄位、空 `sourceQuotes`、改寫後 quote 或錯誤 order。
- Deterministic deck plan proposal 引用不存在的 source section、source fact 或 chart intent。
- Source content 太短，無法達到 3 張 slides；系統仍應產生可展示 deck 並在 review note 說明。
- Source content 太長，超過 8 張 hard cap；系統需合併或壓縮，並把壓縮內容記錄到 review report。
- Slide outline 太空泛、沒有 source trace、或把 speaker notes draft 的推論寫成事實。
- Deck plan 試圖產生 complex role、appendix 或重排來源順序。
- HTML renderer 不小心把 `speakerNotesDraft` 顯示在 presentation view。
- Segmentation guidance 要求新增、改寫、刪除或強化 source content 未支持的事實。
- 使用者沒有填寫 optional style direction 或 chart emphasis。
- Chart emphasis 找不到對應數字、單位、期間或上下文。
- 數字資料不足以形成 chart，只能安全呈現為文字或表格。
- Source content 包含中英混合內容。
- 使用者嘗試在 request 中指定 backend-owned provider/model 或 generation setting。
- design planning / critique 建議與 source fidelity 衝突。
- HTML 可以生成，但 keyboard navigation、16:9 layout 或 responsive behavior 失效。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept pasted source content as the generation source.
- **FR-002**: System MUST accept deck purpose, audience, style direction, free-text chart emphasis, and optional segmentation guidance as generation brief fields.
- **FR-003**: System MUST generate structured slide JSON before HTML rendering.
- **FR-004**: Slide JSON MUST include deck metadata, design system, slides, content blocks, and source trace references where applicable.
- **FR-005**: System MUST generate a review report for every generation.
- **FR-006**: Review report MUST include assumptions, omitted or compressed content, uncertain claims, charting decisions, and human review notes.
- **FR-007**: System MUST produce semantic slide titles grounded in source content.
- **FR-008**: System MUST identify important source facts, including numbers, dates, named entities, decisions, risks, constraints, owners, deadlines, and stated tradeoffs.
- **FR-009**: System MUST first inspect source content for numeric descriptions and visualization logic, then decide whether numeric content should become chart, metric card, table, fallback text, or review note.
- **FR-010**: Numeric visualization decisions MUST preserve original numbers, units, periods, denominators, and context.
- **FR-011**: System MUST NOT invent missing data or unsupported claims for charting or slide titles.
- **FR-012**: System MUST produce self-contained HTML slides from valid slide JSON.
- **FR-013**: HTML slides MUST support local preview in a browser without a backend.
- **FR-014**: HTML slides MUST support keyboard next/previous navigation.
- **FR-015**: HTML slides MUST preserve 16:9 presentation format and basic responsive behavior for common laptop and projector sizes.
- **FR-016**: System MUST use a deck-level design system for generated HTML slides.
- **FR-017**: System MUST use backend-configured LLM-assisted semantic segmentation to split source content into source-grounded sections before downstream deck planning.
- **FR-018**: System MUST use ui-ux-pro-max as part of the generation flow for design planning, layout selection, chart treatment, and critique.
- **FR-019**: ui-ux-pro-max usage MUST NOT invent facts, alter source meaning, or override review notes.
- **FR-020**: System MUST keep LLM provider and model selection as backend runtime configuration, not user-facing request fields, response fields, or generated review-report fields.
- **FR-021**: System MUST reject unsupported request fields that try to configure provider/model or design-planning skill usage because those are backend-owned flow decisions.
- **FR-022**: System MUST expose enough artifacts for review: slide JSON, review report, generated HTML, and verification evidence.
- **FR-023**: System MUST provide a local web app flow with input form, local agent/API boundary, browser preview route, and downloadable self-contained HTML artifact.
- **FR-024**: System MUST merge automatically detected numeric visualization opportunities with user-provided chart emphasis into a unified `ChartIntent` decision set.
- **FR-025**: System MUST keep preview artifacts session-only for the first implementation slice: generated results are visible in the current local web app session and are not persisted as deck history, database records, or automatic artifact storage.
- **FR-026**: After generation, the local web app MUST show slides preview, review report, slide JSON, generation summary, and a download action for the self-contained HTML.
- **FR-027**: LLM segmentation output MUST validate against an internal semantic segmentation schema before it is used for slide planning.
- **FR-028**: Each semantic segment MUST preserve exact source quotes from the pasted content; generated section headings may summarize meaning, but segment body/source quotes MUST NOT rewrite source text.
- **FR-029**: System MUST validate semantic segment order, source quote exact-match grounding, and coverage of important source content; failed validation MUST trigger deterministic fallback segmentation.
- **FR-030**: Source facts, chart decisions, source trace, and review report behavior MUST remain deterministic or validation-backed after segmentation so these outputs remain testable and traceable.
- **FR-031**: `segmentationGuidance` MUST be treated only as segmentation preference and MUST NOT be interpreted as source truth.
- **FR-032**: Prompt construction MUST isolate `segmentationGuidance` from system instructions and source content, and MUST instruct the LLM to ignore conflicting or fact-changing guidance.
- **FR-033**: If initial LLM segmentation output fails schema validation, system MUST attempt at most one format repair using backend-configured LLM before deterministic fallback.
- **FR-034**: Format repair MUST be constrained to JSON/schema correction only and MUST NOT reinterpret source content, add facts, summarize differently, alter exact source quotes, or change source meaning.
- **FR-035**: Raw segmentation validation errors MUST be preserved in internal evidence, while user-facing review notes MUST describe the issue in understandable terms such as "AI 語意切段格式未通過驗證，已自動修復" or "已改用保守切段"; raw schema paths/messages MUST NOT be the primary user-facing explanation.
- **FR-036**: Deck planning v1 MUST be deterministic and MUST NOT call LLM for deck plan generation.
- **FR-037**: System MUST separate deck planning into `DeckPlanner` and `DeckCompiler`: planner produces `DeckPlanProposal`; compiler validates references and produces final `SlideDeck`.
- **FR-038**: `DeckPlanProposal` MUST reference existing `SourceSection`, `SourceFact`, and `ChartIntent` identifiers instead of copying or inventing source facts.
- **FR-039**: `DeckCompiler` MUST validate every referenced source section, source fact, and chart intent before producing `SlideDeck`; invalid references MUST fail the proposal or trigger deterministic fallback planning.
- **FR-040**: Deck planning v1 MUST target 3-8 slides, allow fewer only when source content is too short, and enforce 8 slides as a hard cap.
- **FR-041**: Deck planning v1 MUST generate an opening slide, source-order content slides, and a closing slide only when source content contains next steps, actions, owners, or deadlines.
- **FR-042**: Deck planning v1 MUST NOT use `narrativeType`, complex slide role classification, appendix slides, or automatic reordering of metrics/risks/decisions ahead of source order unless the user explicitly requests it.
- **FR-043**: Every generated slide MUST include `slideKind: "opening" | "content" | "closing"`.
- **FR-044**: Every generated slide MUST include a source-grounded `outline` with one or more outline items, each carrying an emphasis category and source trace; normal target is 2-4 items per slide.
- **FR-045**: Every generated slide MUST include `speakerNotesDraft` as a conservative short presenter cue derived from slide outline/source trace; it MUST NOT add unsupported claims and MUST be at most 400 characters.
- **FR-046**: HTML rendering v1 MUST NOT render `speakerNotesDraft` in the presentation view.
- **FR-047**: Design planning may use ui-ux-pro-max skills only after `DeckCompiler` produces a valid `SlideDeck`, and critique may run after HTML rendering.
- **FR-048**: ui-ux-pro-max design layer MUST consume deck outline/layout intent as design input and MUST NOT alter deck order, source facts, title/message wording, outline meaning, speaker notes factual content, or review warnings.

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: Spec requires preserving important source facts and tracing them through slide JSON, source trace references, or review report.
- **CR-002 Review Report**: Spec requires assumptions, omitted/compressed content, uncertain claims, charting decisions, and human review notes.
- **CR-003 Web-First Output**: Spec limits the implementation artifact to self-contained HTML slides and local preview; publishing is out of scope.
- **CR-004 Backend-Configured LLM Boundary**: Spec keeps provider/model selection backend-owned and out of user request/response contracts while preserving internal operational evidence.
- **CR-005 Design System**: Spec requires deck-level palette, typography, spacing, visual density, layout grid, reusable slide patterns, and chart style.
- **CR-006 Semantic Titles**: Spec requires slide titles that summarize slide or paragraph meaning while staying grounded in source content.
- **CR-007 Data Visualization**: Spec requires layered data visualization decisions: automatic numeric-content inspection first, then user chart emphasis, then chart/metric/table/fallback/review-note decision based on source data completeness.
- **CR-008 TDD Coverage**: Spec requires focused tests or executable verification tasks for input handling, LLM semantic segmentation validation/fallback, deterministic deck planning/compiler behavior, slide outline/source trace, slide JSON, content core behavior, review report, chart decisions, HTML rendering, keyboard navigation, responsive behavior, and ui-ux-pro-max boundaries.
- **CR-009 Domain Model**: Spec identifies `SourceContent`, `SemanticSegment`, `SourceSection`, `DeckBrief`, `DeckPlanProposal`, `DeckSlideProposal`, `SlideOutlineItem`, `LayoutIntent`, `SlideDeck`, `Slide`, `ContentBlock`, `ChartIntent`, `DesignSystem`, `DesignPlanningResult`, `ReviewReport`, and `PreviewArtifact`.
- **CR-010 Lean Test Scope**: Tests should focus on observable behavior, domain rules, contracts, and key edge cases without redundant implementation-detail assertions.
- **CR-011 Behavior-Driven Value**: Each user story has Given/When/Then acceptance scenarios and independent test/demo paths.
- **CR-012 Code Simplicity**: Publishing, persistence, deck history, automatic artifact storage, file upload, PPTX export, full slide editing, and revision loop are excluded to keep this first implementation slice simple.
- **CR-013 Consistent Language**: Spec Kit artifact language is Traditional Chinese; domain names, schema keys, and code identifiers use English.
- **CR-014 Performance and Evidence**: Feature plan must define generation/rendering response targets or mark them N/A, and preserve evidence artifacts for review.
- **CR-015 Manual Verification**: Local preview, visual consistency, keyboard navigation, and responsive behavior require a manual verification path when not fully automatable.
- **CR-016 Verification**: Acceptance scenarios include slide JSON validity, review report presence, HTML rendering, keyboard navigation, and basic responsive behavior.

### Key Entities *(include if feature involves data)*

- **SourceContent**: 使用者貼上的原始內容，可能包含段落、標題、bullet points、數字、日期、決策、風險與限制。
- **SemanticSegment**: LLM-assisted segmentation output 的單位，包含 section heading、原文 exact quotes、順序、信心與 segmentation rationale；必須通過 deterministic validation 才能成為 `SourceSection`。
- **SegmentationRepairAttempt**: 初次 LLM segmentation output 未通過 schema 時的一次性格式修復嘗試；只能修 JSON 結構，不得重解釋或改寫來源內容。
- **SourceSection**: 經 segmentation validation 後可供 downstream content core 使用的來源段落。
- **DeckBrief**: 使用者提供的簡報目的、受眾、風格描述、圖表化重點、切段偏好、語言與語氣偏好。
- **DeckPlanProposal**: Deterministic deck planner 產生的中間 artifact，描述 source-order slide grouping、`slideKind`、title/message candidate、layout intent、outline candidate、speaker notes draft 與引用的 source/chart identifiers；v1 不由 LLM 產生。
- **DeckSlideProposal**: `DeckPlanProposal` 中的單頁 proposal，使用 `slideKind` 表示 opening/content/closing，不使用 complex role 或 narrative classification。
- **SlideDeck**: 產生後的 structured deck，包含 metadata、design system、slides 與 review report reference。
- **Slide**: 單張 slide，包含 `slideKind`、semantic title、message、layout、outline、content blocks、speaker notes draft 與 source trace。
- **SlideOutlineItem**: 單張 slide 的 source-grounded 大綱項目，標示重點類型、文字與 source trace。
- **LayoutIntent**: Deck planner 給 design/rendering layer 的輕量視覺意圖，用於 pattern selection，不是最終樣式。
- **ContentBlock**: slide 內的內容區塊，例如 paragraph、bullets、metric、table、timeline、callout、quote、chart placeholder 或 fallback text。
- **ChartIntent**: 對數字內容進行視覺化或不視覺化的決策，整合自動偵測到的 numeric visualization opportunities 與使用者自由文字 chart emphasis，包含來源數字、單位、期間、分母、圖表理由與 fallback reason。
- **DesignSystem**: deck-level 視覺系統，包含 palette、typography、spacing、visual density、layout grid、component patterns 與 chart style。
- **DesignPlanningResult**: valid `SlideDeck` 進入 HTML rendering 前的 design handoff artifact，包含 design system、slide pattern mapping、chart treatment 與 critique notes；不得改變來源內容或 deck wording。
- **ReviewReport**: 審查 artifact，列出 assumptions、omitted/compressed content、uncertain claims、charting decisions 與 human review notes。
- **PreviewArtifact**: 本機 preview 用的 session-only artifact，包含 self-contained HTML、slide JSON、review report、generation summary 與驗證狀態；不代表已持久化的 deck record。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 使用者可以用 pasted source content、purpose、audience、style direction 與 chart emphasis 完成一次本機 deck generation flow。
- **SC-002**: 對於包含至少五個重要來源事實的測試輸入，slide JSON、source trace 或 review report 能保留全部五個事實且不改變語意。
- **SC-003**: 對於沒有明確 heading 或混合格式的測試輸入，LLM semantic segmentation output 能通過 schema、exact quote grounding 與 source order validation；若初次 schema validation 失敗，系統最多嘗試一次 format repair；若 repair 或後續 validation 仍失敗，系統能 fallback 並產生 review/evidence note。
- **SC-004**: 對於包含 segmentation guidance 的測試輸入，semantic segmentation 可以依 guidance 調整分組；對於與 source content 衝突的 guidance，系統能忽略衝突部分並產生 warning/evidence note。
- **SC-005**: 對於包含足夠數字資料與可視覺化邏輯的測試輸入，系統能先自動偵測 numeric visualization opportunities，再結合 chart emphasis 產生 chart/metric/table decision；對於資料不足的輸入，系統能產生 no-chart rationale。
- **SC-006**: 每次 generation 都產生 review report，且包含 assumptions、omitted/compressed content、uncertain claims、charting decisions 與 review notes。
- **SC-007**: 對於固定 source artifact fixture，deterministic `DeckPlanner` 會產生穩定的 `DeckPlanProposal`，且 v1 deck planning 不需要 LLM。
- **SC-008**: 對於每張 generated slide，slide JSON 會包含 `slideKind`、至少一個 `outline` item、source trace 與必填 `speakerNotesDraft`；`speakerNotesDraft` 必須只描述 outline/source facts 支持的內容。
- **SC-009**: 有效 slide JSON 能 render 成 self-contained HTML slides，並可在 browser 本機開啟。
- **SC-010**: HTML preview 支援 keyboard next/previous navigation。
- **SC-011**: HTML preview 在至少一個 laptop 尺寸與一個 projector-like 16:9 尺寸下不出現主要內容重疊。
- **SC-012**: Verification evidence 包含 semantic segmentation schema validation、source quote grounding check、segmentation guidance handling result、deck planner/compiler validation、slide outline trace validation、speaker notes non-rendering check、slide JSON schema validation、review report validation、HTML rendering check、keyboard navigation check、basic responsive check，以及 manual verification notes。

## Assumptions

- 第一個實作 slice 只支援 pasted text input，不支援 file upload。
- 第一個實作 slice 以 local web app 為 app 形態，支援 session-only browser preview route 與下載 self-contained HTML；不支援 publish to URL、deck history、database persistence 或自動 artifact storage。
- `/speckit-plan` 應以 React + TypeScript frontend 與 NestJS backend 作為 preferred architecture；若 plan 改用其他 stack，必須記錄理由與 rejected simpler/company-standard alternative。
- Preview revision 可透過重新生成處理；完整 revision loop 不在範圍內。
- Native PPTX export、account system、persistence 與 full slide editor 不在範圍內。
- 第一版 agent generation 採 LLM-assisted semantic segmentation + deterministic validation/content core + ui-ux-pro-max design layer；LLM segmentation 用於語意切段，content core 保護來源事實與可測性，ui-ux-pro-max 用於 design planning、layout selection、chart treatment 與 critique。
- 第一版 deck planning 不導入 LLM；`DeckPlanProposal` 由 deterministic planner 產生，`SlideDeck` 由 deterministic compiler 產出。未來若加入 LLM，也只能輔助 proposal，不得直接產 final `SlideDeck`。
- 第一版 deck planning 不使用 narrative type 或複雜 slide role；只用 `slideKind` 區分 opening/content/closing，並維持來源順序。
- 第一版不讓使用者選擇 LLM provider、model 或 design-planning skill 開關；這些由 backend flow 配置，且不出現在生成 response 或 review report。
- Output language 預設跟隨 source content，除非使用者另有指定。
- ui-ux-pro-max 是 design planning、layout selection 與 critique 輔助，不是 DeckPlanner、source truth 或 fact generator。

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: Review report 必須揭露推論出的 audience needs、deck purpose、design assumptions、charting assumptions 與 fallback behavior。
- **Omitted or Compressed Content Policy**: Review report 必須列出被省略或顯著壓縮的重要內容，尤其是 decisions、risks、deadlines、metrics 與 constraints。
- **Uncertain Claims Policy**: Unsupported 或 ambiguous claims 必須標示為 uncertain，不得呈現為已驗證事實。
- **Sensitive Content Handling**: Source content 可能送往 backend-configured LLM provider；provider/model 不作為使用者 request/response contract，內部 evidence 必須足以讓 reviewer 理解敏感內容處理邊界。
- **Segmentation Repair/Fallback Policy**: 初次 LLM segmentation schema validation 失敗時，只允許一次 format repair；repair prompt 必須明確禁止重解釋、摘要、擴寫、刪除或修改來源語意。repair 成功時 review/evidence 必須記錄曾進行自動格式修復；repair 或 grounding/order/coverage validation 失敗時必須使用 deterministic fallback，並以人能理解的 review note 說明已改用保守切段。
- **Deck Outline and Speaker Notes Policy**: Slide outline 是可審查的 deck artifact，必須具備 source trace。`speakerNotesDraft` 是 presenter 輔助文字，不是 source truth；不得加入 outline/source trace 無法支持的 claim，且若內容被壓縮或需要人工確認，必須進 review notes。
- **Deck Structure Policy**: Deck 必須有 opening slide，content slides 必須維持來源順序，closing slide 只能由來源中的 next steps/action/owner/deadline 支持；v1 不使用 appendix、narrative type 或 complex role。
- **Design Handoff Policy**: ui-ux-pro-max 只在 valid `SlideDeck` 後進行 design planning，並可在 HTML 後進行 critique；不得改動 deck order、title/message wording、outline meaning、speaker notes factual content 或 review warnings。
- **Evidence and Traceability**: Review evidence 必須包含 sample input、semantic segmentation validation result、source quote grounding result、slide JSON、review report、generated HTML artifact、schema/render/navigation/responsive verification result，以及 manual verification notes。
- **Manual Verification Path**: 若 visual consistency、layout overlap 或 browser preview behavior 無法完全自動化，quickstart 必須提供明確手動檢查步驟。
