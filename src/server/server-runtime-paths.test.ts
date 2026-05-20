import { expect, test } from "bun:test"
import { createServerRuntimePaths } from "./server-runtime-paths"

test("uses OPENCODE_REMOTE_STATE_ROOT for config, logs, and state paths", () => {
  const paths = createServerRuntimePaths({ root: "/srv/omo-frp" })

  expect(paths.root).toBe("/srv/omo-frp")
  expect(paths.configDirectory).toBe("/srv/omo-frp/config")
  expect(paths.logDirectory).toBe("/srv/omo-frp/logs")
  expect(paths.stateDirectory).toBe("/srv/omo-frp/state")
  expect(paths.appConfigPath).toBe("/srv/omo-frp/config/app-config.json")
  expect(paths.jobsPath).toBe("/srv/omo-frp/state/jobs.jsonl")
})
