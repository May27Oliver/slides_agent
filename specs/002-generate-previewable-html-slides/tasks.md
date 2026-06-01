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
- [X] T010 [P] Create domain model type definitions in `packages/domain/src/deck/types.ts`
- [X] T011 [P] Create review report type definitions in `packages/domain/src/review/types.ts`
- [X] T012 [P] Create chart intent type definitions in `packages/domain/src/content-core/chart-intent.ts`
- [X] T013 [P] Create design system type definitions in `packages/domain/src/design/types.ts`
- [X] T014 Create deterministic content core service skeleton in `packages/domain/src/content-core/content-core-planner.ts`
- [X] T015 Create chart intent planner skeleton in `packages/domain/src/content-core/chart-intent-planner.ts`
- [X] T016 Create design planner boundary in `packages/domain/src/design/design-planner.ts`
- [X] T017 Create HTML renderer boundary in `packages/domain/src/rendering/html-deck-renderer.ts`
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

**Goal**: 在進入 HTML rendering 前，將 source section parsing 從 regex-only parser 升級為 backend-configured LLM-assisted semantic segmentation，並用 deterministic schema/quote/order/coverage validation 保護 source fidelity。

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
- [X] T085 [US1R] Define `SemanticSegment`, `SourceQuote`, and `SegmentationValidation` domain types in `packages/domain/src/content-core/semantic-segmentation.ts`
- [X] T086 [US1R] Implement semantic segmentation validator for schema result, exact source quote grounding, source order, and important-content coverage in `packages/domain/src/content-core/semantic-segmentation-validator.ts`
- [X] T087 [US1R] Keep deterministic parser as fallback segmenter in `packages/domain/src/content-core/source-parser.ts`
- [X] T088 [US1R] Define semantic segmenter port/interface in `packages/domain/src/content-core/semantic-segmenter.ts`
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

- [ ] T092 [P] [US1R2] Write failing contract/domain test for one format repair attempt after invalid initial segmentation schema in `packages/domain/test/content-core/semantic-segmentation-repair.test.ts`
- [ ] T093 [P] [US1R2] Write failing domain test that repair failure triggers deterministic fallback and records repair/fallback issue in `packages/domain/test/content-core/semantic-segmentation-fallback.test.ts`
- [ ] T094 [P] [US1R2] Write failing API adapter prompt test for repair-only instructions that forbid reinterpretation, summarization, expansion, deletion, or source quote rewriting in `apps/api/test/semantic-segmentation-repair-prompt.test.ts`
- [ ] T095 [P] [US1R2] Write failing review report/evidence test that user-facing notes explain repair/fallback plainly and do not expose raw schema paths as the primary message in `packages/domain/test/review/segmentation-review-notes.test.ts`

### Implementation for US1 Segmentation Repair Revision

- [ ] T096 [US1R2] Define segmentation repair attempt types and result fields in `packages/domain/src/content-core/semantic-segmentation.ts`
- [ ] T097 [US1R2] Implement semantic segmentation repair coordinator that allows at most one repair attempt before deterministic fallback in `packages/domain/src/content-core/semantic-segmenter.ts`
- [ ] T098 [US1R2] Implement backend LLM repair prompt builder in `apps/api/src/adapters/llm/semantic-segmentation.adapter.ts`
- [ ] T099 [US1R2] Wire repair success/failure, fallback reason, and user-readable review notes into preview generation flow before source fact extraction
- [ ] T100 [US1R2] Update quickstart/evidence examples with malformed initial output, repaired output, fallback case, and review note sample in `specs/002-generate-previewable-html-slides/evidence.md`
- [ ] T101 [US1R2] Run focused contract/domain/API tests for segmentation repair and record results in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US1 handles invalid initial LLM segmentation output without raw user-facing schema errors: one repair attempt if possible, deterministic fallback if needed, and review/evidence that explains what happened.

---

## Phase 4: User Story 2 - Render Self-Contained HTML Slides (Priority: P2)

**Goal**: 使用有效 slide JSON 產生 self-contained HTML，並在 local web app session 中 preview、顯示 review report/JSON/summary、下載 HTML。

**Independent Test**: 使用固定 slide JSON fixture 驗證 renderer output、API response、preview UI、download HTML、keyboard navigation。

