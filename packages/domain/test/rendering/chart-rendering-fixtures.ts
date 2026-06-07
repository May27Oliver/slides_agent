import type { ChartIntent, VisualizationType } from "@/content-core/chart-intent.types";
import type { SourceFact } from "@/deck/deck.types";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import { defaultDesignSystem } from "@/design/default-design-system";

/** Shared style kit + design system for chart renderer tests. */
export const styleKit = defaultDesignStyleKit();
export const designSystem = defaultDesignSystem();

let factCounter = 0;

/** Builds a SourceFact with a stable id and sensible defaults. */
export function fact(partial: Partial<SourceFact> & { value: string }): SourceFact {
  factCounter += 1;
  return {
    id: partial.id ?? `fact_${factCounter}`,
    kind: partial.kind ?? "metric",
    value: partial.value,
    sourceText: partial.sourceText ?? partial.value,
    ...(partial.sourceSectionId ? { sourceSectionId: partial.sourceSectionId } : {})
  };
}

/** Builds a ChartIntent from source facts. */
export function intent(partial: {
  id?: string;
  title?: string;
  sourceFacts: SourceFact[];
  recommendedVisuals?: VisualizationType[];
  rationale?: string;
}): ChartIntent {
  return {
    id: partial.id ?? "chart_test",
    title: partial.title ?? "Test chart",
    sourceFacts: partial.sourceFacts,
    recommendedVisuals: partial.recommendedVisuals ?? ["comparison"],
    rationale: partial.rationale ?? "test rationale"
  };
}

/** A 4-category same-unit comparison (good for bar). */
export const barFacts: SourceFact[] = [
  fact({ id: "f_north", value: "$2.3M", sourceText: "北區營收 $2.3M" }),
  fact({ id: "f_south", value: "$1.8M", sourceText: "南區營收 $1.8M" }),
  fact({ id: "f_east", value: "$1.2M", sourceText: "東區營收 $1.2M" }),
  fact({ id: "f_west", value: "$0.9M", sourceText: "西區營收 $0.9M" })
];

/** A percentage part-to-whole (good for pie/donut). */
export const pieFacts: SourceFact[] = [
  fact({ id: "p_a", value: "45%", sourceText: "產品A 占 45%" }),
  fact({ id: "p_b", value: "30%", sourceText: "產品B 占 30%" }),
  fact({ id: "p_c", value: "25%", sourceText: "產品C 占 25%" })
];

/** A sortable time series (good for line). */
export const timeFacts: SourceFact[] = [
  fact({ id: "t_q1", value: "$1.0M", sourceText: "Q1 2026 營收 $1.0M" }),
  fact({ id: "t_q2", value: "$1.4M", sourceText: "Q2 2026 營收 $1.4M" }),
  fact({ id: "t_q3", value: "$1.9M", sourceText: "Q3 2026 營收 $1.9M" }),
  fact({ id: "t_q4", value: "$2.6M", sourceText: "Q4 2026 營收 $2.6M" })
];
