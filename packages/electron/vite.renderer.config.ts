import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(currentDir, "src/renderer"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@main": path.resolve(currentDir, "src/main"),
      "@renderer": path.resolve(currentDir, "src/renderer/src"),
      "@shared": path.resolve(currentDir, "src/shared")
    }
  },
  build: {
    outDir: ".vite/renderer"
  }
});
