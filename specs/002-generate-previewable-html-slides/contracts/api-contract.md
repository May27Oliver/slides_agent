# API Contract: Generate Previewable HTML Slides

## 範圍

此 contract 描述 feature `002-generate-previewable-html-slides` 中 React frontend 與 NestJS backend 的 local web app boundary。

本 feature 不包含 publishing、persistence、authentication、deck history 或 file upload。

## POST /api/slides/preview

根據 pasted source content 與 deck brief 產生 session-only preview artifact。

### Request

```json
{
  "sourceContent": "Q3 planning notes...",
  "deckBrief": {
    "purpose": "PM planning review",
    "audience": "Product and engineering leads",
    "styleDirection": "High-density PM planning deck",
    "chartEmphasis": "Highlight KPI changes and schedule risks",
    "segmentationGuidance": "Group by goals, decisions, risks, constraints, and next steps",
    "language": "zh-TW",
    "tone": "direct"
  }
}
```

### Response: 200

```json
{
  "slideDeck": {
    "id": "deck_local_001",
    "title": "Q3 Planning Review",
    "purpose": "PM planning review",
    "audience": "Product and engineering leads",
    "designSystem": {
      "themeName": "pm-planning-dense",
      "palette": {},
      "typography": {},
      "spacing": {},
      "visualDensity": "high",
      "layoutGrid": "16:9",
      "slidePatterns": ["title", "metrics", "risk-table"],
      "chartStyle": "minimal"
    },
    "slides": [
      {
        "id": "slide_001",
        "slideKind": "opening",
        "type": "title",
        "title": "Q3 planning focuses on KPI improvement and delivery risk",
        "message": "Planning summary",
        "outline": [
          {
            "text": "Review KPI improvement goals and delivery risks for Q3 planning.",
            "sourceTrace": ["section_001", "fact_001"],
            "emphasis": "main_point"
          }
        ],
        "layout": "title-summary",
        "layoutIntent": {
          "priority": "message_first",
          "density": "medium",
          "emphasis": "narrative"
        },
        "contentBlocks": [],
        "sourceTrace": ["section_001", "fact_001"],
        "speakerNotesDraft": "Use this opening slide to frame the Q3 planning discussion around the source-supported KPI goals and delivery risks."
      }
    ],
    "reviewReport": {
      "assumptions": [],
      "omittedOrCompressedContent": [],
      "uncertainClaims": [],
      "chartingDecisions": [],
      "humanReviewNotes": []
    }
  },
  "previewArtifact": {
    "html": "<!doctype html>...",
    "generationSummary": {
      "slideCount": 5,
      "sourceFactCount": 8,
      "chartIntentCount": 2,
      "uncertainClaimCount": 1
    }
  }
}
```

### Response: 400

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "sourceContent, purpose, and audience are required",
    "fields": ["sourceContent", "deckBrief.purpose", "deckBrief.audience"]
  }
}
```

## GET /api/slides/preview/:sessionId/html

若 implementation 選擇由 backend 持有 session memory，可提供此 optional local preview route 取回最新 HTML artifact。

### Response: 200

Content-Type: `text/html; charset=utf-8`

回傳 self-contained HTML preview artifact。

### Response: 404

```json
{
  "error": {
    "code": "PREVIEW_NOT_FOUND",
    "message": "No preview artifact exists for this local session"
  }
}
```

## Contract Rules

- `sourceContent`、`deckBrief.purpose`、`deckBrief.audience` 必填。
- `chartEmphasis` 是 free text，不能被視為 source truth。
- `segmentationGuidance` 是 free text，只能作為 semantic segmentation 偏好，不能被視為 source truth。
- LLM provider、model 與 design-planning skill usage 由 backend flow 配置，不是使用者 request/response contract。
- Design planning 與 critique 是固定 flow 能力，不提供使用者 opt-in/opt-out 欄位，且不得改寫來源事實。
- Deck planning v1 不呼叫 LLM；`DeckPlanner` 產生 deterministic `DeckPlanProposal`，`DeckCompiler` 驗證 references 後產出 `SlideDeck`。
- Deck order 必須是 opening -> source-order content slides -> conditional closing；不得自動把 metrics、risks 或 decisions 移到來源順序前面。
- Deck planning v1 只使用 `slideKind: "opening" | "content" | "closing"`，不使用 `narrativeType`、complex role 或 appendix。
- 每張 slide 必須包含 `slideKind`、source-grounded `outline`、`layoutIntent` 與必填 `speakerNotesDraft`；`speakerNotesDraft` 必須保守、最多 400 字元且不得新增 unsupported claim。
- HTML rendering v1 不得在 presentation view 呈現 `speakerNotesDraft`。
- ui-ux-pro-max 只能在 valid `SlideDeck` 後做 design planning，並在 HTML rendering 後做 critique；不得改變 deck order、title/message wording、outline meaning、speaker notes factual content 或 review warnings。
- Response 必須包含 `slideDeck`、`slideDeck.reviewReport`、self-contained HTML 與 `generationSummary`。
- Generated preview 是 session-only，不得暗示 persistence。
