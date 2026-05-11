export interface ServerAppBoundary {
  readonly owns: ["web", "api", "auth", "audit"]
  readonly callsCoreOnly: true
}

export const serverAppBoundary: ServerAppBoundary = {
  owns: ["web", "api", "auth", "audit"],
  callsCoreOnly: true,
}
