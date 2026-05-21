import { expect, test } from "bun:test"
import { createCloudflaredProcessController, extractTryCloudflareUrl } from "./cloudflared-process"

test("extracts trycloudflare public URL from cloudflared output", () => {
  const output = "INF Requesting new quick Tunnel on trycloudflare.com\nhttps://alpha-beta.trycloudflare.com"

  expect(extractTryCloudflareUrl(output)).toBe("https://alpha-beta.trycloudflare.com")
})

test("starts a managed quick tunnel process and captures its public URL", async () => {
  const controller = createCloudflaredProcessController({
    command: process.platform === "win32" ? "cmd.exe" : "sh",
    argsForUrl: () => [
      process.platform === "win32" ? "/C" : "-c",
      process.platform === "win32" ? "echo INF Requesting new quick Tunnel on trycloudflare.com 1>&2 & echo https://alpha-beta.trycloudflare.com" : "echo 'INF Requesting new quick Tunnel on trycloudflare.com' >&2; echo https://alpha-beta.trycloudflare.com",
    ],
    now: () => new Date("2026-05-21T00:00:00.000Z"),
    urlTimeoutMs: 1_000,
    stopTimeoutMs: 100,
    maxLogLines: 1,
  })

  try {
    const result = await controller.startQuickTunnel("http://127.0.0.1:4096")
    const status = controller.status()
    const logs = controller.logs()

    expect(result).toEqual({ ok: true, publicUrl: "https://alpha-beta.trycloudflare.com", message: "Cloudflare quick tunnel is running at https://alpha-beta.trycloudflare.com." })
    expect(status).toEqual({ running: true, publicUrl: "https://alpha-beta.trycloudflare.com" })
    expect(logs).toHaveLength(1)
    expect(logs.some((line) => line.message.includes("trycloudflare.com"))).toBe(true)
  } finally {
    await controller.stop()
  }
})

test("stops the child process when cloudflared never reports a public URL", async () => {
  const controller = createCloudflaredProcessController({
    command: process.execPath,
    argsForUrl: () => [
      "--eval",
      "setTimeout(() => {}, 5000)",
    ],
    urlTimeoutMs: 50,
    stopTimeoutMs: 50,
  })

  const result = await controller.startQuickTunnel("http://127.0.0.1:4096")
  const status = controller.status()

  expect(result).toEqual({ ok: false, message: "Timed out waiting for cloudflared to report a trycloudflare URL." })
  expect(status).toEqual({ running: false, publicUrl: undefined })
})
