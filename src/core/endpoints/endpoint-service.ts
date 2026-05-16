import type { PublicEndpoint, RuntimeCapabilities, ToolInstance } from "../app-config/types"

export interface EndpointValidationIssue {
  code: string
  message: string
  path: string
}

export interface EndpointValidationResult {
  ok: boolean
  issues: EndpointValidationIssue[]
}

export interface EndpointSafetyContext {
  capabilities: RuntimeCapabilities
  toolInstances: ToolInstance[]
  endpoints: PublicEndpoint[]
}

export function validateEndpoint(endpoint: PublicEndpoint): EndpointValidationResult {
  const issues: EndpointValidationIssue[] = []

  if (endpoint.domain.trim() === "") {
    issues.push({ code: "endpoint-domain-required", message: "Endpoint domain is required.", path: "domain" })
  }

  if (endpoint.status === "active" && endpoint.authMode !== "both" && endpoint.authMode !== "opencode-password") {
    issues.push({
      code: "endpoint-auth-incomplete",
      message: "Active public OpenCode endpoints must include the OpenCode password gate.",
      path: "authMode",
    })
  }

  if (endpoint.status !== "disabled" && endpoint.targetType === "desktop-frp" && endpoint.protocol === "tcp" && endpoint.authMode === "basic-auth") {
    issues.push({
      code: "endpoint-tcp-basic-auth-unsupported",
      message: "TCP desktop FRP endpoints cannot rely on HTTP Basic Auth.",
      path: "authMode",
    })
  }

  return { ok: issues.length === 0, issues }
}

export function normalizeEndpointAddress(endpoint: PublicEndpoint): PublicEndpoint {
  const trimmed = endpoint.domain.trim()
  if (!trimmed) {
    return { ...endpoint, domain: "" }
  }

  try {
    const parsed = trimmed.includes("://") ? new URL(trimmed) : new URL(`${endpoint.protocol}://${trimmed}`)
    const protocol = toEndpointProtocol(parsed.protocol.replace(":", ""), endpoint.protocol)
    const domain = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname
    return { ...endpoint, protocol, domain }
  } catch {
    return { ...endpoint, domain: trimmed }
  }
}

export function formatEndpointPublicAddress(endpoint: PublicEndpoint): string {
  const normalized = normalizeEndpointAddress(endpoint)
  return `${normalized.protocol}://${normalized.domain}`
}

export function isValidEndpointAddress(endpoint: PublicEndpoint): boolean {
  const normalized = normalizeEndpointAddress(endpoint)
  if (!normalized.domain.includes(".")) return false
  if (normalized.domain.includes("_")) return false
  if (/\s/.test(normalized.domain)) return false
  try {
    const parsed = new URL(formatEndpointPublicAddress(normalized))
    return parsed.hostname.includes(".") && !parsed.hostname.includes("_")
  } catch {
    return false
  }
}

export function checkEndpointSafety(endpoint: PublicEndpoint, context: EndpointSafetyContext): EndpointValidationResult {
  const normalized = normalizeEndpointAddress({ ...endpoint, status: "active" })
  const issues = [...validateEndpoint(normalized).issues]

  if (!isValidEndpointAddress(normalized)) {
    issues.push({ code: "endpoint-address-invalid", message: "Endpoint domain or URL format is invalid.", path: "domain" })
  }

  const targetTool = context.toolInstances.find((tool) => tool.id === normalized.targetToolInstanceId)
  if (!targetTool) {
    issues.push({ code: "endpoint-target-missing", message: `Target tool ${normalized.targetToolInstanceId || "(missing)"} not found.`, path: "targetToolInstanceId" })
  } else {
    if (targetTool.status !== "running") {
      issues.push({ code: "endpoint-target-not-running", message: `Target tool ${targetTool.displayName} is not running.`, path: "targetToolInstanceId" })
    }
    if (!hasReachablePort(targetTool)) {
      issues.push({ code: "endpoint-target-port-unreachable", message: `Target tool ${targetTool.displayName} does not report a reachable local port.`, path: "targetToolInstanceId" })
    }
    if (!isAuthComplete(normalized, targetTool)) {
      issues.push({ code: "endpoint-password-missing", message: "OpenCode password/auth configuration is incomplete for this endpoint.", path: "authMode" })
    }
  }

  if (normalized.targetType === "server-local" && context.capabilities.mode !== "server") {
    issues.push({ code: "endpoint-server-local-unavailable", message: "Server-local endpoints can only be enabled from server mode.", path: "targetType" })
  }

  if (normalized.targetType === "desktop-frp" && !isFrpAvailable(context.capabilities)) {
    issues.push({ code: "endpoint-frp-unavailable", message: "FRP server/client capability is not available for desktop-frp endpoints.", path: "targetType" })
  }

  if (normalized.targetType === "cloudflare" && !isCloudflareAvailable(context.toolInstances)) {
    issues.push({ code: "endpoint-cloudflare-unavailable", message: "Cloudflare endpoints require a detected or installed cloudflared tool.", path: "targetType" })
  }

  if (context.endpoints.some((item) => item.id !== normalized.id && item.status === "active" && formatEndpointPublicAddress(item) === formatEndpointPublicAddress(normalized))) {
    issues.push({ code: "endpoint-domain-conflict", message: `Domain ${normalized.domain} is already in use by another active endpoint.`, path: "domain" })
  }

  return { ok: issues.length === 0, issues }
}

export function isEndpointTypeAvailable(targetType: PublicEndpoint["targetType"], context: Pick<EndpointSafetyContext, "capabilities" | "toolInstances">): boolean {
  if (targetType === "server-local") return context.capabilities.mode === "server"
  if (targetType === "desktop-frp") return isFrpAvailable(context.capabilities)
  return isCloudflareAvailable(context.toolInstances)
}

function toEndpointProtocol(value: string, fallback: PublicEndpoint["protocol"]): PublicEndpoint["protocol"] {
  if (value === "https" || value === "http" || value === "tcp") return value
  return fallback
}

function hasReachablePort(tool: ToolInstance): boolean {
  return typeof (tool.currentPort ?? tool.defaultPort) === "number" && (tool.currentPort ?? tool.defaultPort) > 0
}

function isAuthComplete(endpoint: PublicEndpoint, tool: ToolInstance): boolean {
  if (endpoint.authMode === "basic-auth") return false
  if (tool.kind !== "opencode") return true
  return tool.installState === "configured"
}

function isFrpAvailable(capabilities: RuntimeCapabilities): boolean {
  return capabilities.canManageFrpServer || capabilities.canManageFrpClient
}

function isCloudflareAvailable(toolInstances: ToolInstance[]): boolean {
  return toolInstances.some((tool) => tool.kind === "cloudflared" && tool.installState !== "missing")
}