### Tests for User Story 2 (REQUIRED - write first)

- [ ] T037 [P] [US2] Write failing renderer test for self-contained HTML output in `packages/domain/test/rendering/html-deck-renderer.test.ts`
- [ ] T038 [P] [US2] Write failing renderer test for keyboard navigation script presence in `packages/domain/test/rendering/keyboard-navigation.test.ts`
- [ ] T039 [P] [US2] Write failing API contract test for `POST /api/slides/preview` in `apps/api/test/slides-preview.contract.test.ts`
- [ ] T040 [P] [US2] Write failing web component test for generated artifact display in `apps/web/src/features/slide-generation/slide-generation-view.test.tsx`
- [ ] T041 [P] [US2] Write failing Playwright test for preview route keyboard navigation in `apps/web/tests/e2e/preview-navigation.spec.ts`
- [ ] T042 [US2] Document manual downloaded-HTML verification path in `specs/002-generate-previewable-html-slides/quickstart.md`

### Implementation for User Story 2

- [ ] T043 [US2] Implement self-contained HTML renderer in `packages/domain/src/rendering/html-deck-renderer.ts`
- [ ] T044 [US2] Implement scoped deck CSS generation in `packages/domain/src/rendering/deck-css.ts`
- [ ] T045 [US2] Implement keyboard navigation script generation in `packages/domain/src/rendering/deck-navigation-script.ts`
- [ ] T046 [US2] Implement generation summary builder in `packages/domain/src/deck/generation-summary.ts`
- [ ] T047 [US2] Implement NestJS preview endpoint in `apps/api/src/modules/slides/slides.controller.ts`
- [ ] T048 [US2] Implement NestJS preview service in `apps/api/src/modules/slides/slides.service.ts`
- [ ] T049 [US2] Implement React input form in `apps/web/src/features/slide-generation/SlideGenerationForm.tsx`
- [ ] T050 [US2] Implement React preview panel in `apps/web/src/features/slide-generation/SlidePreviewPanel.tsx`
- [ ] T051 [US2] Implement React review report panel in `apps/web/src/features/slide-generation/ReviewReportPanel.tsx`
- [ ] T052 [US2] Implement React slide JSON panel in `apps/web/src/features/slide-generation/SlideJsonPanel.tsx`
- [ ] T053 [US2] Implement React generation summary panel in `apps/web/src/features/slide-generation/GenerationSummaryPanel.tsx`
- [ ] T054 [US2] Implement downloadable HTML action in `apps/web/src/features/slide-generation/download-html.ts`
- [ ] T055 [US2] Capture US2 evidence in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US2 independently renders and previews self-contained HTML from valid slide JSON and supports download.

---

## Phase 5: User Story 3 - Apply Design Planning and Critique (Priority: P3)

**Goal**: 使用 deterministic content core 保護來源事實，同時讓 ui-ux-pro-max design layer 影響 summary presentation、design planning、layout selection 與 critique，但不得新增或改寫來源事實。

**Independent Test**: 使用同一 slide JSON 與 style direction，驗證 design system、layout decisions、ui-ux-pro-max notes 與 source fidelity boundary。

### Tests for User Story 3 (REQUIRED - write first)

- [ ] T056 [P] [US3] Write failing design planner test for style direction to design system in `packages/domain/test/design/design-planner.test.ts`
- [ ] T057 [P] [US3] Write failing ui-ux-pro-max boundary test in `packages/domain/test/design/ui-ux-pro-max-boundary.test.ts`
- [ ] T058 [P] [US3] Write failing test that design layer cannot add unsupported source facts in `packages/domain/test/design/source-fidelity-boundary.test.ts`
- [ ] T059 [P] [US3] Write failing Playwright responsive smoke test in `apps/web/tests/e2e/responsive-preview.spec.ts`
- [ ] T060 [US3] Document manual visual consistency verification path in `specs/002-generate-previewable-html-slides/quickstart.md`

### Implementation for User Story 3

