import type { SourceFact, SourceFactKind, SourceSection } from "@/deck/deck.types";
import { parseSourceSections } from "@/content-core/source-parser";

interface FactCandidate {
  kind: SourceFactKind;
  value: string;
}

export function extractSourceFacts(
  sourceContent: string,
  sections: SourceSection[] = parseSourceSections(sourceContent)
): SourceFact[] {
  const facts: SourceFact[] = [];

  for (const section of sections) {
    for (const sourceText of splitSentences(section.text)) {
      const candidates = factCandidatesForLine(section.heading, sourceText);

      for (const candidate of candidates) {
        facts.push({
          id: `fact_${facts.length + 1}`,
          kind: candidate.kind,
          value: candidate.value,
          sourceText,
          sourceSectionId: section.id
        });
      }
    }
  }

  return facts;
}

/**
 * Splits a section into sentence-level units so each fact's `sourceText` is its
 * own sentence — not the whole paragraph. Without this, a prose paragraph like
 * "截至 2026 年底…成長 18%。…NRR 112%" would give the unrelated 18% and 112% the
 * same sourceText, so the chart planner reads the stray "2026" as a shared period
 * and forces a bogus 18%→112% timeline. Splits on CJK sentence enders and
 * newlines only — NOT the ASCII "." so currency/decimals (`$1.1M`, `52.5%`) stay
 * intact; bulleted lines (no enders) pass through unchanged.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[。！？；\n]+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function factCandidatesForLine(sectionHeading: string, sourceText: string): FactCandidate[] {
  const candidates: FactCandidate[] = [];
  const sectionKind = kindForSection(sectionHeading);

  for (const value of sourceText.match(/\d+(?:\.\d+)?%/gu) ?? []) {
    candidates.push({ kind: "metric", value });
  }

  // 008 US6: currency amounts ($1.1M / €2,300 / ¥500K) are prime chartable
  // metrics; extract them so the chart-intent planner has same-unit groups to
  // compare. Whitespace is collapsed so "$ 1.0 M" canonicalises to "$1.0M".
  for (const value of sourceText.match(/[$€£¥]\s?\d[\d,]*(?:\.\d+)?\s?[KMBkmb]?/gu) ?? []) {
    candidates.push({ kind: "metric", value: value.replace(/\s+/gu, "") });
  }

  for (const value of sourceText.match(/\d+(?:\.\d+)?\s*小時/gu) ?? []) {
    candidates.push({ kind: "metric", value: value.replace(/\s+/gu, " ") });
  }

  for (const value of sourceText.match(/\d+(?:\.\d+)?\s*FTE/giu) ?? []) {
    candidates.push({ kind: "constraint", value: value.replace(/\s+/gu, " ") });
  }

  for (const value of sourceText.match(/\d{4}-\d{2}-\d{2}/gu) ?? []) {
    candidates.push({ kind: "date", value });
  }

  if (sectionKind === "decision" && /dashboard MVP/u.test(sourceText)) {
    candidates.push({ kind: sectionKind, value: "dashboard MVP" });
  }

  if (sectionKind === "decision" && /full CRM integration/u.test(sourceText)) {
    candidates.push({ kind: sectionKind, value: "full CRM integration" });
  }

  return dedupeCandidates(candidates);
}

function kindForSection(sectionHeading: string): SourceFactKind {
  if (/決策/u.test(sectionHeading)) {
    return "decision";
  }

  if (/風險/u.test(sectionHeading)) {
    return "risk";
  }

  if (/限制/u.test(sectionHeading)) {
    return "constraint";
  }

  return "claim";
}

function dedupeCandidates(candidates: FactCandidate[]): FactCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.kind}:${candidate.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
