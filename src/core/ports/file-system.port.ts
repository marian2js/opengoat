export interface FileSystemPort {
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectories(path: string): Promise<string[]>;
}
