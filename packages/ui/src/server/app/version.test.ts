import { afterEach, describe, expect, it, vi } from "vitest";
import { createVersionInfoProvider } from "./version.js";

const originalVersion = process.env.OPENGOAT_VERSION;

afterEach(() => {
  if (originalVersion === undefined) {
    delete process.env.OPENGOAT_VERSION;
  } else {
    process.env.OPENGOAT_VERSION = originalVersion;
  }
  vi.restoreAllMocks();
});

describe("createVersionInfoProvider", () => {
  it("marks update-available when a newer npm release exists", async () => {
    process.env.OPENGOAT_VERSION = "2026.2.9";
    mockVersionFetch({
      npmLatest: "2026.2.10",
    });

    const getVersionInfo = createVersionInfoProvider();
    const info = await getVersionInfo();

    expect(info.status).toBe("update-available");
    expect(info.latestVersion).toBe("2026.2.10");
    expect(info.latestSource).toBe("npm");
    expect(info.updateAvailable).toBe(true);
  });

  it("falls back to GitHub tags when npm release is unavailable", async () => {
    process.env.OPENGOAT_VERSION = "2026.2.10";
    mockVersionFetch({
      npmNotFound: true,
      githubReleaseNotFound: true,
      githubTagLatest: "v2026.2.10",
    });

    const getVersionInfo = createVersionInfoProvider();
    const info = await getVersionInfo();

    expect(info.status).toBe("latest");
    expect(info.latestVersion).toBe("2026.2.10");
    expect(info.latestSource).toBe("github-tag");
    expect(info.updateAvailable).toBe(false);
  });

  it("marks local builds newer than released versions as ahead", async () => {
    process.env.OPENGOAT_VERSION = "2026.2.16";
    mockVersionFetch({
      npmLatest: "2026.2.15",
      githubReleaseLatest: "v2026.2.15",
      githubTagLatest: "v2026.2.15",
    });

    const getVersionInfo = createVersionInfoProvider();
    const info = await getVersionInfo();

    expect(info.status).toBe("ahead");
    expect(info.latestVersion).toBe("2026.2.15");
    expect(info.updateAvailable).toBe(false);
  });
});

function mockVersionFetch(options: {
  npmLatest?: string;
  npmNotFound?: boolean;
  githubReleaseLatest?: string;
  githubReleaseNotFound?: boolean;
  githubTagLatest?: string;
  githubTagNotFound?: boolean;
}): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("registry.npmjs.org")) {
      if (options.npmNotFound) {
        return new Response("not found", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          version: options.npmLatest ?? "2026.2.10",
        }),
        { status: 200 },
      );
    }

    if (url.includes("/releases/latest")) {
      if (options.githubReleaseNotFound) {
        return new Response("not found", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          tag_name: options.githubReleaseLatest ?? "v2026.2.10",
        }),
        { status: 200 },
      );
    }

    if (url.includes("/tags?per_page=1")) {
      if (options.githubTagNotFound) {
        return new Response("not found", { status: 404 });
      }
      return new Response(
        JSON.stringify([
          {
            name: options.githubTagLatest ?? "v2026.2.10",
          },
        ]),
        { status: 200 },
      );
    }

    return new Response("unexpected url", { status: 500 });
  });
}
