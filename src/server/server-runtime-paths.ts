import { join, posix, resolve } from "node:path"

export interface ServerRuntimePaths {
  root: string
  configDirectory: string
  logDirectory: string
  stateDirectory: string
  appConfigPath: string
  jobsPath: string
  processStatePath: string
}

export interface CreateServerRuntimePathsOptions {
  root?: string
}

export function createServerRuntimePaths(options: CreateServerRuntimePathsOptions = {}): ServerRuntimePaths {
  const requestedRoot = options.root ?? process.env.OPENCODE_REMOTE_STATE_ROOT ?? "/opt/opencode-remote-platform"
  const root = requestedRoot.startsWith("/") ? posix.resolve(requestedRoot) : resolve(requestedRoot)
  const joinRuntimePath = requestedRoot.startsWith("/") ? posix.join : join
  const configDirectory = joinRuntimePath(root, "config")
  const logDirectory = joinRuntimePath(root, "logs")
  const stateDirectory = joinRuntimePath(root, "state")

  return {
    root,
    configDirectory,
    logDirectory,
    stateDirectory,
    appConfigPath: joinRuntimePath(configDirectory, "app-config.json"),
    jobsPath: joinRuntimePath(stateDirectory, "jobs.jsonl"),
    processStatePath: joinRuntimePath(stateDirectory, "processes.json"),
  }
}
