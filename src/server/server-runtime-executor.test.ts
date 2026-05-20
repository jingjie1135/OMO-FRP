import { expect, test } from "bun:test"
import { createServer } from "node:http"
import { createServerRuntimeExecutor } from "./server-runtime-executor"

test("detects OpenCode as running when health endpoint responds", async () => {
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
    const executor = createServerRuntimeExecutor({
      opencodeUrl: `http://127.0.0.1:${address.port}`,
    })

    const detections = await executor.detectTools()

    expect(detections.some((tool) => tool.kind === "opencode" && tool.detected)).toBe(true)
  } finally {
    server.close()
  }
})
