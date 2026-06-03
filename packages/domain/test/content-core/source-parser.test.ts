import { describe, expect, it } from "vitest";
import { parseSourceSections } from "@/content-core/source-parser";

describe("source parser", () => {
  it("treats markdown subsection headings as source section headings without rendering markers", () => {
    const sections = parseSourceSections(`# 範例公司複試逐字稿

## 1. 自我介紹

董事長、經理你們好，我是王小明。

## 2. 專案經驗

- 把複雜需求落地成可運作的產品功能
`);

    expect(sections).toEqual([
      {
        id: "1-自我介紹",
        heading: "1. 自我介紹",
        text: "董事長、經理你們好，我是王小明。",
        segmentationSource: "deterministic_fallback"
      },
      {
        id: "2-專案經驗",
        heading: "2. 專案經驗",
        text: "把複雜需求落地成可運作的產品功能",
        segmentationSource: "deterministic_fallback"
      }
    ]);
  });
});
