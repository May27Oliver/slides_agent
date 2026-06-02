import type { SegmentedSourceContent } from "@/content-core/semantic-segmentation.types";
import { segmentSourceContent } from "@/content-core/semantic-segmentation-validator";
import type {
  SemanticSegmentationRepairer,
  SemanticSegmenter,
  SemanticSegmenterInput
} from "@/content-core/semantic-segmenter.port";

export interface SegmentSourceContentWithRepairInput extends Partial<SemanticSegmenterInput> {
  sourceContent: string;
  segmenter: SemanticSegmenter;
  repairer: SemanticSegmentationRepairer;
}

export async function segmentSourceContentWithRepair(
  input: SegmentSourceContentWithRepairInput
): Promise<SegmentedSourceContent> {
  const initialOutput = await input.segmenter.segment({
    sourceContent: input.sourceContent,
    purpose: input.purpose ?? "",
    audience: input.audience ?? "",
    ...(input.segmentationGuidance ? { segmentationGuidance: input.segmentationGuidance } : {})
  });

  const initial = segmentSourceContent({
    sourceContent: input.sourceContent,
    llmOutput: initialOutput
  });

  if (!initial.validation.fallbackUsed) {
    return {
      ...initial,
      validation: {
        ...initial.validation,
        repairAttempted: false,
        repairSucceeded: false
      }
    };
  }

  let repairedOutput: unknown;
  try {
    repairedOutput = await input.repairer.repair({
      sourceContent: input.sourceContent,
      invalidOutput: initialOutput,
      validationErrors: initial.validation.issues
    });
  } catch (error) {
    return {
      ...initial,
      validation: {
        ...initial.validation,
        repairAttempted: true,
        repairSucceeded: false,
        issues: [
          "AI 語意切段格式修復失敗，已改用保守切段",
          ...initial.validation.issues,
          error instanceof Error ? error.message : "unknown repair error"
        ]
      }
    };
  }

  const repaired = segmentSourceContent({
    sourceContent: input.sourceContent,
    llmOutput: repairedOutput
  });

  if (!repaired.validation.fallbackUsed) {
    return {
      ...repaired,
      validation: {
        ...repaired.validation,
        repairAttempted: true,
        repairSucceeded: true,
        repairNotes: ["AI 語意切段格式未通過驗證，已自動修復"]
      }
    };
  }

  return {
    ...repaired,
    validation: {
      ...repaired.validation,
      repairAttempted: true,
      repairSucceeded: false,
      issues: ["AI 語意切段格式修復後仍未通過驗證，已改用保守切段", ...repaired.validation.issues]
    }
  };
}
