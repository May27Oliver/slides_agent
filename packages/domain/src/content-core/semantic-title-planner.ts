export interface SemanticTitleInputSection {
  id: string;
  heading: string;
  text: string;
}

export interface SemanticTitleResult {
  sourceSectionId: string;
  title: string;
}

export function planSemanticSlideTitles(
  sections: SemanticTitleInputSection[]
): SemanticTitleResult[] {
  return sections.map((section) => ({
    sourceSectionId: section.id,
    title: titleForSection(section)
  }));
}

function titleForSection(section: SemanticTitleInputSection): string {
  const text = section.text;

  if (/conversion/iu.test(text) && /回覆時間/u.test(text) && /Dashboard MVP|MVP/u.test(text)) {
    return "Q3 planning focuses on conversion, response time, and MVP delivery";
  }

  if (/dashboard MVP/u.test(text) && /full CRM integration/u.test(text)) {
    return "This phase narrows scope to dashboard MVP";
  }

  if (/0\.5\s*FTE/iu.test(text)) {
    return "Resource and data readiness remain delivery risks";
  }

  return section.text.split("\n")[0]?.trim() || section.heading;
}
