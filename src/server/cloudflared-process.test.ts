import { expect, test } from "bun:test"
import { createCloudflaredProcessController, extractTryCloudflareUrl } from "./cloudflared-process"

test("extracts trycloudflare public URL from cloudflared output", () => {
  const output = "INF Requesting new quick Tunnel on trycloudflare.com\nhttps://alpha-beta.trycloudflare.com"

  expect(extractTryCloudflareUrl(output)).toBe("https://alpha-beta.trycloudflare.com")
})

test("starts a managed quick tunnel process and captures its public URL", async () => {
  const controller = createCloudflaredProcessController({
    command: process.execPath,
    argsForUrl: () => [
      "--eval",
      "setTimeout(() => { console.error('INF Requesting new quick Tunnel on trycloudflare.com'); console.log('https://alpha-beta.trycloudflare.com') }, 10); setInterval(() => {}, 1000)",
    ],
    now: () => new Date("2026-05-21T00:00:00.000Z"),
    urlTimeoutMs: 1_000,
    stopTimeoutMs: 100,
  })

  try {
    const result = await controller.startQuickTunnel("http://127.0.0.1:4096")
    const status = controller.status()
    const logs = controller.logs()

    expect(result).toEqual({ ok: true, publicUrl: "https://alpha-beta.trycloudflare.com", message: "Cloudflare quick tunnel is running at https://alpha-beta.trycloudflare.com." })
    expect(status).toEqual({ running: true, publicUrl: "https://alpha-beta.trycloudflare.com" })
    expect(logs.some((line) => line.message.includes("trycloudflare.com"))).toBe(true)
  } finally {
    await controller.stop()
  }
})
