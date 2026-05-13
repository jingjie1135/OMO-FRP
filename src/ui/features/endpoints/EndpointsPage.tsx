import type { PublicEndpoint } from "../../../core/app-config/types"
import { validateEndpoint } from "../../../core/endpoints/endpoint-service"

export interface EndpointsPageState {
  endpoints: PublicEndpoint[]
  loading?: boolean
  error?: string
}

export function EndpointsPage(state: EndpointsPageState): string {
  if (state.loading) {
    return "endpoints:loading"
  }

  if (state.error) {
    return `endpoints:error:${state.error}`
  }

  if (state.endpoints.length === 0) {
    return "endpoints:empty"
  }

  return state.endpoints
    .map((endpoint) => {
      const validation = validateEndpoint({ ...endpoint, status: endpoint.status === "active" ? "active" : endpoint.status })
      const validationState = validation.ok ? "ok" : validation.issues.map((issue) => issue.code).join(",")
      return `${endpoint.name}:${endpoint.status}:${endpoint.targetType}:${validationState}`
    })
    .join("\n")
}
