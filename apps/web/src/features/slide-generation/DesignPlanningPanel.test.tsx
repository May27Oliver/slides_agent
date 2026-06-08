// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DesignPlanningPanel } from "@/features/slide-generation/DesignPlanningPanel";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";

type SelectedTheme = NonNullable<
  GeneratedPreviewArtifact["previewArtifact"]["generationSummary"]["selectedTheme"]
>;

const designPlanningResult: GeneratedPreviewArtifact["designPlanningResult"] = {
  slidePatternAssignments: [{ slideId: "s1", primaryPattern: "content-summary" }],
  consistencyValidation: { issues: [] }
};

function theme(overrides: Partial<SelectedTheme> = {}): SelectedTheme {
  return {
    kitName: "warm-professional",
    ids: { style: "style-01-minimalism", palette: "palette-02-rose", font: "font-03-geist" },
    fallback: false,
    accentHues: [
      { name: "rose", base: "#FF6B6B" },
      { name: "amber", base: "#FFC93C" }
    ],
    fonts: { heading: "Poppins", body: "Noto Sans TC" },
    visualDensity: "medium",
    structureFeatures: { radiusPx: 22, shadow: true, glow: true },
    ...overrides
  };
}

afterEach(() => {
  cleanup();
});

describe("DesignPlanningPanel", () => {
  it("renders applied-theme tokens from selectedTheme (name, fonts, radius, swatches, effects)", () => {
    render(
      <DesignPlanningPanel designPlanningResult={designPlanningResult} selectedTheme={theme()} />
    );

    expect(screen.getByText("warm-professional")).toBeTruthy();
    expect(screen.getByText("Poppins / Noto Sans TC")).toBeTruthy();
    expect(screen.getByText("22px")).toBeTruthy();
    // accent swatches grouped under an aria-label including the kit name + palette
    expect(screen.getByLabelText(/warm-professional/)).toBeTruthy();
    // structure effect chips reflect only what the kit applies
    expect(screen.getByText("陰影")).toBeTruthy();
    expect(screen.getByText("光暈")).toBeTruthy();
    // no fallback note on a fully-resolved theme
    expect(screen.queryByText("部分風格軸未命中，已套用預設值")).toBeNull();
  });

  it("does not fabricate effects the kit omits", () => {
    render(
      <DesignPlanningPanel
        designPlanningResult={designPlanningResult}
        selectedTheme={theme({ structureFeatures: { radiusPx: 14, shadow: false } })}
      />
    );

    expect(screen.getByText("14px")).toBeTruthy();
    expect(screen.queryByText("陰影")).toBeNull();
    expect(screen.queryByText("光暈")).toBeNull();
    expect(screen.queryByText("紋理")).toBeNull();
  });

  it("honestly discloses a fallback when a theme axis fell back to default", () => {
    render(
      <DesignPlanningPanel
        designPlanningResult={designPlanningResult}
        selectedTheme={theme({ fallback: true, ids: { style: null, palette: null, font: null } })}
      />
    );

    expect(screen.getByText("部分風格軸未命中，已套用預設值")).toBeTruthy();
  });

  it("shows placeholders and no theme evidence when selectedTheme is absent", () => {
    const { container } = render(
      <DesignPlanningPanel designPlanningResult={designPlanningResult} />
    );

    // theme name + density fall back to an em dash — never fabricated from the request
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    // no swatch group / effect chips / fallback note without selectedTheme
    expect(screen.queryByLabelText(/warm-professional/)).toBeNull();
    expect(container.querySelector("[aria-label$='配色']")).toBeNull();
    expect(screen.queryByText("部分風格軸未命中，已套用預設值")).toBeNull();
  });
});
