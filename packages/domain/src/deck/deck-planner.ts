import type { ChartIntent } from "@/content-core/chart-intent.types";
import type {
  DeckPlanProposal,
  DeckSlideProposal,
  LayoutIntent,
  SlideOutlineEmphasis,
  SourceFact,
  SourceSection
} from "@/deck/deck.types";
import type { CreateDeckPlanProposalInput } from "@/deck/deck-planner.types";

const maxSlideCount = 8;

export function createDeckPlanProposal(input: CreateDeckPlanProposalInput): DeckPlanProposal {
  const contentGroups = groupSourceSections(input.sourceSections);
  const hasClosing = input.sourceSections.some(isClosingSupportedBySource);
  const maxContentSlides = Math.max(1, maxSlideCount - 1 - (hasClosing ? 1 : 0));
  const cappedGroups = capContentGroups(contentGroups, maxContentSlides);
  const slides: DeckSlideProposal[] = [
    openingSlide(input),
    ...cappedGroups.map((sections, index) => contentSlide(input, sections, index))
  ];

  if (hasClosing) {
    slides.push(closingSlide(input));
  }

  return {
    id: "deck_plan_001",
    title: deckTitle(input),
    slides,
    planningNotes: [
      "Deck planning v1 is deterministic and preserves source section order.",
      "Deck planning v1 does not use LLM, narrativeType, complex slide role, or appendix."
    ]
  };
}

function groupSourceSections(sourceSections: SourceSection[]): SourceSection[][] {
  const groups: SourceSection[][] = [];

  for (const section of sourceSections) {
    const previous = groups.at(-1);
    if (previous && shouldMerge(previous.at(-1), section)) {
      previous.push(section);
      continue;
    }

    groups.push([section]);
  }

  return groups;
}

function shouldMerge(previous: SourceSection | undefined, current: SourceSection): boolean {
  if (!previous) {
    return false;
  }

  return previous.heading === current.heading || (isShort(previous) && isShort(current));
}

function isShort(section: SourceSection): boolean {
  return section.text.trim().length <= 80;
}

function capContentGroups(groups: SourceSection[][], maxGroups: number): SourceSection[][] {
  const capped = groups.map((group) => [...group]);
  while (capped.length > maxGroups) {
    const last = capped.pop();
    if (!last) {
      break;
    }
    capped[capped.length - 1]?.push(...last);
  }
  return capped;
}

function openingSlide(input: CreateDeckPlanProposalInput): DeckSlideProposal {
  const firstSection = input.sourceSections[0];
  const sourceSectionIds = firstSection ? [firstSection.id] : [];
  const outlineText = firstSection
    ? conciseText(firstSection.text)
    : `Purpose: ${input.deckBrief.purpose}`;

  return {
    id: "slide_001",
    slideKind: "opening",
    title: deckTitle(input),
    message: input.deckBrief.purpose,
    sourceSectionIds,
    sourceFactIds: factIdsForSections(input.sourceFacts, sourceSectionIds),
    chartIntentIds: [],
    outline: [
      {
        text: outlineText,
        sourceTrace: sourceSectionIds,
        emphasis: "main_point"
      }
    ],
    layoutIntent: {
      priority: "message_first",
      density: "medium",
      emphasis: "narrative"
    },
    speakerNotesDraft: speakerNotes(deckTitle(input), outlineText),
    reviewNotes: []
  };
}

function contentSlide(
  input: CreateDeckPlanProposalInput,
  sections: SourceSection[],
  index: number
): DeckSlideProposal {
  const sourceSectionIds = sections.map((section) => section.id);
  const sourceFactIds = factIdsForSections(input.sourceFacts, sourceSectionIds);
  const chartIntentIds = chartIntentIdsForFacts(input.chartIntents, sourceFactIds);
  const outline = outlineForSections(sections, input.sourceFacts);
  const title = titleForSections(sections);

  return {
    id: `slide_${String(index + 2).padStart(3, "0")}`,
    slideKind: "content",
    title,
    message: sections.map((section) => section.heading).join(" / "),
    sourceSectionIds,
    sourceFactIds,
    chartIntentIds,
    outline,
    layoutIntent: layoutIntentForSections(sections, chartIntentIds),
    speakerNotesDraft: speakerNotes(
      title,
      outline[0]?.text ?? sections[0]?.heading ?? "Review source detail."
    ),
    reviewNotes: []
  };
}