- [ ] T061 [US3] Implement design planner defaults in `packages/domain/src/design/design-planner.ts`
- [ ] T062 [US3] Implement ui-ux-pro-max adapter boundary in `apps/api/src/adapters/ui-ux-pro-max/ui-ux-pro-max.adapter.ts`
- [ ] T063 [US3] Implement design critique note mapping in `packages/domain/src/design/design-critique.ts`
- [ ] T064 [US3] Apply design system to HTML renderer layouts in `packages/domain/src/rendering/html-deck-renderer.ts`
- [ ] T065 [US3] Add chart/table/metric layout rendering in `packages/domain/src/rendering/content-block-renderer.ts`
- [ ] T066 [US3] Update React preview styling to reflect design system in `apps/web/src/features/slide-generation/SlidePreviewPanel.tsx`
- [ ] T067 [US3] Capture US3 evidence in `specs/002-generate-previewable-html-slides/evidence.md`

**Checkpoint**: US3 independently shows design-system and ui-ux-pro-max influence while preserving source-fidelity boundaries.

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
- [ ] T076 Verify ui-ux-pro-max usage remains presentation/design-only and cannot modify source facts in `packages/domain/test/design/source-fidelity-boundary.test.ts`
- [ ] T077 Update `specs/002-generate-previewable-html-slides/quickstart.md` with final run commands and evidence paths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1.
- **US1**: Depends on Phase 2. MVP behavior.
- **US1 Semantic Segmentation Revision**: Depends on US1 and blocks US2 implementation.
- **US2**: Depends on US1 Semantic Segmentation Revision and US1 Segmentation Repair Revision because renderer and API need validated `SlideDeck` built from valid, repaired, or fallback source sections with user-readable review notes.
- **US3**: Depends on US1 Semantic Segmentation Revision and can partially run in parallel with late US2 renderer work after `DesignSystem` exists.
- **Phase 6 Polish**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: Independent generation artifact; can be demonstrated with JSON/report only.
- **US1 Semantic Segmentation Revision**: Revises source sectioning before downstream rendering; can be demonstrated with segmentation validation evidence and JSON/report only.
- **US1 Segmentation Repair Revision**: Revises invalid LLM output handling before downstream rendering; can be demonstrated with malformed segmentation fixture, repair/fallback evidence, and JSON/report only.
- **US2**: Requires valid slide JSON from revised US1 or fixture.
- **US3**: Requires baseline design system and renderer boundary; validates design layer without changing source facts or segmentation grounding.

### Within Each User Story

- Tests and verification tasks must be written first and initially fail or be unimplemented.
- Domain rules before application services.
- Shared contracts before API and UI integration.
- Renderer contract before React preview.
- Refactor only after tests pass.

---

## Parallel Opportunities

- T003-T007 can run in parallel after T001-T002.
- T008-T013 can run in parallel after setup.
- T022-T026 can run in parallel before US1 implementation.
- T037-T041 can run in parallel after renderer/API/web skeleton exists.
- T056-T059 can run in parallel after design boundary exists.
- T068-T069 can run in parallel during final polish.
- T078-T081 can run in parallel before US1 semantic segmentation implementation.
- T092-T095 can run in parallel before US1 segmentation repair implementation.

---

## Parallel Example: US1

```text
Task: "T023 [US1] Write failing domain test for source fact extraction"
Task: "T024 [US1] Write failing domain test for semantic title generation"
Task: "T025 [US1] Write failing domain test for layered chart intent decisions"
Task: "T026 [US1] Write failing domain test for review report required fields"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1.
3. Complete US1 semantic segmentation revision.
4. Complete US1 segmentation repair revision.
5. Stop and demo segmentation validation/repair/fallback evidence + slide JSON + review report from fixture input.
6. Only then proceed to US2 renderer/preview.

### Incremental Delivery

1. US1: reviewable content core and reviewability.
2. US1 revision: LLM-assisted semantic segmentation with deterministic validation/fallback.
3. US1 repair revision: one format repair attempt before conservative fallback and user-readable review notes.
4. US2: self-contained HTML and session-only preview.
5. US3: ui-ux-pro-max design layer and visual consistency.

### Quality Bar

- Keep tests concise and behavior-focused.
- Do not introduce persistence or publishing.
- Do not let ui-ux-pro-max add source facts.
- Do not let LLM segmentation or format repair rewrite source text; use exact source quotes, allow at most one repair attempt, and fallback on failed repair/validation.
- Do not show raw schema validation paths/messages as the main user-facing explanation; preserve them in evidence and give users a plain-language review note.
- Preserve evidence in `evidence.md`.
