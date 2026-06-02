# Tasks: Generate Previewable HTML Slides

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Input**: Design documents from `/specs/002-generate-previewable-html-slides/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: 所有 production behavior 必須先有 focused failing test 或 executable verification task。測試聚焦 observable behavior、domain rules、contracts、renderer output、browser navigation 與必要 manual verification evidence。

**Organization**: Tasks are grouped by user story to enable independent implementation, independent demonstration, and independent testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立 React + TypeScript frontend、NestJS backend、shared domain/contracts packages 的最小 monorepo scaffold。此階段只做 spec 支援的 scaffold，不實作產品行為。

- [X] T001 Create monorepo directories `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, and `tests/fixtures`
- [X] T002 Initialize root TypeScript workspace configuration in `package.json`, `tsconfig.base.json`, and workspace package manifests
- [X] T003 [P] Configure shared linting and formatting in `eslint.config.js` and `.prettierrc`
- [X] T004 [P] Configure test scripts for domain, API, web, and e2e targets in root `package.json`
- [X] T005 [P] Create sample fixture `tests/fixtures/planning-brief.md` from `quickstart.md`
- [X] T006 [P] Create expected fact fixture `tests/fixtures/expected-source-facts.json`
- [X] T007 [P] Create expected chart fixture `tests/fixtures/expected-chart-intents.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立共用 contracts、domain skeleton、API boundary、renderer boundary、evidence path。完成前不得進入 user story implementation。

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 [P] Copy JSON schema contract into `packages/contracts/schemas/slide-generation.schema.json`
- [X] T009 [P] Create contract exports in `packages/contracts/src/index.ts`
- [X] T010 [P] Create domain model type definitions in `packages/domain/src/deck/deck.types.ts`
- [X] T011 [P] Create review report type definitions in `packages/domain/src/review/types.ts`
- [X] T012 [P] Create chart intent type definitions in `packages/domain/src/content-core/chart-intent.types.ts`
- [X] T013 [P] Create design system type definitions in `packages/domain/src/design/types.ts`
- [X] T014 Create deterministic content core service skeleton in `packages/domain/src/content-core/content-core-planner.ts`
- [X] T015 Create chart intent planner skeleton in `packages/domain/src/content-core/chart-intent-planner.ts`
- [X] T016 Create design planner boundary in `packages/domain/src/design/design-planner.ts`
- [X] T017 Create HTML generation boundary in `packages/domain/src/rendering/html-deck-renderer.ts`
- [X] T018 Create NestJS slides module skeleton in `apps/api/src/modules/slides/slides.module.ts`
- [X] T019 Create NestJS slides controller skeleton in `apps/api/src/modules/slides/slides.controller.ts`
- [X] T020 Create React slide generation feature shell in `apps/web/src/features/slide-generation/`
- [X] T021 Create evidence notes file `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: Foundation ready. Domain, contracts, API boundary, renderer boundary, and evidence path exist.

---

## Phase 3: User Story 1 - 產生可審查的 Slide Deck (Priority: P1) MVP

**Goal**: 使用者貼上內容與 brief 後，系統產生 deterministic slide JSON、source trace、chart intents 與 review report。

**Independent Test**: 使用 fixture input 驗證 slide JSON、review report、source facts、semantic titles 與 chart decisions，不需要 HTML preview 或 UI。

### Tests for User Story 1 (REQUIRED - write first)

- [X] T022 [P] [US1] Write failing contract validation test for preview request in `packages/contracts/test/preview-request.contract.test.ts`
- [X] T023 [P] [US1] Write failing domain test for source fact extraction in `packages/domain/test/content-core/source-facts.test.ts`
- [X] T024 [P] [US1] Write failing domain test for semantic title generation in `packages/domain/test/content-core/semantic-titles.test.ts`
- [X] T025 [P] [US1] Write failing domain test for layered chart intent decisions in `packages/domain/test/content-core/chart-intents.test.ts`
- [X] T026 [P] [US1] Write failing domain test for review report required fields in `packages/domain/test/review/review-report.test.ts`
- [X] T027 [US1] Document manual demo path for slide JSON and review report in `specs/002-generate-previewable-html-slides/quickstart.md`

### Implementation for User Story 1

- [X] T028 [US1] Implement request schema validation in `packages/contracts/src/preview-request.ts`
- [X] T029 [US1] Implement source section parsing in `packages/domain/src/content-core/source-parser.ts`
- [X] T030 [US1] Implement source fact extraction in `packages/domain/src/content-core/source-fact-extractor.ts`
- [X] T031 [US1] Implement semantic title generation in `packages/domain/src/content-core/semantic-title-planner.ts`
- [X] T032 [US1] Implement layered chart intent planner in `packages/domain/src/content-core/chart-intent-planner.ts`
- [X] T033 [US1] Implement review report builder in `packages/domain/src/review/review-report-builder.ts`
- [X] T034 [US1] Implement slide deck planner in `packages/domain/src/deck/slide-deck-planner.ts`
- [X] T035 [US1] Wire deterministic preview generation use case in `packages/domain/src/deck/generate-preview-deck.ts`
- [X] T036 [US1] Capture US1 evidence in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US1 independently produces reviewable `SlideDeck` and `ReviewReport` from fixture input.

