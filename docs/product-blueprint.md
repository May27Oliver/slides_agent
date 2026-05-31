# HTML Slides Agent Product Blueprint

Status: Draft
Last updated: 2026-05-30

## Vision

讓使用者輸入要製作成 slides 的內容，補充簡報目的、受眾、想要的風格與圖表化重點，
再由 agent 產生可審查、可展示、可分享的 web-native HTML slides。完成後，deck 可以
部署到一個網域，讓使用者 presentation everywhere。

## Core Flow

```text
Source content + purpose + audience + style direction + chart emphasis
-> Agent digestion
-> Slide JSON + review report
-> Design system planning with ui-ux-pro-max
-> Self-contained HTML rendering
-> Preview and revision
-> Publish to a shareable URL
```

## Major Capability Areas

### 1. Content Intake

使用者提供原始內容與簡報需求。第一版以 pasted text 為主，內容可能包含內部報告、
提案、PM planning、會議紀錄、數據摘要或 Markdown 草稿。

輸入應包含：

- Source content
- Deck purpose
- Audience
- Style direction
- Must-include points
- Chart emphasis
- Optional language and tone preferences

### 2. Agent Planning

Agent 先消化內容，不直接產 HTML。它需要抽取事實、數字、風險、決策、期限與段落
意圖，接著規劃 storyline、slide architecture、語意標題與適合的 visual structure。

### 3. Slide Schema and Review Report

正式中間產物是 structured slide JSON，而不是直接輸出 HTML。每次生成都必須附上
review report，讓使用者知道 assumptions、omitted content、uncertain claims、
charting decisions 與需要人工審查的地方。

### 4. Design System with ui-ux-pro-max

`ui-ux-pro-max` 作為 design planning 與 critique skill 使用。它負責視覺層級、layout
選擇、visual density、color/typography/spacing 建議與 design consistency review。

限制：ui-ux-pro-max 只能改變表達方式與視覺結構，不能新增未被 source content 支持
的事實或主張。

### 5. HTML Rendering

Renderer 將 slide JSON 與 design system 轉為 self-contained HTML slides。第一版應
支援 16:9 slide layout、keyboard navigation、browser presentation mode 與基本
responsive behavior。

### 6. Preview and Revision

使用者可以 preview deck，並以自然語言要求調整，例如改風格、調整頁數、強化某些
重點、把某段改成圖表或把圖表改回表格。第一版可以先支援重新生成，不必做完整
drag-and-drop editor。

### 7. Publishing

生成後可以發布到一個可分享 URL。第一版重點是讓使用者能夠跨裝置開啟與展示；權限、
版本管理、密碼保護與自訂網域可以作為後續功能。

## Initial MVP Boundary

第一個 MVP 應證明完整閉環：

```text
使用者貼上內容 + 描述風格 + 指定圖表重點
-> 系統產生 slide JSON + review report
-> 系統產生 self-contained HTML slides
-> 使用者 preview
-> 使用者發布到 shareable URL
```

MVP 不包含：

- Native PPTX export
- Full slide editor
- Account system
- Real-time collaboration
- File upload
- Advanced access control
- Multi-version deck management

## Candidate Domain Concepts

- `SourceContent`
- `DeckBrief`
- `SlideDeck`
- `Slide`
- `ContentBlock`
- `ChartIntent`
- `DesignSystem`
- `ReviewReport`
- `PublishedDeck`

## Open Product Questions

1. Published URL 在第一版是否需要 private token，或可以先用 unlisted public URL？
2. Preview 後的 revision 是重新生成整份 deck，還是支援單頁局部修改？
3. 第一版部署應該保留 deck versions，還是每次發布覆蓋最新 artifact？
4. 是否需要在 v1 支援 speaker notes？
5. 是否允許外部 LLM provider 處理公司內部內容，或預設必須走 local/deterministic fallback？

