# 規格品質檢查清單：Generate Previewable HTML Slides

**目的**：在進入 planning / tasks 前，驗證規格完整性、可測性與 constitution compliance。
**建立日期**：2026-05-30
**更新日期**：2026-06-02
**Feature**：[spec.md](../spec.md)

## 內容品質

- [x] 沒有未解決的 `[NEEDS CLARIFICATION]` 標記
- [x] 聚焦使用者價值、生成輸出與審查需求
- [x] 主要規格內容以繁體中文撰寫
- [x] 所有必要章節已完成
- [x] 範圍包含 design planning，且未擴張到 full slide editor、PPTX export 或 publish URL

## 需求完整性

- [x] Functional requirements 具體且可測
- [x] Success criteria 可驗證且不依賴單一實作細節
- [x] 每個 user story 都有 Given/When/Then acceptance scenarios
- [x] 每個 user story 都有 independent test 與 independent demo path
- [x] Edge cases 已涵蓋 source fidelity、segmentation、deck planning、design planning、renderer 與 accessibility 風險
- [x] Scope boundaries、assumptions、dependencies 已明確記錄
- [x] 不能自動化的行為已有 manual verification path

## Design Planning Readiness

- [x] `ui-ux-pro-max` 被定義為固定 design planning / critique layer
- [x] 使用者不能啟用、停用或配置 `ui-ux-pro-max`
- [x] `DesignPlanningResult` 必須可被 HTML generation prompt / validator 消費
- [x] 規格定義 `DesignSystem`、每頁 pattern assignment、chart treatment、visual hierarchy、accessibility notes、design review notes 與 consistency validation
- [x] style direction interpretation、visual density decision 與 design rationale 必須可追溯
- [x] design planning 不得改寫來源內容、改變 slide order、改變 title/message/outline 語意或產生 unsupported facts
- [x] 不同 slides 不得任意風格化，必須通過 design consistency validation

## Constitution Readiness

- [x] 所有 feature work 必須先通過 constitution check
- [x] Source fidelity、reviewable generation、web-first deliverable 與 backend-configured LLM boundary 已保留
- [x] 新增複雜度需在 plan 中記錄 rejected simpler alternative
- [x] TDD 流程要求已納入：先 failing tests、確認 red、最小實作、green 後才 refactor
- [x] DDD 邊界已納入：design domain type、port、behavior 檔案需分開
- [x] 決策與輸出必須可由 artifact/evidence 追溯

## Feature Readiness

- [x] User stories cover primary generation, LLM-assisted HTML generation, and design planning flows
- [x] Requirements cover primary behavior, fixed design layer boundaries, failure handling, and review evidence
- [x] Success criteria cover design planning result validation and design fallback behavior
- [x] Spec is ready for `/speckit-plan` update

## Notes

- 本次 specify 更新既有 `specs/002-generate-previewable-html-slides` feature，未建立新 spec 目錄。
- 後續 `/speckit-plan` 應同步更新 data model、contracts、quickstart、tasks、complexity tracking 與 evidence plan。
