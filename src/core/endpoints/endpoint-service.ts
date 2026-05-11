import type { PublicEndpoint } from "../app-config/types"

export interface EndpointValidationIssue {
  code: string
  message: string
  path: string
}

export interface EndpointValidationResult {
  ok: boolean
  issues: EndpointValidationIssue[]
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
