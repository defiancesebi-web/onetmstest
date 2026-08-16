import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    // Test files share one real Postgres database with no per-test isolation
    // (beforeEach truncates shared tables) — must run sequentially, not in
    // parallel workers, or concurrent files stomp on each other's data.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
