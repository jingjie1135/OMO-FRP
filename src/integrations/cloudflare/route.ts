import type { PublicRoute } from "../../core/schema"

export function createCloudflareRoute(options: {
  id: string
  toolId: string
  publicHost: string
  targetPort: number
  authRequired?: boolean
}): PublicRoute {
  return {
    id: options.id,
    toolId: options.toolId,
    provider: "cloudflare",
    publicHost: options.publicHost,
    targetHost: "127.0.0.1",
    targetPort: options.targetPort,
    authRequired: options.authRequired ?? true,
    status: "planned",
  }
}
