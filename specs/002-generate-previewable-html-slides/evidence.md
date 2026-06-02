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
