export interface HtmlDownload {
  href: string;
  filename: string;
}

export interface HtmlDownloadOptions {
  /** 015 (FR-001): when given together with `revision`, names the file after the deck. */
  deckTitle?: string;
  revision?: number;
  now?: Date;
}

export function buildHtmlDownload(html: string, options: HtmlDownloadOptions = {}): HtmlDownload {
  const stamp = formatTimestamp(options.now ?? new Date());
  const base =
    options.deckTitle !== undefined && options.revision !== undefined
      ? `${sanitizeTitle(options.deckTitle)}-rev${options.revision}`
      : "preview-slides";
  return {
    href: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    filename: `${base}-${stamp}.html`
  };
}

/** Filesystem-safe title: illegal chars/whitespace → "-", collapsed and trimmed. */
function sanitizeTitle(title: string): string {
  const cleaned = title
    .replace(/[/\\:*?"<>|\s]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 60);
  return cleaned || "deck";
}

// Local-time YYYYMMDD-HHmmss, safe for filenames (no colons/spaces).
function formatTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
