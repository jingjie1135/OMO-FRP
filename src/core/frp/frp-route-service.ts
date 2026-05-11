import type { FrpClientConfig, PublicEndpoint } from "../app-config/types"

export function createFrpClientConfigForEndpoint(endpoint: PublicEndpoint, options: Omit<FrpClientConfig, "endpointId">): FrpClientConfig {
  return {
    ...options,
    endpointId: endpoint.id,
  }
}
