import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.eval.ts", "**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    testTimeout: 120000, // 2 minutes timeout per test
  },
});
