import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("NodeFileSystem", () => {
  it("can ensure directories and read/write files", async () => {
    const root = await createTempDir("opengoat-fs-");
    roots.push(root);

    const fs = new NodeFileSystem();
    const nested = path.join(root, "a", "b");
    const file = path.join(nested, "note.md");

    await fs.ensureDir(nested);
    expect(await fs.exists(nested)).toBe(true);

    await fs.writeFile(file, "hello\n");
    expect(await fs.exists(file)).toBe(true);
    expect(await fs.readFile(file)).toBe("hello\n");
  });

  it("lists only directories and tolerates missing paths", async () => {
    const root = await createTempDir("opengoat-fs-");
    roots.push(root);

    const fs = new NodeFileSystem();
    const parent = path.join(root, "parent");

    await fs.ensureDir(path.join(parent, "alpha"));
    await fs.ensureDir(path.join(parent, "beta"));
    await fs.writeFile(path.join(parent, "README.md"), "text\n");

    const dirs = await fs.listDirectories(parent);
    expect(dirs.sort()).toEqual(["alpha", "beta"]);
    const entries = await fs.listEntries(parent);
    expect(entries.sort()).toEqual(["README.md", "alpha", "beta"]);

    expect(await fs.listDirectories(path.join(root, "missing"))).toEqual([]);
    expect(await fs.listEntries(path.join(root, "missing"))).toEqual([]);
  });

  it("creates and resolves symbolic links", async () => {
    const root = await createTempDir("opengoat-fs-");
    roots.push(root);

    const fs = new NodeFileSystem();
    const targetDir = path.join(root, "target");
    const linkPath = path.join(root, "link");
    const plainFile = path.join(root, "plain.txt");

    await fs.ensureDir(targetDir);
    await fs.writeFile(plainFile, "content\n");
    await fs.createSymbolicLink(targetDir, linkPath);

    expect(
      path.resolve(path.dirname(linkPath), (await fs.readSymbolicLink(linkPath)) ?? ""),
    ).toBe(path.resolve(targetDir));
    expect(await fs.readSymbolicLink(path.join(root, "missing-link"))).toBe(
      null,
    );
    expect(await fs.readSymbolicLink(plainFile)).toBe(null);
  });
});
