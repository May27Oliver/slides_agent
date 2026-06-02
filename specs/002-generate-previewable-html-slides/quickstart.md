# Quickstart: Generate Previewable HTML Slides

## Purpose

驗證 002 feature 的第一個 implementation slice：local web app 使用 pasted source content 產生 slide JSON、review report、self-contained HTML slides，並在 session-only preview 中展示與下載。

## Prerequisites

- Node.js 20.x
- pnpm 10.x
- Browser for local preview

## Sample Input

Use this fixture content for first verification:

```text
Q3 Product Planning

目標：
- Onboarding conversion 從 18% 提升到 25%
- 客服首次回覆時間從 12 小時降到 4 小時
- Dashboard MVP 需在 2026-08-15 前完成

決策：
- 本階段只做 dashboard MVP，不做 full CRM integration
- 先支援 admin 使用者，不支援 customer self-service

風險：
- 資料同步 API 尚未完成，可能影響 dashboard freshness
- Design resource 只有 0.5 FTE

限制：
- 不新增付費第三方 BI 工具
- 不處理 historical import
```

Deck brief:

```json
{
  "purpose": "PM planning review",
  "audience": "Product and engineering leads",
  "styleDirection": "高密度 PM planning deck，強調風險、里程碑與 KPI",
  "chartEmphasis": "把 conversion、回覆時間、deadline 和 resource risk 做成容易比較的視覺重點",
  "segmentationGuidance": "請優先依照目標、決策、風險、限制、下一步切段",
  "language": "zh-TW"
}
```

Provider, model, and design-skill toggles are backend-configured in this feature slice.
Do not include those settings in the request.

## Automated Verification Targets

Implementation should provide commands for:

1. Contract validation for `/api/slides/preview`.
2. Semantic segmentation schema validation.
3. Semantic segmentation source quote grounding and fallback validation.
4. Domain test for source fact extraction.
5. Domain test for layered chart intent decision.
6. Domain test for deterministic deck plan proposal.
7. Domain test for deck compiler reference validation.
8. Domain test for slide outline source trace and conservative speaker notes draft.
9. Domain test for review report fields.
10. LLM HTML generation prompt contract test.
11. Deterministic HTML validation test for self-contained resources, content fidelity, design compliance, and speaker notes non-rendering.
12. Fallback renderer test for invalid LLM HTML after one repair attempt.
13. Browser test for keyboard next/previous navigation.
14. Browser test for basic responsive behavior.

Expected semantic segmentation behavior:

- LLM output must match `contracts/semantic-segmentation.schema.json`.
- Each `sourceQuotes[].text` must exactly match the pasted source content after newline normalization.
- Segment order must follow source order.
- Invalid initial schema must trigger at most one format repair attempt before fallback.
- Format repair must only correct JSON/schema structure and must not reinterpret, summarize, expand, delete, or alter source meaning.
- Repaired output that still has invalid schema, missing quote grounding, impossible ordering, or important coverage gaps must trigger deterministic fallback.
- `segmentationGuidance` may influence grouping but must not be treated as source truth.
- Conflicting or fact-changing guidance must be ignored and recorded in `globalWarnings`, review notes, or evidence.
- Format repair, fallback use, or low-confidence segmentation should be preserved in evidence or human review notes.

Expected source facts include:

- `18%`
- `25%`
- `12 小時`
- `4 小時`
- `2026-08-15`
- `dashboard MVP`
- `full CRM integration`
- `0.5 FTE`

Expected chart decisions:

- Conversion before/after can become metric card or comparison visual.
- Response time before/after can become metric card or comparison visual.
- Deadline can become timeline or milestone visual.
- Resource risk can become callout/table; no invented capacity numbers.

Expected deck planning behavior:

