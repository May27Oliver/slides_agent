import PptxGenJS from "pptxgenjs";

/** 16:9 PowerPoint canvas in inches (the pptxgenjs unit). */
const LAYOUT = { name: "SLIDES_16x9", width: 13.333, height: 7.5 };

/**
 * 015 US2 (FR-004): assembles the .pptx — one slide per screenshot, full-bleed.
 * Pure data-in/data-out so the execution flow stays testable around it.
 */
export async function buildPptxFromImages(pngs: readonly Buffer[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout(LAYOUT);
  pptx.layout = LAYOUT.name;
  for (const png of pngs) {
    pptx.addSlide().addImage({
      data: `image/png;base64,${png.toString("base64")}`,
      x: 0,
      y: 0,
      w: LAYOUT.width,
      h: LAYOUT.height
    });
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
