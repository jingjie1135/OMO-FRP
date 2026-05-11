export interface CommandSpec {
  adapter: string
  executable: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface CommandExecutor {
  run(command: CommandSpec): Promise<CommandResult>
}

export function createCommandSpec(adapter: string, executable: string, args: string[], options: Omit<CommandSpec, "adapter" | "executable" | "args"> = {}): CommandSpec {
  return { adapter, executable, args, ...options }
}