- Deck planning v1 must not call LLM.
- `DeckPlanner` produces deterministic `DeckPlanProposal` from validated sections, facts, chart intents, and deck brief.
- Target deck size is 3-8 slides; content that is too short may produce fewer, and 8 slides is the hard cap.
- Deck must start with an opening slide, preserve source order for content slides, and add a closing slide only when source content contains next steps, actions, owners, or deadlines.
- v1 must not use `narrativeType`, complex slide role, appendix slide, or automatic metrics/risk/decision reordering unless the user explicitly asks.
- `DeckCompiler` validates every `sourceSectionId`, `sourceFactId`, and `chartIntentId` before producing `SlideDeck`.
- Invalid proposal references must fail validation or trigger deterministic fallback planning.
- Every slide contains `slideKind: "opening" | "content" | "closing"`.
- Every slide contains an `outline` array with 2-4 items when source supports it, and at least one item.
- Every outline item includes `text`, `emphasis`, and non-empty `sourceTrace`.
- Every slide contains `speakerNotesDraft`; it uses only outline/source facts, remains conservative, and is at most 400 characters.
- HTML generation v1 must not render `speakerNotesDraft` in the presentation view.

Expected LLM-assisted HTML generation behavior:

- HTML generation runs after valid `SlideDeck` and valid `DesignPlanningResult`.
- The HTML generation prompt includes `SlideDeck`, `DesignPlanningResult`, HTML generation constraints, and source-fidelity instructions.
- The prompt must tell the LLM to preserve slide count, slide order, title/message wording, outline meaning, chart numbers/units/context, and review boundaries.
- The generated HTML must be self-contained: no external CSS, JavaScript, image, font, CDN, or backend dependency.
- The generated HTML must not render `speakerNotesDraft` in presentation view.
- Deterministic HTML validation must check self-contained resources, slide count/order, content fidelity, design compliance, speaker notes non-rendering, keyboard navigation, and basic responsive readiness.
- If initial LLM HTML fails validation, the system may attempt one HTML repair only.
- HTML repair may correct HTML structure, resource boundaries, navigation, and design compliance, but must not rewrite slide semantics or add unsupported facts.
- If repaired HTML still fails validation, the system must use a conservative fallback HTML renderer or return a reviewable failure with validation issues.

Expected design handoff behavior:

- ui-ux-pro-max runs after `DeckCompiler` produces a valid `SlideDeck`, not inside `DeckPlanner`.
- Design planning may influence `DesignSystem`, slide pattern mapping, chart treatment, density, visual hierarchy, accessibility notes, and critique notes.
- Design planning must not change deck order, title/message wording, outline meaning, source facts, speaker notes factual content, or review warnings.

## Manual Verification Path

After implementation:

1. Open the local web app.
2. Paste the sample input.
3. Fill the deck brief fields.
4. Generate preview.
5. Confirm the page shows:
   - Slides preview
   - Review report
   - Slide JSON
   - Generation summary
   - Download HTML action
6. Navigate slides with keyboard next/previous.
7. Resize browser to:
   - Laptop-like viewport: 1440x900
   - Projector-like 16:9 viewport: 1920x1080
8. Confirm primary text and controls do not overlap.
9. Download the HTML artifact.
10. Save the downloaded file path and checksum in `evidence.md`.
11. Stop the API and web dev servers.
12. Open the downloaded HTML directly from the local filesystem in a browser.
13. Confirm the downloaded HTML opens without any backend request, CDN request, external font request, external image request, or console error related to missing runtime assets.
14. Confirm downloaded HTML still supports slide navigation with:
   - ArrowRight / PageDown for next slide
   - ArrowLeft / PageUp for previous slide
15. Confirm presentation view does not show `speakerNotesDraft`.
16. Resize the downloaded HTML browser tab to 1440x900 and 1920x1080 and confirm no primary text, controls, chart labels, or slide numbers overlap.
17. Preserve a screenshot of the downloaded HTML opened from the filesystem in `evidence.md`.
18. Inspect `htmlGenerationValidation` and confirm:
   - `selfContained` is true
   - `slideCountAndOrderPreserved` is true
   - `contentFidelityPreserved` is true
   - `designCompliancePreserved` is true
   - `speakerNotesHidden` is true
   - repair/fallback status is understandable when used

