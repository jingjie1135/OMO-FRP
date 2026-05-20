import type { ManagementClient } from "../management-api/client"
import { createServerManagementClient } from "./api/server-management-client"
import { createTauriManagementClient, type TauriInvokeBridge } from "./api/tauri-management-client"

export interface BrowserManagementClientOptions {
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  tauri?: TauriInvokeBridge
  sessionToken?: string
}

declare global {
  interface Window {
    __TAURI__?: {
      core?: TauriInvokeBridge
    }
    __OPENCODE_MANAGEMENT_SESSION_TOKEN__?: string
  }
}

export function createBrowserManagementClient(options: BrowserManagementClientOptions = {}): ManagementClient {
  const tauri = options.tauri ?? globalThis.window?.__TAURI__?.core
  if (tauri) {
    return createTauriManagementClient(tauri)
  }

  const fetcher = options.fetch ?? ((input, init) => fetch(input, init))
  const sessionToken = options.sessionToken ?? globalThis.window?.__OPENCODE_MANAGEMENT_SESSION_TOKEN__
  return createServerManagementClient({ baseUrl: "", fetch: fetcher, sessionToken })
}