function closingSlide(input: CreateDeckPlanProposalInput): DeckSlideProposal {
  const closingSections = input.sourceSections.filter(isClosingSupportedBySource);
  const sourceSectionIds = closingSections.map((section) => section.id);
  const sourceFactIds = factIdsForSections(input.sourceFacts, sourceSectionIds);
  const outline = outlineForSections(closingSections, input.sourceFacts);
  const firstOutline =
    outline[0]?.text ?? "Review source-supported next steps, owners, or deadlines.";

  return {
    id: `slide_${String(input.sourceSections.length + 2).padStart(3, "0")}`,
    slideKind: "closing",
    title: "Source-supported next steps",
    message: "Close with only actions, owners, or deadlines stated in the source.",
    sourceSectionIds,
    sourceFactIds,
    chartIntentIds: chartIntentIdsForFacts(input.chartIntents, sourceFactIds),
    outline,
    layoutIntent: {
      priority: "timeline",
      density: "medium",
      emphasis: "actions"
    },
    speakerNotesDraft: speakerNotes("Source-supported next steps", firstOutline),
    reviewNotes: []
  };
}

function outlineForSections(sections: SourceSection[], sourceFacts: SourceFact[]) {
  const items = sections.flatMap((section) => {
    const sectionFacts = sourceFacts.filter((fact) => fact.sourceSectionId === section.id);
    const trace = sectionFacts.length > 0 ? sectionFacts.map((fact) => fact.id) : [section.id];

    return splitLines(section.text)
      .slice(0, 2)
      .map((line) => ({
        text: conciseText(line),
        sourceTrace: trace,
        emphasis: emphasisFor(section, sectionFacts)
      }));
  });

  return items.slice(0, 4);
}

function emphasisFor(section: SourceSection, facts: SourceFact[]): SlideOutlineEmphasis {
  if (/風險/u.test(section.heading) || facts.some((fact) => fact.kind === "risk")) {
    return "risk";
  }
  if (/決策/u.test(section.heading) || facts.some((fact) => fact.kind === "decision")) {
    return "decision";
  }
  if (/下一步|action|owner|deadline|期限|完成/iu.test(section.heading)) {
    return "action";
  }
  if (facts.some((fact) => fact.kind === "metric" || fact.kind === "date")) {
    return "evidence";
  }
  return "main_point";
}

function layoutIntentForSections(
  sections: SourceSection[],
  chartIntentIds: string[]
): LayoutIntent {
  if (chartIntentIds.length > 0) {
    return { priority: "metrics_first", density: "high", emphasis: "numbers" };
  }
  if (sections.some((section) => /風險/u.test(section.heading))) {
    return { priority: "risk_matrix", density: "medium", emphasis: "risks" };
  }
  if (sections.some((section) => /決策/u.test(section.heading))) {
    return { priority: "message_first", density: "medium", emphasis: "decisions" };
  }
  return { priority: "message_first", density: "medium", emphasis: "narrative" };
}

function factIdsForSections(sourceFacts: SourceFact[], sourceSectionIds: string[]): string[] {
  return sourceFacts
    .filter((fact) => fact.sourceSectionId && sourceSectionIds.includes(fact.sourceSectionId))
    .map((fact) => fact.id);
}

function chartIntentIdsForFacts(chartIntents: ChartIntent[], sourceFactIds: string[]): string[] {
  return chartIntents
    .filter((intent) => intent.sourceFacts.some((fact) => sourceFactIds.includes(fact.id)))
    .map((intent) => intent.id);
}

function titleForSections(sections: SourceSection[]): string {
  const headings = [...new Set(sections.map((section) => section.heading))];
  if (headings.length === 1) {
    return `${headings[0]}: ${conciseText(sections[0]?.text ?? "")}`;
  }
  return headings.join(" / ");
}

function deckTitle(input: CreateDeckPlanProposalInput): string {
  return input.deckBrief.purpose || input.sourceSections[0]?.heading || "Generated slide deck";
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function conciseText(text: string): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return normalized.length > 90 ? `${normalized.slice(0, 87)}...` : normalized;
}

function speakerNotes(title: string, outlineText: string): string {
  return `${title}。請依照來源內容說明：${outlineText}`;
}

function isClosingSupportedBySource(section: SourceSection): boolean {
  return /下一步|next steps?|action|owner|deadline|負責|期限|需在\s*\d{4}-\d{2}-\d{2}|完成/iu.test(
    `${section.heading}\n${section.text}`
  );
}
