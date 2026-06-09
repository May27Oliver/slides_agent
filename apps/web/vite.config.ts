import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { sharedPackageAliases } from "./domain-alias";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Domain/contracts (+ their internal @/<subdir>) first, so the `@` catch-all
      // below does not swallow `@/rendering` etc. (010 T002 — LivePreview parity).
      ...sharedPackageAliases(),
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
