import { clampFontSizeCss } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import type { DesignSystem } from "@/design/design.types";
import { safeCssValue, safeHex, safeNumber } from "@/rendering/sanitize";

// 007 US3 — built-in B-grade overlays. These are ENGINE-OWNED static CSS keyed by
// a closed enum: a tampered kit can only select a preset (or none), never inject
// its own CSS. The maps use literal-union keys so tsc enforces the closed set and
// the type guards below (hasOwnProperty) reject any prototype key (e.g. "toString",
// "__proto__") before it can reach a template literal (DR-008).
type TextureKey = "grain" | "noise" | "paper";
type GradientPreset = "aurora" | "mesh";

const TEXTURE_OVERLAYS: Record<TextureKey, string> = {
  grain: "repeating-radial-gradient(circle at 0 0, rgba(0,0,0,.05) 0 1px, transparent 1px 3px)",
  noise:
    "repeating-linear-gradient(0deg, rgba(0,0,0,.035) 0 1px, transparent 1px 2px), repeating-linear-gradient(90deg, rgba(0,0,0,.035) 0 1px, transparent 1px 2px)",
  paper: "repeating-linear-gradient(45deg, rgba(0,0,0,.03) 0 2px, transparent 2px 5px)"
};

const GRADIENT_ANIMATIONS: Record<
  GradientPreset,
  { readonly keyframes: string; readonly layer: string }
> = {
  aurora: {
    keyframes:
      "@keyframes deck-aurora{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}",
    layer: "linear-gradient(120deg, var(--hue-0), var(--hue-1), var(--hue-2), var(--hue-3))"
  },
  mesh: {
    keyframes:
      "@keyframes deck-mesh{0%{background-position:0% 0%}50%{background-position:100% 100%}100%{background-position:0% 0%}}",
    layer:
      "radial-gradient(circle at 20% 25%, var(--hue-0), transparent 45%), radial-gradient(circle at 80% 75%, var(--hue-2), transparent 45%)"
  }
};

