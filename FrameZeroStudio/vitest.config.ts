import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@framezero/schema": fileURLToPath(new URL("./packages/framezero-schema/src/index.ts", import.meta.url)),
      "@framezero/compiler": fileURLToPath(new URL("./packages/framezero-compiler/src/index.ts", import.meta.url)),
      "@framezero/fixtures": fileURLToPath(new URL("./packages/framezero-fixtures/src/index.ts", import.meta.url))
    }
  }
});
