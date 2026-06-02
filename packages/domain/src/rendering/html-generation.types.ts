export type HtmlGenerationValidationStatus =
  | "pass"
  | "repair_required"
  | "fallback_used"
  | "failed";

export interface HtmlGenerationAttempt {
  attemptNumber: 1;
  html: string;
  validation: HtmlGenerationValidation;
}

export interface HtmlGenerationValidation {
  status: HtmlGenerationValidationStatus;
  selfContained: boolean;
  slideCountAndOrderPreserved: boolean;
  contentFidelityPreserved: boolean;
  designCompliancePreserved: boolean;
  speakerNotesHidden: boolean;
  keyboardNavigationPresent: boolean;
  externalResourceIssues: string[];
  contentIssues: string[];
  designIssues: string[];
  repairAttempted: boolean;
  fallbackUsed: boolean;
}

export interface HtmlRepairAttempt {
  attemptNumber: 1;
  inputValidationIssues: string[];
  repairedHtml: string;
  validation: HtmlGenerationValidation;
}
