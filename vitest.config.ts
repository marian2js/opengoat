import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@cli/onboard-guided-auth": path.resolve(
        __dirname,
        "packages/cli/src/cli/commands/onboard-guided-auth.ts"
      ),
      "@opengoat/core": path.resolve(__dirname, "packages/core/src/index.ts")
    }
  },
  test: {
    testTimeout: 20000,
    include: ["test/**/*.test.ts", "packages/**/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/**/src/**/*.ts"],
      exclude: ["packages/cli/src/**/*.ts"]
    }
  }
});
