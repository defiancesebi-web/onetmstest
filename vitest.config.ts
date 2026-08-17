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
    // The suite talks to a remote Neon Postgres instance, not a local one.
    // Vitest's 5s test / 10s hook defaults are tuned for local databases and
    // flake under normal network latency or pool contention (P2024/P2028),
    // making an infra hiccup look like a test failure. Raise both so a slow
    // round-trip has room to finish instead of timing out.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
