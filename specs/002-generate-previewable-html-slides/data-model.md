# Data Model: Generate Previewable HTML Slides

## Bounded Context

`SlideGeneration` 是本 feature 的 bounded context。它負責從 pasted source content 與 deck brief 產生可審查的 `SlideDeck`、`ReviewReport`、`DesignSystem` 與 self-contained `PreviewArtifact`。Publishing、persistence、deck history、file upload、PPTX export 與 full editor 不屬於此 context。

## Ubiquitous Language

- `SourceContent`: 使用者貼上的原始內容。
- `DeckBrief`: 使用者對簡報目的、受眾、風格與圖表重點的描述。
- `SourceFact`: 從來源內容抽出的重要事實。
- `ChartIntent`: 是否將數字視覺化，以及用何種方式視覺化的可審查決策。
- `SlideDeck`: 可 render 的 structured slide artifact。
- `ReviewReport`: generation 的審查與追溯報告。
- `DesignSystem`: deck-level 視覺規則。
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

Represents parsed source structure.

Fields:

- `id: string`
- `heading?: string`
- `body: string`
- `bullets: string[]`
- `order: number`

Validation:

- `order` MUST preserve source order.
- Empty sections SHOULD be ignored.

### DeckBrief

Represents user generation intent.

Fields:

- `purpose: string`
- `audience: string`
- `styleDirection?: string`
- `chartEmphasis?: string`
- `language?: string`
- `tone?: string`

Validation:

- `purpose` and `audience` MUST be non-empty.
- `chartEmphasis` is free text and MUST NOT be interpreted as source truth.

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
- `userEmphasisMatched: boolean`
- `visualizationType: "chart" | "metric_card" | "table" | "timeline" | "fallback_text" | "review_note"`
- `rationale: string`
- `missingContext: string[]`
- `sourceTrace: string[]`

Validation:

- MUST reference at least one `SourceFact` when visualizationType is not `review_note`.
- MUST preserve original numbers, units, periods, denominators, and context.
- MUST use `fallback_text` or `review_note` when data is insufficient.

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
- `uiUxProMaxNotes: string[]`

Validation:

- Must be deck-level, not per-slide arbitrary styles.
- ui-ux-pro-max notes MUST NOT add facts or change source meaning.

### SlideDeck

Represents the structured deck artifact.

Fields:

- `id: string`
- `title: string`
- `subtitle?: string`
- `purpose: string`
- `audience: string`
- `designSystem: DesignSystem`
- `slides: Slide[]`
- `reviewReport: ReviewReport`

Validation:

- MUST contain at least one slide.
- MUST include design system and review report.
- Slide order MUST be stable for the same deterministic input.

### Slide

Represents one slide.

Fields:

- `id: string`
- `type: "title" | "section" | "content" | "comparison" | "timeline" | "table" | "metrics" | "quote" | "action"`
- `title: string`
- `message: string`
- `layout: string`
- `contentBlocks: ContentBlock[]`
- `sourceTrace: string[]`
- `speakerNotes?: string`

Validation:

- `title` SHOULD summarize slide meaning and MUST remain source-grounded.
- `sourceTrace` SHOULD reference source sections or source facts when slide content derives from source.

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
- `providerBoundary: ProviderBoundaryNote`

Validation:

- MUST exist for every generation.
- MUST include charting decisions, including no-chart rationale.
- MUST disclose external provider use or confirm local/deterministic path.

### PreviewArtifact

Represents session-only local preview output.

Fields:

- `html: string`
- `slideDeck: SlideDeck`
- `generationSummary: GenerationSummary`
- `verificationStatus: VerificationStatus`

Validation:

- MUST NOT imply persistence.
- `html` MUST be self-contained and openable without backend.

## Domain Services

### ContentCorePlanner

Responsibilities:

- Parse source content.
- Extract source facts.
- Generate baseline slide architecture.
- Produce semantic titles conservatively.
- Generate review report facts and warnings.

### ChartIntentPlanner

Responsibilities:

- Inspect source numeric descriptions and visualization logic first.
- Merge free-text chart emphasis.
- Decide chart/metric/table/timeline/fallback/review-note.
- Produce no-chart rationale when data is insufficient.

### DesignPlanner

Responsibilities:

- Convert style direction into `DesignSystem`.
- Apply ui-ux-pro-max guidance for presentation and critique.
- Enforce source-fidelity boundary.

### HtmlDeckRenderer

Responsibilities:

- Render `SlideDeck` into self-contained HTML.
- Include scoped CSS and keyboard navigation script.
- Preserve 16:9 layout.

## State Transitions

```text
DraftInput
-> ParsedSourceContent
-> PlannedSlideDeck
-> DesignedSlideDeck
-> RenderedPreviewArtifact
-> DownloadedHtml
```

No persisted deck state exists in this slice.

