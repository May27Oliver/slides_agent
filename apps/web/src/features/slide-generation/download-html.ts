export interface HtmlDownload {
  href: string;
  filename: string;
}

export function buildHtmlDownload(html: string): HtmlDownload {
  return {
    href: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    filename: "preview-slides.html"
  };
}
