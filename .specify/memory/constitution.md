<!--
Sync Impact Report
Version change: 3.2.0 -> 3.3.0
Modified principles:
- Expanded: VII. Code Quality and Simplicity — added explicit "No dead code, shims, or
  legacy coexistence" gate (full-replacement rule; zero unused code incl. UI/i18n;
  manual enforcement because noUnusedLocals is off; no over-strict types)
Added sections:
- None
Removed sections:
- None
Templates requiring updates:
- Updated: .specify/templates/plan-template.md (Code Quality and Simplicity gate)
- Review recommended: .specify/templates/tasks-template.md (polish/cleanup tasks)
- No update needed: .specify/templates/spec-template.md
Follow-up TODOs:
- None
-->

# HTML Slides Agent Constitution

## Core Principles

### I. Specification First and Constitution Gate

No product code, runtime scaffolding, UI implementation, provider integration, renderer,
or agent implementation may begin until the relevant feature has an accepted specification.
Every feature plan MUST pass the Constitution Check before Phase 0 research, before design
is accepted, and before implementation starts.

A valid specification MUST define the user problem, target audience, input contract,
output contract, prioritized user stories, acceptance criteria, review requirements,
and unresolved questions. Ambiguous requirements that affect behavior, privacy, output,
or user value MUST be clarified before coding starts.

Rationale: This project is explicitly spec-driven. Code written before the problem and
contract are explicit creates rework and makes generated slide behavior difficult to
evaluate.

### II. Behavior-Driven User Value

User-facing behavior and agent decision flow MUST be described with Given/When/Then
scenarios before implementation. Every user story MUST be independently demonstrable and
independently testable, so a single completed story can be shown as a meaningful product
increment without relying on unfinished stories.

Agent decisions that materially change output, including content compression, semantic
title generation, chart selection, review-note creation, design-system selection, and
publishing decisions, MUST have behavior scenarios or executable verification tasks.

Rationale: The product is valuable only when users can understand, review, present, and
share generated slides. BDD keeps the work grounded in observable user value instead of
internal implementation structure.

### III. Source Fidelity and Reviewable Generation

Generated slides MUST preserve important facts from the source material, including
numbers, dates, named entities, decisions, risks, constraints, owners, deadlines, and
stated tradeoffs. The system MUST NOT invent unsupported claims, silently strengthen weak
claims, or alter source meaning during summarization, charting, or design transformation.

Every generation flow MUST produce a review report alongside the slide output. The report
MUST include assumptions, omitted or compressed content, uncertain claims, charting
decisions, and human review notes. When the system cannot determine whether a claim is
supported by the input, it MUST surface uncertainty rather than present the claim as
verified.

Rationale: Internal reports, proposals, and planning decks are decision artifacts. A
visually strong deck that distorts the source content is a product failure.

### IV. Web-First Deliverable

Version 1 MUST treat self-contained HTML slides as the primary artifact. The HTML deck
MUST open in a browser without a backend, preserve a 16:9 presentation format, support
keyboard navigation, and remain usable on common laptop and projector sizes. Native PPTX
export is out of scope for version 1 unless this constitution is amended.

Rationale: The project goal is to make slide communication web-native first, not to
recreate traditional slide tooling.

### V. Backend-Configured LLM Boundary

Version 1 uses backend-configured LLM APIs as part of the product path. Provider and
model selection are backend runtime configuration, not user-facing request fields,
response fields, or generated review-report fields, unless a future accepted feature spec
explicitly changes that contract.

Provider integration MUST be replaceable and isolated behind a provider boundary. Feature
plans MUST document internally which backend provider/model configuration is used, what
content is sent, what purpose the provider serves, and what operational evidence is
preserved for reviewers. Provider output MUST NOT become source truth: source fidelity,
charting decisions, and review notes still require traceability to the supplied source
content.

Rationale: Expected inputs include internal reports, proposals, and planning documents
that may contain sensitive company information. The project currently does not have
self-hosted model capacity, so trust must come from backend-owned provider configuration,
source-fidelity controls, reviewability, and internal operational evidence rather than
user-tunable model settings.

### VI. Consistent User Experience and Language

The system MUST use consistent terminology across user-facing UI, generated reports, CLI
output, documentation, decision rationale, and Spec Kit artifacts. The same domain concept
MUST use the same name unless a spec explicitly defines an alias.

Spec Kit artifacts for this project, including feature specs, plans, tasks, checklists,
quickstarts, and product notes, MUST be written in Traditional Chinese by default.
This constitution MUST remain in English. Code identifiers, schema keys, API field names,
and domain model names SHOULD use English unless a specific external contract requires
otherwise.

