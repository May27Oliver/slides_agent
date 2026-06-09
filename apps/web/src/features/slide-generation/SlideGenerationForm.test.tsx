// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlideGenerationForm } from "@/features/slide-generation/SlideGenerationForm";

afterEach(() => {
  cleanup();
});

describe("SlideGenerationForm style cards", () => {
  it("submits the unchanged styleDirection keyword for the selected style card", () => {
    const onSubmit = vi.fn();
    render(<SlideGenerationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("原始內容"), {
      target: { value: "季度營運數據顯示留存率提升。" }
    });
    fireEvent.change(screen.getByLabelText("簡報用途"), {
      target: { value: "季度營運回顧" }
    });
    fireEvent.change(screen.getByLabelText("目標受眾"), {
      target: { value: "產品與工程主管" }
    });
    fireEvent.click(screen.getByRole("radio", { name: /科技新創/ }));
    fireEvent.click(screen.getByRole("button", { name: "生成簡報" }));

    expect(onSubmit).toHaveBeenCalledWith({
      sourceContent: "季度營運數據顯示留存率提升。",
      deckBrief: {
        purpose: "季度營運回顧",
        audience: "產品與工程主管",
        styleDirection: "tech startup developer 科技",
        language: "zh-TW"
      }
    });
  });

  it("submits the free-text chartEmphasis when provided", () => {
    const onSubmit = vi.fn();
    render(<SlideGenerationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("原始內容"), {
      target: { value: "季度營運數據顯示留存率提升。" }
    });
    fireEvent.change(screen.getByLabelText("簡報用途"), {
      target: { value: "季度營運回顧" }
    });
    fireEvent.change(screen.getByLabelText("目標受眾"), {
      target: { value: "產品與工程主管" }
    });
    fireEvent.change(screen.getByLabelText("圖表強調（自訂）"), {
      target: { value: "強調留存率趨勢" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成簡報" }));

    expect(onSubmit).toHaveBeenCalledWith({
      sourceContent: "季度營運數據顯示留存率提升。",
      deckBrief: {
        purpose: "季度營運回顧",
        audience: "產品與工程主管",
        chartEmphasis: "強調留存率趨勢",
        language: "zh-TW"
      }
    });
  });

  it("drops the preset styleDirection once the custom-theme tab is active (mutually exclusive)", async () => {
    const onSubmit = vi.fn();
    const emptyCatalog = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ font: [], palette: [], style: [] }) });
    render(
      <SlideGenerationForm
        onSubmit={onSubmit}
        fetchImpl={emptyCatalog as unknown as typeof fetch}
      />
    );

    fireEvent.change(screen.getByLabelText("原始內容"), {
      target: { value: "季度營運數據顯示留存率提升。" }
    });
    fireEvent.change(screen.getByLabelText("簡報用途"), { target: { value: "季度營運回顧" } });
    fireEvent.change(screen.getByLabelText("目標受眾"), { target: { value: "產品與工程主管" } });
    // pick a preset card, then switch to the custom-theme tab.
    fireEvent.click(screen.getByRole("radio", { name: /科技新創/ }));
    fireEvent.click(screen.getByRole("tab", { name: "自選主題" }));
    fireEvent.click(screen.getByRole("button", { name: "生成簡報" }));

    // custom mode ⇒ no styleDirection (preset dropped) and no themeSelection (none picked).
    expect(onSubmit).toHaveBeenCalledWith({
      sourceContent: "季度營運數據顯示留存率提升。",
      deckBrief: { purpose: "季度營運回顧", audience: "產品與工程主管", language: "zh-TW" }
    });
  });

  it("keeps the custom styleDirection override when both custom text and a card are selected", () => {
    const onSubmit = vi.fn();
    render(<SlideGenerationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("原始內容"), {
      target: { value: "季度營運數據顯示留存率提升。" }
    });
    fireEvent.change(screen.getByLabelText("簡報用途"), {
      target: { value: "季度營運回顧" }
    });
    fireEvent.change(screen.getByLabelText("目標受眾"), {
      target: { value: "產品與工程主管" }
    });
    fireEvent.click(screen.getByRole("radio", { name: /優雅高級/ }));
    fireEvent.change(screen.getByLabelText("風格方向（自訂）"), {
      target: { value: "investor-ready monochrome editorial" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成簡報" }));

    expect(onSubmit).toHaveBeenCalledWith({
      sourceContent: "季度營運數據顯示留存率提升。",
      deckBrief: {
        purpose: "季度營運回顧",
        audience: "產品與工程主管",
        styleDirection: "investor-ready monochrome editorial",
        language: "zh-TW"
      }
    });
  });
});
