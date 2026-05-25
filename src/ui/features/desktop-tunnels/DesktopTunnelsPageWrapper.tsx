import type { ManagementClient } from "../../../management-api/client"
import type { DesktopTunnelDevice } from "../../../management-api/types"
import { DesktopTunnelsPage } from "./DesktopTunnelsPage"
import { useDesktopTunnelsState } from "./use-desktop-tunnels-state"

export interface DesktopTunnelsPageWrapperProps {
  client: ManagementClient
  initialDevices?: DesktopTunnelDevice[]
}

export function DesktopTunnelsPageWrapper({ client, initialDevices }: DesktopTunnelsPageWrapperProps) {
  const state = useDesktopTunnelsState(client, initialDevices)
  return <DesktopTunnelsPage devices={state.devices} loading={state.loading} error={state.error} refresh={state.refresh} deleteDevice={state.deleteDevice} copyUrl={copyUrl} />
}

async function copyUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url)
}