// 008: engine-owned, fully static chart styles. No interpolation — every colour
// is a CSS var already sanitized at :root, and the chart fragments themselves are
// per-value sanitized by the chart renderers. Charts inherit the deck palette via
// var(--accent)/var(--text)/var(--muted) and stay inside their card, responsive.
const CHART_CSS = `
.charts{display:grid;gap:clamp(12px,1.6vw,20px);grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}
.chart-split{display:grid;gap:clamp(20px,3vw,56px);grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:center;margin-top:clamp(10px,1.6vh,20px)}
.chart-split-media{min-width:0}
.chart-split-media .charts{grid-template-columns:1fr}
.chart-split-text{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:clamp(12px,1.8vh,22px)}
.chart-takeaway{margin:0;position:relative;padding-left:clamp(16px,1.2vw,22px);font-family:var(--font-heading);font-weight:700;font-size:clamp(20px,2vw,30px);line-height:1.4;color:var(--text);letter-spacing:-.01em}
.chart-takeaway::before{content:"";position:absolute;left:0;top:.2em;bottom:.2em;width:5px;border-radius:99px;background:var(--accent-grad)}
.chart-points{grid-template-columns:1fr!important;gap:clamp(8px,1.1vh,14px)}
.chart-points .bullet{background:none;border:none;box-shadow:none;padding:2px 0 2px clamp(20px,1.6vw,26px);font-size:var(--type-bullet);color:var(--muted);line-height:1.5}
.chart-points .bullet::before{content:"";left:0;top:.62em;transform:none;width:8px;height:8px;border-radius:3px}
/* Chart-feature slides earn more of the canvas: widen the body and scale the
   chart + takeaway up so a full-screen 16:9 slide isn't mostly negative space. */
.has-chart-split .slide-body{max-width:min(1780px,94vw)}
.has-chart-split .chart-split{gap:clamp(28px,4.5vw,96px)}
.has-chart-split .chart{padding:clamp(22px,2.2vw,40px);max-width:820px}
.has-chart-split .chart-svg{max-height:clamp(320px,42vh,520px)}
.has-chart-split .chart-pie{gap:clamp(18px,2.4vw,44px);justify-content:center}
.has-chart-split .chart-pie .chart-svg{flex:0 0 auto;width:clamp(260px,26vw,420px);max-width:clamp(260px,26vw,420px);max-height:none}
.has-chart-split .chart-legend{flex:1 1 220px}
.has-chart-split .chart-legend-item{font-size:clamp(15px,1.15vw,20px)}
.has-chart-split .chart-takeaway{font-size:clamp(26px,2.9vw,46px);line-height:1.34}
.has-chart-split .chart-points .bullet{font-size:clamp(16px,1.25vw,22px)}
@media (max-width:900px){.chart-split{grid-template-columns:1fr}.has-chart-split .slide-body{max-width:none}}
.chart{margin:0;background:var(--card-surface);border:var(--card-border);border-radius:var(--card-radius);box-shadow:var(--card-shadow);padding:clamp(14px,1.6vw,22px);min-width:0;overflow:hidden}
.chart-title{font-family:var(--font-heading);font-size:var(--type-caption);font-weight:700;color:var(--text);margin:0 0 10px}
.chart-svg{display:block;width:100%;height:auto;max-height:260px;overflow:visible}
.chart-axis{stroke:var(--muted);stroke-width:1;opacity:.4}
.chart-line{stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1 1;stroke-dashoffset:0}
.chart-svg .chart-value{fill:var(--text);font-size:11px;font-weight:700;font-family:var(--font-body)}
.chart-svg .chart-label{fill:var(--muted);font-size:10px;font-family:var(--font-body)}
.chart-pie-slice{stroke-dashoffset:0}
.chart-pie{display:flex;flex-wrap:wrap;align-items:center;gap:clamp(10px,1.4vw,20px)}
.chart-pie .chart-svg{flex:1 1 180px;max-width:240px}
.chart-legend{flex:1 1 160px;list-style:none;margin:0;padding:0;display:grid;gap:7px;min-width:0}
.chart-legend-item{display:flex;align-items:center;gap:8px;font-size:var(--type-caption);color:var(--text);min-width:0}
.chart-swatch{width:12px;height:12px;border-radius:3px;flex:0 0 auto}
.chart-legend-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chart-legend-value{color:var(--muted);font-variant-numeric:tabular-nums;flex:0 0 auto}
.chart-metric-group{display:grid;gap:clamp(10px,1.4vw,16px);grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.chart-metric{display:flex;flex-direction:column;gap:6px;padding:clamp(12px,1.4vw,18px);border-radius:calc(var(--card-radius) * .7);background:rgba(255,255,255,.5);border-left:4px solid var(--chart-accent,var(--accent))}
.chart-metric-value{font-family:var(--font-heading);font-size:clamp(26px,3vw,40px);font-weight:800;line-height:1.05;color:var(--text)}
.chart-metric-context{font-size:var(--type-caption);color:var(--muted);line-height:1.4}
.chart-table{width:100%;border-collapse:collapse;font-size:var(--type-caption)}
.chart-table th,.chart-table td{text-align:left;padding:7px 10px;border-bottom:1px solid rgba(0,0,0,.08);vertical-align:top}
.chart-table th{font-weight:600;color:var(--text)}
.chart-table td{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.chart-table-note,.chart-fallback{margin:8px 0 0;font-size:var(--type-caption);color:var(--muted);line-height:1.5}
/* 008 entrance motion — every chart's resting state is the FINISHED visual, so a
   no-JS / print / reduced-motion render shows complete charts; the keyframes only
   add a hidden "from" state, played when the slide becomes .active (and replayed
   on every revisit). The global prefers-reduced-motion guard kills them all. */
@keyframes chart-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes chart-grow{from{transform:scaleY(0)}}
@keyframes chart-sweep{from{stroke-dashoffset:var(--frac,1)}to{stroke-dashoffset:0}}
@keyframes chart-fade{from{opacity:0;transform:translateY(6px)}}
.chart-bar{transform-box:fill-box;transform-origin:bottom}
.chart-bar-neg{transform-origin:top}
.chart-value,.chart-dot{opacity:1}
.slide.active .chart-line{animation:chart-draw 1000ms ease both;animation-delay:250ms}
.slide.active .chart-bar{animation:chart-grow 650ms cubic-bezier(.2,.8,.2,1) both;animation-delay:250ms}
.slide.active .chart-pie-slice{animation:chart-sweep calc(var(--frac,1) * 1100ms) linear both;animation-delay:calc(var(--slice-start,0) * 1100ms + 200ms)}
.slide.active .chart-value,.slide.active .chart-dot{animation:chart-fade 460ms ease both;animation-delay:780ms}
@media print{.chart-line,.chart-bar,.chart-pie-slice,.chart-value,.chart-dot{animation:none !important}}
`;

