import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;
const hmr = host
  ? {
      protocol: "ws" as const,
      host,
      port: 1431,
    }
  : undefined;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("radix-ui")) {
            return "radix";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1430,
    strictPort: true,
    host: host ?? false,
    ...(hmr ? { hmr } : {}),
    ...(!host && {
      proxy: {
        "/agents": { target: "http://127.0.0.1:19749", changeOrigin: true },
        "/chat": { target: "http://127.0.0.1:19749", changeOrigin: true },
        "/auth": { target: "http://127.0.0.1:19749", changeOrigin: true },
        "/global": { target: "http://127.0.0.1:19749", changeOrigin: true },
        "/tasks": { target: "http://127.0.0.1:19749", changeOrigin: true },
      },
    }),
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
});
