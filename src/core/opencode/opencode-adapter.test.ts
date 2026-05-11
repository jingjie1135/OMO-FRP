import { describe, expect, it } from "bun:test"
import { buildOpenCodeStartCommand } from "./opencode-adapter"

describe("OpenCode adapter", () => {
  it("builds a localhost OpenCode web start command", () => {
    const command = buildOpenCodeStartCommand({ port: 4096 })

    expect(command.command).toEqual(["opencode", "serve", "--hostname", "127.0.0.1", "--port", "4096"])
  })
})