Rationale: Consistent language reduces ambiguity for both humans and agents. Keeping the
constitution in English makes governance concise and stable, while Traditional Chinese
artifacts match the working language of the project.

### VII. Code Quality and Simplicity

Implementation MUST be small-step, readable, and simple. Prefer KISS over speculative
architecture. Do not introduce abstractions, frameworks, services, queues, caches,
plugins, or generalized extension points for unproven needs. New complexity MUST include
a documented rejected simpler alternative in the feature plan.

Proof-of-concept, MVP, and internal-tool work SHOULD optimize for clarity, traceability,
and reversibility over premature scale. Refactoring is allowed when it removes real
duplication, clarifies domain boundaries, or simplifies a verified behavior.

Domain modules MUST keep file roles readable. Type-only declarations SHOULD live in
`*.types.ts` files. External capability interfaces and adapter boundaries SHOULD live in
`*.port.ts` files. Domain behavior SHOULD live in files named for the behavior role, such
as `*.planner.ts`, `*.validator.ts`, `*.extractor.ts`, `*.parser.ts`, `*.service.ts`, or a
specific flow name. A non-trivial file MUST NOT mix type-only declarations, external
ports, and orchestration behavior unless the feature plan documents why the temporary
mixing is simpler and how it will be unwound.

Do not over-design domain artifacts. A new type, field, enum value, service, planner,
validator, adapter boundary, or intermediate artifact MUST have at least one current
consumer in the same feature slice, or a near-term task with an independently testable
acceptance path that consumes it. If the consumer is future work, the feature plan MUST
record the rejected simpler alternative and the task that will prove the artifact is
useful. Artifacts that remain unconsumed after the planned slice MUST be removed or
simplified before completion unless the deferral is explicitly approved in evidence.

No dead code, shims, or legacy coexistence. After any change there MUST be exactly one
way to do each thing. When a behavior, type, component, path, or contract shape is
replaced, the old one MUST be fully removed in the same change — never left coexisting,
aliased, or hidden behind a backward-compatibility shim or optional "support both shapes"
parameter. No unused code may remain: unused imports, variables, exports, props, type
fields, enum values, branches, dead UI, or unreferenced i18n / config / schema keys.
Because the toolchain does NOT enable `noUnusedLocals` / `noUnusedParameters`, this MUST be
verified manually and in review, not assumed from a green build. Types MUST NOT encode a
constraint stricter than the code actually exercises (for example a fixed-length tuple
where the consumer only iterates) unless that constraint is genuinely enforced and needed.

Rationale: The project is exploring a new agent workflow. Simple, readable increments make
the system easier to validate and change. Domain structures that humans cannot see in
current behavior are risk: they increase review cost and make the agent flow look more
capable than it is.

### VIII. Test-First Engineering and DDD

All automatable production behavior MUST be developed test-first. The required cycle is:
write a focused failing test or executable verification task, confirm red, implement the
minimum behavior, confirm green, then refactor. Production code MUST NOT be added for a
spec requirement unless the corresponding test or verification path exists first.

Every PR or feature spec MUST have corresponding tests or executable verification tasks.
Tests MUST be concise, focused, non-redundant, and maintainable. Avoid broad, fragile,
duplicative, or implementation-detail assertions unless they protect an explicit contract.

Domain behavior MUST be modeled with DDD discipline: use clear ubiquitous language,
domain concepts, entities, value objects, domain services, or policies. Core rules MUST
NOT be scattered across UI, controllers, provider adapters, persistence code, or rendering
code.

DDD artifacts MUST make their role obvious from the file name and import path. `types`
files define language and shapes only. `port` files define what the domain needs from
outside the domain. Behavior files contain executable domain decisions. Tests SHOULD
import behavior from behavior files and types from type or port files, so refactoring does
not blur domain language with execution flow.

Rationale: TDD proves behavior against the spec; DDD keeps slide generation, source
fidelity, review reporting, design planning, rendering, and publishing boundaries clear.

### IX. Coherent Design System, Semantic Titles, and Data Visualization

Each generated deck MUST use a coherent design system covering palette, typography,
spacing, visual density, layout grid, reusable slide patterns, and chart style. Individual
slides MUST NOT choose unrelated visual styles. User design direction MUST be translated
into concrete constraints that improve readability and meeting comprehension.

