# Data Model: Generate Previewable HTML Slides

## Bounded Context

`SlideGeneration` 是本 feature 的 bounded context。它負責從 pasted source content 與 deck brief 產生可審查的 `SlideDeck`、`ReviewReport`、`DesignPlanningResult` 與 self-contained `PreviewArtifact`。Publishing、persistence、deck history、file upload、PPTX export 與 full editor 不屬於此 context。

## Ubiquitous Language

- `SourceContent`: 使用者貼上的原始內容。
- `SemanticSegment`: LLM-assisted segmentation output 中的語意段落候選。
- `SegmentationValidation`: 程式端對 LLM segmentation output 的 schema、quote grounding、順序與 coverage 驗證結果。
- `SegmentationRepairAttempt`: 初次 LLM segmentation schema validation 失敗時的一次性格式修復嘗試。
- `DeckBrief`: 使用者對簡報目的、受眾、風格與圖表重點的描述。
- `SourceFact`: 從來源內容抽出的重要事實。
- `ChartIntent`: 是否將數字視覺化，以及用何種方式視覺化的可審查決策。
- `DeckPlanProposal`: deterministic deck planner 產生的中間規劃 artifact。
- `DeckSlideProposal`: deck plan 中的單頁規劃 artifact。
- `SlideOutlineItem`: 每張 slide 的 source-grounded 大綱項目。
- `LayoutIntent`: deck planner 傳給 design/rendering layer 的輕量視覺意圖。
- `SlideDeck`: 可 render 的 structured slide artifact。
- `ReviewReport`: generation 的審查與追溯報告。
- `DesignSystem`: deck-level 視覺規則。
- `DesignPlanningResult`: valid `SlideDeck` 進入 HTML generation 前的 design handoff artifact。
- `SlidePatternAssignment`: 每張 slide 的 HTML-generation-consumable primary pattern。
- `ChartTreatmentPlan`: 每個 chart intent 的 HTML-generation-consumable visual treatment 或 fallback rationale。
- `VisualHierarchyPlan`: 每張 slide 的 primary/supporting/secondary/de-emphasized 層級規劃。
- `AccessibilityNotes`: 設計與 rendering 的可及性風險與檢查筆記。
- `DesignReviewNotes`: style interpretation、rejected suggestions、HTML generation constraints 與 manual verification notes。
- `DesignConsistencyValidation`: deck-level consistency validation result。
- `HtmlGenerationAttempt`: render 階段的 backend-configured LLM HTML generation attempt。
- `HtmlGenerationValidation`: deterministic validation result for generated HTML。
- `HtmlRepairAttempt`: 初次 LLM HTML validation 失敗時的一次性 HTML repair attempt。
- `PreviewArtifact`: session-only preview artifact。

## Entities and Value Objects

### SourceContent

Represents the raw pasted input.

Fields:

- `rawText: string`
- `languageHint?: string`
- `sections: SourceSection[]`
- `detectedFacts: SourceFact[]`

Validation:

- `rawText` MUST be non-empty after trimming.
- First implementation supports pasted text only.

### SourceSection

Represents validated source structure used by downstream content core.

Fields:

- `id: string`
- `heading?: string`
- `text: string`
- `sourceQuotes: SourceQuote[]`
- `order: number`
- `segmentationSource: "llm" | "deterministic_fallback"`

Validation:

- `order` MUST preserve source order.
- `sourceQuotes` MUST exact-match source content.
- Empty sections SHOULD be ignored.

### SemanticSegment

Represents one section candidate returned by LLM-assisted semantic segmentation.

Fields:

- `id: string`
- `heading: string`
- `sourceQuotes: SourceQuote[]`
- `summary: string`
- `order: number`
- `rationale: string`
- `confidence: "high" | "medium" | "low"`
- `warnings: string[]`

Validation:

- `heading` MAY summarize meaning but MUST NOT add unsupported facts.
- `summary` is for planning/evidence only and MUST NOT replace source quotes.
- `sourceQuotes` MUST contain exact copied snippets from `SourceContent.rawText`.
- `order` MUST match the first matched quote position in the source.
- Low confidence or warnings SHOULD produce review/evidence notes.

### SourceQuote

