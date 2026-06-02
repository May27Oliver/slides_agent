import type { DesignSystem } from "@/design/types";

export function buildDeckCss(designSystem: DesignSystem): string {
  return `
:root {
  --deck-background: ${designSystem.palette.background};
  --deck-surface: ${designSystem.palette.surface};
  --deck-text: ${designSystem.palette.text};
  --deck-muted: ${designSystem.palette.mutedText};
  --deck-accent: ${designSystem.palette.accent};
  --deck-warning: ${designSystem.palette.warning};
  --deck-padding: ${designSystem.spacing.slidePadding}px;
  --deck-gap: ${designSystem.spacing.blockGap}px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--deck-background);
  color: var(--deck-text);
  font-family: ${designSystem.typography.bodyFamily};
}

.deck {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.slide {
  width: min(100%, 1280px);
  aspect-ratio: 16 / 9;
  background: var(--deck-surface);
  padding: var(--deck-padding);
  display: flex;
  flex-direction: column;
  gap: var(--deck-gap);
  border-top: 8px solid var(--deck-accent);
}

.slide[hidden] {
  display: none;
}

h1 {
  margin: 0;
  font-family: ${designSystem.typography.headingFamily};
  font-size: 44px;
}

.message {
  margin: 0;
  color: var(--deck-muted);
  font-size: 24px;
}

li {
  margin-block: 8px;
  font-size: 22px;
}
`.trim();
}
