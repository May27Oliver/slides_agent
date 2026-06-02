# Evidence: Generate Previewable HTML Slides

## Scope

This file records implementation and verification evidence for feature 002.

## T001-T021 Scaffold Evidence

- Monorepo scaffold created for `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, and `tests/fixtures`.
- Shared contracts, domain model types, planner boundaries, API controller/module skeletons, and React feature shell are present.
- No US1 behavior, tests, renderer implementation, persistence, publishing, upload, PPTX export, full editor, or revision loop has been introduced.

## Verification Log

### 2026-05-31 - T001-T021

- `check-prerequisites.sh --json --require-tasks --include-tasks` did not complete because the repository has no initial commit yet, so Git reports `HEAD` as an ambiguous revision and the script cannot validate the feature branch.
- Requirements checklist has no unchecked items.
- `python3 -m json.tool` passed for root/workspace package manifests, TypeScript configs, fixture JSON files, and `packages/contracts/schemas/slide-generation.schema.json`.
- Verified T001-T021 are marked complete in `tasks.md`.
- Verified T022-T027 remain unstarted, so US1 work has not begun.
- Automated behavior tests were not run because this slice only creates scaffold and dependencies have not been installed.

### 2026-05-31 - Package Manager Decision

- Package manager set to pnpm `10.30.3`.
- Workspace membership is defined in `pnpm-workspace.yaml` for `apps/*` and `packages/*`.
- Root test scripts use `pnpm --filter` so package-level tests can run independently.
- `pnpm install` completed and generated `pnpm-lock.yaml`.
- pnpm reported ignored build scripts for `@nestjs/core` and `esbuild`; no interactive approval was applied during this scaffold step.
- `pnpm --filter @slides-agent/contracts build`, `pnpm --filter @slides-agent/domain build`, `pnpm --filter @slides-agent/api build`, and `pnpm --filter @slides-agent/web build` passed.
- `pnpm run lint` passed.
- `pnpm run format` passed after excluding generated Spec Kit/skill artifacts from Prettier scope.

### 2026-05-31 - Import Alias Decision

- Local workspace imports use `@/*` to point to that workspace package's own `src/*`.
- Cross-package imports remain explicit as `@slides-agent/contracts` and `@slides-agent/domain`.
- Vite is configured with the same `@` alias for the web app.

### 2026-05-31 - US1 Green Slice

- Completed US1 minimal implementation for request validation, deterministic source parsing, source fact extraction, semantic title planning, layered chart intent planning, review report building, slide deck planning, and `generatePreviewDeck`.
- `pnpm --filter @slides-agent/contracts test` passed: 1 file, 3 tests.
- `pnpm --filter @slides-agent/domain test` passed: 5 files, 5 tests.
- `pnpm run test` passed. API and web packages currently use `--passWithNoTests` because US2/API/UI behavior tests have not started.
- `pnpm --filter @slides-agent/contracts build` passed.
- `pnpm --filter @slides-agent/domain build` passed.
- `pnpm --filter @slides-agent/api build` passed.
- `pnpm --filter @slides-agent/web build` passed.
- `pnpm run lint` passed.
- `pnpm run format` passed.
- US1 fixture preserves source facts for `18%`, `25%`, `12 小時`, `4 小時`, `2026-08-15`, `dashboard MVP`, `full CRM integration`, and `0.5 FTE`.
- US1 fixture produces chart intents for conversion, response time, dashboard MVP deadline, and design resource risk.
- No US2 renderer, browser preview, download behavior, persistence, publishing, upload, PPTX export, full editor, or revision loop was introduced.

### 2026-06-01 - Schema Identifier Clarification

- Schema `$id` changed from a fake URL to `urn:slides-agent:contracts:slide-generation`.
- `SLIDE_GENERATION_SCHEMA_ID` now uses the same URN to avoid implying that the identifier is a reachable HTTP endpoint.

### 2026-06-01 - LLM Provider Contract Change

- Removed `useExternalProvider`, `usedExternalProvider`, and `providerBoundary` from the 002 contract language.
- Removed request-level provider/model selection and generated response provider disclosure.
- Removed the design-skill toggle because design planning and critique are fixed generation-flow capabilities, not user toggles.
- Removed the legacy `GenerationOptionsContract`, request `options` field, and schema `GenerationOptions` definition.
- Review report remains focused on assumptions, omitted/compressed content, uncertain claims, charting decisions, and human review notes.
- Constitution updated to version `3.0.0` with Backend-Configured LLM Boundary replacing user-facing provider selection/disclosure.

### 2026-06-01 - Semantic Segmentation Spec Change

- Spec updated to require backend-configured LLM-assisted semantic segmentation before downstream deck planning.
- Added internal `contracts/semantic-segmentation.schema.json` for LLM output shape.
- Added deterministic validation requirements for schema, exact source quote grounding, source order, and important-content coverage.
- Added optional `deckBrief.segmentationGuidance` as a user-provided segmentation preference, explicitly not source truth.
- Added deterministic fallback requirement when segmentation validation fails.
- Added US1 revision tasks T078-T091 and marked the revision as blocking before US2 implementation.

### 2026-06-01 - US1R Semantic Segmentation Green Slice

- Added `packages/contracts/schemas/semantic-segmentation.schema.json` with URN id `urn:slides-agent:contracts:semantic-segmentation`.
- Added `packages/contracts/src/semantic-segmentation.ts` with schema id export and focused runtime validation helper for LLM segmentation output.
- Added domain semantic segmentation types, validator, semantic segmenter port, deterministic fallback path, and preview generation wiring before source fact extraction.
- Added API prompt adapter boundary at `apps/api/src/adapters/llm/semantic-segmentation.adapter.ts`; automated tests do not call external LLM APIs.
- Prompt adapter treats `segmentationGuidance` as preference-only, isolates it from source content, and instructs LLM output to record ignored/conflicting guidance in `globalWarnings`.
- Focused validation passed:
  - `pnpm --filter @slides-agent/contracts test -- semantic-segmentation.contract.test.ts`
  - `pnpm --filter @slides-agent/domain test -- semantic-segmentation`
  - `pnpm --filter @slides-agent/api test -- semantic-segmentation`

### 2026-06-01 - Segmentation Repair/Fallback Spec Decision

- Added requirement that invalid initial LLM segmentation schema output may trigger at most one format repair attempt before deterministic fallback.
- Repair is limited to JSON/schema correction and must not reinterpret, summarize, expand, delete, or alter source meaning.
- Repair failure, grounding/order/coverage failure, or fallback must produce user-readable review notes while preserving raw validation details in internal evidence.
- Added US1R2 tasks T092-T101 and kept the revision blocking before US2 implementation.

### 2026-06-02 - Deterministic Deck Planning Spec Decision

- Added requirement that deck planning v1 does not call LLM.
- Added `DeckPlanner` / `DeckCompiler` split: planner produces deterministic `DeckPlanProposal`; compiler validates references and emits final `SlideDeck`.
- Added required slide `outline` with source trace and conservative `speakerNotesDraft`.
- Updated slide-generation contract schema to require `slideKind`, `outline`, `layoutIntent`, and `speakerNotesDraft`, and to use `speakerNotesDraft` instead of `speakerNotes`.
- Added US1R3 tasks T102-T112 and kept the revision blocking before US2 implementation.

### 2026-06-02 - Deck Planner Clarification A-F

- Clarified deck structure target: 3-8 slides, 8-slide hard cap, required opening slide, conditional closing slide only when source supports next steps/actions/owners/deadlines, no appendix in v1.
- Clarified deck planning ordering: content slides preserve source order; v1 does not use `narrativeType`, complex slide role, or automatic metrics/risk/decision reordering.
- Replaced complex slide role with `slideKind: "opening" | "content" | "closing"`.
- Required every slide to include source-grounded outline and required conservative `speakerNotesDraft`; speaker notes draft must be at most 400 characters and cannot add unsupported claims.
- Clarified HTML rendering v1 must not render `speakerNotesDraft` in presentation view.
- Clarified `DeckCompiler` validates only and does not fill missing fields; invalid proposals trigger deterministic fallback planning and user-readable review notes while preserving raw validation details as evidence.
- Clarified ui-ux-pro-max is a design planning and critique layer after valid `SlideDeck`, not part of DeckPlanner; it may affect design system, pattern mapping, chart treatment, density, visual hierarchy, accessibility, and critique notes, but cannot alter source facts, deck order, title/message wording, outline meaning, speaker notes factual content, or review warnings.

### 2026-06-02 - US1R2 Segmentation Repair Green Slice

- Added focused red tests for one bounded repair attempt, repair failure fallback, repair-only prompt instructions, and user-readable review notes.
- Initial red evidence:
  - Domain tests failed because `segmentSourceContentWithRepair` and `buildSegmentationReviewNotes` did not exist.
  - API test failed because `buildSemanticSegmentationRepairPrompt` did not exist.
- Implemented `SegmentationRepairAttempt` and repair result fields on segmentation validation.
- Implemented `segmentSourceContentWithRepair` coordinator:
  - validates the initial segmentation output;
  - calls the repairer at most once when initial validation falls back;
  - validates repaired output before use;
  - uses deterministic fallback when repair fails or repaired output still fails validation.
- Implemented repair prompt builder that instructs the LLM to repair JSON/schema shape only and forbids reinterpretation, different summarization, expansion, deletion, source quote rewriting, source meaning changes, invented facts, or strengthened claims.
- Added `buildSegmentationReviewNotes` so user-facing notes explain repair/fallback plainly:
  - `AI 語意切段格式未通過驗證，已嘗試自動修復。`
  - `AI 語意切段格式修復後仍未通過驗證，已改用保守切段。`
- Wired segmentation review notes into preview deck review report human notes.
- Malformed initial output fixture: `{ "segments": [{ "id": "segment_001" }], "globalWarnings": [] }`.
- Repaired output success fixture exact quote: `Onboarding conversion 從 18% 提升到 25%`.
- Repair failure fallback fixture rewrites source quote to `Design resource 只有 2 FTE`; validation rejects it and fallback preserves deterministic section text `Design resource 只有 0.5 FTE`.
- Focused green evidence:
  - `pnpm --filter @slides-agent/domain test -- semantic-segmentation-repair.test.ts semantic-segmentation-fallback.test.ts segmentation-review-notes.test.ts` passed: 9 files, 11 tests.
  - `pnpm --filter @slides-agent/api test -- semantic-segmentation-repair-prompt.test.ts` passed: 3 files, 3 tests.
- Full validation after formatting:
  - `pnpm run test` passed: domain 9 files / 11 tests, contracts 2 files / 6 tests, API 3 files / 3 tests, web no tests yet with `--passWithNoTests`.
  - `pnpm run lint` passed.
  - `pnpm --filter @slides-agent/domain build` passed.
  - `pnpm --filter @slides-agent/api build` passed.
  - `pnpm exec prettier --check ...` passed for changed code/test/spec files.
  - `python3 -m json.tool specs/002-generate-previewable-html-slides/contracts/slide-generation.schema.json` passed.
  - `git diff --check` passed.

### 2026-06-02 - Domain File Role Refactor

- Constitution amended to v3.1.0 to require readable domain file roles:
  - `*.types.ts` for type-only declarations;
  - `*.port.ts` for external capability interfaces and adapter boundaries;
  - behavior files named by role, such as planner, validator, extractor, parser, service, or a concrete flow name.
- Updated Spec Kit plan/tasks templates so future feature plans and task lists check type/port/behavior separation.
- Refactored `content-core` without behavior changes:
  - `chart-intent.ts` -> `chart-intent.types.ts`;
  - `semantic-segmentation.ts` -> `semantic-segmentation.types.ts`;
  - `semantic-segmenter.ts` split into `semantic-segmenter.port.ts` and `semantic-segmentation-repair.ts`.
- Updated `packages/domain/AGENTS.md` with the same domain file role guidance.
- Refactor validation:
  - `pnpm run test` passed.
  - `pnpm run lint` passed.
  - `pnpm --filter @slides-agent/domain build` passed.
  - `pnpm --filter @slides-agent/contracts build` passed.
  - `pnpm --filter @slides-agent/api build` passed.
  - `pnpm --filter @slides-agent/web build` passed.
  - `pnpm exec prettier --check ...` passed for changed constitution/template/domain/spec files.
  - `git diff --check` passed.

### 2026-06-02 - US1R3 Deterministic Deck Planning Green Slice

- Added focused red tests for deterministic deck planning and compiler/schema behavior:
  - `packages/domain/test/deck/deck-plan-proposal.test.ts`
  - `packages/domain/test/deck/deck-compiler-validation.test.ts`
  - `packages/domain/test/deck/slide-outline.test.ts`
  - `packages/domain/test/deck/speaker-notes-draft.test.ts`
  - `packages/contracts/test/slide-generation-schema.test.ts`
- Initial red evidence:
  - Domain deck tests failed because `@/deck/deck-planner` and `@/deck/deck-compiler` did not exist.
  - Contract schema test failed because `Slide` did not require `slideKind`, `outline`, `layoutIntent`, or `speakerNotesDraft`, and still exposed `speakerNotes`.
- Implemented `DeckPlanProposal`, `DeckSlideProposal`, `SlideOutlineItem`, `LayoutIntent`, and `slideKind` domain types.
- Implemented deterministic `createDeckPlanProposal`:
  - opening slide is always first;
  - content slides preserve source section order;
  - adjacent short sections are merged;
  - deck target stays within 3-8 slides when source supports it;
  - 8 slides is a hard cap;
  - closing slide appears only when source text supports next steps, actions, owners, or deadlines;
  - v1 does not call LLM and does not use `narrativeType`, complex role, or appendix.
- Implemented `compileDeckPlanProposal`:
  - validates source section, source fact, chart intent, and outline source trace references;
  - returns `fallbackRequired: true` instead of producing a final deck when references are invalid;
  - deduplicates and stable-sorts `sourceTrace`;
  - compiles valid proposals into `SlideDeck`.
- Rewired `planSlideDeck` so slide construction now goes through `DeckPlanner` and `DeckCompiler`.
- Updated `packages/contracts/schemas/slide-generation.schema.json` so each `Slide` requires `slideKind`, `outline`, `layoutIntent`, and `speakerNotesDraft`; removed final-sounding `speakerNotes`.
- Focused green evidence:
  - `pnpm --filter @slides-agent/domain test -- deck-plan-proposal.test.ts deck-compiler-validation.test.ts slide-outline.test.ts speaker-notes-draft.test.ts` passed: 13 files, 15 tests.
  - `pnpm --filter @slides-agent/contracts test -- slide-generation-schema.test.ts` passed: 3 files, 7 tests.
  - `pnpm run test` passed: domain 13 files / 15 tests, contracts 3 files / 7 tests, API 3 files / 3 tests, web no tests yet with `--passWithNoTests`.
  - `pnpm run lint` passed.
  - `pnpm --filter @slides-agent/domain build` passed.
  - `pnpm --filter @slides-agent/contracts build` passed.
  - `pnpm --filter @slides-agent/api build` passed.
  - `pnpm --filter @slides-agent/web build` passed.
  - `python3 -m json.tool packages/contracts/schemas/slide-generation.schema.json` passed.
  - `python3 -m json.tool specs/002-generate-previewable-html-slides/contracts/slide-generation.schema.json` passed.
  - `pnpm exec prettier --check ...` passed for changed deck/schema/spec files.
  - `git diff --check` passed.

### 2026-06-02 - Semantic Segmentation Prompt Language Consistency

- Added API prompt contract tests to prevent language drift:
  - Chinese source or `deckBrief.language: "zh-TW"` requires generated headings, summaries, rationales, and warnings to use Traditional Chinese.
  - English source or `deckBrief.language: "en"` requires generated headings, summaries, rationales, and warnings to use English.
  - `sourceQuotes` must always preserve exact original source language and text.
  - Prompt explicitly forbids translating `sourceQuotes`.
- Updated both initial semantic segmentation prompt and repair prompt with an `OUTPUT_LANGUAGE` section.
- If no explicit language is provided, `OUTPUT_LANGUAGE` instructs the model to follow the dominant language of `SOURCE_CONTENT`.
- Focused red/green evidence:
  - Initial `pnpm --filter @slides-agent/api test -- semantic-segmentation-language.test.ts` failed because prompts did not include `OUTPUT_LANGUAGE` or source quote translation guards.
  - After implementation, `pnpm --filter @slides-agent/api test -- semantic-segmentation-language.test.ts semantic-segmentation-prompt.test.ts semantic-segmentation-guidance.test.ts semantic-segmentation-repair-prompt.test.ts` passed: 4 files, 6 tests.

### 2026-06-02 - Anti-Over-Design Constitution Gate

- Constitution amended to v3.2.0 to require every new domain type, field, enum value, service, planner, validator, adapter boundary, or intermediate artifact to have a current consumer or a near-term independently testable consuming task.
- If the consumer is future work, the feature plan must record the rejected simpler alternative and the task that will prove the artifact is useful.
- Unconsumed artifacts must be removed or simplified before completion unless evidence explicitly approves the deferral.
- This gate was added after reviewing `SourceFactKind`: it is acceptable only if chart/deck/design consumers use it or tasks prove future consumption.

### 2026-06-02 - Deck File Role Refactor

- Refactored `packages/domain/src/deck` so type declarations and behavior are no longer mixed:
  - `types.ts` -> `deck.types.ts`;
  - planner boundary types moved to `deck-planner.types.ts`;
  - compiler boundary types moved to `deck-compiler.types.ts`;
  - preview generation boundary types moved to `deck-generation.types.ts`.
- Kept behavior files focused on executable behavior:
  - `deck-planner.ts` creates deterministic `DeckPlanProposal`;
  - `deck-compiler.ts` validates and compiles proposals;
  - `slide-deck-planner.ts` and `generate-preview-deck.ts` orchestrate the flow.
- Updated package exports, internal imports, `packages/domain/AGENTS.md`, and completed task paths to use `@/deck/deck.types`.
- Refactor validation:
  - `pnpm --filter @slides-agent/domain build` passed.
  - `pnpm --filter @slides-agent/domain test` passed: 13 files / 15 tests.
  - `pnpm run test` passed: domain 13 files / 15 tests, contracts 3 files / 7 tests, API 4 files / 6 tests, web no tests yet with `--passWithNoTests`.
  - `pnpm run lint` passed.
  - `pnpm --filter @slides-agent/contracts build` passed.
  - `pnpm --filter @slides-agent/domain build` passed.
  - `pnpm --filter @slides-agent/api build` passed.
  - `pnpm --filter @slides-agent/web build` passed.
  - `pnpm exec prettier --check packages/domain/src/deck packages/domain/src/index.ts packages/domain/AGENTS.md specs/002-generate-previewable-html-slides/tasks.md specs/002-generate-previewable-html-slides/evidence.md` passed.
  - `git diff --check` passed.
