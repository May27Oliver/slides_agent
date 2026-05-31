# Implementation Plan: Generate Previewable HTML Slides

**Branch**: `002-generate-previewable-html-slides` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-generate-previewable-html-slides/spec.md`

## Summary

建立第一個可實作 vertical slice：使用者在 local web app 貼上 source content，填寫 purpose、audience、style direction 與 free-text chart emphasis；NestJS backend 透過 deterministic content core 產生可追溯的 slide JSON、review report 與 chart intents；ui-ux-pro-max design layer 只輔助 summary presentation、design planning、layout selection 與 critique；React + TypeScript frontend 提供 session-only preview、review report、slide JSON、generation summary 與 self-contained HTML download。

**Artifact Language**: 本 feature 的 Spec Kit artifacts 使用繁體中文；domain model、schema keys、API field names、code identifiers 使用英文。

## Technical Context

**Language/Version**: TypeScript on Node.js `v20.19.5`

**Package Manager**: pnpm `10.30.3` with `pnpm-workspace.yaml` for `apps/*` and `packages/*`.

**Primary Dependencies**: React + TypeScript frontend, NestJS backend, shared TypeScript domain package, JSON Schema validation, Playwright for browser verification, ui-ux-pro-max skill as design guidance source

**Storage**: N/A for product data. Preview artifacts are session-only in browser/backend memory for this slice; no database, deck history, automatic artifact storage, or publishing.

**Testing**: TDD with focused unit/contract/integration tests. Domain and renderer tests should be deterministic. Browser behavior and responsive checks use Playwright or an equivalent browser automation tool. Manual verification remains required for visual quality and design consistency.

**Target Platform**: Local development web app opened in a desktop browser; generated self-contained HTML should open directly in a browser without backend dependency.

**Project Type**: Local web app with monorepo structure: React frontend, NestJS backend, shared domain/contracts packages.

**Performance Goals**:

- Deterministic content-core generation for representative fixture: <= 2s on local development machine.
- HTML rendering from valid slide JSON fixture: <= 500ms.
- Local preview route first usable render after successful generation: <= 1s.
- Downloaded self-contained HTML target size for representative fixture: <= 1MB unless embedded content requires otherwise.

**Constraints**:

- No persistence, publish URL, account system, file upload, PPTX export, full slide editor, or revision loop in this slice.
- Source facts, chart decisions, source traces, and review report behavior must be deterministic and testable.
- ui-ux-pro-max may improve presentation/design decisions but must not invent facts, alter source meaning, or override review notes.
- External providers are optional and must remain behind a provider boundary; deterministic path must work without external provider configuration.

**Scale/Scope**:

- Pasted text only.
- Representative input target: internal planning/report content that can reasonably produce 3-8 slides.
- One active generated deck per local session.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification First**: PASS. Accepted source is [spec.md](./spec.md). No unresolved clarification markers remain. Clarifications cover app shape, generation strategy, chart emphasis layering, preview lifecycle, and preferred stack.
- **Behavior-Driven User Value**: PASS. Each user story has Given/When/Then scenarios plus independent test and demo paths. Agent decision flow has scenarios for semantic titles, numeric visualization, ui-ux-pro-max boundaries, preview, and artifact display.
- **Source Fidelity**: PASS. Domain model includes `SourceFact`, `ChartIntent`, `SourceTrace`, and `ReviewReport`. Content core owns source fact extraction, chart decisions, and review report behavior.
- **Reviewable Generation**: PASS. Review report fields are required: assumptions, omitted/compressed content, uncertain claims, charting decisions, human review notes.
- **Web-First Deliverable**: PASS. Primary deliverable is self-contained HTML slides plus local browser preview and download.
- **Privacy-First Provider Boundary**: PASS. Default path is deterministic/local. External provider is optional and must be explicit. No source content leaves local runtime in the default flow.
- **Coherent Deck Design System**: PASS. Design system is a first-class domain entity with palette, typography, spacing, visual density, layout grid, reusable slide patterns, and chart style.
- **Semantic Titles and Data Visualization**: PASS. Content core first inspects numeric descriptions and visualization logic, then merges free-text chart emphasis into unified `ChartIntent` decisions.
- **Code Quality and Simplicity**: PASS WITH JUSTIFIED COMPLEXITY. React + NestJS is more scaffold than a single Vite/Node app, but it matches company technical line and keeps frontend/backend boundaries explicit. See Complexity Tracking.
- **TDD and DDD**: PASS. First tests target shared domain contracts: request validation, source fact extraction, chart intent decisions, review report generation, and HTML rendering contract.
- **Lean Test Scope**: PASS. Tests cover observable behavior and domain contracts. Visual polish uses Playwright smoke checks plus manual verification instead of brittle pixel-perfect assertions.
- **Consistent UX and Language**: PASS. Canonical terms: `SourceContent`, `DeckBrief`, `SlideDeck`, `Slide`, `ContentBlock`, `ChartIntent`, `DesignSystem`, `ReviewReport`, `PreviewArtifact`.
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

## Evidence Plan

- **Automated Evidence**: domain tests for source facts/chart intents/review report, contract tests for request/response schema, renderer tests for self-contained HTML, Playwright tests for keyboard navigation and preview route.
- **Manual Verification**: quickstart manual checklist for visual consistency, layout overlap, downloaded HTML opening without backend, responsive laptop/projector dimensions.
- **Operational Evidence**: local generation/render timing notes from quickstart; screenshot evidence for preview route and downloaded HTML.
- **Decision Evidence**: research.md records React + NestJS choice, deterministic content core, session-only preview, provider boundary, ui-ux-pro-max boundary, rejected simpler alternatives.

## Phase 0 Research Output

See [research.md](./research.md).

## Phase 1 Design Output

See [data-model.md](./data-model.md), [contracts/api-contract.md](./contracts/api-contract.md), [contracts/slide-generation.schema.json](./contracts/slide-generation.schema.json), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

PASS. Phase 1 artifacts preserve the planned boundaries: no persistence, no publishing, deterministic content core, explicit ui-ux-pro-max boundary, schema contracts, local preview/manual verification path, and evidence artifacts.
