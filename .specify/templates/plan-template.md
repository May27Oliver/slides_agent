# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

**Artifact Language**: This plan and related Spec Kit artifacts for this project MUST be
written in Traditional Chinese unless the user explicitly requests otherwise.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The plan MUST explicitly answer each gate below:

- **Specification First**: Link to an accepted `spec.md`. List any unresolved questions
  and explain why they do not block planning.
- **Behavior-Driven User Value**: Confirm every user-facing behavior and agent decision
  flow has Given/When/Then scenarios, and every user story is independently demonstrable
  and testable.
- **Source Fidelity**: Define how source facts, numbers, dates, decisions, risks,
  owners, and constraints will be preserved or traced.
- **Reviewable Generation**: Define the generation report fields for assumptions,
  omitted or compressed content, uncertain claims, and review notes.
- **Web-First Deliverable**: Confirm self-contained HTML slides are the primary v1
  artifact and document any approved exception.
- **Backend-Configured LLM Boundary**: State that provider/model selection is backend
  runtime configuration, not user request/response contract. Document internally what
  content is sent and what operational evidence is preserved.
- **Coherent Deck Design System**: Define how palette, typography, spacing, density,
  layout grid, and reusable slide patterns will remain consistent.
- **Semantic Titles and Data Visualization**: Define how paragraph meaning becomes
  slide titles, and how numeric content is converted into charts, metric cards, tables,
  or kept as text when the data is insufficient.
- **Code Quality and Simplicity**: Explain the smallest readable approach. Any added
  abstraction, framework, service, or complexity MUST include the rejected simpler
  alternative. Confirm non-trivial domain modules separate type-only declarations,
  external ports, and executable behavior into clearly named files such as `*.types.ts`,
  `*.port.ts`, `*.planner.ts`, `*.validator.ts`, `*.extractor.ts`, `*.parser.ts`, or
  `*.service.ts`. For every new domain type, field, enum value, service, planner,
  validator, adapter boundary, or intermediate artifact, identify the current consumer or
  the near-term independently testable task that will consume it; otherwise choose the
  rejected simpler alternative.
- **TDD and DDD**: Identify the first failing tests or verification tasks, the main
  domain concepts, bounded context, where domain behavior will live, and which files hold
  domain language (`*.types.ts`), adapter boundaries (`*.port.ts`), and executable domain
  decisions.
- **Lean Test Scope**: Explain why the planned tests are sufficient and not redundant;
  avoid implementation-detail assertions unless they guard an explicit contract.
- **Consistent UX and Language**: Define the terms that must remain consistent across UI,
  reports, CLI output, docs, and decision rationale.
- **Performance and Operational Evidence**: Define performance/resource/response targets,
  or state N/A with rationale. Define evidence artifacts that let reviewers understand
  safety, privacy, backend provider configuration, publishing, and operational decisions
  without rerunning a demo.
- **Manual Verification Path**: Identify behavior that cannot be automated and document
  the manual verification path.
- **Release Verification**: Define how slide JSON schema, HTML rendering, keyboard
  navigation, and basic responsive behavior will be verified before completion.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Evidence Plan

List artifacts that will preserve decisions and outputs for review:

- **Automated Evidence**: [tests, contracts, generated sample artifacts, logs, reports]
- **Manual Verification**: [inspection path for behavior that cannot be automated]
- **Operational Evidence**: [performance/resource results, publishing proof, screenshots]
- **Decision Evidence**: [privacy/backend-provider/safety rationale and rejected alternatives]
