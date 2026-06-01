import type { DesignSystem } from "@/design/types";

export function defaultDesignSystem(styleDirection?: string): DesignSystem {
  return {
    themeName: styleDirection ? "brief-directed-planning" : "default-planning",
    palette: {
      background: "#f7f7f2",
      surface: "#ffffff",
      text: "#1f2933",
      mutedText: "#5b6770",
      accent: "#0f766e",
      warning: "#b45309"
    },
    typography: {
      headingFamily: "Inter, system-ui, sans-serif",
      bodyFamily: "Inter, system-ui, sans-serif",
      scale: "compact"
    },
    spacing: {
      unit: 8,
      slidePadding: 48,
      blockGap: 16
    },
    visualDensity: styleDirection?.includes("高密度") ? "high" : "medium",
    layoutGrid: "16:9",
    slidePatterns: ["title", "metrics", "risk-table"],
    chartStyle: "minimal",
    uiUxProMaxNotes: styleDirection ? [`Style direction captured: ${styleDirection}`] : []
  };
}