---

## Phase 3A: User Story 1 Revision - LLM-Assisted Semantic Segmentation

**Goal**: 在進入 HTML generation 前，將 source section parsing 從 regex-only parser 升級為 backend-configured LLM-assisted semantic segmentation，並用 deterministic schema/quote/order/coverage validation 保護 source fidelity。

**Independent Test**: 使用不規則格式 fixture 驗證 LLM segmentation output schema、exact source quote grounding、source order validation 與 deterministic fallback；不需要 HTML preview 或 UI。

**Blocking**: 完成此 revision 前，不得進入 US2 implementation。US1 既有 deterministic parser 保留為 fallback。

### Tests for US1 Semantic Segmentation Revision (REQUIRED - write first)

- [X] T078 [P] [US1R] Write failing internal schema contract test for LLM segmentation output in `packages/contracts/test/semantic-segmentation.contract.test.ts`
- [X] T079 [P] [US1R] Write failing domain test for source quote grounding validation in `packages/domain/test/content-core/semantic-segmentation-validation.test.ts`
- [X] T080 [P] [US1R] Write failing domain test for deterministic fallback when LLM segmentation is invalid in `packages/domain/test/content-core/semantic-segmentation-fallback.test.ts`
- [X] T081 [P] [US1R] Write failing API adapter prompt contract test in `apps/api/test/semantic-segmentation-prompt.test.ts`
- [X] T081a [P] [US1R] Write failing API adapter prompt test that treats `segmentationGuidance` as preference-only and ignores fact-changing guidance in `apps/api/test/semantic-segmentation-guidance.test.ts`
- [X] T082 [US1R] Document prompt review and segmentation evidence path in `specs/002-generate-previewable-html-slides/quickstart.md`

### Implementation for US1 Semantic Segmentation Revision

- [X] T083 [US1R] Copy internal semantic segmentation schema into `packages/contracts/schemas/semantic-segmentation.schema.json`
- [X] T084 [US1R] Export semantic segmentation schema id and contract helpers from `packages/contracts/src/semantic-segmentation.ts`
- [X] T085 [US1R] Define `SemanticSegment`, `SourceQuote`, and `SegmentationValidation` domain types in `packages/domain/src/content-core/semantic-segmentation.types.ts`
- [X] T086 [US1R] Implement semantic segmentation validator for schema result, exact source quote grounding, source order, and important-content coverage in `packages/domain/src/content-core/semantic-segmentation-validator.ts`
- [X] T087 [US1R] Keep deterministic parser as fallback segmenter in `packages/domain/src/content-core/source-parser.ts`
- [X] T088 [US1R] Define semantic segmenter port/interface in `packages/domain/src/content-core/semantic-segmenter.port.ts`
- [X] T089 [US1R] Implement backend LLM semantic segmentation prompt builder and adapter boundary in `apps/api/src/adapters/llm/semantic-segmentation.adapter.ts`
- [X] T090 [US1R] Wire semantic segmentation + validation + fallback before source fact extraction in the preview generation flow
- [X] T091 [US1R] Capture segmentation schema, prompt, quote-grounding, fallback, and review evidence in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US1 produces reviewable `SlideDeck` and `ReviewReport` from LLM-assisted semantic sections when valid, and from deterministic fallback when validation fails.

---

## Phase 3B: User Story 1 Revision - Segmentation Format Repair and Conservative Fallback UX

**Goal**: 初次 LLM semantic segmentation schema validation 失敗時，系統最多嘗試一次格式修復；修復仍失敗或 grounding/order/coverage validation 失敗時，使用 deterministic fallback，並輸出人能理解的 review note 與可追溯 internal evidence。

**Independent Test**: 使用 malformed LLM segmentation fixture 驗證一次 format repair、禁止多次 retry、repair prompt 不得改寫來源語意、repair 失敗後 deterministic fallback，以及 review/evidence 不直接暴露 raw schema error 給使用者。

**Blocking**: 完成此 revision 前，不得進入 US2 implementation。US1R 既有 deterministic fallback 保留，但需補上 bounded repair 與使用者可理解的 fallback 說明。

### Tests for US1 Segmentation Repair Revision (REQUIRED - write first)

- [X] T092 [P] [US1R2] Write failing contract/domain test for one format repair attempt after invalid initial segmentation schema in `packages/domain/test/content-core/semantic-segmentation-repair.test.ts`
- [X] T093 [P] [US1R2] Write failing domain test that repair failure triggers deterministic fallback and records repair/fallback issue in `packages/domain/test/content-core/semantic-segmentation-fallback.test.ts`
- [X] T094 [P] [US1R2] Write failing API adapter prompt test for repair-only instructions that forbid reinterpretation, summarization, expansion, deletion, or source quote rewriting in `apps/api/test/semantic-segmentation-repair-prompt.test.ts`
- [X] T095 [P] [US1R2] Write failing review report/evidence test that user-facing notes explain repair/fallback plainly and do not expose raw schema paths as the primary message in `packages/domain/test/review/segmentation-review-notes.test.ts`

### Implementation for US1 Segmentation Repair Revision

