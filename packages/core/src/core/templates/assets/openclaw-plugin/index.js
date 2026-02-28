"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_MAX_READ_BYTES = 200_000;
const MAX_READ_BYTES_LIMIT = 1_000_000;

module.exports = function register(api) {
  api.registerTool((ctx) => createReadTool(api, ctx));
  api.registerTool((ctx) => createWriteTool(api, ctx));
  api.registerTool((ctx) => createEditTool(api, ctx));
};

function createReadTool(api, ctx) {
  return {
    name: "opengoat_read",
    description:
      "Read UTF-8 files/directories inside ~/.opengoat (or OPENGOAT_HOME override).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string" },
        maxBytes: {
          type: "integer",
          minimum: 1,
          maximum: MAX_READ_BYTES_LIMIT,
        },
      },
      required: ["path"],
    },
    async execute(_toolCallId, params) {
      const policy = await resolvePolicy(api, ctx);
      const requestedPath = resolveRequestedPath(
        readRequiredString(params, "path"),
        policy.workspaceRoot,
      );
      const canonicalPath = await assertReadablePath(policy, requestedPath);
      const fileStat = await fs.stat(canonicalPath);

      if (fileStat.isDirectory()) {
        const entries = await fs.readdir(canonicalPath, { withFileTypes: true });
        const lines = entries
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
        return textResult(
          [`Directory: ${canonicalPath}`, ...lines].join("\n") || `Directory: ${canonicalPath}`,
        );
      }

      const maxBytes = readOptionalPositiveInteger(params, "maxBytes") ?? DEFAULT_MAX_READ_BYTES;
      const content = await fs.readFile(canonicalPath, "utf8");
      const bytes = Buffer.byteLength(content, "utf8");
      if (bytes <= maxBytes) {
        return textResult(content);
      }

      const truncated = Buffer.from(content, "utf8").subarray(0, maxBytes).toString("utf8");
      return textResult(
        `${truncated}\n\n[Truncated to ${maxBytes} bytes from ${bytes} bytes.]`,
      );
    },
  };
}

function createWriteTool(api, ctx) {
  return {
    name: "opengoat_write",
    description:
      "Write UTF-8 files inside ~/.opengoat/organization and inside the current agent workspace.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        append: { type: "boolean" },
        createParents: { type: "boolean" },
      },
      required: ["path", "content"],
    },
    async execute(_toolCallId, params) {
      const policy = await resolvePolicy(api, ctx);
      const requestedPath = resolveRequestedPath(
        readRequiredString(params, "path"),
        policy.workspaceRoot,
      );
      const canonicalPath = await assertWritablePath(policy, requestedPath);
      const append = readOptionalBoolean(params, "append") ?? false;
      const createParents = readOptionalBoolean(params, "createParents") ?? true;
      const content = readRequiredString(params, "content");

      const parentDir = path.dirname(canonicalPath);
      if (createParents) {
        await fs.mkdir(parentDir, { recursive: true });
      } else {
        await fs.access(parentDir);
      }

      if (append) {
        await fs.appendFile(canonicalPath, content, "utf8");
      } else {
        await fs.writeFile(canonicalPath, content, "utf8");
      }

      return textResult(
        `${append ? "Appended" : "Wrote"} ${Buffer.byteLength(content, "utf8")} bytes to ${canonicalPath}`,
      );
    },
  };
}

function createEditTool(api, ctx) {
  return {
    name: "opengoat_edit",
    description:
      "Edit UTF-8 files inside ~/.opengoat/organization and inside the current agent workspace.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string" },
        oldText: { type: "string" },
        newText: { type: "string" },
        replaceAll: { type: "boolean" },
      },
      required: ["path", "oldText", "newText"],
    },
    async execute(_toolCallId, params) {
      const policy = await resolvePolicy(api, ctx);
      const requestedPath = resolveRequestedPath(
        readRequiredString(params, "path"),
        policy.workspaceRoot,
      );
      const canonicalPath = await assertWritablePath(policy, requestedPath);
      const oldText = readRequiredString(params, "oldText");
      if (oldText.length === 0) {
        throw new Error("oldText must not be empty.");
      }
      const newText = readRequiredString(params, "newText");
      const replaceAll = readOptionalBoolean(params, "replaceAll") ?? false;

      const original = await fs.readFile(canonicalPath, "utf8");
      const replacementCount = countOccurrences(original, oldText);
      if (replacementCount === 0) {
        throw new Error(`No match found in ${canonicalPath}.`);
      }

      const replaced = replaceAll
        ? original.split(oldText).join(newText)
        : original.replace(oldText, newText);

      await fs.writeFile(canonicalPath, replaced, "utf8");
      return textResult(
        replaceAll
          ? `Replaced ${replacementCount} occurrence(s) in ${canonicalPath}`
          : `Replaced 1 occurrence in ${canonicalPath}`,
      );
    },
  };
}