## US1 Manual Demo Path

After T028-T036 implementation:

1. Run the US1 domain and contract tests:
   - `pnpm --filter @slides-agent/contracts test`
   - `pnpm --filter @slides-agent/domain test`
2. Use `tests/fixtures/planning-brief.md` as the pasted source content.
3. Use the deck brief JSON from this quickstart.
4. Generate the deterministic slide deck through the US1 use case or local API boundary once it is wired.
5. Inspect the generated slide JSON and confirm it includes:
   - Deck metadata with purpose and audience
   - Semantic slide titles grounded in source content
   - Deterministic deck plan proposal evidence
   - Opening slide followed by source-order content slides
   - Conditional closing slide only if source content supports next steps/actions/owners/deadlines
   - `slideKind` on every slide
   - Slide outlines with source trace for every slide
   - Conservative required `speakerNotesDraft` for every slide
   - Source facts for `18%`, `25%`, `12 小時`, `4 小時`, `2026-08-15`, `dashboard MVP`, `full CRM integration`, and `0.5 FTE`
   - Chart intents for conversion, response time, deadline, and resource risk where supported by source data
6. Inspect the review report and confirm it includes:
   - `assumptions`
   - `omittedOrCompressedContent`
   - `uncertainClaims`
   - `chartingDecisions`
   - `humanReviewNotes`
7. Confirm the US1 demo does not require HTML preview, publishing, persistence, file upload, PPTX export, or a revision loop.

## Deterministic Deck Planning Review Path

Before implementing deck planner/compiler revision:

1. Review `contracts/slide-generation.schema.json` and confirm each slide requires `slideKind`, `outline`, `layoutIntent`, and `speakerNotesDraft`.
2. Confirm v1 deck planning does not call LLM and does not use provider/model configuration.
3. Use validated source artifacts from `tests/fixtures/planning-brief.md`.
4. Confirm deterministic `DeckPlanProposal` includes:
   - stable slide order
   - opening slide first
   - source-order content slides
   - conditional closing slide only when supported by source
   - `slideKind`, not narrative type or complex role
   - title and message candidate
   - source section references
   - source fact references
   - chart intent references where applicable
   - layout intent
   - outline candidate
5. Confirm `DeckCompiler` rejects or fallback-handles:
   - unknown source section id
   - unknown source fact id
   - unknown chart intent id
   - empty slide outline
6. Confirm `speakerNotesDraft`:
   - is visibly a draft field
   - does not add unsupported claim
   - can be traced back to outline/source facts
   - is at most 400 characters
7. Confirm generated HTML does not render `speakerNotesDraft` in presentation view.
8. Preserve deck proposal, compiler validation result, slide outline trace result, speaker notes draft review notes, and HTML non-rendering check in `evidence.md`.

## ui-ux-pro-max Design Handoff Review Path

Before implementing design planning/critique:

1. Confirm DeckPlanner and DeckCompiler do not import or invoke ui-ux-pro-max adapters.
2. Confirm design planning input is a valid `SlideDeck`, `DeckBrief`, `ChartIntent[]`, style direction, and slide `layoutIntent`.
3. Confirm design output is limited to:
   - `DesignSystem`
   - `SlidePatternAssignment`
   - `ChartTreatmentPlan`
   - `VisualHierarchyPlan`
   - `AccessibilityNotes`
   - `DesignReviewNotes`
   - `DesignConsistencyValidation`
4. Confirm design planning cannot modify:
   - deck order
   - title/message wording
   - outline meaning
   - source facts
   - speaker notes factual content
   - review warnings
5. Confirm HTML generation prompt and validator consume `designPlanningResult` instead of reinterpreting `styleDirection`.
6. Preserve design handoff sample and critique result in `evidence.md`.

## LLM HTML Generation Review Path

Before implementing render-stage LLM generation:

