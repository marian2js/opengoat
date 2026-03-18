import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function loadOrCreateGatewayToken(tokenPath: string): Promise<string> {
  try {
    const current = (await readFile(tokenPath, "utf8")).trim();
    if (current) {
      return current;
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const token = randomBytes(32).toString("base64url");
  await mkdir(dirname(tokenPath), { recursive: true, mode: 0o700 });
  await writeFile(tokenPath, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(tokenPath, 0o600);
  return token;
}
