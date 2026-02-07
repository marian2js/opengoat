import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootModules = path.resolve(currentDir, "../../node_modules");
const reactRoot = path.resolve(rootModules, "react");
const reactDomRoot = path.resolve(rootModules, "react-dom");

export default defineConfig({
  root: path.resolve(currentDir, "src/renderer"),
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      react: reactRoot,
      "react-dom": reactDomRoot,
      "@main": path.resolve(currentDir, "src/main"),
      "@renderer": path.resolve(currentDir, "src/renderer/src"),
      "@shared": path.resolve(currentDir, "src/shared"),
      "@trpc/server": path.resolve(rootModules, "@trpc/server"),
      "@trpc/client": path.resolve(rootModules, "@trpc/client")
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@ai-sdk/react", "ai"]
  },
  build: {
    outDir: ".vite/renderer"
  }
});