- [X] T096 [US1R2] Define segmentation repair attempt types and result fields in `packages/domain/src/content-core/semantic-segmentation.types.ts`
- [X] T097 [US1R2] Implement semantic segmentation repair coordinator that allows at most one repair attempt before deterministic fallback in `packages/domain/src/content-core/semantic-segmentation-repair.ts`
- [X] T098 [US1R2] Implement backend LLM repair prompt builder in `apps/api/src/adapters/llm/semantic-segmentation.adapter.ts`
- [X] T099 [US1R2] Wire repair success/failure, fallback reason, and user-readable review notes into preview generation flow before source fact extraction
- [X] T100 [US1R2] Update quickstart/evidence examples with malformed initial output, repaired output, fallback case, and review note sample in `specs/002-generate-previewable-html-slides/evidence.md`
- [X] T101 [US1R2] Run focused contract/domain/API tests for segmentation repair and record results in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US1 handles invalid initial LLM segmentation output without raw user-facing schema errors: one repair attempt if possible, deterministic fallback if needed, and review/evidence that explains what happened.

---

## Phase 3C: User Story 1 Revision - Deterministic Deck Planning and Slide Outlines

**Goal**: 將 deck layer 明確拆成 deterministic `DeckPlanner` 與 `DeckCompiler`。Planner 產生 source-order-preserving `DeckPlanProposal`；Compiler 驗證 source/chart references 後產出 `SlideDeck`。每張 slide 必須包含 `slideKind`、source-grounded outline，並產生保守 `speakerNotesDraft`。v1 不使用 LLM、`narrativeType`、complex role、appendix 或自動重排來源內容。

**Independent Test**: 使用固定 source sections、source facts、chart intents 與 deck brief fixture，驗證 deterministic proposal、3-8 slide target、opening/source-order/conditional-closing order、compiler reference validation、每頁 outline source trace、保守 speaker notes draft，以及 v1 deck planning 不呼叫 LLM。

**Blocking**: 完成此 revision 前，不得進入 US2 implementation。US2 renderer 必須依賴含 outline/source trace 的有效 `SlideDeck`。

### Tests for US1 Deck Planning Revision (REQUIRED - write first)

- [X] T102 [P] [US1R3] Write failing domain test for deterministic source-order `DeckPlanProposal` with opening slide, 3-8 target, merge/split behavior, and conditional closing in `packages/domain/test/deck/deck-plan-proposal.test.ts`
- [X] T103 [P] [US1R3] Write failing domain test for `DeckCompiler` rejecting unknown source section, source fact, or chart intent references in `packages/domain/test/deck/deck-compiler-validation.test.ts`
- [X] T104 [P] [US1R3] Write failing domain test that every slide has `slideKind` and source-grounded `outline` items with emphasis and source trace in `packages/domain/test/deck/slide-outline.test.ts`
- [X] T105 [P] [US1R3] Write failing domain test for required conservative `speakerNotesDraft` that is at most 400 characters and does not add unsupported claims in `packages/domain/test/deck/speaker-notes-draft.test.ts`
- [X] T106 [P] [US1R3] Write failing contract/schema test that `Slide` requires `slideKind`, `outline`, `layoutIntent`, and `speakerNotesDraft` instead of final-sounding `speakerNotes` in `packages/contracts/test/slide-generation-schema.test.ts`

### Implementation for US1 Deck Planning Revision

- [X] T107 [US1R3] Define `DeckPlanProposal`, `DeckSlideProposal`, `SlideOutlineItem`, and `LayoutIntent` types with `slideKind` and no `narrativeType`/complex role in `packages/domain/src/deck/deck.types.ts`
- [X] T108 [US1R3] Implement deterministic source-order deck planner with opening slide, short-section merge, long-section conservative split, conditional closing, 3-8 target, and 8-slide hard cap in `packages/domain/src/deck/deck-planner.ts`
- [X] T109 [US1R3] Implement deck compiler reference validation, deterministic fallback trigger, and stable sourceTrace dedupe/sort in `packages/domain/src/deck/deck-compiler.ts`
- [X] T110 [US1R3] Wire deck planner/compiler into preview generation flow and remove direct slide construction from `packages/domain/src/deck/slide-deck-planner.ts`
- [X] T111 [US1R3] Update slide-generation schema and contract package schema to require `slideKind`, slide outline, `layoutIntent`, and `speakerNotesDraft`
- [X] T112 [US1R3] Capture deck proposal, compiler validation, source-order/slide-count check, outline trace, speaker notes draft, and focused test evidence in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US1 produces `SlideDeck` through deterministic planner/compiler, every slide has source-grounded outline, and speaker notes draft remains conservative and reviewable.

---

## Phase 4: User Story 2 - LLM-Assisted Render Self-Contained HTML Slides (Priority: P2)

**Goal**: 使用有效 slide JSON 與 HTML-generation-consumable `DesignPlanningResult`，透過 backend-configured LLM-assisted HTML generation 產生 self-contained HTML，並用 deterministic validation/repair/fallback 保護 content fidelity、design compliance、speaker notes non-rendering、navigation 與 self-contained resource boundary；local web app session 顯示 preview、review report、JSON、design planning result、HTML validation result、summary 並下載 HTML。

