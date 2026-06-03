import type {
  DeckOutlineRefinement,
  DeckOutlineRefinementInput,
  DeckOutlineRefinementValidation,
  RefinedSlideOutline
} from "@/deck/deck-outline-planner.port";

const MAX_BULLETS_PER_SLIDE = 6;
const MAX_BULLET_LENGTH = 220;
const MAX_TITLE_LENGTH = 120;

export function validateDeckOutlineRefinement(
  input: DeckOutlineRefinementInput,
  refinement: DeckOutlineRefinement
): DeckOutlineRefinementValidation {
  const issues: string[] = [];

  const expectedIds = input.deck.slides.map((slide) => slide.id);
  const actualIds = refinement.slides.map((slide) => slide.id);
  if (expectedIds.join("|") !== actualIds.join("|")) {
    issues.push(
      `Slide id/order mismatch. Expected ${expectedIds.join(", ")}, found ${actualIds.join(", ")}.`
    );
    return { ok: false, issues };
  }

  const sourceNumbers = extractNumbers(sourceCorpus(input));

  for (const slide of refinement.slides) {
    issues.push(...validateSlide(slide, sourceNumbers));
  }

  return { ok: issues.length === 0, issues };
}

function validateSlide(slide: RefinedSlideOutline, sourceNumbers: Set<string>): string[] {
  const issues: string[] = [];

  if (slide.title.trim().length === 0) {
    issues.push(`Empty slide title: ${slide.id}`);
  }
  if (slide.title.trim().length > MAX_TITLE_LENGTH) {
    issues.push(`Slide title too long: ${slide.id}`);
  }
  if (slide.message.trim().length === 0) {
    issues.push(`Empty slide message: ${slide.id}`);
  }

  if (slide.bullets.length === 0) {
    issues.push(`Empty bullets: ${slide.id}`);
  }
  if (slide.bullets.length > MAX_BULLETS_PER_SLIDE) {
    issues.push(`Too many bullets: ${slide.id} (${slide.bullets.length})`);
  }

  for (const bullet of slide.bullets) {
    if (bullet.trim().length === 0) {
      issues.push(`Empty bullet text: ${slide.id}`);
    }
    if (bullet.trim().length > MAX_BULLET_LENGTH) {
      issues.push(`Bullet too long: ${slide.id}`);
    }
    if (isTruncated(bullet)) {
      issues.push(`Truncated bullet: ${slide.id}`);
    }
  }

  const fabricated = fabricatedNumbers([slide.title, slide.message, ...slide.bullets], sourceNumbers);
  for (const value of fabricated) {
    issues.push(`Fabricated number not present in source: ${slide.id} -> ${value}`);
  }

  return issues;
}

function isTruncated(text: string): boolean {
  return /(\.\.\.|…)\s*$/u.test(text.trim());
}

function sourceCorpus(input: DeckOutlineRefinementInput): string {
  return input.sourceSections.map((section) => `${section.heading}\n${section.text}`).join("\n");
}

function extractNumbers(text: string): Set<string> {
  return new Set((text.match(/\d+/gu) ?? []).map((value) => value));
}

function fabricatedNumbers(values: string[], sourceNumbers: Set<string>): string[] {
  const fabricated = new Set<string>();
  for (const value of values) {
    for (const number of value.match(/\d+/gu) ?? []) {
      if (!sourceNumbers.has(number)) {
        fabricated.add(number);
      }
    }
  }
  return [...fabricated];
}