Represents exact source text selected by segmentation.

Fields:

- `text: string`
- `role: "heading" | "body" | "bullet" | "table" | "quote"`

Validation:

- `text` MUST be an exact substring of `SourceContent.rawText` after newline normalization.
- Character offsets SHOULD be computed by application code after exact-match validation; LLM SHOULD NOT be trusted as the source of offsets.

### SegmentationValidation

Represents deterministic validation result for LLM segmentation output.

Fields:

- `schemaValid: boolean`
- `quoteGroundingValid: boolean`
- `sourceOrderValid: boolean`
- `importantContentCoverageValid: boolean`
- `repairAttempted: boolean`
- `repairSucceeded: boolean`
- `fallbackUsed: boolean`
- `issues: string[]`

Validation:

- Failed initial schema validation MUST trigger at most one `SegmentationRepairAttempt` before deterministic fallback.
- Failed repaired schema, quote grounding, or source order validation MUST trigger deterministic fallback segmentation.
- Coverage issues SHOULD trigger review/evidence notes and MAY trigger fallback when important content would be omitted.

### SegmentationRepairAttempt

Represents a bounded LLM format repair request after initial segmentation schema validation fails.

Fields:

- `attemptNumber: 1`
- `inputValidationErrors: string[]`
- `repairedSchemaValid: boolean`
- `repairNotes: string[]`

Validation:

- Only one repair attempt is allowed per generation.
- Repair MUST be constrained to JSON/schema correction.
- Repair MUST NOT reinterpret source content, rewrite exact source quotes, add unsupported facts, remove important content, or change segment meaning.
- Raw validation errors are internal evidence; user-facing review notes should explain repair/fallback in plain language.

### DeckBrief

Represents user generation intent.

Fields:

- `purpose: string`
- `audience: string`
- `styleDirection?: string`
- `chartEmphasis?: string`
- `segmentationGuidance?: string`
- `language?: string`

Validation:

- `purpose` and `audience` MUST be non-empty.
- `chartEmphasis` is free text and MUST NOT be interpreted as source truth.
- `segmentationGuidance` is free text and MUST be treated only as segmentation preference, not source truth.
- Conflicting or fact-changing segmentation guidance MUST be ignored and surfaced in warnings/evidence.
- `language` MAY guide generated artifact language. Tone-specific control is intentionally out of scope until a consumer proves the need.

### SourceFact

Represents a preserved source fact.

Fields:

- `id: string`
- `kind: "number" | "date" | "decision" | "risk" | "constraint" | "owner" | "deadline" | "entity" | "tradeoff"`
- `text: string`
- `value?: string`
- `unit?: string`
- `period?: string`
- `sourceSectionId: string`
- `confidence: "deterministic" | "inferred" | "uncertain"`

Validation:

- Numeric facts MUST preserve original value text.
- Inferred facts MUST be surfaced in review notes if materially used.

### ChartIntent

Represents a visualization decision.

Fields:

- `id: string`
- `sourceFactIds: string[]`
- `visualizationType: "chart" | "metric_card" | "table" | "timeline" | "fallback_text" | "review_note"`
- `rationale: string`
- `missingContext: string[]`
- `sourceTrace: string[]`

Validation:

- MUST reference at least one `SourceFact` when visualizationType is not `review_note`.
- MUST preserve original numbers, units, periods, denominators, and context.
- MUST use `fallback_text` or `review_note` when data is insufficient.

### DeckPlanProposal

Represents deterministic deck planning output before final `SlideDeck` compilation.

Fields:

- `title: string`
- `subtitle?: string`
- `slides: DeckSlideProposal[]`
- `planningNotes: string[]`

Validation:

- v1 MUST be produced by deterministic rules and MUST NOT call LLM.
- MUST reference existing `SourceSection`, `SourceFact`, and `ChartIntent` identifiers.
- MUST NOT copy, rewrite, or invent source facts outside referenced artifacts.
- MUST be stable for the same validated source artifacts and `DeckBrief`.
- MUST target 3-8 slides, allow fewer only when source content is too short, and enforce 8 slides as hard cap.
- MUST start with an opening slide, preserve source order for content slides, and add a closing slide only when source content contains next steps, actions, owners, or deadlines.
- MUST NOT use `narrativeType`, complex role classification, appendix slides, or automatic reordering of metrics/risks/decisions unless the user explicitly requests it.
- Future LLM assistance MAY propose this shape, but `DeckCompiler` MUST still validate and compile final `SlideDeck`.

