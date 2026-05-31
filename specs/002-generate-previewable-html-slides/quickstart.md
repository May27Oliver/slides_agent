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
  "language": "zh-TW",
  "tone": "direct"
}
```

## Automated Verification Targets

Implementation should provide commands for:

1. Contract validation for `/api/slides/preview`.
2. Domain test for source fact extraction.
3. Domain test for layered chart intent decision.
4. Domain test for review report fields.
5. Renderer test for self-contained HTML output.
6. Browser test for keyboard next/previous navigation.
7. Browser test for basic responsive behavior.

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

## Evidence To Preserve

- Test output summary.
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
