export interface FileSystemPort {
  ensureDir(path: string): Promise<void>;
  removeDir(path: string): Promise<void>;
  copyDir(sourcePath: string, targetPath: string): Promise<void>;
  createSymbolicLink(targetPath: string, linkPath: string): Promise<void>;
  readSymbolicLink(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectories(path: string): Promise<string[]>;
}