**Independent Test**: 使用固定 slide JSON + `DesignPlanningResult` fixture 驗證 HTML generation prompt、LLM adapter boundary、HTML validation、one repair attempt、fallback renderer、API response、preview UI、download HTML、keyboard navigation；HTML generation 不得重新解讀 `styleDirection` 或改寫 source-supported content。

### Tests for User Story 2 (REQUIRED - write first)

- [X] T037 [P] [US2] Write failing HTML generation prompt contract test for self-contained HTML output from `SlideDeck` + `DesignPlanningResult` in `packages/domain/test/rendering/html-generation-prompt.test.ts`
- [X] T037a [P] [US2] Write failing HTML generation test that prompt and validation consume `DesignPlanningResult` pattern assignments and hierarchy instead of reinterpreting `styleDirection` in `packages/domain/test/rendering/design-planning-consumption.test.ts`
- [X] T037b [P] [US2] Write failing HTML validation test rejecting external resources, slide reorder/omission, title/message/outline drift, unsupported facts, design drift, and rendered `speakerNotesDraft` in `packages/domain/test/rendering/html-generation-validator.test.ts`
- [X] T037c [P] [US2] Write failing HTML repair/fallback test proving one repair attempt before conservative fallback renderer in `packages/domain/test/rendering/html-generation-repair-fallback.test.ts`
- [X] T038 [P] [US2] Write failing renderer test for keyboard navigation script presence in `packages/domain/test/rendering/keyboard-navigation.test.ts`
- [X] T038a [P] [US2] Write failing renderer test that self-contained HTML does not render `speakerNotesDraft` in presentation view in `packages/domain/test/rendering/speaker-notes-visibility.test.ts`
- [X] T039 [P] [US2] Write failing API contract test for `POST /api/slides/preview` response including `slideDeck`, `designPlanningResult`, `previewArtifact.html`, `previewArtifact.htmlGenerationValidation`, and `generationSummary` in `apps/api/test/slides-preview.contract.test.ts`
- [X] T039a [P] [US2] Write failing contract/schema test requiring `previewArtifact.htmlGenerationValidation` fields and rejecting extra HTML-generation provider/model fields in `packages/contracts/test/slide-generation-schema.test.ts`
- [X] T040 [P] [US2] Write failing web component test for generated artifact display including design planning result in `apps/web/src/features/slide-generation/slide-generation-view.test.tsx`
- [X] T041 [P] [US2] Write failing Playwright test for preview route keyboard navigation in `apps/web/tests/e2e/preview-navigation.spec.ts`
- [X] T042 [US2] Document manual downloaded-HTML verification path in `specs/002-generate-previewable-html-slides/quickstart.md`

### Implementation for User Story 2

- [X] T043 [US2] Define HTML generation domain types `HtmlGenerationAttempt`, `HtmlGenerationValidation`, and `HtmlRepairAttempt` in `packages/domain/src/rendering/html-generation.types.ts`
- [X] T043a [US2] Define HTML generator port/boundary separately from behavior in `packages/domain/src/rendering/html-generator.port.ts`
- [X] T043b [US2] Implement HTML generation prompt builder from `SlideDeck`, `DesignPlanningResult`, and HTML generation constraints in `packages/domain/src/rendering/html-generation-prompt.ts`
- [X] T043c [US2] Implement deterministic HTML generation validator for self-contained resources, content fidelity, design compliance, speaker notes non-rendering, and keyboard navigation in `packages/domain/src/rendering/html-generation-validator.ts`
- [X] T043d [US2] Implement conservative fallback HTML renderer accepting `SlideDeck` + `DesignPlanningResult` in `packages/domain/src/rendering/fallback-html-renderer.ts`, excluding `speakerNotesDraft` from presentation view
- [X] T043e [US2] Implement HTML generation coordinator with one repair attempt before fallback in `packages/domain/src/rendering/html-deck-renderer.ts`
- [X] T044 [US2] Implement scoped deck CSS generation from `DesignSystem` tokens for fallback and prompt constraints in `packages/domain/src/rendering/deck-css.ts`
- [X] T045 [US2] Implement keyboard navigation script generation in `packages/domain/src/rendering/deck-navigation-script.ts`
- [X] T046 [US2] Implement generation summary builder in `packages/domain/src/deck/generation-summary.ts`
- [X] T047 [US2] Implement NestJS preview endpoint in `apps/api/src/modules/slides/slides.controller.ts`
- [X] T048 [US2] Implement NestJS preview service orchestration that produces a valid `SlideDeck`, calls `await UiUxProMaxDesignPlanner.plan({ slideDeck, deckBrief, chartIntents })`, passes the resulting `DesignPlanningResult` into HTML generation, and returns `designPlanningResult`, `htmlGenerationValidation`, and session-only preview artifact in `apps/api/src/modules/slides/slides.service.ts`
- [X] T048a [US2] Implement backend HTML generation LLM adapter boundary in `apps/api/src/adapters/html-generation/html-generation.adapter.ts`
- [X] T049 [US2] Implement React input form in `apps/web/src/features/slide-generation/SlideGenerationForm.tsx`
- [X] T050 [US2] Implement React preview panel in `apps/web/src/features/slide-generation/SlidePreviewPanel.tsx`
- [X] T051 [US2] Implement React review report panel in `apps/web/src/features/slide-generation/ReviewReportPanel.tsx`
- [X] T052 [US2] Implement React slide JSON panel in `apps/web/src/features/slide-generation/SlideJsonPanel.tsx`
- [X] T052a [US2] Implement React design planning result panel in `apps/web/src/features/slide-generation/DesignPlanningPanel.tsx`
- [X] T052b [US2] Implement React HTML generation validation panel in `apps/web/src/features/slide-generation/HtmlGenerationValidationPanel.tsx`
- [X] T053 [US2] Implement React generation summary panel in `apps/web/src/features/slide-generation/GenerationSummaryPanel.tsx`
- [X] T054 [US2] Implement downloadable HTML action in `apps/web/src/features/slide-generation/download-html.ts`
- [X] T055 [US2] Capture US2 evidence in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US2 independently renders and previews self-contained HTML from valid slide JSON and supports download.

