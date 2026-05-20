export function extractTryCloudflareUrl(output: string): string | undefined {
  return output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0]
}
