export interface StorageAdapter {
  readText(path: string): Promise<string | null>
  writeText(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(path: string): Promise<string[]>
  backup(path: string): Promise<string>
}
