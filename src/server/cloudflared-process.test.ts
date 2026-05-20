import { expect, test } from "bun:test"
import { extractTryCloudflareUrl } from "./cloudflared-process"

test("extracts trycloudflare public URL from cloudflared output", () => {
  const output = "INF Requesting new quick Tunnel on trycloudflare.com\nhttps://alpha-beta.trycloudflare.com"

  expect(extractTryCloudflareUrl(output)).toBe("https://alpha-beta.trycloudflare.com")
})
