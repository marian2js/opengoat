import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@opengoat/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@main": path.resolve(__dirname, "packages/electron/src/main"),
      "@renderer": path.resolve(__dirname, "packages/electron/src/renderer/src"),
      "@shared": path.resolve(__dirname, "packages/electron/src/shared")
    }
  },
  test: {
    include: ["test/**/*.test.ts", "packages/**/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/**/src/**/*.ts"],
      exclude: ["packages/cli/src/**/*.ts", "packages/electron/src/**/*.ts", "packages/electron/src/**/*.tsx"]
    }
  }
});
