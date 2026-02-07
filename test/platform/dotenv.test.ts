import { writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDotEnv, parseDotEnv } from "../../packages/core/src/platform/node/dotenv.js";
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

describe("dotenv support", () => {
  it("parses dotenv content with comments, export, and quoted values", () => {
    const parsed = parseDotEnv(`
# comment
export OPENAI_API_KEY=sk-test
OPENAI_MODEL="gpt-4.1-mini"
GROK_BASE_URL='https://api.x.ai/v1'
EMPTY=
INVALID_LINE
`);

    expect(parsed).toEqual({
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-4.1-mini",
      GROK_BASE_URL: "https://api.x.ai/v1",
      EMPTY: ""
    });
  });

  it("loads .env from cwd without overriding existing process env values", async () => {
    const root = await createTempDir("opengoat-dotenv-");
    roots.push(root);

    await writeFile(
      path.join(root, ".env"),
      ["OPENAI_API_KEY=from-file", "OPENAI_MODEL=from-file", "GROK_MODEL=grok-4"].join("\n") + "\n",
      "utf8"
    );

    const env: NodeJS.ProcessEnv = {
      OPENAI_MODEL: "from-process"
    };

    await loadDotEnv({ cwd: root, env });

    expect(env.OPENAI_API_KEY).toBe("from-file");
    expect(env.OPENAI_MODEL).toBe("from-process");
    expect(env.GROK_MODEL).toBe("grok-4");
  });
});
