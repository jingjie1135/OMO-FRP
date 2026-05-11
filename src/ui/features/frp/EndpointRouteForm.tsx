export interface EndpointRouteDraft {
  serverAddr: string
  serverPort: number
  tokenRef: string
  localPort: number
  subdomain?: string
  customDomain?: string
}

export function EndpointRouteForm(draft: EndpointRouteDraft): string {
  return `endpoint-route:${draft.serverAddr}:${draft.serverPort}:${draft.localPort}`
}
