import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Pipeline tests write corpus files to a temp dir; keep them fast and isolated.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
