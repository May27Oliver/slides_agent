# HTML Slides Agent Spec

Status: Draft

Last updated: 2026-05-29

## 1. Background

Many internal company workflows rely on slide decks: business reports, client proposals, PM planning, project reviews, retrospectives, strategy updates, and meeting pre-reads. Traditional PPT files are slow to create, hard to iterate with AI agents, and less convenient for web-native sharing.

This project aims to create an agent flow that accepts raw user input plus presentation design direction, then produces readable, visually polished, web-native HTML slides.

## 2. Product Goal

Given a user's source content and slide design preferences, the system should automatically generate an HTML slide deck that can be opened in a browser, shared as a webpage, and used directly in meetings.

The generated deck should help attendees understand the message faster by converting unstructured or semi-structured content into a clear narrative, slide structure, visual hierarchy, and browser-friendly presentation.

## 3. Non-Goals

The first version will not:

- Export native `.pptx` files.
- Support real-time collaborative editing.
- Replace professional designers for high-stakes external brand decks.
- Guarantee factual correctness beyond the provided input unless external research tools are explicitly enabled.
- Build a full slide editor with drag-and-drop layout editing.
- Depend on a specific LLM provider in the product contract.

## 4. Primary Users

- Founders and executives creating strategy, investor, or operating review decks.
- PMs creating planning, roadmap, PRD, launch, or sprint review slides.
- Business teams creating proposals, reports, sales enablement, or internal summaries.
- Operators and analysts turning dense notes, tables, or meeting docs into presentation-ready communication.

## 5. Core User Story

As a user, I paste or upload source content, describe the target audience and desired slide style, then receive an HTML slide deck that communicates the content clearly and is ready to share or present.

## 6. Input Contract

The agent flow accepts the following user-provided fields.

### 6.1 Required Fields

- `source_content`: Raw material to transform into slides. This can be notes, markdown, meeting transcript, report text, planning docs, proposal outline, or structured bullet points.
- `deck_purpose`: Why the deck is being made. Examples: internal review, customer proposal, roadmap planning, executive update, training, retrospective.
- `audience`: Who will read or attend the presentation. Examples: leadership team, PMs, engineers, clients, investors, cross-functional stakeholders.

### 6.2 Optional Fields

- `design_direction`: Visual and layout preference. Examples: concise executive style, dense PM planning deck, modern SaaS proposal, data-heavy board report.
- `tone`: Communication tone. Examples: direct, strategic, analytical, persuasive, friendly, formal.
- `slide_count_target`: Approximate number of slides.
- `language`: Output language. Default follows the input language.
- `brand_constraints`: Colors, typography, logo usage, visual restrictions, company style guide notes.
- `must_include`: Specific points, sections, metrics, charts, or decisions that must appear.
- `must_avoid`: Claims, topics, visuals, phrases, or structures to avoid.
- `output_format_preferences`: Examples: single-page HTML, reveal.js-compatible HTML, printable HTML, speaker-notes included.

## 7. Output Contract

The system produces:

- A complete HTML slide deck.
- A structured slide JSON representation.
- A generation report that lists assumptions, omitted content, uncertain claims, and recommended human review points.

The first implementation target should be a self-contained HTML file that can run locally in a browser without a backend.

## 8. Slide Deck Quality Principles

Generated decks should:

- Make the key message visible within the first 1-2 slides.
- Prefer clear information architecture over decorative design.
- Convert dense input into audience-relevant narrative flow.
- Use concise slide titles that communicate claims, not only topics.
- Preserve important facts, numbers, risks, decisions, owners, and deadlines.
- Use tables, comparison layouts, timelines, metrics, and callouts when they improve comprehension.
- Avoid generic AI-sounding filler, vague business language, and visually repetitive slides.
- Treat design direction as constraints, not just theme decoration.

## 9. Agent Flow

The planned flow has six stages.

### 9.1 Intake Analysis

Parse the input and identify:

- Main topic.
- Intended outcome.
- Audience needs.
- Content type.
- Source structure.
- Key facts, entities, metrics, dates, decisions, risks, and open questions.
- Missing context that may affect slide quality.

### 9.2 Narrative Planning

Create a deck-level storyline:

- Opening context.
- Main argument or message.
- Supporting sections.
- Evidence or examples.
- Decision points or next actions.
- Closing slide.

The output of this stage is a deck outline, not visual slides yet.

### 9.3 Slide Architecture

Convert the outline into slide-level structure:

- Slide count.
- Slide purpose.
- Slide title.
- Main message.
- Content blocks.
- Suggested layout type.
- Data visualization needs.
- Speaker note candidates.

### 9.4 Design System Planning

Translate user design direction into a concrete deck design system:

