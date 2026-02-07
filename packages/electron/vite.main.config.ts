import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootModules = path.resolve(currentDir, "../../node_modules");

const externals = [
  "electron",
  "electron-squirrel-startup",
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`)
];

export default defineConfig({
  resolve: {
    alias: {
      "@main": path.resolve(currentDir, "src/main"),
      "@shared": path.resolve(currentDir, "src/shared"),
      "@cli/onboard-guided-auth": path.resolve(
        currentDir,
        "../cli/src/cli/commands/onboard-guided-auth.ts"
      ),
      "@opengoat/core": path.resolve(currentDir, "../core/src/index.ts"),
      "@trpc/server": path.resolve(rootModules, "@trpc/server"),
      "@trpc/client": path.resolve(rootModules, "@trpc/client")
    }
  },
  build: {
    lib: {
      entry: path.resolve(currentDir, "src/main/main.ts"),
      fileName: () => "main.cjs",
      formats: ["cjs"]
    },
    rollupOptions: {
      external: externals
    }
  }
});
