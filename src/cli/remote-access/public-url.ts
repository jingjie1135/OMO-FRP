import type { NormalizedRemoteAccessOptions } from "./types"

export function buildPublicUrl(options: Pick<NormalizedRemoteAccessOptions, "panelUrl" | "subdomain" | "customDomain" | "remotePort" | "https">): string {
  const scheme = options.https ? "https" : "http"

  if (options.customDomain) {
    return `${scheme}://${options.customDomain}`
  }

  const panel = new URL(options.panelUrl)

  if (options.remotePort !== undefined) {
    return `${scheme}://${panel.hostname}:${options.remotePort}`
  }

  const host = options.subdomain ? `${options.subdomain}.${panel.hostname}` : panel.hostname
  return `${scheme}://${host}`
}
