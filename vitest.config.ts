import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Source files intentionally self-reference the public FAQ subpath so the
    // production bundle preserves its separate Client Component boundary.
    // During tests, dist/ does not exist yet, so resolve that subpath to source.
    alias: {
      "@rankworker/nextjs-blog/faq": fileURLToPath(
        new URL("./src/ui/faq.tsx", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/cli/index.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
