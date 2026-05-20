import { createServer } from "node:http"
import { expect, test } from "bun:test"
import { createFrpPanelClient } from "./frp-panel-client"

test("reports frp-panel healthy when HTTP endpoint responds", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" })
    response.end("ok")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("HTTP test server did not expose a TCP port")
  }

  try {
    const client = createFrpPanelClient({ baseUrl: `http://127.0.0.1:${address.port}` })
    await expect(client.health()).resolves.toEqual({ reachable: true, status: 200 })
  } finally {
    server.close()
  }
})
