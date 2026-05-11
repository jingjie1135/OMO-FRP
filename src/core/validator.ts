import type { AppConfig, PublicRoute } from "./schema"

export interface ValidationIssue {
  code: string
  message: string
  path: string
  severity: "error" | "warning"
}

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return duplicates
}

function routeEndpoint(route: PublicRoute): string {
  return `${route.provider}:${route.publicHost}:${route.targetHost}:${route.targetPort}`
}

export function validateAppConfig(config: AppConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const toolIds = new Set(config.tools.map((tool) => tool.id))
  const secretIds = new Set(config.secrets.map((secret) => secret.id))

  for (const id of duplicateValues(config.tools.map((tool) => tool.id))) {
    issues.push({ code: "duplicate-tool-id", message: `Tool id '${id}' is duplicated.`, path: "tools", severity: "error" })
  }

  for (const id of duplicateValues(config.routes.map((route) => route.id))) {
    issues.push({ code: "duplicate-route-id", message: `Route id '${id}' is duplicated.`, path: "routes", severity: "error" })
  }

  for (const endpoint of duplicateValues(config.routes.map(routeEndpoint))) {
    issues.push({ code: "duplicate-route-endpoint", message: `Route endpoint '${endpoint}' is duplicated.`, path: "routes", severity: "error" })
  }

  for (const route of config.routes) {
    if (!toolIds.has(route.toolId)) {
      issues.push({ code: "route-tool-missing", message: `Route '${route.id}' targets unknown tool '${route.toolId}'.`, path: `routes.${route.id}.toolId`, severity: "error" })
    }
    if (!route.authRequired) {
      issues.push({ code: "route-auth-required", message: `Route '${route.id}' cannot be enabled without route-level auth.`, path: `routes.${route.id}.authRequired`, severity: "error" })
    }
  }

  for (const plugin of config.plugins) {
    if (!toolIds.has(plugin.toolId)) {
      issues.push({ code: "plugin-tool-missing", message: `Plugin '${plugin.kind}' targets unknown tool '${plugin.toolId}'.`, path: `plugins.${plugin.kind}.toolId`, severity: "error" })
    }
  }

  for (const tool of config.tools) {
    if (tool.auth.required && !tool.auth.passwordRef) {
      issues.push({ code: "tool-password-missing", message: `Tool '${tool.id}' requires auth but has no password SecretRef.`, path: `tools.${tool.id}.auth.passwordRef`, severity: "error" })
    }
    if (tool.auth.passwordRef && !secretIds.has(tool.auth.passwordRef.id)) {
      issues.push({ code: "tool-secret-missing", message: `Tool '${tool.id}' references unknown secret '${tool.auth.passwordRef.id}'.`, path: `tools.${tool.id}.auth.passwordRef`, severity: "error" })
    }
  }

  if (config.frp.server && !secretIds.has(config.frp.server.tokenRef.id)) {
    issues.push({ code: "frp-server-secret-missing", message: `FRP server references unknown secret '${config.frp.server.tokenRef.id}'.`, path: "frp.server.tokenRef", severity: "error" })
  }

  for (const client of config.frp.clients) {
    if (!secretIds.has(client.tokenRef.id)) {
      issues.push({ code: "frp-client-secret-missing", message: `FRP client references unknown secret '${client.tokenRef.id}'.`, path: "frp.clients.tokenRef", severity: "error" })
    }
    for (const proxy of client.proxies) {
      if (!config.routes.some((route) => route.id === proxy.routeId)) {
        issues.push({ code: "frp-proxy-route-missing", message: `FRP proxy references unknown route '${proxy.routeId}'.`, path: "frp.clients.proxies.routeId", severity: "error" })
      }
    }
  }

  return issues
}
