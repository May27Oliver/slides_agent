# Implementation Plan: Generate Previewable HTML Slides

**Branch**: `002-generate-previewable-html-slides` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-generate-previewable-html-slides/spec.md`

## Summary

建立第一個可實作 vertical slice：使用者在 local web app 貼上 source content，填寫 purpose、audience、style direction 與 free-text chart emphasis；NestJS backend 先透過 backend-configured LLM-assisted semantic segmentation 產生 source-grounded sections，再用 deterministic validation/content core、deterministic DeckPlanner 與 DeckCompiler 產生可追溯的 slide JSON、每頁 outline、必填保守 speaker notes draft、review report 與 chart intents。Deck planning v1 維持來源順序，只使用 `slideKind`，不使用 narrative type 或複雜 role。ui-ux-pro-max design layer 只在 valid `SlideDeck` 後輔助 design planning、layout selection 與 critique；React + TypeScript frontend 提供 session-only preview、review report、slide JSON、generation summary 與 self-contained HTML download。

**Artifact Language**: 本 feature 的 Spec Kit artifacts 使用繁體中文；domain model、schema keys、API field names、code identifiers 使用英文。

## Technical Context

**Language/Version**: TypeScript on Node.js `v20.19.5`

**Package Manager**: pnpm `10.30.3` with `pnpm-workspace.yaml` for `apps/*` and `packages/*`.

**Primary Dependencies**: React + TypeScript frontend, NestJS backend, shared TypeScript domain package, JSON Schema validation, backend-configured LLM client behind adapter boundary for semantic segmentation, Playwright for browser verification, ui-ux-pro-max skill as design guidance source

**Storage**: N/A for product data. Preview artifacts are session-only in browser/backend memory for this slice; no database, deck history, automatic artifact storage, or publishing.

**Testing**: TDD with focused unit/contract/integration tests. Domain and renderer tests should be deterministic. Browser behavior and responsive checks use Playwright or an equivalent browser automation tool. Manual verification remains required for visual quality and design consistency.

**Target Platform**: Local development web app opened in a desktop browser; generated self-contained HTML should open directly in a browser without backend dependency.

**Project Type**: Local web app with monorepo structure: React frontend, NestJS backend, shared domain/contracts packages.

**Performance Goals**:

- Semantic segmentation + deterministic content-core generation for representative fixture: <= 8s on local development machine when backend LLM output is valid on first attempt; <= 12s when one format repair attempt is needed; deterministic fallback path <= 2s after fallback decision.
- Deterministic deck planning and compilation from validated source artifacts: <= 300ms for representative 3-8 slide fixture.
- HTML rendering from valid slide JSON fixture: <= 500ms.
- Local preview route first usable render after successful generation: <= 1s.
- Downloaded self-contained HTML target size for representative fixture: <= 1MB unless embedded content requires otherwise.

**Constraints**:

- No persistence, publish URL, account system, file upload, PPTX export, full slide editor, or revision loop in this slice.
- Semantic segmentation may use backend-configured LLM, but must validate output schema, exact source quote grounding, source order, and coverage before downstream use.
- Invalid semantic segmentation schema output may trigger at most one backend-configured LLM format repair attempt; repair is limited to JSON/schema correction and must not reinterpret, summarize, expand, or alter source meaning.
- If repair fails schema validation, or if repaired output fails quote grounding, source order, or coverage validation, generation must continue with deterministic fallback segmentation and preserve user-readable review notes plus internal evidence.
- Source facts, chart decisions, source traces, and review report behavior must remain deterministic or validation-backed and testable.
- Deck planning v1 must not call LLM. It must produce `DeckPlanProposal` deterministically, then compile to `SlideDeck` through reference validation.
- Every slide must include source-grounded outline and required speaker notes draft; speaker notes draft must remain conservative, source-traceable, and not rendered by HTML v1.
- Deck planning v1 must use opening/content/closing `slideKind`, preserve source order, target 3-8 slides, enforce 8 slides as a hard cap, and avoid narrative type, complex role, appendix, or automatic metrics/risk/decision reordering.
- ui-ux-pro-max is a fixed design layer after `DeckCompiler` and critique layer after HTML rendering; it must not invent facts, alter source meaning, change title/message wording, reorder deck content, or override review notes.
- LLM provider/model selection is backend runtime configuration, not a user request/response contract. Internal evidence must preserve the sensitive-content processing boundary.

**Scale/Scope**:

- Pasted text only.
- Representative input target: internal planning/report content that can reasonably produce 3-8 slides.
- One active generated deck per local session.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification First**: PASS. Accepted source is [spec.md](./spec.md). No unresolved clarification markers remain. Clarifications cover app shape, generation strategy, chart emphasis layering, preview lifecycle, and preferred stack.
- **Behavior-Driven User Value**: PASS. Each user story has Given/When/Then scenarios plus independent test and demo paths. Agent decision flow has scenarios for LLM semantic segmentation validation/fallback, deterministic deck planning/compiler validation, slide outline/source trace, semantic titles, numeric visualization, ui-ux-pro-max boundaries, preview, and artifact display.
- **Source Fidelity**: PASS. Domain model includes `SemanticSegment`, `SourceSection`, `SourceFact`, `ChartIntent`, `DeckPlanProposal`, `SlideOutlineItem`, `SourceTrace`, and `ReviewReport`. Segmentation must preserve exact source quotes; content core owns source fact extraction and chart decisions; deck planner/compiler own stable slide structure and outline traceability.
- **Reviewable Generation**: PASS. Review report fields are required: assumptions, omitted/compressed content, uncertain claims, charting decisions, human review notes.
- **Web-First Deliverable**: PASS. Primary deliverable is self-contained HTML slides plus local browser preview and download.
- **Backend-Configured LLM Boundary**: PASS. Provider/model selection is backend-owned and intentionally absent from request fields, review report, generation summary, and user-facing response fields. LLM usage is limited to semantic segmentation for v1; deck planning v1 is deterministic and source-order preserving; design skill usage remains bounded by source-fidelity rules. Internal evidence preserves the sensitive-content processing boundary.
- **Coherent Deck Design System**: PASS. Design system is a first-class domain entity with palette, typography, spacing, visual density, layout grid, reusable slide patterns, and chart style.
- **Semantic Titles and Data Visualization**: PASS. LLM-assisted segmentation creates source-grounded sections; content core then inspects numeric descriptions and visualization logic, then merges free-text chart emphasis into unified `ChartIntent` decisions. Deck planner/compiler add deterministic slide titles, source-order outline, `slideKind`, and speaker notes draft without inventing source facts.
- **Code Quality and Simplicity**: PASS WITH JUSTIFIED COMPLEXITY. React + NestJS is more scaffold than a single Vite/Node app, but it matches company technical line and keeps frontend/backend boundaries explicit. See Complexity Tracking.
- **TDD and DDD**: PASS. First tests target shared domain contracts: request validation, source fact extraction, chart intent decisions, review report generation, and HTML rendering contract.
- **Lean Test Scope**: PASS. Tests cover observable behavior and domain contracts. Visual polish uses Playwright smoke checks plus manual verification instead of brittle pixel-perfect assertions.
- **Consistent UX and Language**: PASS. Canonical terms: `SourceContent`, `DeckBrief`, `DeckPlanProposal`, `SlideOutlineItem`, `SlideDeck`, `Slide`, `ContentBlock`, `ChartIntent`, `DesignSystem`, `ReviewReport`, `PreviewArtifact`.
- **Performance and Operational Evidence**: PASS. Performance goals above are explicit. Evidence artifacts are defined below.
- **Manual Verification Path**: PASS. Visual consistency, layout overlap, browser preview, and downloaded HTML are manually verified through quickstart.
- **Release Verification**: PASS. Verification includes schema validation, review report validation, HTML rendering, keyboard navigation, responsive behavior, download, and manual evidence.

## Project Structure

### Documentation (this feature)

```text
specs/002-generate-previewable-html-slides/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-contract.md
│   └── slide-generation.schema.json
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── src/
│   │   ├── features/slide-generation/
│   │   ├── components/
│   │   └── test/
│   └── tests/
│       └── e2e/
└── api/
    ├── src/
    │   ├── modules/slides/
    │   ├── adapters/ui-ux-pro-max/
    │   └── main.ts
    └── test/

packages/
├── domain/
│   ├── src/
│   │   ├── content-core/
│   │   ├── deck/
│   │   ├── design/
│   │   ├── rendering/
│   │   └── review/
│   └── test/
└── contracts/
    ├── src/
    └── schemas/

tests/
└── fixtures/
    ├── planning-brief.md
    ├── expected-source-facts.json
    └── expected-chart-intents.json
```

**Structure Decision**: Use a small monorepo because the feature needs a React local UI, NestJS local API/agent boundary, and shared domain/contracts. Keep all product data session-only and avoid persistence packages.

## Complexity Tracking

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------------|------------|-------------------------------------|
| React frontend + NestJS backend instead of single-process Vite app | Aligns with company technical line and validates future frontend/backend boundary early | Single Vite/Node app is simpler but diverges from target company stack and would require later architectural rewrite |
| Shared `packages/domain` and `packages/contracts` | Keeps deterministic content core, schema contracts, renderer contracts, and API boundary testable without UI/Nest coupling | Putting domain logic inside NestJS controllers or React components would violate DDD and make TDD harder |
| Playwright browser checks | Needed for keyboard navigation and responsive preview evidence | Pure unit tests cannot verify browser navigation, downloaded HTML behavior, or layout overlap risks |
| LLM-assisted semantic segmentation before deterministic content core | Source content can be unstructured internal reports; regex-only segmentation risks losing paragraph meaning and weakens slide grouping | Regex-only parser is simpler and remains fallback, but it cannot reliably split markdown headings, inline headings, mixed bullets, or multi-topic long paragraphs |
| Single LLM format repair attempt before fallback | Improves user experience when the LLM understood the content but returned malformed JSON, without exposing raw schema errors or dropping immediately to conservative segmentation | Direct fallback is simpler but may make fixable provider formatting issues look like poor product quality; unlimited retry is rejected because it increases cost/latency and can drift source meaning |
| DeckPlanner + DeckCompiler split | Keeps source-order deck structure, `slideKind`, outline, and speaker notes draft testable while allowing future LLM proposal support without changing final `SlideDeck` compiler boundary | A single `planSlideDeck` function is simpler but mixes proposal, validation, compilation, and review evidence; direct LLM SlideDeck output is rejected for v1 because it weakens source-fidelity and schema stability |
| ui-ux-pro-max design handoff after DeckCompiler | Preserves user trust by allowing stronger visual planning and critique only after content structure is validated | Putting ui-ux-pro-max inside DeckPlanner could blur source-fidelity boundaries and allow design advice to change content order, wording, or meaning |

## Evidence Plan

- **Automated Evidence**: domain tests for semantic segmentation schema validation/source quote grounding/format repair/fallback, deterministic source-order deck plan proposal, deck compiler reference validation, slide outline/source trace, speaker notes draft, source facts/chart intents/review report, contract tests for request/response schema, renderer tests for self-contained HTML and non-rendered speaker notes, Playwright tests for keyboard navigation and preview route.
- **Manual Verification**: quickstart manual checklist for visual consistency, layout overlap, downloaded HTML opening without backend, responsive laptop/projector dimensions.
- **Operational Evidence**: local generation/render timing notes from quickstart; screenshot evidence for preview route and downloaded HTML.
- **Decision Evidence**: research.md records React + NestJS choice, LLM-assisted semantic segmentation with one format repair attempt and deterministic validation/fallback, deterministic downstream content core, deterministic source-order deck planner/compiler v1, session-only preview, provider boundary, ui-ux-pro-max design handoff boundary, rejected simpler alternatives.

## Phase 0 Research Output

See [research.md](./research.md).

## Phase 1 Design Output

See [data-model.md](./data-model.md), [contracts/api-contract.md](./contracts/api-contract.md), [contracts/slide-generation.schema.json](./contracts/slide-generation.schema.json), [contracts/semantic-segmentation.schema.json](./contracts/semantic-segmentation.schema.json), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

PASS. Phase 1 artifacts preserve the planned boundaries: no persistence, no publishing, LLM-assisted semantic segmentation with one bounded format repair attempt plus deterministic validation/fallback, deterministic downstream content core, deterministic source-order deck planner/compiler with `slideKind`, source-grounded outline and required speaker notes draft, explicit ui-ux-pro-max design handoff boundary, schema contracts, local preview/manual verification path, and evidence artifacts.
