import { describe, expect, it } from "bun:test"
import { createServerManagementClient } from "./server-management-client"

describe("server management client", () => {
  it("loads runtime info from HTTP API", async () => {
    const client = createServerManagementClient({
      fetch: async () => new Response(JSON.stringify({ capabilities: { mode: "server" } }), { status: 200 }),
      baseUrl: "http://127.0.0.1:4098",
    })

    const info = await client.getRuntimeInfo()
    expect(info.capabilities.mode).toBe("server")
  })
})
