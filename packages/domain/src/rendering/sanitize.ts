/**
 * Shared, per-value sanitizers for the 008 chart renderers. Every string that
 * can originate from an LLM/DB/source fact must pass through these before it
 * reaches an SVG/HTML fragment, so a payload can never escape `<svg>`/`<style>`
 * or inject markup, event handlers, or external resources.
 */

const HEX_PATTERN = /^#[0-9a-fA-F]{3,8}$/u;

/** Default accent hue when a palette hue is missing or unsafe. */
export const FALLBACK_HUE = "#FF6B6B";

/** Returns a finite number, else the fallback. */
export function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Returns a number formatted with fixed precision for compact, stable SVG. */
export function svgCoord(value: number, fallback = 0): string {
  return safeNumber(value, fallback).toFixed(2);
}

/** Returns the value only if it is a safe hex colour, else the fallback. */
export function safeHex(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return HEX_PATTERN.test(trimmed) ? trimmed : fallback;
}

/** Escapes text for safe interpolation into HTML/SVG text nodes and attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

/** Escapes and collapses whitespace for use inside an HTML attribute. */
export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\s+/gu, " ").trim();
}
