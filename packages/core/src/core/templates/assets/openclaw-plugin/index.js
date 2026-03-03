"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const DEFAULT_MAX_READ_BYTES = 200_000;
const MAX_READ_BYTES_LIMIT = 1_000_000;
const COMMAND_TIMEOUT_MS = 120_000;

module.exports = function register(api) {
  api.registerTool((ctx) => createReadTool(api, ctx), {
    names: ["opengoat_read"],
  });
  api.registerTool((ctx) => createWriteTool(api, ctx), {
    names: ["opengoat_write"],
  });
  api.registerTool((ctx) => createEditTool(api, ctx), {
    names: ["opengoat_edit"],
  });

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_list",
      description: "List OpenGoat agents.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      buildArgs: () => ["agent", "list"],
      parse: (stdout) => parseAgentList(stdout),
      }),
    { names: ["opengoat_agent_list"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_info",
      description: "Get organization metadata for one OpenGoat agent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          agentId: { type: "string" },
        },
        required: ["agentId"],
      },
      buildArgs: (params) => ["agent", "info", readRequiredString(params, "agentId")],
      parse: (stdout) => parseAgentInfo(stdout),
      }),
    { names: ["opengoat_agent_info"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_direct_reportees",
      description: "List direct reportee IDs for one OpenGoat agent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          agentId: { type: "string" },
        },
        required: ["agentId"],
      },
      buildArgs: (params) => [
        "agent",
        "direct-reportees",
        readRequiredString(params, "agentId"),
      ],
      parse: (stdout) => parseStringLines(stdout),
      }),
    { names: ["opengoat_agent_direct_reportees"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_all_reportees",
      description: "List recursive reportee IDs for one OpenGoat agent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          agentId: { type: "string" },
        },
        required: ["agentId"],
      },
      buildArgs: (params) => [
        "agent",
        "all-reportees",
        readRequiredString(params, "agentId"),
      ],
      parse: (stdout) => parseStringLines(stdout),
      }),
    { names: ["opengoat_agent_all_reportees"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_last_action",
      description: "Get last recorded AI action timestamp for an OpenGoat agent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          agentId: { type: "string" },
        },
      },
      buildArgs: (params) => {
        const args = ["agent", "last-action"];
        const agentId = readOptionalString(params.agentId);
        if (agentId) {
          args.push(agentId);
        }
        args.push("--json");
        return args;
      },
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_agent_last_action"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_create",
      description: "Create an OpenGoat agent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["manager", "individual"] },
          role: { type: "string" },
          reportsTo: { type: "string" },
          skills: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["name"],
      },
      buildArgs: (params) => {
        const args = ["agent", "create", readRequiredString(params, "name")];
        const type = readOptionalString(params.type);
        if (type === "manager") {
          args.push("--manager");
        }
        if (type === "individual") {
          args.push("--individual");
        }
        const role = readOptionalString(params.role);
        if (role) {
          args.push("--role", role);
        }
        const reportsTo = readOptionalString(params.reportsTo);
        if (reportsTo) {
          args.push("--reports-to", reportsTo);
        }
        for (const skillId of readStringArray(params.skills)) {
          args.push("--skill", skillId);
        }
        return args;
      },
      parse: (stdout) => ({ ok: true, output: stdout.trim() }),
      }),
    { names: ["opengoat_agent_create"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_delete",
      description: "Delete an OpenGoat agent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          agentId: { type: "string" },
          force: { type: "boolean" },
        },
        required: ["agentId"],
      },
      buildArgs: (params) => {
        const args = ["agent", "delete", readRequiredString(params, "agentId")];
        if (readOptionalBoolean(params, "force") === true) {
          args.push("--force");
        }
        return args;
      },
      parse: (stdout) => ({ ok: true, output: stdout.trim() }),
      }),
    { names: ["opengoat_agent_delete"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_agent_set_manager",
      description: "Assign an OpenGoat manager relationship.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          agentId: { type: "string" },
          managerId: { type: "string" },
        },
        required: ["agentId"],
      },
      buildArgs: (params) => [
        "agent",
        "set-manager",
        readRequiredString(params, "agentId"),
        readOptionalString(params.managerId) || "none",
      ],
      parse: (stdout) => ({ ok: true, output: stdout.trim() }),
      }),
    { names: ["opengoat_agent_set_manager"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_create",
      description: "Create an OpenGoat task.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actorId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          assignedTo: { type: "string" },
          status: { type: "string" },
          dueDate: { type: "string" },
        },
        required: ["actorId", "title", "description"],
      },
      buildArgs: (params) => {
        const args = [
          "task",
          "create",
          "--owner",
          readRequiredString(params, "actorId"),
          "--title",
          readRequiredString(params, "title"),
          "--description",
          readRequiredString(params, "description"),
          "--json",
        ];
        const assignedTo = readOptionalString(params.assignedTo);
        if (assignedTo) {
          args.push("--assign", assignedTo);
        }
        const status = readOptionalString(params.status);
        if (status) {
          args.push("--status", status);
        }
        const dueDate = readOptionalString(params.dueDate);
        if (dueDate) {
          args.push("--due-date", dueDate);
        }
        return args;
      },
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_create"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_list",
      description: "List OpenGoat tasks.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          assignee: { type: "string" },
        },
      },
      buildArgs: (params) => {
        const args = ["task", "list", "--json"];
        const assignee = readOptionalString(params.assignee);
        if (assignee) {
          args.push("--as", assignee);
        }
        return args;
      },
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_list"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_list_latest",
      description: "List latest OpenGoat tasks.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          assignee: { type: "string" },
          limit: {
            type: "integer",
            minimum: 1,
          },
        },
      },
      buildArgs: (params) => {
        const args = ["task", "list-latest", "--json"];
        const assignee = readOptionalString(params.assignee);
        if (assignee) {
          args.push("--as", assignee);
        }
        const limit = readOptionalPositiveInteger(params, "limit");
        if (limit !== undefined) {
          args.push("--limit", String(limit));
        }
        return args;
      },
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_list_latest"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_get",
      description: "Get one OpenGoat task by id.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          taskId: { type: "string" },
        },
        required: ["taskId"],
      },
      buildArgs: (params) => [
        "task",
        "show",
        readRequiredString(params, "taskId"),
        "--json",
      ],
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_get"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_delete",
      description: "Delete an OpenGoat task.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actorId: { type: "string" },
          taskId: { type: "string" },
        },
        required: ["actorId", "taskId"],
      },
      buildArgs: (params) => [
        "task",
        "delete",
        readRequiredString(params, "taskId"),
        "--as",
        readRequiredString(params, "actorId"),
        "--json",
      ],
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_delete"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_update_status",
      description: "Update OpenGoat task status.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actorId: { type: "string" },
          taskId: { type: "string" },
          status: { type: "string" },
          reason: { type: "string" },
        },
        required: ["actorId", "taskId", "status"],
      },
      buildArgs: (params) => {
        const args = [
          "task",
          "status",
          readRequiredString(params, "taskId"),
          readRequiredString(params, "status"),
          "--as",
          readRequiredString(params, "actorId"),
          "--json",
        ];
        const reason = readOptionalString(params.reason);
        if (reason) {
          args.push("--reason", reason);
        }
        return args;
      },
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_update_status"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_add_blocker",
      description: "Add a blocker to an OpenGoat task.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actorId: { type: "string" },
          taskId: { type: "string" },
          blocker: { type: "string" },
        },
        required: ["actorId", "taskId", "blocker"],
      },
      buildArgs: (params) => [
        "task",
        "blocker",
        "add",
        readRequiredString(params, "taskId"),
        readRequiredString(params, "blocker"),
        "--as",
        readRequiredString(params, "actorId"),
        "--json",
      ],
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_add_blocker"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_add_artifact",
      description: "Add an artifact to an OpenGoat task.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actorId: { type: "string" },
          taskId: { type: "string" },
          content: { type: "string" },
        },
        required: ["actorId", "taskId", "content"],
      },
      buildArgs: (params) => [
        "task",
        "artifact",
        "add",
        readRequiredString(params, "taskId"),
        readRequiredString(params, "content"),
        "--as",
        readRequiredString(params, "actorId"),
        "--json",
      ],
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_add_artifact"] },
  );

  api.registerTool(
    (ctx) =>
      createCommandTool(api, ctx, {
      name: "opengoat_task_add_worklog",
      description: "Add a worklog entry to an OpenGoat task.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actorId: { type: "string" },
          taskId: { type: "string" },
          content: { type: "string" },
        },
        required: ["actorId", "taskId", "content"],
      },
      buildArgs: (params) => [
        "task",
        "worklog",
        "add",
        readRequiredString(params, "taskId"),
        readRequiredString(params, "content"),
        "--as",
        readRequiredString(params, "actorId"),
        "--json",
      ],
      parse: (stdout) => parseLooseJson(stdout),
      }),
    { names: ["opengoat_task_add_worklog"] },
  );
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
          [`Directory: ${canonicalPath}`, ...lines].join("\n") ||
            `Directory: ${canonicalPath}`,
        );
      }

      const maxBytes =
        readOptionalPositiveInteger(params, "maxBytes") ?? DEFAULT_MAX_READ_BYTES;
      const content = await fs.readFile(canonicalPath, "utf8");
      const bytes = Buffer.byteLength(content, "utf8");
      if (bytes <= maxBytes) {
        return textResult(content);
      }

      const truncated = Buffer.from(content, "utf8")
        .subarray(0, maxBytes)
        .toString("utf8");
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