---

## Phase 5: User Story 3 - Apply Design Planning and Critique (Priority: P3)

**Goal**: 使用 deterministic content core 和 valid `SlideDeck` 保護來源事實，同時讓 backend-configured ui-ux-pro-max/LLM design planning port 作為主要 design system 來源，產生 HTML-generation-consumable `DesignPlanningResult`，包含 design system、slide pattern assignment、chart treatment、visual hierarchy、accessibility notes、design review notes 與 consistency validation；domain 只負責 deterministic validation、bounded fallback 與 source-fidelity guardrails，且不得新增、改寫或重排來源內容。

**Independent Test**: 使用同一 valid `SlideDeck`、`DeckBrief`、`ChartIntent[]`、style direction 與 slide `layoutIntent`，以 fake `DesignPlanningGenerationPort` 驗證 `UiUxProMaxDesignPlanner` 採用 ui-ux-pro-max/LLM 產生的完整 `DesignPlanningResult`；再用 invalid generated result 驗證 deterministic validation/fallback。測試必須確認 design layer 不改變 deck order、title/message wording、outline meaning、speaker notes factual content，也不能把 LLM provider/model 暴露到 user-facing artifacts。

### Tests for User Story 3 (REQUIRED - write first)

- [X] T056 [P] [US3] Write failing design planner test for valid `SlideDeck` + `DeckBrief` + `ChartIntent[]` + style direction + slide `layoutIntent` to full `DesignPlanningResult` in `packages/domain/test/design/design-planner.test.ts`
- [X] T057 [P] [US3] Write failing ui-ux-pro-max adapter boundary test proving `generateDesignPlanningResult()` builds a schema-bound design planning prompt from `SlideDeck` + `DeckBrief` + `ChartIntent[]` + style direction + slide `layoutIntent`, excludes provider/model from public artifacts, and returns a full `DesignPlanningResult` in `apps/api/test/adapters/ui-ux-pro-max.adapter.test.ts`
- [ ] T058 [P] [US3] Write failing source-fidelity boundary test proving generated design planning output is rejected when it adds unsupported source facts, extra slide ids, or chart context not present in `SlideDeck`/`ChartIntent[]` in `packages/domain/test/design/source-fidelity-boundary.test.ts`
- [ ] T058a [P] [US3] Write failing deck-design boundary test proving generated design planning output is rejected when it changes deck order, title/message wording, outline meaning, or speaker notes factual content in `packages/domain/test/design/deck-design-boundary.test.ts`
- [X] T058b [P] [US3] Write failing contract/schema test that response requires `designPlanningResult` and rejects `deckBrief.tone` and `DesignSystem.uiUxProMaxNotes` in `packages/contracts/test/slide-generation-schema.test.ts`
- [ ] T058c [P] [US3] Write failing design consistency validation test for generated `DesignPlanningResult` that checks required slide coverage, supported palette/typography/density/pattern tokens, chart treatment coverage, and explicit fallback evidence in `packages/domain/test/design/design-consistency-validator.test.ts`
- [ ] T058d [P] [US3] Write failing chart treatment validation test that preserves original numbers, units, periods, denominators, and fallback rationale from `ChartIntent[]` in `packages/domain/test/design/chart-treatment-plan.test.ts`
- [ ] T058e [P] [US3] Write failing visual hierarchy validation test for primary message fidelity, supporting evidence, secondary details, and de-emphasized content derived from slide title/message/outline in `packages/domain/test/design/visual-hierarchy-plan.test.ts`
- [ ] T059 [P] [US3] Write failing Playwright responsive smoke test in `apps/web/tests/e2e/responsive-preview.spec.ts`
- [ ] T060 [US3] Document manual visual consistency verification path in `specs/002-generate-previewable-html-slides/quickstart.md`

### Implementation for User Story 3