### DeckSlideProposal

Represents one planned slide before compilation.

Fields:

- `id: string`
- `slideKind: "opening" | "content" | "closing"`
- `title: string`
- `message: string`
- `sourceSectionIds: string[]`
- `sourceFactIds: string[]`
- `chartIntentIds: string[]`
- `outline: SlideOutlineItem[]`
- `layoutIntent: LayoutIntent`
- `speakerNotesDraft: string`
- `reviewNotes: string[]`

Validation:

- `sourceSectionIds`, `sourceFactIds`, and `chartIntentIds` MUST reference existing validated artifacts.
- `slideKind` MUST be opening, content, or closing only.
- Content slides MUST contain at least one `sourceSectionId`.
- Empty `chartIntentIds` is valid.
- `outline` SHOULD contain 2-4 source-grounded items and MUST contain at least one item.
- `speakerNotesDraft` MUST be conservative, 2-4 sentences when possible, at most 400 characters, and derived from outline/source trace.
- Invalid references MUST fail proposal validation or trigger deterministic fallback planning.

### SlideOutlineItem

Represents one source-grounded point for a slide.

Fields:

- `text: string`
- `sourceTrace: string[]`
- `emphasis: "main_point" | "evidence" | "risk" | "decision" | "action" | "context"`

Validation:

- `text` MUST be grounded in referenced source sections or source facts.
- `sourceTrace` MUST contain at least one source section or source fact identifier.
- Items that mention numbers, decisions, risks, constraints, owners, or deadlines SHOULD trace to `SourceFact` when available.
- Chart-related outline items MAY trace to `ChartIntent`.
- Outline text MAY compress source wording but MUST NOT add unsupported claims.

### LayoutIntent

Represents deck-level planning intent passed to design/rendering.

Fields:

- `priority: "message_first" | "metrics_first" | "comparison" | "timeline" | "risk_matrix" | "table_dense"`
- `density: "low" | "medium" | "high"`
- `emphasis: "narrative" | "numbers" | "risks" | "decisions" | "actions"`

Validation:

- `LayoutIntent` is not final visual styling.
- Design layer MAY use it for visual hierarchy and pattern selection, but MUST NOT alter source facts or outline meaning.
- `LayoutIntent` MUST remain lightweight and must not encode final CSS or arbitrary per-slide styling.

### DesignSystem

Represents deck-level visual rules.

Fields:

- `themeName: string`
- `palette: Palette`
- `typography: Typography`
- `spacing: SpacingScale`
- `visualDensity: "low" | "medium" | "high"`
- `layoutGrid: string`
- `slidePatterns: string[]`
- `chartStyle: string`

Validation:

- Must be deck-level, not per-slide arbitrary styles.
- Notes from ui-ux-pro-max MUST live in `DesignReviewNotes`, not inside HTML generation tokens.

### DesignPlanningResult

Represents design handoff after `DeckCompiler` and before HTML generation.

Fields:

- `designSystem: DesignSystem`
- `slidePatternAssignments: SlidePatternAssignment[]`
- `chartTreatmentPlans: ChartTreatmentPlan[]`
- `visualHierarchyPlans: VisualHierarchyPlan[]`
- `accessibilityNotes: AccessibilityNotes`
- `designReviewNotes: DesignReviewNotes`
- `consistencyValidation: DesignConsistencyValidation`

Validation:

- MUST be produced from a valid `SlideDeck`, `DeckBrief`, `ChartIntent[]`, style direction, and slide `layoutIntent`.
- MAY use ui-ux-pro-max as design planning guidance.
- MUST NOT change slide order, title/message wording, outline meaning, source facts, speaker notes factual content, or review warnings.
- MUST NOT depend on `speakerNotesDraft` because HTML v1 does not render speaker notes.
- Every referenced slide and chart intent MUST exist.
- HTML generation prompt and validator MUST consume `designSystem`, slide pattern assignments, chart treatment plans, and visual hierarchy plans instead of reinterpreting style direction.

