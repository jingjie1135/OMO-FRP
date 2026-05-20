export interface FrpPanelClientOptions {
  baseUrl: string
}

export interface FrpPanelHealth {
  reachable: boolean
  status?: number
  message?: string
}

export function createFrpPanelClient(options: FrpPanelClientOptions) {
  return {
    async health(): Promise<FrpPanelHealth> {
      try {
        const response = await fetch(options.baseUrl, { method: "GET" })
        return { reachable: true, status: response.status }
      } catch (error) {
        return { reachable: false, message: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