- [X] T060a [US3] Remove unconsumed fields `DeckBrief.tone`, `ChartIntent.userEmphasisMatched`, `DeckPlanProposal.id`, and `DesignSystem.uiUxProMaxNotes` from domain/contracts in `packages/domain/src/deck/deck.types.ts`, `packages/domain/src/content-core/chart-intent.types.ts`, `packages/domain/src/design/types.ts`, and `packages/contracts/src/index.ts`
- [X] T060b [US3] Update preview request validation to reject unsupported `deckBrief` fields such as `tone` in `packages/contracts/src/preview-request.ts`
- [X] T060c [US3] Sync slide generation schemas to require `designPlanningResult` and remove unconsumed fields in `packages/contracts/schemas/slide-generation.schema.json` and `specs/002-generate-previewable-html-slides/contracts/slide-generation.schema.json`
- [X] T060d [US3] Remove `SlideDeck.designSystem` from domain/contracts/API examples so `DesignSystem` only exists inside `DesignPlanningResult` in `packages/domain/src/deck/deck.types.ts`, `packages/domain/src/deck/deck-compiler.ts`, `packages/contracts/schemas/slide-generation.schema.json`, and `specs/002-generate-previewable-html-slides/contracts/api-contract.md`
- [X] T060e [US3] Stop exporting `defaultDesignSystem` from the root domain API and document it as an internal design-layer seed helper in `packages/domain/src/index.ts` and `packages/domain/docs/domain.md`
- [X] T060f [US3] Rename `DesignReviewNotes.rendererConstraints` to `htmlGenerationConstraints` across schema, API contract, data model, and regression tests in `packages/contracts/schemas/slide-generation.schema.json`, `specs/002-generate-previewable-html-slides/contracts/slide-generation.schema.json`, `specs/002-generate-previewable-html-slides/contracts/api-contract.md`, and `packages/contracts/test/slide-generation-schema.test.ts`
- [X] T061 [US3] Move existing design type declarations into `packages/domain/src/design/design.types.ts` and define `DesignPlanningResult`, `SlidePatternAssignment`, `ChartTreatmentPlan`, `VisualHierarchyPlan`, `AccessibilityNotes`, `DesignReviewNotes`, and `DesignConsistencyValidation`
- [X] T061a [US3] Define async `DesignPlanner.plan(input): Promise<DesignPlanningResult>` and `DesignPlanningGenerationPort.generateDesignPlanningResult(input)` separately from behavior in `packages/domain/src/design/design-planner.port.ts`
- [X] T061b [US3] Implement `UiUxProMaxDesignPlanner` as port-first orchestration: use `DesignPlanningGenerationPort` output when deterministic validation passes, otherwise produce conservative fallback `DesignPlanningResult` from valid `SlideDeck`, `DeckBrief`, `ChartIntent[]`, style direction, and slide `layoutIntent` in `packages/domain/src/design/design-planner.ts`
- [X] T061c [US3] Update design imports/exports so `design.types.ts` is exported through the design module/root API while deck types remain design-free in `packages/domain/src/index.ts`, `packages/domain/src/design/types.ts`, and `packages/domain/src/design/default-design-system.ts`
- [X] T061d [US3] Keep `defaultDesignSystem` as fallback-only design seed consumed by `UiUxProMaxDesignPlanner` when no ui-ux-pro-max/LLM port is configured or generated design output fails validation in `packages/domain/src/design/design-planner.ts` and `packages/domain/src/design/default-design-system.ts`
- [X] T062 [US3] Implement ui-ux-pro-max design planning prompt builder that serializes only `SlideDeck`, `DeckBrief`, `ChartIntent[]`, style direction, slide `layoutIntent`, supported renderer tokens, and source-fidelity constraints, and requires JSON matching `DesignPlanningResult` in `apps/api/src/adapters/ui-ux-pro-max/ui-ux-pro-max.prompt.ts`
- [X] T062a [US3] Implement `UiUxProMaxDesignPlanningAdapter` that implements `DesignPlanningGenerationPort.generateDesignPlanningResult()`, reads backend LLM provider/model/key from runtime config, calls the backend-configured LLM, parses JSON into `DesignPlanningResult`, and never exposes provider/model/key in user-facing artifacts in `apps/api/src/adapters/ui-ux-pro-max/ui-ux-pro-max.adapter.ts`
- [X] T062b [US3] Wire `UiUxProMaxDesignPlanningAdapter` into `SlidesModule`/`SlidesService` so `UiUxProMaxDesignPlanner` receives the production `designPlanningPort` for preview generation, while tests can inject fake ports, in `apps/api/src/modules/slides/slides.module.ts` and `apps/api/src/modules/slides/slides.service.ts`
- [X] T062c [US3] Add API runtime config validation for `LLM_PROVIDER`, `LLM_MODEL`, `OPENAI_API_KEY`, optional `DESIGN_PLANNING_MODEL`, and `LLM_MAX_REPAIR_ATTEMPTS`, with missing-key fallback behavior documented for local development, in `apps/api/src/config/llm.config.ts` and `.env.example`
- [ ] T063 [US3] Implement design review note and rejected suggestion mapping from generated/fallback design planning evidence in `packages/domain/src/design/design-review-notes.ts`
- [ ] T063a [US3] Implement reusable design consistency validation and conservative fallback decision logic for generated `DesignPlanningResult` in `packages/domain/src/design/design-consistency-validator.ts`, then call it from `packages/domain/src/design/design-planner.ts`
- [ ] T063b [US3] Extract fallback chart treatment planning from `ChartIntent[]` into `packages/domain/src/design/chart-treatment-planner.ts` and keep generated chart treatment validation source-fidelity-aware
- [ ] T063c [US3] Extract fallback visual hierarchy planning from slide title/message/outline into `packages/domain/src/design/visual-hierarchy-planner.ts` and keep generated hierarchy validation message-fidelity-aware
- [ ] T064 [US3] Verify `DesignPlanningResult` generated by the ui-ux-pro-max/LLM port is consumed by HTML generation prompt and validation rules without reinterpreting `styleDirection` in `packages/domain/src/rendering/html-generation-prompt.ts` and `packages/domain/src/rendering/html-generation-validator.ts`
- [ ] T065 [US3] Verify chart/table/metric HTML generation constraints and validation consume `ChartTreatmentPlan` from generated or fallback `DesignPlanningResult` in `packages/domain/src/rendering/html-generation-prompt.ts` and `packages/domain/src/rendering/html-generation-validator.ts`
- [ ] T066 [US3] Update React preview styling to reflect design system in `apps/web/src/features/slide-generation/SlidePreviewPanel.tsx`
- [ ] T067 [US3] Capture US3 evidence in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US3 independently shows HTML-generation-consumable design planning and ui-ux-pro-max influence while preserving source-fidelity boundaries.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Final compliance, evidence, and quickstart validation across all user stories.