### SlidePatternAssignment

Represents the selected primary renderer pattern for one slide.

Fields:

- `slideId: string`
- `primaryPattern: string`
- `density: "low" | "medium" | "high"`
- `layoutIntent: LayoutIntent`
- `rationale: string`

Validation:

- `slideId` MUST reference a slide in the valid `SlideDeck`.
- Each slide MUST have exactly one primary pattern assignment.
- Pattern selection MUST be supported by `slideKind`, `outline`, `layoutIntent`, `ChartIntent`, or `DesignSystem`.
- Pattern selection MUST NOT introduce content semantics or arbitrary per-slide styling.

### ChartTreatmentPlan

Represents visual treatment for a chart intent.

Fields:

- `chartIntentId: string`
- `treatment: "chart" | "metric_card" | "table" | "timeline" | "fallback_text" | "review_note"`
- `labelingNotes: string[]`
- `preservedContext: string[]`
- `fallbackRationale?: string`

Validation:

- `chartIntentId` MUST reference an existing `ChartIntent`.
- Treatment MUST preserve original values, units, periods, denominators, and context.
- Unsupported chart treatments MUST use fallback text or review note.

### VisualHierarchyPlan

Represents per-slide hierarchy before rendering.

Fields:

- `slideId: string`
- `primaryMessage: string`
- `supportingEvidence: string[]`
- `secondaryDetails: string[]`
- `deEmphasizedContent: string[]`

Validation:

- `slideId` MUST reference a slide in the valid `SlideDeck`.
- `primaryMessage` MUST derive from slide title/message/outline without changing meaning.
- De-emphasized content remains reviewable and MUST NOT be silently dropped.

### AccessibilityNotes

Represents accessibility risks and verification notes for design/rendering.

Fields:

- `colorContrast: string[]`
- `textSize: string[]`
- `readingOrder: string[]`
- `chartLabeling: string[]`
- `keyboardNavigation: string[]`
- `responsiveRisks: string[]`

Validation:

- Notes SHOULD identify automated checks when possible.
- Notes MUST include manual verification needs for visual risks that cannot be fully automated.

### DesignReviewNotes

Represents review notes for design decisions.

Fields:

- `styleInterpretation: string[]`
- `rejectedSuggestions: string[]`
- `htmlGenerationConstraints: string[]`
- `consistencyConcerns: string[]`
- `manualVerificationNeeds: string[]`

Validation:

- Rejected suggestions MUST explain whether the reason is source fidelity, HTML generation support, accessibility, or deck consistency.
- Notes MUST NOT expose backend provider/model selection as user-facing configuration.

### DesignConsistencyValidation

Represents deck-level design consistency validation.

Fields:

- `status: "pass" | "needs_manual_review" | "fallback_used"`
- `checkedDimensions: string[]`
- `issues: string[]`
- `fallbackApplied: boolean`

Validation:

- MUST check palette, typography, spacing, component style, chart style, visual density, and pattern usage.
- Inconsistent or unsupported output MUST trigger conservative fallback or manual verification notes.

### SlideDeck

Represents the structured deck artifact.

Fields:

- `id: string`
- `title: string`
- `subtitle?: string`
- `purpose: string`
- `audience: string`
- `slides: Slide[]`
- `reviewReport: ReviewReport`

Validation:

- MUST contain at least one slide.
- MUST include review report.
- MUST NOT include design system; design system belongs to `DesignPlanningResult`.
- Slide order MUST be stable for the same deterministic input.
- MUST be produced by `DeckCompiler`, not directly by LLM.

### Slide

Represents one slide.

Fields:

- `id: string`
- `slideKind: "opening" | "content" | "closing"`
- `type: "title" | "section" | "content" | "comparison" | "timeline" | "table" | "metrics" | "quote" | "action"`
- `title: string`
- `message: string`
- `outline: SlideOutlineItem[]`
- `layout: string`
- `layoutIntent: LayoutIntent`
- `contentBlocks: ContentBlock[]`
- `sourceTrace: string[]`
- `speakerNotesDraft: string`

