import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@framezero/schema": fileURLToPath(new URL("../../packages/framezero-schema/src/index.ts", import.meta.url)),
      "@framezero/compiler": fileURLToPath(new URL("../../packages/framezero-compiler/src/index.ts", import.meta.url)),
      "@framezero/fixtures": fileURLToPath(new URL("../../packages/framezero-fixtures/src/index.ts", import.meta.url))
    }
  },
  server: {
    port: 5173
  }
});
