import type { RuntimeExecutor } from "../management-api/runtime-executor"
import type { ToolDetection } from "../management-api/types"

export interface ServerRuntimeExecutorOptions {
  opencodeUrl?: string
}

export function createServerRuntimeExecutor(options: ServerRuntimeExecutorOptions = {}): RuntimeExecutor {
  const opencodeUrl = options.opencodeUrl ?? process.env.OPENCODE_INTERNAL_URL ?? "http://opencode:4096"

  return {
    async detectTools(): Promise<ToolDetection[]> {
      return [{
        kind: "opencode",
        displayName: "OpenCode",
        detected: await isHttpReachable(opencodeUrl),
        binaryPath: "opencode",
        configDirectory: process.env.OPENCODE_CONFIG_DIR ?? "/config",
      }]
    },
    async installTool(request) {
      return { jobId: `install:${request.kind}`, status: "failed", message: "Server runtime installs tools through Docker images." }
    },
    async startTool(instanceId) {
      return { jobId: `start:${instanceId}`, status: "failed", message: "OpenCode container start is not enabled for this runtime yet." }
    },
    async stopTool(instanceId) {
      return { jobId: `stop:${instanceId}`, status: "failed", message: "OpenCode container stop is not enabled for this runtime yet." }
    },
    async restartTool(instanceId) {
      return { jobId: `restart:${instanceId}`, status: "failed", message: "OpenCode container restart is not enabled for this runtime yet." }
    },
    async getToolLogs() { return [] },
    async getFrpStatus() { return { mode: "server", running: false, message: "FRP status integration is not connected yet." } },
    async saveFrpConfig() {},
    async startFrp() { return { jobId: "start-frp:server", status: "failed", message: "FRP server execution is not connected yet." } },
    async stopFrp() { return { jobId: "stop-frp:server", status: "failed", message: "FRP server execution is not connected yet." } },
    async getCloudflareTunnelStatus() { return { mode: "unavailable", running: false, message: "Cloudflare runtime is not connected yet." } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { throw new Error("Cloudflare plan integration is not connected yet") },
    async startCloudflareTunnel() { return { jobId: "start-cloudflare:server", status: "failed", message: "Cloudflare execution is not connected yet." } },
    async stopCloudflareTunnel() { return { jobId: "stop-cloudflare:server", status: "failed", message: "Cloudflare execution is not connected yet." } },
    async retryCloudflareTunnelStep(stepId) {
      return { jobId: `retry-cloudflare:${stepId}`, status: "failed", message: "Cloudflare retry is not connected yet." }
    },
  }
}

async function isHttpReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET" })
    return response.ok || response.status === 401 || response.status === 403
  } catch {
    return false
  }
}
