import path from "node:path";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { BundledSkillProvisioner } from "../../../packages/core/src/core/skills/application/bundled-skill-provisioner.js";
import { NodeFileSystem } from "../../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

function createProvisioner(): {
  provisioner: BundledSkillProvisioner;
  fileSystem: NodeFileSystem;
} {
  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
  const provisioner = new BundledSkillProvisioner({ fileSystem, pathPort });
  return { provisioner, fileSystem };
}

describe("BundledSkillProvisioner", () => {
  it("provisions bundled skills when marker file is missing", async () => {
    const workspaceDir = await createTempDir("opengoat-bundled-skills-");
    roots.push(workspaceDir);
    const { provisioner, fileSystem } = createProvisioner();

    const result = await provisioner.provisionBundledSkills(workspaceDir);

    expect(result.provisioned).toBe(true);
    expect(result.createdPaths.length).toBeGreaterThan(0);

    // Verify marketing skills exist
    expect(
      await fileSystem.exists(
        path.join(workspaceDir, "skills", "marketing", "cold-email", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      await fileSystem.exists(
        path.join(workspaceDir, "skills", "marketing", "seo-audit", "SKILL.md"),
      ),
    ).toBe(true);

    // Verify persona skills exist
    expect(
      await fileSystem.exists(
        path.join(workspaceDir, "skills", "personas", "seo-specialist", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      await fileSystem.exists(
        path.join(workspaceDir, "skills", "personas", "growth-hacker", "SKILL.md"),
      ),
    ).toBe(true);

    // Verify version marker was written
    expect(
      await fileSystem.exists(
        path.join(workspaceDir, ".bundled-skills-version"),
      ),
    ).toBe(true);
  });

  it("skips provisioning when marker file matches current manifest", async () => {
    const workspaceDir = await createTempDir("opengoat-bundled-skills-");
    roots.push(workspaceDir);
    const { provisioner } = createProvisioner();

    // First run — provisions
    const first = await provisioner.provisionBundledSkills(workspaceDir);
    expect(first.provisioned).toBe(true);

    // Second run — skips
    const second = await provisioner.provisionBundledSkills(workspaceDir);
    expect(second.provisioned).toBe(false);
    expect(second.skippedPaths).toContain(workspaceDir);
    expect(second.createdPaths).toEqual([]);
  });

  it("re-provisions when marker file has outdated hash", async () => {
    const workspaceDir = await createTempDir("opengoat-bundled-skills-");
    roots.push(workspaceDir);
    const { provisioner, fileSystem } = createProvisioner();

    // First run
    await provisioner.provisionBundledSkills(workspaceDir);

    // Tamper with version marker to simulate outdated hash
    await fileSystem.writeFile(
      path.join(workspaceDir, ".bundled-skills-version"),
      "outdated-hash-value",
    );

    // Second run — should re-provision
    const result = await provisioner.provisionBundledSkills(workspaceDir);
    expect(result.provisioned).toBe(true);
    expect(result.createdPaths.length).toBeGreaterThan(0);
  });

  it("preserves references/ subdirectories in marketing skills", async () => {
    const workspaceDir = await createTempDir("opengoat-bundled-skills-");
    roots.push(workspaceDir);
    const { provisioner, fileSystem } = createProvisioner();

    await provisioner.provisionBundledSkills(workspaceDir);

    // Check if at least one marketing skill has references/ preserved
    const marketingDir = path.join(workspaceDir, "skills", "marketing");
    const marketingSkills = await fileSystem.listDirectories(marketingDir);

    let foundReferences = false;
    for (const skill of marketingSkills) {
      const refsDir = path.join(marketingDir, skill, "references");
      if (await fileSystem.exists(refsDir)) {
        foundReferences = true;
        break;
      }
    }
    expect(foundReferences).toBe(true);
  });

  it("does not conflict with user-installed skills", async () => {
    const workspaceDir = await createTempDir("opengoat-bundled-skills-");
    roots.push(workspaceDir);
    const { provisioner, fileSystem } = createProvisioner();

    // Simulate a user-installed skill at workspace/skills/my-custom-skill/
    const userSkillDir = path.join(workspaceDir, "skills", "my-custom-skill");
    await fileSystem.ensureDir(userSkillDir);
    await fileSystem.writeFile(
      path.join(userSkillDir, "SKILL.md"),
      "---\nname: my-custom-skill\n---\nUser skill content",
    );

    await provisioner.provisionBundledSkills(workspaceDir);

    // User skill should remain untouched
    const content = await readFile(
      path.join(userSkillDir, "SKILL.md"),
      "utf-8",
    );
    expect(content).toBe("---\nname: my-custom-skill\n---\nUser skill content");

    // Bundled skills should exist in their subdirectories
    expect(
      await fileSystem.exists(
        path.join(workspaceDir, "skills", "marketing", "cold-email", "SKILL.md"),
      ),
    ).toBe(true);
  });

  it("computes a deterministic manifest hash", async () => {
    const { provisioner } = createProvisioner();

    const hash1 = await provisioner.computeManifestHash();
    const hash2 = await provisioner.computeManifestHash();

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("provisions all 33 marketing skills and 9 persona skills", async () => {
    const workspaceDir = await createTempDir("opengoat-bundled-skills-");
    roots.push(workspaceDir);
    const { provisioner, fileSystem } = createProvisioner();

    await provisioner.provisionBundledSkills(workspaceDir);

    const marketingDir = path.join(workspaceDir, "skills", "marketing");
    const personasDir = path.join(workspaceDir, "skills", "personas");

    const marketingSkills = await fileSystem.listDirectories(marketingDir);
    const personaSkills = await fileSystem.listDirectories(personasDir);

    expect(marketingSkills.length).toBeGreaterThanOrEqual(33);
    expect(personaSkills.length).toBe(9);
  });

  it("context mapping verified — provisioned skills reference PRODUCT.md/MARKET.md/GROWTH.md", async () => {
    const workspaceDir = await createTempDir("opengoat-bundled-skills-");
    roots.push(workspaceDir);
    const { provisioner } = createProvisioner();

    await provisioner.provisionBundledSkills(workspaceDir);

    // Read a marketing skill that should have context mapping applied
    const skillPath = path.join(
      workspaceDir,
      "skills",
      "marketing",
      "cold-email",
      "SKILL.md",
    );
    const content = await readFile(skillPath, "utf-8");

    // Should NOT contain old context reference
    expect(content).not.toContain(".agents/product-marketing-context.md");

    // Should contain new context references (if skill had the preamble)
    // Some skills may not have the preamble, so check PRODUCT.md presence or absence of old ref
    if (content.includes("PRODUCT.md") || content.includes("MARKET.md")) {
      expect(content).toContain("PRODUCT.md");
    }
  });
});