function textResult(text) {
  return {
    content: [{ type: "text", text }],
  };
}

async function resolvePolicy(api, ctx) {
  const pluginConfig = asRecord(api.pluginConfig);
  const configuredHome = readOptionalString(pluginConfig.opengoatHomeDir);
  const opengoatHome = path.resolve(
    expandTilde(configuredHome || process.env.OPENGOAT_HOME || path.join(os.homedir(), ".opengoat")),
  );
  const organizationRoot = await canonicalizeExistingPath(path.join(opengoatHome, "organization"));
  const workspaceRoot = readOptionalString(ctx.workspaceDir)
    ? await canonicalizeExistingPath(path.resolve(String(ctx.workspaceDir)))
    : null;

  return {
    opengoatReadRoot: await canonicalizeExistingPath(opengoatHome),
    organizationRoot,
    workspaceRoot,
  };
}

function resolveRequestedPath(inputPath, workspaceRoot) {
  const expanded = expandTilde(inputPath);
  if (path.isAbsolute(expanded)) {
    return path.resolve(expanded);
  }
  const baseDir = workspaceRoot || process.cwd();
  return path.resolve(baseDir, expanded);
}

async function assertReadablePath(policy, targetPath) {
  const canonicalPath = await canonicalizeTargetPath(targetPath);
  if (!isPathWithin(policy.opengoatReadRoot, canonicalPath)) {
    throw new Error(
      `Read denied for ${canonicalPath}. Allowed root: ${policy.opengoatReadRoot}`,
    );
  }
  return canonicalPath;
}

async function assertWritablePath(policy, targetPath) {
  const canonicalPath = await canonicalizeTargetPath(targetPath);
  if (isPathWithin(policy.organizationRoot, canonicalPath)) {
    return canonicalPath;
  }
  if (policy.workspaceRoot && isPathWithin(policy.workspaceRoot, canonicalPath)) {
    return canonicalPath;
  }

  const allowedRoots = [policy.organizationRoot];
  if (policy.workspaceRoot) {
    allowedRoots.push(policy.workspaceRoot);
  }
  throw new Error(
    `Write denied for ${canonicalPath}. Allowed roots: ${allowedRoots.join(", ")}`,
  );
}

async function canonicalizeTargetPath(targetPath) {
  const absoluteTarget = path.resolve(targetPath);
  const existingAncestor = await findNearestExistingAncestor(absoluteTarget);
  const canonicalAncestor = await fs.realpath(existingAncestor);
  const suffix = path.relative(existingAncestor, absoluteTarget);
  return path.resolve(canonicalAncestor, suffix);
}

async function findNearestExistingAncestor(targetPath) {
  let probe = path.resolve(targetPath);
  while (true) {
    try {
      await fs.lstat(probe);
      return probe;
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
      const parent = path.dirname(probe);
      if (parent === probe) {
        return probe;
      }
      probe = parent;
    }
  }
}

async function canonicalizeExistingPath(targetPath) {
  try {
    return await fs.realpath(targetPath);
  } catch (error) {
    if (isNotFound(error)) {
      return path.resolve(targetPath);
    }
    throw error;
  }
}

function isPathWithin(rootPath, candidatePath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (relative.length === 0) {
    return true;
  }
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readRequiredString(raw, key) {
  const record = asRecord(raw);
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }
  return value;
}

function readOptionalString(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalPositiveInteger(raw, key) {
  const record = asRecord(raw);
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function readOptionalBoolean(raw, key) {
  const record = asRecord(raw);
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean.`);
  }
  return value;
}

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while (true) {
    const next = text.indexOf(needle, offset);
    if (next < 0) {
      return count;
    }
    count += 1;
    offset = next + needle.length;
  }
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function expandTilde(inputPath) {
  if (!inputPath.startsWith("~")) {
    return inputPath;
  }
  if (inputPath === "~") {
    return os.homedir();
  }
  return path.join(os.homedir(), inputPath.slice(2));
}

function isNotFound(error) {
  return Boolean(error) && typeof error === "object" && error.code === "ENOENT";
}
