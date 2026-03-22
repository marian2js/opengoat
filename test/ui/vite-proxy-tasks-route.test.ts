import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const viteConfigSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/vite.config.ts"),
  "utf-8",
);

describe("Vite proxy config includes /tasks route", () => {
  it("has a /tasks proxy entry", () => {
    expect(viteConfigSrc).toContain('"/tasks"');
  });

  it("proxies /tasks to the sidecar at 127.0.0.1:19749", () => {
    // Match the proxy rule pattern: "/tasks": { target: "http://127.0.0.1:19749"
    expect(viteConfigSrc).toMatch(
      /["']\/tasks["']\s*:\s*\{[^}]*target\s*:\s*["']http:\/\/127\.0\.0\.1:19749["']/,
    );
  });

  it("sets changeOrigin: true for /tasks proxy", () => {
    // Extract the /tasks proxy block and verify changeOrigin
    const tasksProxyMatch = viteConfigSrc.match(
      /["']\/tasks["']\s*:\s*\{([^}]*)\}/,
    );
    expect(tasksProxyMatch).not.toBeNull();
    expect(tasksProxyMatch![1]).toContain("changeOrigin: true");
  });
});
