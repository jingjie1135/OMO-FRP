import { describe, expect, it } from "bun:test"
import { MemoryStorage } from "../storage/memory-storage"
import { findOhMyOpenAgentConfigPath, listOhMyOpenAgentPresetPaths } from "./config-paths"
import { applyPresetToActiveConfig } from "./preset-service"

describe("oh-my-openagent presets", () => {
  it("backs up active config before applying a preset", async () => {
    const storage = new MemoryStorage({
      "/opencode/oh-my-openagent.json": "{\"agents\":{}}",
      "/opencode/oh-my-openagent.preset-fast.json": "{\"agents\":{\"hephaestus\":{}}}",
    })

    await applyPresetToActiveConfig(storage, {
      activePath: "/opencode/oh-my-openagent.json",
      presetPath: "/opencode/oh-my-openagent.preset-fast.json",
      timestamp: "2026-05-11T120000",
    })

    expect(await storage.readText("/opencode/oh-my-openagent.json")).toBe("{\"agents\":{\"hephaestus\":{}}}")
    expect(await storage.readText("/opencode/oh-my-openagent.json.2026-05-11T120000.backup")).toBe("{\"agents\":{}}")
  })

  it("detects active config and preset paths", async () => {
    const storage = new MemoryStorage({
      "/opencode/oh-my-opencode.jsonc": "{}",
      "/opencode/oh-my-openagent.preset-fast.json": "{}",
      "/opencode/oh-my-openagent.preset-safe.json": "{}",
    })

    expect(await findOhMyOpenAgentConfigPath(storage, "/opencode")).toBe("/opencode/oh-my-opencode.jsonc")
    expect(await listOhMyOpenAgentPresetPaths(storage, "/opencode")).toEqual([
      "/opencode/oh-my-openagent.preset-fast.json",
      "/opencode/oh-my-openagent.preset-safe.json",
    ])
  })
})