Validation:

- `slideKind` MUST identify deck structural position only; it is not a complex narrative role.
- `title` SHOULD summarize slide meaning and MUST remain source-grounded.
- `outline` MUST include at least one item and each item MUST include source trace.
- `sourceTrace` SHOULD reference source sections or source facts when slide content derives from source.
- `speakerNotesDraft` MUST be conservative, at most 400 characters, and MUST NOT add unsupported claims.
- HTML generation v1 MUST NOT render `speakerNotesDraft` in the presentation view.

### HtmlGenerationAttempt

Represents one render-stage backend-configured LLM attempt to produce self-contained HTML.

Fields:

- `attemptNumber: 1 | 2`
- `inputSlideDeckId: string`
- `inputDesignPlanningResultHash: string`
- `promptBoundaryNotes: string[]`
- `html: string`
- `validation: HtmlGenerationValidation`
- `repairAttempt?: HtmlRepairAttempt`
- `fallbackUsed: boolean`

Validation:

- MUST be created only after valid `SlideDeck` and `DesignPlanningResult` exist.
- MUST NOT expose provider/model selection as user-facing request/response configuration.
- Prompt input MUST include HTML generation constraints and MUST instruct the LLM to preserve slide count/order/title/message/outline meaning, source-supported content, chart numbers/units/context, and review boundaries.
- Prompt input MUST instruct the LLM to avoid external CSS, JavaScript, images, fonts, CDNs, or backend dependencies.

### HtmlGenerationValidation

Represents deterministic validation for LLM-generated or fallback HTML.

Fields:

- `status: "pass" | "repair_required" | "fallback_used" | "failed"`
- `selfContained: boolean`
- `slideCountAndOrderPreserved: boolean`
- `contentFidelityPreserved: boolean`
- `designCompliancePreserved: boolean`
- `speakerNotesHidden: boolean`
- `keyboardNavigationPresent: boolean`
- `externalResourceIssues: string[]`
- `contentIssues: string[]`
- `designIssues: string[]`
- `repairAttempted: boolean`
- `fallbackUsed: boolean`

Validation:

- MUST reject HTML with external CSS, JavaScript, image, font, CDN, or backend dependencies.
- MUST reject HTML that changes slide order, omits slides, changes title/message wording, changes outline meaning, renders `speakerNotesDraft`, or adds unsupported facts.
- MUST check that slide patterns, chart treatments, visual hierarchy, and design system tokens map back to `DesignPlanningResult` or conservative fallback choices.
- SHOULD identify manual verification needs for responsive/layout overlap risks that cannot be fully automated.

### HtmlRepairAttempt

Represents one bounded LLM repair attempt after initial HTML validation fails.

Fields:

- `attemptNumber: 1`
- `inputValidationIssues: string[]`
- `repairInstructions: string[]`
- `repairedValidation: HtmlGenerationValidation`

Validation:

- Only one HTML repair attempt is allowed per generation.
- Repair MUST be constrained to HTML structure, self-contained resource boundary, navigation, and design compliance.
- Repair MUST NOT reinterpret source content, rewrite slide title/message/outline semantics, change chart numbers/units/context, or add unsupported facts.

### ContentBlock

Represents a typed content block in a slide.

Fields:

- `kind: "paragraph" | "bullets" | "metric" | "table" | "timeline" | "callout" | "quote" | "chart_placeholder" | "fallback_text"`
- `content: object`
- `chartIntentId?: string`

Validation:

- Blocks showing numbers MUST preserve original units and context.
- `chartIntentId` MUST reference a valid `ChartIntent` when present.

### ReviewReport

Represents auditable generation output.

Fields:

- `assumptions: string[]`
- `omittedOrCompressedContent: string[]`
- `uncertainClaims: string[]`
- `chartingDecisions: ChartingDecisionNote[]`
- `humanReviewNotes: string[]`

Validation:

- MUST exist for every generation.
- MUST include charting decisions, including no-chart rationale.
- MUST NOT expose backend provider/model selection as a user-facing review-report field.

### PreviewArtifact

Represents session-only local preview output.

Fields:

