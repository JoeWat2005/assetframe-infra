import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Test-only configuration. Next.js builds do not read this file (the production
// bundle is governed by next.config.ts); it exists purely so Vitest can resolve the
// "@/..." path alias used across the app the same way tsconfig + the Next plugin do,
// which lets component/a11y tests import real components (Header, forms) rather than
// stubbing their entire dependency tree. JSX is handled by esbuild (no extra plugin).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    globals: false,
    // Default to node; files needing the DOM opt in with `// @vitest-environment jsdom`,
    // matching the existing test suite's convention.
    environment: "node",
  },
});
