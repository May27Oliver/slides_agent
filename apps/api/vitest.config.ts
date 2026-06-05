import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/auth": fileURLToPath(new URL("../../packages/domain/src/auth", import.meta.url)),
      "@/adapters": fileURLToPath(new URL("./src/adapters", import.meta.url)),
      "@/config": fileURLToPath(new URL("./src/config", import.meta.url)),
      "@/modules": fileURLToPath(new URL("./src/modules", import.meta.url)),
      "@/content-core": fileURLToPath(
        new URL("../../packages/domain/src/content-core", import.meta.url)
      ),
      "@/deck": fileURLToPath(new URL("../../packages/domain/src/deck", import.meta.url)),
      "@/design": fileURLToPath(new URL("../../packages/domain/src/design", import.meta.url)),
      "@/preview-job": fileURLToPath(
        new URL("../../packages/domain/src/preview-job", import.meta.url)
      ),
      "@/rendering": fileURLToPath(new URL("../../packages/domain/src/rendering", import.meta.url)),
      "@/review": fileURLToPath(new URL("../../packages/domain/src/review", import.meta.url)),
      "@/shared": fileURLToPath(new URL("../../packages/domain/src/shared", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@slides-agent/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url)
      ),
      "@slides-agent/domain": fileURLToPath(
        new URL("../../packages/domain/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    environment: "node"
  }
});