Generated slide titles SHOULD summarize the core meaning of the paragraph or slide rather
than merely copy source headings. When source content contains numbers that can form a
comparison, trend, ratio, ranking, progress view, or distribution, the system SHOULD
convert them into an appropriate chart, metric card, table, or visual structure.

Any charting transformation MUST preserve original numbers, units, periods,
denominators, and context. If the source data is insufficient for charting, the system
MUST keep the content as text, table, or review note rather than invent missing data.

The `ui-ux-pro-max` skill MUST be part of the generation flow for design planning and
critique. It MAY improve
visual hierarchy, layout selection, density, chart treatment, and design consistency, but
it MUST NOT invent facts, alter source meaning, or override review notes.

Rationale: Good slides are not just paginated text. They convert meaning into quickly
understandable claims and convert numbers into visual structures only when the source data
supports that transformation.

### X. Performance and Operational Evidence

Every feature plan MUST define performance, resource, and response-time targets, or state
why they are not applicable. Safety, privacy, provider, publishing, and operational
decisions MUST preserve enough artifact evidence that a reviewer can understand the
decision without rerunning a demo.

Non-automatable behavior MUST have a manual verification path. Decisions and outputs MUST
be traceable through artifacts or evidence, such as specs, plans, tests, quickstarts,
review reports, generated sample artifacts, screenshots, logs, or documented inspection
steps.

Rationale: Presentation generation involves user trust, sensitive content, generated HTML,
and published URLs. Reviewers need evidence that survives beyond a local demo.

## Product Boundaries and Runtime Constraints

Version 1 scope is intentionally narrow:

- The primary output is a self-contained HTML slide deck plus structured slide JSON and a
  review report.
- Pasted source content is sufficient for the first milestone; file upload is optional
  and requires explicit specification.
- PPTX export, real-time collaborative editing, account systems, persistence, and full
  drag-and-drop slide editing are out of scope unless a feature spec explicitly amends
  the milestone.
- Research or fact checking beyond the supplied source content MUST be opt-in and
  separately specified.
- Output language SHOULD follow the input language unless the user specifies otherwise.
- Chinese, English, and mixed-language source content SHOULD be supported when doing so
  does not weaken the required gates.
- Slide titles SHOULD present the core meaning of the paragraph or slide; charting and
  visual transformation MUST remain limited by source data completeness.

## Artifact Language Policy

- This constitution MUST remain in English.
- Spec Kit artifacts MUST be written in Traditional Chinese by default.
- User-facing generated slide content SHOULD follow the user's requested language or the
  source language.
- Code identifiers, schema keys, filenames, API contracts, and domain model names SHOULD
  use English for consistency and tool compatibility.

## Development Workflow and Review Gates

All feature work follows this order:

1. Create or update the feature specification in Traditional Chinese.
2. Define Given/When/Then scenarios for user-facing behavior and agent decision flow.
3. Resolve open questions that affect behavior, privacy, output contract, performance,
   operational evidence, or acceptance.
4. Create the implementation plan and pass the Constitution Check.
5. Document performance/resource targets or mark them N/A with rationale.
6. Document any added complexity with the rejected simpler alternative.
7. Create the task list with tests and verification tasks linked to the accepted spec.
8. Create the corresponding failing tests or executable verification tasks first.
9. Implement only approved tasks with the minimum behavior needed to pass tests.
10. Refactor after tests pass, keeping domain boundaries clear and code simple.
11. Verify schema, rendering, keyboard navigation, basic responsive behavior, publishing,
    review report output, manual verification paths, and artifact evidence before marking
    the feature complete.

Reviews MUST check compliance with this constitution before accepting implementation
work. If a feature intentionally violates a principle, the plan MUST document the
violation, why it is necessary, and the simpler compliant alternative that was rejected.

## Governance

This constitution supersedes informal development preferences for this project. Feature
specifications, implementation plans, tasks, PRs, and reviews MUST comply with it.
Amendments require:

- A written reason for the change.
- An update to this file with a Sync Impact Report.
- A semantic version bump.
- Review of affected Spec Kit templates and active specs.

Versioning policy:

- MAJOR version changes redefine or remove core principles or governance requirements.
- MINOR version changes add principles, sections, or materially expand required gates.
- PATCH version changes clarify wording without changing required behavior.

Compliance review is required during planning and before feature completion. If a gate is
deferred, the deferral MUST include a specific follow-up task and cannot be hidden in
general prose.

**Version**: 3.3.0 | **Ratified**: 2026-05-29 | **Last Amended**: 2026-06-08