// Sane animation bounds: 0ms would repaint every frame (CPU churn); an absurd
// value just looks frozen. Clamp regardless of source (LLM or DB jsonb).
const MIN_ANIMATION_MS = 500;
const MAX_ANIMATION_MS = 60000;
const DEFAULT_ANIMATION_MS = 14000;

function isTextureKey(value: unknown): value is TextureKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TEXTURE_OVERLAYS, value);
}

function isGradientPreset(value: unknown): value is GradientPreset {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(GRADIENT_ANIMATIONS, value)
  );
}

/** Renders the engine-owned `.deck::before` texture for a known enum preset, else "". */
function buildTextureOverlayCss(overlay: unknown): string {
  if (!isTextureKey(overlay)) {
    return "";
  }
  // mix-blend-mode:multiply blends the grain against the body background painted
  // below the (transparent) deck. The deck must NOT establish an isolated group
  // or the texture would have nothing local to multiply against and vanish.
  return `
.deck::before{
  content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
  background:${TEXTURE_OVERLAYS[overlay]};opacity:.55;mix-blend-mode:multiply;
}`;
}

/**
 * Renders the engine-owned animated gradient (`@keyframes` + a `.deck::after` layer
 * behind the slide content) for a known enum preset. Anchoring to `.deck::after`
 * (paired with `.deck{z-index:0}`) keeps the layer reliably below content without
 * depending on slides being transparent. The keyframes are killed by the
 * always-emitted prefers-reduced-motion guard; the duration is sanitized + clamped.
 */
function buildGradientAnimationCss(animation: unknown): string {
  if (typeof animation !== "object" || animation === null) {
    return "";
  }
  const preset = (animation as { preset?: unknown }).preset;
  if (!isGradientPreset(preset)) {
    return "";
  }
  const spec = GRADIENT_ANIMATIONS[preset];
  const rawDuration = safeNumber(
    (animation as { durationMs?: number }).durationMs as number,
    DEFAULT_ANIMATION_MS
  );
  const duration = Math.min(MAX_ANIMATION_MS, Math.max(MIN_ANIMATION_MS, rawDuration));
  return `
${spec.keyframes}
.deck::after{
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:${spec.layer};background-repeat:no-repeat;background-size:300% 300%;
  animation:deck-${preset} ${duration}ms ease-in-out infinite;
}`;
}

