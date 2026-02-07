import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "[name].cjs",
        chunkFileNames: "[name].cjs",
        assetFileNames: "[name].[ext]"
      }
    }
  }
});