1. Confirm HTML generation does not run until valid `SlideDeck` and valid `DesignPlanningResult` exist.
2. Review the HTML generation prompt and confirm it instructs the LLM to:
   - generate one self-contained HTML document
   - avoid external CSS, JavaScript, images, fonts, CDNs, and backend dependencies
   - preserve slide count and slide order
   - preserve title/message wording and outline meaning
   - preserve chart numbers, units, periods, denominators, and context
   - not render `speakerNotesDraft`
   - follow `DesignPlanningResult` for design system, pattern assignments, chart treatment, and visual hierarchy
3. Run validation fixtures for:
   - valid LLM HTML
   - HTML with external resource URLs
   - HTML that omits or reorders slides
   - HTML that changes title/message/outline wording
   - HTML that renders `speakerNotesDraft`
   - HTML that ignores chart treatment or visual hierarchy
4. Confirm invalid initial HTML triggers at most one repair attempt.
5. Confirm repair prompt only addresses HTML/contract/design compliance and does not reinterpret source content.
6. Confirm repair failure triggers conservative fallback HTML or a reviewable generation failure.
7. Preserve prompt boundary, validation result, repair attempt result, fallback decision, downloaded HTML path/checksum, and screenshots in `evidence.md`.

## Semantic Segmentation Prompt Review Path

Before implementing LLM segmentation:

1. Review `contracts/semantic-segmentation.schema.json`.
2. Confirm the prompt instructs the LLM to:
   - segment by meaning, not only formatting
   - use `segmentationGuidance` only as grouping preference
   - preserve exact source quotes
   - avoid rewriting source text
   - ignore guidance that conflicts with source content or asks to alter facts
   - avoid adding facts not present in source content
   - output JSON only, matching the schema
   - attempt format repair only when given invalid prior JSON plus validation errors
   - repair JSON/schema shape only, without reinterpreting or changing source meaning
3. Run the prompt against:
   - the planning brief fixture
   - a markdown-heading fixture
   - an inline-heading fixture
   - an unstructured paragraph fixture
4. Preserve output samples, schema validation result, repair attempt result when applicable, quote grounding result, fallback result when applicable, and review notes in `evidence.md`.

## US1R Manual Demo Path

After T078-T082 red tests are created and before T083 implementation:

1. Run the focused red tests:
   - `pnpm --filter @slides-agent/contracts test -- semantic-segmentation.contract.test.ts`
   - `pnpm --filter @slides-agent/domain test -- semantic-segmentation`
   - `pnpm --filter @slides-agent/api test -- semantic-segmentation`
2. Confirm the tests fail because semantic segmentation contract helpers, validator, fallback wiring, and API prompt adapter are not implemented yet.
3. Review the failing assertions and confirm they cover:
   - schema-bound LLM JSON output
   - exact source quote grounding
   - deterministic fallback on invalid segmentation
   - one bounded format repair attempt before deterministic fallback
   - prompt instructions for exact quotes and JSON-only output
   - `segmentationGuidance` as preference-only
   - warning/evidence path for ignored or conflicting guidance
4. Preserve the red test output summary in `evidence.md` when T083-T091 implementation begins.

## Evidence To Preserve

- Test output summary.
- Semantic segmentation output sample and validation result.
- Format repair input errors, repaired output validation result, and repair/fallback decision when applicable.
- Source quote grounding validation result.
- Deterministic deck plan proposal sample and compiler validation result.
- Slide count and source-order check.
- Slide outline source trace validation result.
- Speaker notes draft sample and unsupported-claim review result.
- HTML speaker notes non-rendering check.
- LLM HTML generation prompt boundary and validation result.
- HTML repair attempt and fallback decision when applicable.
- ui-ux-pro-max design handoff and critique boundary check.
- Generated slide JSON for sample input.
- Generated review report for sample input.
- Downloaded self-contained HTML artifact or a documented checksum/path.
- Screenshot of local preview.
- Screenshot of downloaded HTML opened without backend.
- Notes for any manual verification item that cannot be automated.

## Expected Non-Goals

- Do not publish to URL.
- Do not persist deck history.
- Do not store artifacts automatically.
- Do not support file upload.
- Do not export PPTX.
- Do not implement full slide editor or revision loop.