- [ ] T068 [P] Remove redundant or implementation-detail tests from `packages/domain/test/`, `apps/api/test/`, and `apps/web/src/features/slide-generation/`
- [ ] T069 [P] Add any missing focused tests for uncovered domain rules in `packages/domain/test/`
- [ ] T070 Run schema validation evidence for `contracts/slide-generation.schema.json` and record result in `specs/002-generate-previewable-html-slides/evidence.md`
- [ ] T071 Run domain/API/web test suite and record summary in `specs/002-generate-previewable-html-slides/evidence.md`
- [ ] T072 Run Playwright preview navigation and responsive checks and record summary in `specs/002-generate-previewable-html-slides/evidence.md`
- [ ] T073 Run quickstart manual verification and record notes/screenshots path in `specs/002-generate-previewable-html-slides/evidence.md`
- [ ] T074 Verify performance goals from `plan.md` and record generation/render/preview timings in `specs/002-generate-previewable-html-slides/evidence.md`
- [ ] T075 Verify no persistence, publishing, file upload, PPTX export, full editor, or revision loop was introduced in `apps/` and `packages/`
- [ ] T076 Verify ui-ux-pro-max usage remains design-planning/critique-only and cannot modify source facts, deck order, title/message wording, outline meaning, speaker notes factual content, or review warnings in `packages/domain/test/design/source-fidelity-boundary.test.ts`
- [ ] T077 Update `specs/002-generate-previewable-html-slides/quickstart.md` with final run commands and evidence paths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1.
- **US1**: Depends on Phase 2. MVP behavior.
- **US1 Semantic Segmentation Revision**: Depends on US1 and blocks US2 implementation.
- **US1 Segmentation Repair Revision**: Depends on US1 Semantic Segmentation Revision and blocks US2 implementation.
- **US1 Deterministic Deck Planning Revision**: Depends on US1 segmentation revisions and blocks US2 implementation.
- **US2**: Depends on US1 Semantic Segmentation Revision, US1 Segmentation Repair Revision, US1 Deterministic Deck Planning Revision, and the US3 contract cleanup tasks T058b/T060a-T060f because HTML generation/API response contract now requires `designPlanningResult`, design-free `SlideDeck`, and `htmlGenerationValidation`. US2 preview service T048 may use `UiUxProMaxDesignPlanner` fallback until US3 adapter wiring T062b is complete.
- **US3**: Depends on US1 Deterministic Deck Planning Revision. US3 tests/types/contract cleanup may run before US2 HTML generation implementation; production ui-ux-pro-max/LLM design planning requires T062-T062c, and US3 HTML generation integration tasks T064-T066 depend on US2 HTML generation/UI skeleton tasks T043-T052b plus design adapter wiring T062b.
- **Phase 6 Polish**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: Independent generation artifact; can be demonstrated with JSON/report only.
- **US1 Semantic Segmentation Revision**: Revises source sectioning before downstream rendering; can be demonstrated with segmentation validation evidence and JSON/report only.
- **US1 Segmentation Repair Revision**: Revises invalid LLM output handling before downstream rendering; can be demonstrated with malformed segmentation fixture, repair/fallback evidence, and JSON/report only.
- **US1 Deterministic Deck Planning Revision**: Revises deck construction before downstream rendering; can be demonstrated with deck proposal, compiler validation, slide outline/source trace, speaker notes draft, and JSON/report only.
- **US2**: Requires valid slide JSON plus `DesignPlanningResult` from `UiUxProMaxDesignPlanner` fallback, production US3 adapter, or fixture; requires backend HTML generation adapter boundary, deterministic HTML validation, and conservative fallback renderer.
- **US3**: Requires valid `SlideDeck`, `DeckBrief`, `ChartIntent[]`, slide `layoutIntent`, baseline HTML generation boundary, and backend-configured ui-ux-pro-max/LLM adapter boundary implementing `DesignPlanningGenerationPort`; validates generated design planning output without changing source facts, deck order, title/message wording, outline meaning, speaker notes factual content, or segmentation grounding.

