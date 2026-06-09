import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { sharedPackageAliases } from "./domain-alias";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // See vite.config.ts — same shared-package resolution for tests (010 T002).
      ...sharedPackageAliases(),
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"]
  }
});