- `html: string`
- `slideDeck: SlideDeck`
- `generationSummary: GenerationSummary`
- `htmlGenerationValidation: HtmlGenerationValidation`
- `verificationStatus: VerificationStatus`

Validation:

- MUST NOT imply persistence.
- `html` MUST be self-contained and openable without backend.
- `htmlGenerationValidation` MUST pass, use conservative fallback, or record a reviewable failure before download is offered.

## Domain Services

### ContentCorePlanner

Responsibilities:

- Request or receive semantic segmentation result from the API/application layer.
- Validate semantic segmentation schema, exact source quote grounding, source order, and important-content coverage.
- Fallback to deterministic source parsing when segmentation validation fails.
- Extract source facts.
- Generate baseline slide architecture.
- Produce semantic titles conservatively.
- Generate review report facts and warnings.

### DeckPlanner

Responsibilities:

- Produce deterministic `DeckPlanProposal` from validated `SourceSection`, `SourceFact`, `ChartIntent`, and `DeckBrief`.
- Decide source-order slide grouping, `slideKind`, title/message candidate, outline, layout intent, and speaker notes draft.
- Merge short source sections and conservatively split long source sections while respecting the 3-8 target and 8-slide hard cap.
- Always produce an opening slide and produce a closing slide only when source content supports next steps, actions, owners, or deadlines.
- Avoid narrative type, complex role classification, appendix slides, and automatic reordering.
- Keep v1 free of LLM calls.
- Preserve stable output for the same inputs.

### DeckCompiler

Responsibilities:

- Validate all `DeckPlanProposal` references against source sections, source facts, and chart intents.
- Compile valid proposal into final `SlideDeck`.
- Return validation failure for invalid proposals so the application flow can use deterministic fallback planning.
- Deduplicate and stable-sort compiled source trace.
- Ensure every slide has source-grounded outline and source trace.
- Do not fill missing fields or rewrite proposal wording.

### ChartIntentPlanner

Responsibilities:

- Inspect source numeric descriptions and visualization logic first.
- Merge free-text chart emphasis.
- Decide chart/metric/table/timeline/fallback/review-note.
- Produce no-chart rationale when data is insufficient.

### DesignPlanner

Responsibilities:

- Consume valid `SlideDeck`, `DeckBrief`, `ChartIntent[]`, style direction, and slide `layoutIntent`.
- Convert style direction into HTML-generation-consumable `DesignSystem`.
- Produce per-slide `SlidePatternAssignment`, `ChartTreatmentPlan`, `VisualHierarchyPlan`, `AccessibilityNotes`, `DesignReviewNotes`, and `DesignConsistencyValidation`.
- Apply ui-ux-pro-max guidance after `DeckCompiler` for design planning and after HTML generation/validation for critique.
- Enforce source-fidelity boundary.
- Avoid title/message wording changes in v1.

### HtmlGenerator

Responsibilities:

- Build the backend-configured LLM prompt from valid `SlideDeck`, `DesignPlanningResult`, and HTML generation constraints.
- Request self-contained HTML from the HTML generation adapter.
- Preserve the sensitive-content/provider boundary by keeping provider/model backend-owned.
- Never call the LLM before `SlideDeck` and `DesignPlanningResult` are valid.

### HtmlGenerationValidator

Responsibilities:

- Validate LLM-generated HTML for self-contained resources, content fidelity, design compliance, speaker notes non-rendering, keyboard navigation, and basic responsive readiness.
- Produce `HtmlGenerationValidation` with actionable issues.
- Trigger at most one bounded HTML repair attempt when validation fails.

### FallbackHtmlRenderer

Responsibilities:

- Render conservative self-contained HTML from `SlideDeck` and `DesignPlanningResult` when LLM HTML generation or repair fails.
- Include scoped CSS and keyboard navigation script.
- Preserve 16:9 layout.
- Do not render `speakerNotesDraft` in the presentation view.

## State Transitions

```text
DraftInput
-> ParsedSourceContent
-> ProposedDeckPlan
-> PlannedSlideDeck
-> DesignedSlideDeck
-> GeneratedHtmlCandidate
-> ValidatedHtmlArtifact
-> RenderedPreviewArtifact
-> DownloadedHtml
```

No persisted deck state exists in this slice.
