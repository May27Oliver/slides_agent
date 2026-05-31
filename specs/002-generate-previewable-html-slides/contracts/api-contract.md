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
    "language": "zh-TW",
    "tone": "direct"
  },
  "options": {
    "useExternalProvider": false,
    "enableUiUxProMax": true
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
        "type": "title",
        "title": "Q3 planning focuses on KPI improvement and delivery risk",
        "message": "Planning summary",
        "layout": "title-summary",
        "contentBlocks": [],
        "sourceTrace": []
      }
    ],
    "reviewReport": {
      "assumptions": [],
      "omittedOrCompressedContent": [],
      "uncertainClaims": [],
      "chartingDecisions": [],
      "humanReviewNotes": [],
      "providerBoundary": {
        "usedExternalProvider": false
      }
    }
  },
  "previewArtifact": {
    "html": "<!doctype html>...",
    "generationSummary": {
      "slideCount": 5,
      "sourceFactCount": 8,
      "chartIntentCount": 2,
      "uncertainClaimCount": 1,
      "usedUiUxProMax": true,
      "usedExternalProvider": false
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

### Response: 422

```json
{
  "error": {
    "code": "UNSAFE_PROVIDER_CONFIGURATION",
    "message": "External provider use was requested but no explicit provider configuration is available",
    "fields": ["options.useExternalProvider"]
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
- `useExternalProvider` 預設為 false。
- `enableUiUxProMax` 預設為 true，用於 design planning/critique。
- Response 必須包含 `slideDeck`、`slideDeck.reviewReport`、self-contained HTML 與 `generationSummary`。
- Generated preview 是 session-only，不得暗示 persistence。
