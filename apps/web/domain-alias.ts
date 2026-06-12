import { fileURLToPath, URL } from "node:url";

/**
 * 010 (T002 / R1): resolve the shared domain + contracts packages (TS source, no
 * build step) AND their internal `@/<subdir>` imports so the client can bundle the
 * SAME deterministic renderer the server uses (LivePreview parity, FR-005a). The
 * domain package was verified to have zero Node-only deps, so importing its barrel
 * in the browser is safe. The web app's own `@` alias (→ src) must be applied AFTER
 * these (it would otherwise swallow `@/rendering` etc.), so callers spread this
 * first and add `"@"` last.
 */
const DOMAIN_SUBDIRS = [
  "auth",
  "content-core",
  "deck-edit",
  "deck-persistence",
  "deck",
  "design",
  "preview-job",
  "pptx-export-job",
  "rendering",
  "review",
  "shared"
];

const domainSrc = (path: string): string =>
  fileURLToPath(new URL(`../../packages/domain/src/${path}`, import.meta.url));

const contractsSrc = (path: string): string =>
  fileURLToPath(new URL(`../../packages/contracts/src/${path}`, import.meta.url));

export function sharedPackageAliases(): Record<string, string> {
  const subdirAliases = Object.fromEntries(
    DOMAIN_SUBDIRS.map((dir) => [`@/${dir}`, domainSrc(dir)])
  );
  return {
    "@slides-agent/domain": domainSrc("index.ts"),
    "@slides-agent/contracts": contractsSrc("index.ts"),
    ...subdirAliases
  };
}
