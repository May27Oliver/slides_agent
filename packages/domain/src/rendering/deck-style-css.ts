import { clampFontSizeCss } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import type { DesignSystem } from "@/design/design.types";

const HEX_PATTERN = /^#[0-9a-fA-F]{3,8}$/u;
// A legitimate CSS *value* never needs these. They are exactly what a breakout
// payload uses to escape the declaration / <style> context or load resources.
const UNSAFE_CSS_VALUE = /[;{}<>\\@]|url\(|\/\*|\*\/|expression\(|\r|\n/iu;

/** Returns the value only if it is a safe hex colour, else the fallback. */
function safeHex(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return HEX_PATTERN.test(trimmed) ? trimmed : fallback;
}

/** Returns the value only if it has no CSS-injection characters, else fallback. */
function safeCssValue(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.length > 0 && !UNSAFE_CSS_VALUE.test(value)
    ? value
    : fallback;
}

/** Coerces to a finite number, else returns the fallback. */
function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

// 007 US3 — built-in B-grade overlays. These are ENGINE-OWNED static CSS keyed by
// a closed enum: a tampered kit can only select a preset (or none), never inject
// its own CSS. The renderer guards the lookup with hasOwnProperty so prototype
// keys (e.g. "toString") cannot resolve to inherited members (DR-008).
const TEXTURE_OVERLAYS: Record<string, string> = {
  grain: "repeating-radial-gradient(circle at 0 0, rgba(0,0,0,.05) 0 1px, transparent 1px 3px)",
  noise: "repeating-conic-gradient(rgba(0,0,0,.035) 0% 25%, transparent 0% 50%)",
  paper: "repeating-linear-gradient(45deg, rgba(0,0,0,.03) 0 2px, transparent 2px 5px)"
};

const GRADIENT_ANIMATIONS: Record<string, { readonly keyframes: string; readonly layer: string }> =
  {
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

/** Renders the engine-owned `.deck::before` texture for a known enum preset, else "". */
function buildTextureOverlayCss(overlay: unknown): string {
  if (
    typeof overlay !== "string" ||
    !Object.prototype.hasOwnProperty.call(TEXTURE_OVERLAYS, overlay)
  ) {
    return "";
  }
  return `
.deck::before{
  content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
  background:${TEXTURE_OVERLAYS[overlay]};opacity:.55;mix-blend-mode:multiply;
}`;
}

/**
 * Renders the engine-owned animated gradient (`@keyframes` + a fixed `body::before`
 * layer behind content) for a known enum preset. The keyframes are killed by the
 * always-emitted prefers-reduced-motion guard; the duration is sanitized.
 */
function buildGradientAnimationCss(animation: unknown): string {
  if (typeof animation !== "object" || animation === null) {
    return "";
  }
  const preset = (animation as { preset?: unknown }).preset;
  if (
    typeof preset !== "string" ||
    !Object.prototype.hasOwnProperty.call(GRADIENT_ANIMATIONS, preset)
  ) {
    return "";
  }
  const spec = GRADIENT_ANIMATIONS[preset];
  if (spec === undefined) {
    return "";
  }
  const duration = safeNumber((animation as { durationMs?: number }).durationMs as number, 14000);
  return `
${spec.keyframes}
body::before{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:${spec.layer};background-size:300% 300%;
  animation:deck-${preset} ${duration}ms ease-in-out infinite;
}`;
}

function hexToRgba(hex: string, alpha: number): string {
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
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
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
  const backdropCss =
    backdropBlur !== null
      ? `\n.bullet,.eyebrow,.btn{backdrop-filter:blur(var(--card-backdrop-blur));-webkit-backdrop-filter:blur(var(--card-backdrop-blur))}`
      : "";
  const textureCss = buildTextureOverlayCss(styleKit.background.textureOverlay);
  const animationCss = buildGradientAnimationCss(styleKit.background.gradientAnimation);

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
  --bg: ${safeHex(designSystem.palette.background, "#FFF8EE")};
  --text: ${safeHex(designSystem.palette.text, "#1F2937")};
  --muted: ${safeHex(designSystem.palette.mutedText, "#475569")};
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
  background:${safeCssValue(styleKit.background.css, safeHex(designSystem.palette.background, "#FFF8EE"))};
  color:var(--text);
  font-family:var(--font-body);
  -webkit-font-smoothing:antialiased;
  letter-spacing:.01em;
}
.deck{position:relative;width:100vw;height:100vh;overflow:hidden}
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
@keyframes rise{to{opacity:1;transform:none}}${backdropCss}${textureCss}${animationCss}
@media (max-width:640px){.controls{right:16px;bottom:16px}.sidedots{display:none}}
@media (prefers-reduced-motion: reduce){
  *{animation:none !important;transition:none !important}
  .slide{opacity:1;transform:none}
  .anim{opacity:1;transform:none}
}
`.trim();
}
