import type { SourceSection } from "@/deck/deck.types";

const headingPattern = /^(.+?)：$/u;

export function parseSourceSections(sourceContent: string): SourceSection[] {
  const sections: SourceSection[] = [];
  let current: { heading: string; lines: string[] } | undefined;

  for (const rawLine of sourceContent.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (/^#\s+/u.test(line)) {
      continue;
    }

    const headingMatch = line.match(headingPattern);
    if (headingMatch?.[1]) {
      if (current) {
        sections.push(toSourceSection(current, sections.length));
      }
      current = { heading: headingMatch[1], lines: [] };
      continue;
    }

    if (!current) {
      current = { heading: "Untitled", lines: [] };
    }

    current.lines.push(stripBulletMarker(line));
  }

  if (current) {
    sections.push(toSourceSection(current, sections.length));
  }

  return sections.filter((section) => section.text.trim().length > 0);
}

function toSourceSection(
  section: { heading: string; lines: string[] },
  index: number
): SourceSection {
  return {
    id: sectionId(section.heading, index),
    heading: section.heading,
    text: section.lines.join("\n"),
    segmentationSource: "deterministic_fallback"
  };
}

function sectionId(heading: string, index: number): string {
  const normalized = heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/gu, "");

  return normalized || `section-${index + 1}`;
}

function stripBulletMarker(line: string): string {
  return line.replace(/^[-*]\s+/u, "");
}