- Color palette.
- Typography scale.
- Spacing rules.
- Layout grid.
- Visual density.
- Chart/table style.
- Component patterns.
- Accessibility constraints.

This stage should prevent each slide from looking unrelated.

### 9.5 HTML Rendering Plan

Map each slide into HTML/CSS-ready components:

- Hero/title slide.
- Section divider.
- Text and evidence slide.
- Two-column comparison.
- Timeline.
- Table.
- KPI grid.
- Quote or insight slide.
- Decision/action slide.

### 9.6 Critique and Revision

Review the generated slide plan before final rendering:

- Is the storyline coherent?
- Are titles specific?
- Are slides overloaded?
- Are important source facts preserved?
- Does the deck match audience and purpose?
- Are there unsupported claims?
- Are visual patterns consistent?

The first version may run this stage once. Later versions can support multi-pass revision.

## 10. Proposed Slide JSON Schema

```json
{
  "deck": {
    "title": "string",
    "subtitle": "string",
    "purpose": "string",
    "audience": "string",
    "language": "string",
    "assumptions": ["string"],
    "review_notes": ["string"]
  },
  "design_system": {
    "theme_name": "string",
    "visual_density": "low | medium | high",
    "palette": {
      "background": "string",
      "surface": "string",
      "text": "string",
      "muted_text": "string",
      "primary": "string",
      "accent": "string",
      "warning": "string"
    },
    "typography": {
      "heading_font": "string",
      "body_font": "string",
      "scale": "compact | standard | expressive"
    },
    "layout": {
      "aspect_ratio": "16:9",
      "max_content_width": "string",
      "grid": "string"
    }
  },
  "slides": [
    {
      "id": "string",
      "type": "title | section | content | comparison | timeline | table | metrics | quote | action",
      "title": "string",
      "message": "string",
      "layout": "string",
      "content_blocks": [
        {
          "kind": "paragraph | bullets | metric | table | timeline | callout | quote | chart_placeholder",
          "content": {}
        }
      ],
      "speaker_notes": "string",
      "source_trace": ["string"]
    }
  ]
}
```

## 11. Output HTML Requirements

The generated HTML deck should:

- Be presentable in a browser.
- Support keyboard navigation between slides.
- Support responsive scaling for common laptop and projector sizes.
- Preserve slide aspect ratio.
- Include print styles when feasible.
- Keep CSS scoped to the deck.
- Avoid external runtime dependencies in the first version unless explicitly approved.

## 12. UX Requirements

The first UI should provide:

- Source content input.
- Purpose input.
- Audience input.
- Design direction input.
- Optional advanced settings.
- Generate action.
- Preview area.
- Download HTML action.
- Generation report view.

The UI should feel like a work tool, not a marketing landing page.

## 13. Safety and Review Requirements

The system must surface:

- Assumptions made by the agent.
- Content that was compressed or omitted.
- Claims that may need verification.
- Missing information that would improve the deck.

For company-internal usage, the system should avoid sending sensitive content to external services unless the runtime and provider are explicitly configured by the user or organization.

## 14. Acceptance Criteria

The spec is ready for implementation when the following are agreed:

- Required and optional inputs are accepted.
- Output formats are accepted.
- Agent stages are accepted.
- Slide JSON schema is accepted.
- HTML deck requirements are accepted.
- UI requirements are accepted.
- LLM provider and fallback behavior are decided.
- First milestone scope is decided.

The first coded milestone is accepted when:

- A user can paste content and settings into a local UI.
- The system produces a structured slide deck.
- The system renders the deck as browser-presentable HTML.
- The user can download the generated HTML.
- The generation report shows assumptions and review notes.

## 15. Open Questions

1. Should the first implementation use a real LLM immediately, or start with a deterministic local planner and add LLM integration afterward?
2. Which output should be the primary artifact: single-file HTML, reveal.js-compatible HTML, or both?
3. Should the deck be editable after generation in v1, or only regeneratable from input?
4. Should we support file uploads in v1, or only pasted text?
5. Do we need company brand templates from the beginning?
6. Should generated slides include speaker notes?
7. Should the system support Chinese, English, and mixed-language decks from the beginning?
8. What level of visual sophistication is required for v1: practical internal slides or polished client-facing proposals?
9. Should sensitive content remain fully local unless the user opts into external LLM calls?
10. What is the target first use case: PM planning, internal report, proposal, or executive update?

## 16. Suggested First Milestone

Milestone 1 should prove the core loop:

Input content + audience + purpose + design direction -> structured slide JSON -> self-contained HTML slides -> browser preview -> downloadable HTML.

Recommended constraints:

- Pasted text only.
- Single-file HTML output.
- 16:9 slides.
- Keyboard navigation.
- No account system.
- No persistence.
- No PPTX export.
- LLM integration behind a clear provider boundary.

