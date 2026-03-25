import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const viteConfigSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/vite.config.ts"),
  "utf-8",
);

describe("Vite proxy config includes /messaging route", () => {
  it("has a /messaging proxy entry", () => {
    expect(viteConfigSrc).toContain('"/messaging"');
  });

  it("proxies /messaging to the sidecar at 127.0.0.1:19749", () => {
    expect(viteConfigSrc).toMatch(
      /["']\/messaging["']\s*:\s*\{[^}]*target\s*:\s*["']http:\/\/127\.0\.0\.1:19749["']/,
    );
  });

  it("sets changeOrigin: true for /messaging proxy", () => {
    const messagingProxyMatch = viteConfigSrc.match(
      /["']\/messaging["']\s*:\s*\{([^}]*)\}/,
    );
    expect(messagingProxyMatch).not.toBeNull();
    expect(messagingProxyMatch![1]).toContain("changeOrigin: true");
  });
});
