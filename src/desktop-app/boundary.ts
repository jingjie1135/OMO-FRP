export interface DesktopAppBoundary {
  readonly owns: ["tauri-ui", "local-detection", "frp-client", "health-display"]
  readonly callsCoreOnly: true
}

export const desktopAppBoundary: DesktopAppBoundary = {
  owns: ["tauri-ui", "local-detection", "frp-client", "health-display"],
  callsCoreOnly: true,
}