/** Parses a #RGB / #RRGGBB hex into [r,g,b] 0–255 channels, or null if invalid. */
function hexToChannels(hex: string): [number, number, number] | null {
  const raw = hex.replace("#", "");
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : raw.slice(0, 6);
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

/** WCAG relative luminance (0 = black, 1 = white) of a #RGB/#RRGGBB hex. */
function relativeLuminance(hex: string): number {
  const channels = hexToChannels(hex);
  if (!channels) {
    return 1;
  }
  const linear = channels.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

/** WCAG contrast ratio (1–21) between two hex colours. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The deck's effective canvas colour. The 007 palette gradients are translucent
 * accent washes over the page (white) canvas, so unless the background paints an
 * OPAQUE 6-digit hex fill we treat the canvas as white. 8-digit (#RRGGBBAA)
 * translucent stops are intentionally excluded by the trailing boundary.
 */
function resolveCanvasHex(backgroundCss: string): string {
  const opaque = backgroundCss.match(/#[0-9a-fA-F]{6}(?![0-9a-fA-F])/gu);
  return opaque && opaque.length > 0 ? opaque[opaque.length - 1]! : "#FFFFFF";
}

/** Keeps `candidate` when it meets the contrast ratio on `canvas`, else `fallback`. */
function readableOn(canvas: string, candidate: string, fallback: string, minRatio: number): string {
  return contrastRatio(candidate, canvas) >= minRatio ? candidate : fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  const channels = hexToChannels(hex);
  if (!channels) {
    return `rgba(0, 0, 0, ${safeAlpha})`;
  }
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${safeAlpha})`;
}

// Engine-owned ambient blobs (per-style opt-in). Large, soft, low-opacity radial
// circles placed in the negative space of the left-weighted layout — top-right,
// lower-right, bottom-left — coloured from the palette accent hues. Mirrors the
// ui-ux-pro-max "organic shapes / blob" background guidance.
const AMBIENT_BLOBS: ReadonlyArray<{
  readonly size: string;
  readonly pos: string;
  readonly alpha: number;
}> = [
  { size: "560px 560px", pos: "86% 14%", alpha: 0.36 },
  { size: "460px 460px", pos: "70% 82%", alpha: 0.3 },
  { size: "420px 420px", pos: "6% 90%", alpha: 0.28 }
];
// The tint holds solid to CORE% then fades to nothing by EDGE% — a defined orb
// core with a soft halo, rather than an all-the-way-out blur that reads as fog.
const BLOB_CORE_STOP = 24;
const BLOB_EDGE_STOP = 58;

/**
 * Whether a hex is "colourful" enough to wash a blob with. A near-black, near-white,
 * or greyish accent (e.g. a luxury/neutral palette whose accent is #1C1917) would
 * smear the background into a dirty grey, so we skip it and keep that area clean.
 */
function isColourfulHue(hex: string): boolean {
  const channels = hexToChannels(hex);
  if (!channels) {
    return false;
  }
  const r = channels[0] / 255;
  const g = channels[1] / 255;
  const b = channels[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return lightness >= 0.22 && lightness <= 0.9 && saturation >= 0.25;
}

/**
 * Builds the comma-separated ambient blob background layers for a known enum, else
 * "". Blobs are coloured only from the palette's *colourful* accent hues (sanitized
 * hex → rgba); a fully neutral palette yields no blobs so the background stays clean
 * rather than muddy. No attacker string can reach the value.
 */
function buildAmbientBlobs(ambient: unknown, accentHues: DesignStyleKit["accentHues"]): string {
  if (ambient !== "blobs") {
    return "";
  }
  const colourful = accentHues
    .map((hue) => safeHex(hue.base, ""))
    .filter((hex) => hex.length > 0 && isColourfulHue(hex));
  if (colourful.length === 0) {
    return "";
  }
  return AMBIENT_BLOBS.map((blob, index) => {
    const hex = colourful[index % colourful.length]!;
    const tint = hexToRgba(hex, blob.alpha);
    return `radial-gradient(${blob.size} at ${blob.pos}, ${tint} 0%, ${tint} ${BLOB_CORE_STOP}%, transparent ${BLOB_EDGE_STOP}%)`;
  }).join(", ");
}

/**
 * Builds the reference-grade, self-contained deck CSS from a DesignStyleKit.
 *
 * Every interpolated value is sanitized: the style kit and the design-system
 * palette can originate from an LLM design-planning result, so raw strings must
 * never reach the <style> block unchecked (CSS / markup injection).
 */
export function buildDeckStyleCss(styleKit: DesignStyleKit, designSystem: DesignSystem): string {
  const { typeScale, motion, effects } = styleKit;

  const primaryHex = safeHex(styleKit.accentHues[0]?.base, "#FF6B6B");
  const accent = safeHex(styleKit.accentHues[0]?.base ?? designSystem.palette.accent, primaryHex);
  const focusRing = hexToRgba(accent, 0.28);
  const stagger = safeNumber(motion.staggerStepMs, 90);

  const hueVars = styleKit.accentHues
    .map((hue, index) => {
      const base = safeHex(hue.base, "#FF6B6B");
      const gradient = safeCssValue(hue.gradient, `linear-gradient(135deg, ${base}, ${base})`);
      return `  --hue-${index}: ${base};\n  --hue-grad-${index}: ${gradient};`;
    })
    .join("\n");

  // 007 US3 B-grade tokens. Each is optional and sanitized/enum-owned before it
  // reaches the <style> block; absent tokens emit nothing.
  const baseShadow = safeCssValue(effects.cardShadow, "0 18px 44px rgba(31,41,51,.12)");
  const glow = effects.glow !== undefined ? safeCssValue(effects.glow, "") : "";
  const cardShadow = glow.length > 0 ? `${baseShadow}, ${glow}` : baseShadow;
  const backdropBlur =
    effects.cardBackdropBlurPx !== undefined ? safeNumber(effects.cardBackdropBlurPx, 12) : null;
  const backdropVar = backdropBlur !== null ? `\n  --card-backdrop-blur: ${backdropBlur}px;` : "";
  // Frosted glass belongs on the card surfaces only — not the eyebrow chip or the
  // corner nav buttons (wrong intent + Safari drops positioned ::before children
  // inside a backdrop-filter container).
  const backdropCss =
    backdropBlur !== null
      ? `\n.bullet{backdrop-filter:blur(var(--card-backdrop-blur));-webkit-backdrop-filter:blur(var(--card-backdrop-blur))}`
      : "";
  const textureCss = buildTextureOverlayCss(styleKit.background.textureOverlay);
  const animationCss = buildGradientAnimationCss(styleKit.background.gradientAnimation);

  // Ambient blobs (when on) layer *over* the base background so they read as soft
  // accent depth filling the negative space; the base wash stays underneath.
  const baseBackground = safeCssValue(
    styleKit.background.css,
    safeHex(designSystem.palette.background, "#FFF8EE")
  );
  const ambientBlobs = buildAmbientBlobs(styleKit.background.ambient, styleKit.accentHues);
  const bodyBackground =
    ambientBlobs.length > 0 ? `${ambientBlobs}, ${baseBackground}` : baseBackground;

  // Contrast safety net. The visible canvas comes from the 007 palette
  // (`styleKit.background.css`), but --text/--muted come from the design-system
  // palette — which may have been authored for the opposite light/dark mode (an
  // LLM "dark" theme paired with a light palette renders light text on a light
  // canvas, unreadable). Resolve the canvas, then keep the design-system colour
  // ONLY when it actually contrasts; otherwise fall back to a readable default.
  const canvas = resolveCanvasHex(baseBackground);
  const canvasDark = relativeLuminance(canvas) < 0.4;
  const textHex = readableOn(
    canvas,
    safeHex(designSystem.palette.text, canvasDark ? "#F8FAFC" : "#1F2937"),
    canvasDark ? "#F8FAFC" : "#1F2937",
    4.5
  );
  const mutedHex = readableOn(
    canvas,
    safeHex(designSystem.palette.mutedText, canvasDark ? "#CBD5E1" : "#475569"),
    canvasDark ? "#CBD5E1" : "#475569",
    3
  );

  return `
:root{
  --font-heading: ${safeCssValue(styleKit.fonts.heading, "system-ui, sans-serif")};
  --font-body: ${safeCssValue(styleKit.fonts.body, "system-ui, sans-serif")};
  --type-cover: ${clampFontSizeCss(typeScale.coverTitle)};
  --type-title: ${clampFontSizeCss(typeScale.slideTitle)};
  --type-message: ${clampFontSizeCss(typeScale.message)};
  --type-bullet: ${clampFontSizeCss(typeScale.bullet)};
  --type-eyebrow: ${clampFontSizeCss(typeScale.eyebrow)};
  --type-caption: ${clampFontSizeCss(typeScale.caption)};
  --text: ${textHex};
  --muted: ${mutedHex};
  --accent: ${accent};
  --accent-grad: ${safeCssValue(effects.accentGradient, "linear-gradient(110deg, #FF6B6B, #FFC93C)")};
  --card-radius: ${safeNumber(effects.cardRadiusPx, 22)}px;
  --card-border: ${safeCssValue(effects.cardBorder, "1.5px solid rgba(0,0,0,.08)")};
  --card-shadow: ${cardShadow};
  --card-surface: ${safeCssValue(effects.cardSurface, "rgba(255,255,255,.82)")};
  --focus-ring: ${focusRing};
  --t-dur: ${safeNumber(motion.slideTransitionMs, 550)}ms;
  --t-ease: ${safeCssValue(motion.slideEasing, "ease")};
  --e-dur: ${safeNumber(motion.entranceMs, 600)}ms;
  --micro: ${safeNumber(motion.microMs, 220)}ms;${backdropVar}
${hueVars}
}
*{box-sizing:border-box}
html,body{width:100%;height:100%;margin:0;overflow:hidden}
body{
  background:${bodyBackground};
  color:var(--text);
  font-family:var(--font-body);
  -webkit-font-smoothing:antialiased;
  letter-spacing:.01em;
}
.deck{position:relative;width:100vw;height:100vh;overflow:hidden;z-index:0}
.slide{
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  justify-content:flex-start;
  gap:clamp(16px,2.2vh,28px);
  padding:clamp(48px,6vw,96px) clamp(48px,6vw,96px) clamp(92px,9vh,132px);
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-gutter:stable;
  opacity:0;
  transform:translateX(40px);
  pointer-events:none;
  transition:opacity var(--t-dur) ease, transform var(--t-dur) var(--t-ease);
}
.slide.active{opacity:1;transform:none;pointer-events:auto}
.slide.prev{transform:translateX(-40px)}
.slide-body{display:flex;flex-direction:column;gap:clamp(14px,1.8vh,22px);max-width:1180px;min-height:0;margin:auto 0}
.eyebrow{
  display:inline-flex;align-items:center;gap:10px;align-self:flex-start;
  padding:7px 14px;border-radius:999px;background:rgba(255,255,255,.7);
  border:var(--card-border);color:var(--accent);
  font-size:var(--type-eyebrow);font-weight:700;letter-spacing:.06em;
}
.eyebrow .dot{width:9px;height:9px;border-radius:50%;background:var(--accent-grad);display:inline-block}
.slide-title{
  margin:0;font-family:var(--font-heading);color:var(--text);
  font-size:var(--type-title);font-weight:${safeNumber(typeScale.slideTitle.weight, 800)};
  line-height:${safeNumber(typeScale.slideTitle.lineHeight, 1.1)};letter-spacing:0;
}
.slide.cover{align-items:flex-start}
.slide.cover .slide-title{font-size:var(--type-cover);font-weight:${safeNumber(typeScale.coverTitle.weight, 800)};line-height:${safeNumber(typeScale.coverTitle.lineHeight, 1.05)}}
.message{
  margin:0;color:var(--muted);max-width:1000px;
  font-size:var(--type-message);font-weight:${safeNumber(typeScale.message.weight, 600)};
  line-height:${safeNumber(typeScale.message.lineHeight, 1.5)};
}
.bullets{list-style:none;margin:0;padding:0;display:grid;gap:clamp(10px,1.4vh,16px)}
.layout-metric-cards .bullets,.layout-matrix .bullets{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.bullet{
  position:relative;background:var(--card-surface);border:var(--card-border);
  border-radius:var(--card-radius);box-shadow:var(--card-shadow);
  padding:clamp(14px,1.8vw,22px) clamp(16px,2vw,26px) clamp(14px,1.8vw,22px) clamp(40px,3vw,52px);
  font-size:var(--type-bullet);line-height:${safeNumber(typeScale.bullet.lineHeight, 1.6)};color:var(--text);
}
.bullet::before{
  content:"";position:absolute;left:clamp(16px,1.5vw,22px);top:50%;transform:translateY(-50%);
  width:12px;height:12px;border-radius:4px;background:var(--hue-grad-0);
}
.bullet:nth-child(6n+2)::before{background:var(--hue-grad-1)}
.bullet:nth-child(6n+3)::before{background:var(--hue-grad-2)}
.bullet:nth-child(6n+4)::before{background:var(--hue-grad-3)}
.bullet:nth-child(6n+5)::before{background:var(--hue-grad-4)}
.bullet:nth-child(6n)::before{background:var(--hue-grad-5)}
.layout-closing .bullets{counter-reset:step}
.layout-closing .bullet{counter-increment:step;padding-left:clamp(58px,4vw,74px)}
.layout-closing .bullet::before{
  content:counter(step);left:clamp(18px,1.6vw,24px);top:clamp(14px,1.8vw,22px);transform:none;
  width:26px;height:26px;border-radius:50%;color:#fff;
  font-size:13px;font-weight:800;display:grid;place-items:center;
}
.controls{position:absolute;right:clamp(20px,3vw,40px);bottom:clamp(18px,2.6vh,32px);display:flex;gap:10px;z-index:30}
.btn{
  width:44px;height:44px;border-radius:50%;border:var(--card-border);
  background:rgba(255,255,255,.78);color:var(--accent);
  display:grid;place-items:center;cursor:pointer;box-shadow:var(--card-shadow);
  transition:background var(--micro) ease, color var(--micro) ease, box-shadow var(--micro) ease;
}
.btn:hover{background:var(--accent-grad);color:#fff}
.btn:focus-visible{outline:0;box-shadow:var(--card-shadow),0 0 0 4px var(--focus-ring)}
.btn svg{width:22px;height:22px}
.progress{position:absolute;top:0;left:0;height:6px;width:0;background:var(--accent-grad);transition:width var(--t-dur) ease;z-index:30}
.sidedots{position:absolute;left:clamp(16px,2vw,28px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:9px;z-index:30}
.sidedots button{width:9px;height:9px;border-radius:50%;border:0;padding:0;background:rgba(31,41,51,.18);cursor:pointer;transition:background var(--micro) ease,transform var(--micro) ease}
.sidedots button.on{background:var(--accent-grad);transform:scale(1.35)}
.anim{opacity:0;transform:translateY(14px)}
.slide.active .anim{animation:rise var(--e-dur) ease both;animation-delay:calc(var(--d, 0) * ${stagger}ms)}
@keyframes rise{to{opacity:1;transform:none}}${backdropCss}${textureCss}${animationCss}${CHART_CSS}
@media (max-width:640px){.controls{right:16px;bottom:16px}.sidedots{display:none}}
@media (prefers-reduced-motion: reduce){
  *{animation:none !important;transition:none !important}
  .slide{opacity:1;transform:none}
  .anim{opacity:1;transform:none}
}
`.trim();
}
