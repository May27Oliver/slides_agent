/**
 * Normalizes a possibly-markdown string for display: trims each line, strips
 * leading heading (`#`) and list (`-`/`*`) markers, drops empty lines, and
 * rejoins with newlines. Shared by deck planning and HTML rendering so the two
 * stay in sync.
 */
export function cleanDisplayText(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s+/u, "")
        .replace(/^[-*]\s+/u, "")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}
