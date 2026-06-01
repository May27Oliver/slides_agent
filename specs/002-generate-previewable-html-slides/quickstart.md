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
  "language": "zh-TW",
  "tone": "direct"
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
10. Renderer test for self-contained HTML output.
11. Browser test for keyboard next/previous navigation.
12. Browser test for basic responsive behavior.

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
- `DeckCompiler` validates every `sourceSectionId`, `sourceFactId`, and `chartIntentId` before producing `SlideDeck`.
- Invalid proposal references must fail validation or trigger deterministic fallback planning.
- Every slide contains an `outline` array with at least one item.
- Every outline item includes `text`, `emphasis`, and non-empty `sourceTrace`.
- `speakerNotesDraft`, when present, uses only outline/source facts and remains conservative.

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
10. Open the downloaded HTML directly in a browser without backend running.
11. Confirm downloaded HTML still supports slide navigation.

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
   - Slide outlines with source trace for every slide
   - Conservative `speakerNotesDraft` when present
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

1. Review `contracts/slide-generation.schema.json` and confirm each slide requires `outline`.
2. Confirm v1 deck planning does not call LLM and does not use provider/model configuration.
3. Use validated source artifacts from `tests/fixtures/planning-brief.md`.
4. Confirm deterministic `DeckPlanProposal` includes:
   - stable slide order
   - slide role
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
6. Confirm `speakerNotesDraft`, when present:
   - is visibly a draft field
   - does not add unsupported claim
   - can be traced back to outline/source facts
7. Preserve deck proposal, compiler validation result, slide outline trace result, and speaker notes draft review notes in `evidence.md`.

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
- Slide outline source trace validation result.
- Speaker notes draft sample and unsupported-claim review result.
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
