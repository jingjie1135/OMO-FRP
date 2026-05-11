import type { PublicEndpoint } from "../../../core/app-config/types"

export function EndpointsPage(endpoints: PublicEndpoint[]): string {
  return `endpoints:${endpoints.length}`
}
