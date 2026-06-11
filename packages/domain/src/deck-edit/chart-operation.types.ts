import type { ChartVisualOverride } from "@/design/design.types";

/**
 * 014: 使用者輸入的單一數據點。數值以 valueText 單源表達（FR-007），
 * domain 自行導出 displayValue / numericValue，矛盾在結構上不可能。
 */
export interface UserPointInput {
  /** trim 後非空，≤ 120 字元。 */
  label: string;
  /** 須符合 /^-?\d+(\.\d+)?$/，≤ 32 字元，解析後為有限數。 */
  valueText: string;
  /** ≤ 16 字元。 */
  unit: string | null;
}

/**
 * 014: edit_data 的完整點清單項目，陣列序 = 顯示序。
 * original 引用必須屬於該 intent 於前序操作套用後的 sourceFacts，且清單內不得重複。
 */
export type EditDataPoint =
  | { kind: "original"; sourceFactId: string }
  | { kind: "user"; point: UserPointInput; replacesFactId?: string };

/** 014: 編輯頁圖表編輯的結構化操作（唯一編輯通道，依陣列序套用）。 */
export type ChartOperation =
  | { op: "set_visual"; chartIntentId: string; visual: ChartVisualOverride }
  | { op: "remove_chart"; slideId: string; chartIntentId: string }
  | {
      op: "add_chart";
      slideId: string;
      source:
        | { kind: "existing_intent"; chartIntentId: string }
        | {
            kind: "user_data";
            title: string;
            visual: ChartVisualOverride;
            points: UserPointInput[];
          };
    }
  | {
      op: "edit_data";
      chartIntentId: string;
      /** 完整清單，陣列序 = 顯示序。 */
      points: EditDataPoint[];
      /** 提供時 trim 非空，覆寫 intent.title。 */
      title?: string;
    };

/**
 * 014: the valueText literal rule（負號/小數可選的數字字面）— single source shared by
 * the authoritative domain validator and the web UX mirrors (red-border hints,
 * create-button gating). Rejects "1e5"、"1/3"、"Infinity"、"12." etc.
 */
export const USER_POINT_VALUE_PATTERN = /^-?\d+(\.\d+)?$/;

export const CHART_EDIT_LIMITS = {
  maxPointsPerChart: 12,
  maxChartsPerSlide: 1,
  maxOperations: 50,
  /** label 與 title 共用。 */
  maxLabelLength: 120,
  maxUnitLength: 16,
  maxValueTextLength: 32
} as const;