### Within Each User Story

- Tests and verification tasks must be written first and initially fail or be unimplemented.
- Domain rules before application services.
- Shared contracts before API and UI integration.
- HTML generation contract and validation before React preview.
- Refactor only after tests pass.

---

## Parallel Opportunities

- T003-T007 can run in parallel after T001-T002.
- T008-T013 can run in parallel after setup.
- T022-T026 can run in parallel before US1 implementation.
- T037-T041, including T037a-T037c, T038a, and T039a, can run in parallel after HTML generation/API/web skeleton exists.
- T056-T059, including T058a-T058e, can run in parallel after design boundary exists.
- T061a, T063, T063a, T063b, and T063c can run in parallel after T061 defines the design domain types.
- T061d runs after T061b so the fallback seed decision is based on the actual port-first `DesignPlanner` implementation.
- T062 and T062a can run after T061a defines `DesignPlanningGenerationPort`; T062b depends on T048 and T062a; T062c can run in parallel with T062 before production LLM calls.
- T064-T066 can run after T061-T063c, T062b, and the US2 HTML generation/UI skeleton tasks exist.
- T068-T069 can run in parallel during final polish.
- T078-T081 can run in parallel before US1 semantic segmentation implementation.
- T092-T095 can run in parallel before US1 segmentation repair implementation.
- T102-T106 can run in parallel before US1 deterministic deck planning implementation.

---

## Parallel Example: US1

```text
Task: "T023 [US1] Write failing domain test for source fact extraction"
Task: "T024 [US1] Write failing domain test for semantic title generation"
Task: "T025 [US1] Write failing domain test for layered chart intent decisions"
Task: "T026 [US1] Write failing domain test for review report required fields"
```

---

## Parallel Example: US3

```text
Task: "T056 [US3] Write failing design planner test"
Task: "T057 [US3] Write failing ui-ux-pro-max adapter boundary test"
Task: "T058 [US3] Write failing source-fidelity boundary test"
Task: "T058c [US3] Write failing design consistency validation test"
Task: "T058d [US3] Write failing chart treatment planning test"
Task: "T058e [US3] Write failing visual hierarchy planning test"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1.
3. Complete US1 semantic segmentation revision.
4. Complete US1 segmentation repair revision.
5. Complete US1 deterministic deck planning revision.
6. Stop and demo segmentation validation/repair/fallback evidence + deck proposal/compiler evidence + slide JSON + review report from fixture input.
7. Only then proceed to US2 renderer/preview.

### Incremental Delivery

1. US1: reviewable content core and reviewability.
2. US1 revision: LLM-assisted semantic segmentation with deterministic validation/fallback.
3. US1 repair revision: one format repair attempt before conservative fallback and user-readable review notes.
4. US1 deck revision: deterministic deck planner/compiler, source-grounded outline, and conservative speaker notes draft.
5. US2: LLM-assisted self-contained HTML generation, deterministic validation/repair/fallback, and session-only preview.
6. US3: HTML-generation-consumable design planning, ui-ux-pro-max handoff/critique layer, visual consistency, and accessibility/review notes.

### Quality Bar

- Keep tests concise and behavior-focused.
- Do not introduce persistence or publishing.
- Do not let ui-ux-pro-max add source facts.
- Do not put ui-ux-pro-max inside DeckPlanner; use it after `DeckCompiler` through `DesignPlanningGenerationPort` for design planning and after HTML generation/validation for critique.
- Do not use keyword heuristics or `defaultDesignSystem` as the primary design system source when a valid backend-configured ui-ux-pro-max/LLM design planning port is available.
- Do not expose LLM provider, model, or API key in public request fields, response fields, `ReviewReport`, `DesignPlanningResult`, or generation summary.
- Do not let HTML generation reinterpret `styleDirection`; prompt and validator consume `DesignPlanningResult`.
- Do not trust raw LLM-generated HTML. Validate self-contained resources, slide count/order, content fidelity, design compliance, speaker notes non-rendering, keyboard navigation, and repair/fallback status before preview/download.
- Do not allow more than one HTML repair attempt, and do not let repair rewrite slide title/message/outline semantics or add unsupported facts.
- Do not let design planning change deck order, title/message wording, outline meaning, speaker notes factual content, or review warnings.
- Do not keep unconsumed domain/contract fields. Removed fields remain rejected unless a new accepted spec defines a consumer.
- Do not let LLM segmentation or format repair rewrite source text; use exact source quotes, allow at most one repair attempt, and fallback on failed repair/validation.
- Do not use LLM for deck planning v1; keep `DeckPlanProposal` deterministic and compile final `SlideDeck` through validated references.
- Do not use `narrativeType`, complex slide role, appendix, or automatic metrics/risk/decision reordering in deck planning v1.
- Do not let `speakerNotesDraft` add unsupported claims; it must be grounded in outline/source trace.
- Do not render `speakerNotesDraft` in HTML presentation view for v1.
- Do not show raw schema validation paths/messages as the main user-facing explanation; preserve them in evidence and give users a plain-language review note.
- Preserve evidence in `evidence.md`.
