import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { createEmptyServerConfig } from "./runtime-adapter"
import { loadServerAppConfig, saveServerAppConfig } from "./server-runtime-state"

test("saves and loads server app config from disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "omo-frp-state-"))
  try {
    const path = join(root, "config", "app-config.json")
    const config = createEmptyServerConfig()
    config.toolInstances.push({
      id: "opencode-server",
      kind: "opencode",
      displayName: "OpenCode",
      hostType: "server",
      installState: "installed",
      defaultPort: 4096,
      status: "stopped",
    })

    await saveServerAppConfig(path, config)
    const loaded = await loadServerAppConfig(path)

    expect(loaded.toolInstances).toHaveLength(1)
    expect(loaded.toolInstances[0]?.id).toBe("opencode-server")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