function createCommandTool(api, ctx, config) {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    async execute(_toolCallId, params) {
      const policy = await resolvePolicy(api, ctx);
      const args = config.buildArgs(asRecord(params));
      const executed = await runOpenGoatCommand(policy, args);
      if (executed.code !== 0) {
        const details = [
          `OpenGoat command failed (exit ${executed.code}).`,
          executed.stderr.trim() || executed.stdout.trim() || "No output.",
        ]
          .filter(Boolean)
          .join(" ");
        throw new Error(details);
      }

      const parsed = config.parse(executed.stdout, executed);
      if (typeof parsed === "string") {
        return textResult(parsed);
      }
      return textResult(`${JSON.stringify(parsed, null, 2)}\n`);
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
    expandTilde(
      configuredHome || process.env.OPENGOAT_HOME || path.join(os.homedir(), ".opengoat"),
    ),
  );
  const organizationRoot = await canonicalizeExistingPath(
    path.join(opengoatHome, "organization"),
  );
  const workspaceRoot = readOptionalString(ctx.workspaceDir)
    ? await canonicalizeExistingPath(path.resolve(String(ctx.workspaceDir)))
    : null;
  const workspaceCommandPath = workspaceRoot
    ? path.join(workspaceRoot, "opengoat")
    : undefined;

  return {
    opengoatReadRoot: await canonicalizeExistingPath(opengoatHome),
    organizationRoot,
    workspaceRoot,
    workspaceCommandPath,
    // Backward compatibility: older configs may still include this key.
    opengoatCommandPath: readOptionalString(pluginConfig.opengoatCommandPath),
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
  const relative = path.relative(rootPath, candidatePath);
  if (!relative) {
    return true;
  }
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isNotFound(error) {
  return Boolean(error && typeof error === "object" && error.code === "ENOENT");
}

function expandTilde(value) {
  if (!value.startsWith("~")) {
    return value;
  }

  if (value === "~") {
    return os.homedir();
  }

  return path.join(os.homedir(), value.slice(2));
}

function countOccurrences(haystack, needle) {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let cursor = 0;
  while (true) {
    const found = haystack.indexOf(needle, cursor);
    if (found < 0) {
      return count;
    }
    count += 1;
    cursor = found + needle.length;
  }
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function readRequiredString(record, key) {
  const value = readOptionalString(record[key]);
  if (!value) {
    throw new Error(`Missing required string parameter: ${key}`);
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

function readOptionalBoolean(record, key) {
  const value = record[key];
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function readOptionalPositiveInteger(record, key) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.floor(value);
  if (normalized <= 0) {
    return undefined;
  }
  return normalized;
}

function readStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const deduped = [];
  for (const item of value) {
    const normalized = readOptionalString(item);
    if (!normalized || deduped.includes(normalized)) {
      continue;
    }
    deduped.push(normalized);
  }
  return deduped;
}

async function runOpenGoatCommand(policy, args) {
  const cwd = policy.workspaceRoot || process.cwd();
  const env = {
    ...process.env,
    OPENGOAT_HOME: policy.opengoatReadRoot,
  };
  const commandCandidates = [];
  commandCandidates.push({
    label: path.join(policy.opengoatReadRoot, "bin", "opengoat"),
    command: "sh",
    commandArgs: [path.join(policy.opengoatReadRoot, "bin", "opengoat"), ...args],
  });

  const workspaceShimPath = readOptionalString(policy.workspaceCommandPath);
  if (workspaceShimPath) {
    commandCandidates.push({
      label: workspaceShimPath,
      command: "sh",
      commandArgs: [workspaceShimPath, ...args],
    });
  }

  const legacyCommandPath = readOptionalString(policy.opengoatCommandPath);
  if (legacyCommandPath) {
    commandCandidates.push({
      label: legacyCommandPath,
      command: process.execPath,
      commandArgs: [legacyCommandPath, ...args],
    });
  }

  commandCandidates.push({
    label: "opengoat",
    command: "opengoat",
    commandArgs: args,
  });

  let lastError;
  for (const candidate of commandCandidates) {
    try {
      const result = await runCommand(candidate.command, candidate.commandArgs, {
        cwd,
        env,
        timeoutMs: COMMAND_TIMEOUT_MS,
      });
      if (
        result.code === 127 &&
        isCommandNotFoundOutput(result.stdout, result.stderr)
      ) {
        lastError = new Error(
          `${candidate.label} is not available (exit 127: command not found).`,
        );
        continue;
      }
      return result;
    } catch (error) {
      if (isSpawnMissingCommandError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Unable to locate OpenGoat command. Checked: ${commandCandidates
      .map((candidate) => candidate.label)
      .join(", ")}`,
    { cause: lastError },
  );
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`OpenGoat command timed out after ${options.timeoutMs}ms.`));
        return;
      }
      resolve({
        code: typeof code === "number" ? code : 1,
        stdout,
        stderr,
      });
    });
  });
}

function isSpawnMissingCommandError(error) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error.code === "ENOENT" || error.errno === "ENOENT"),
  );
}

function isCommandNotFoundOutput(stdout, stderr) {
  const combined = `${stdout || ""}\n${stderr || ""}`.toLowerCase();
  return (
    combined.includes("command not found") ||
    combined.includes("not found") ||
    combined.includes("no such file")
  );
}

function parseLooseJson(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Keep trying fallback parsing.
  }

  const starts = [
    trimmed.indexOf("{"),
    trimmed.lastIndexOf("{"),
    trimmed.indexOf("["),
    trimmed.lastIndexOf("["),
  ].filter((value, index, arr) => value >= 0 && arr.indexOf(value) === index);

  for (const start of starts) {
    const candidate = trimmed.slice(start).trim();
    if (!candidate) {
      continue;
    }
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue.
    }
  }

  return {
    output: trimmed,
  };
}

function parseStringLines(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseAgentList(stdout) {
  const lines = parseStringLines(stdout);
  return lines.map((line) => {
    const managerMatch =
      /^([a-z0-9-]+)\s+\(([^)]+)\)\s+\[([^\]]+)\]$/i.exec(line);
    if (managerMatch) {
      return {
        id: managerMatch[1],
        displayName: managerMatch[2],
        role: managerMatch[3],
      };
    }

    const simpleMatch = /^([a-z0-9-]+)\s+\[([^\]]+)\]$/i.exec(line);
    if (simpleMatch) {
      return {
        id: simpleMatch[1],
        role: simpleMatch[2],
      };
    }

    return { raw: line };
  });
}

function parseAgentInfo(stdout) {
  const lines = parseStringLines(stdout);
  const result = {
    id: "",
    name: "",
    role: "",
    totalReportees: 0,
    directReportees: [],
  };

  for (const line of lines) {
    if (line.startsWith("id:")) {
      result.id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("name:")) {
      result.name = line.slice(5).trim();
      continue;
    }
    if (line.startsWith("role:")) {
      result.role = line.slice(5).trim();
      continue;
    }
    if (line.startsWith("total reportees:")) {
      result.totalReportees = Number.parseInt(line.slice(16).trim(), 10) || 0;
      continue;
    }
    if (!line.startsWith("- {")) {
      continue;
    }

    const directMatch =
      /^- \{id: "([^"]+)", name: "([^"]+)", role: "([^"]+)", total reportees: (\d+)\}$/i.exec(
        line,
      );
    if (directMatch) {
      result.directReportees.push({
        id: directMatch[1],
        name: directMatch[2],
        role: directMatch[3],
        totalReportees: Number.parseInt(directMatch[4], 10) || 0,
      });
    }
  }

  return result;
}
