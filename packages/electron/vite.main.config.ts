import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

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
      "@opengoat/core": path.resolve(currentDir, "../../src/index.ts")
    }
  },
  build: {
    rollupOptions: {
      external: externals
    }
  }
});
