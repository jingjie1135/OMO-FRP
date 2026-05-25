import { useCallback, useEffect, useRef, useState } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { DesktopTunnelDevice } from "../../../management-api/types"

export interface DesktopTunnelsState {
  devices: DesktopTunnelDevice[]
  loading: boolean
  error?: string
  refresh(): Promise<void>
  deleteDevice(deviceId: string): Promise<void>
}

export function useDesktopTunnelsState(client: ManagementClient, initialDevices?: DesktopTunnelDevice[]): DesktopTunnelsState {
  const [devices, setDevices] = useState<DesktopTunnelDevice[]>(initialDevices ?? [])
  const [loading, setLoading] = useState(initialDevices === undefined)
  const [error, setError] = useState<string | undefined>()
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const nextDevices = await client.listDesktopTunnelDevices()
      if (mounted.current) {
        setDevices(nextDevices)
        setError(undefined)
      }
    } catch (refreshError) {
      if (mounted.current) setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (initialDevices === undefined) void refresh()
  }, [initialDevices, refresh])

  const deleteDevice = useCallback(async (deviceId: string) => {
    await client.deleteDesktopTunnelDevice(deviceId)
    await refresh()
  }, [client, refresh])

  return { devices, loading, error, refresh, deleteDevice }
}
