import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import type { FileSystemPort } from "../../core/ports/file-system.port.js";

export class NodeFileSystem implements FileSystemPort {
  public async ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public readFile(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  public writeFile(path: string, content: string): Promise<void> {
    return writeFile(path, content, "utf-8");
  }

  public async listDirectories(path: string): Promise<string[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
      if (isNotFound(error)) {
        return [];
      }
      throw error;
    }
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
