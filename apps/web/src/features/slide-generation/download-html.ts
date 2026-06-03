export interface HtmlDownload {
  href: string;
  filename: string;
}

export function buildHtmlDownload(html: string, now: Date = new Date()): HtmlDownload {
  return {
    href: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    filename: `preview-slides-${formatTimestamp(now)}.html`
  };
}

// Local-time YYYYMMDD-HHmmss, safe for filenames (no colons/spaces).
function formatTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
