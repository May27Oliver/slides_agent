# Feature Specification: [FEATURE NAME]

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Independent Demo**: [Describe how this story can be demonstrated without relying on unfinished stories]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Independent Demo**: [Describe how this story can be demonstrated without relying on unfinished stories]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Independent Demo**: [Describe how this story can be demonstrated without relying on unfinished stories]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: Specification MUST identify source facts that must be
  preserved, including numbers, dates, named entities, decisions, risks, constraints,
  owners, deadlines, and stated tradeoffs.
- **CR-002 Review Report**: Specification MUST define assumptions, omitted or compressed
  content, uncertain claims, and review notes as visible generation outputs.
- **CR-003 Web-First Output**: Specification MUST treat self-contained HTML slides as
  the primary v1 deliverable unless an approved exception is documented.
- **CR-004 Privacy Boundary**: Specification MUST state whether source content may leave
  the local runtime and how any external provider is explicitly configured.
- **CR-005 Design System**: Specification MUST define expected deck-level design
  constraints, including palette, typography, spacing, visual density, and reusable slide
  patterns.
- **CR-006 Semantic Titles**: Specification MUST define whether slide titles should
  summarize paragraph or slide meaning, and how title claims remain grounded in the
  source content.
- **CR-007 Data Visualization**: Specification MUST define when numeric content should be
  converted into charts, metric cards, tables, or preserved as text because the source data
  is insufficient.
- **CR-008 TDD Coverage**: Specification MUST define the behavior that corresponding
  tests or executable verification tasks will cover for each PR or feature slice.
- **CR-009 Domain Model**: Specification MUST identify the main domain concepts and
  rules that should be represented in the domain model or domain services.
- **CR-010 Lean Test Scope**: Specification MUST state how tests remain concise,
  non-redundant, and focused on observable behavior or domain rules.
- **CR-011 Behavior-Driven Value**: Specification MUST define Given/When/Then scenarios
  for user-facing behavior and agent decision flow. Each user story MUST be independently
  demonstrable and independently testable.
- **CR-012 Code Simplicity**: Specification MUST identify scope boundaries that prevent
  speculative abstractions or unproven complexity.
- **CR-013 Consistent Language**: Specification MUST identify key terms that should remain
  consistent across UI, reports, CLI output, documentation, and decision rationale.
- **CR-014 Performance and Evidence**: Specification MUST state expected
  performance/resource/response outcomes or mark them N/A, and identify artifacts or
  evidence required for review.
- **CR-015 Manual Verification**: Specification MUST identify behavior that cannot be
  automated and define a manual verification path.
- **CR-016 Verification**: Specification MUST include acceptance scenarios for slide JSON
  schema validity, HTML rendering, keyboard navigation, and basic responsive behavior.

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- [Assumption about target users, e.g., "Users have stable internet connectivity"]
- [Assumption about scope boundaries, e.g., "Mobile support is out of scope for v1"]
- [Assumption about data/environment, e.g., "Existing authentication system will be reused"]
- [Dependency on existing system/service, e.g., "Requires access to the existing user profile API"]

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: [What the generated output must disclose]
- **Omitted or Compressed Content Policy**: [How omitted/compressed source content is
  selected and reported]
- **Uncertain Claims Policy**: [How unsupported or ambiguous claims are identified]
- **Sensitive Content Handling**: [Whether content stays local, uses configured providers,
  or requires user approval]
- **Evidence and Traceability**: [Artifacts or evidence that make decisions and outputs
  reviewable without rerunning a demo]
- **Manual Verification Path**: [Manual inspection path for behavior that cannot be
  automated]
