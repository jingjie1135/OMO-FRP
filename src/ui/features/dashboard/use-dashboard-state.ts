import { useCallback, useEffect, useRef, useState } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { DashboardViewModel, LoadDashboardViewModel } from "./dashboard-view-model"
import { loadDashboardViewModel } from "./dashboard-view-model"

export interface DashboardState {
  dashboard: DashboardViewModel | null
  isLoading: boolean
  isRefreshing: boolean
  errorMessage: string | null
  lastUpdated: Date | null
  refresh(): Promise<void>
}

export function useDashboardState(client: ManagementClient, loader: LoadDashboardViewModel = loadDashboardViewModel): DashboardState {
  const [dashboard, setDashboard] = useState<DashboardViewModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const latestRequestId = useRef(0)
  const mounted = useRef(false)

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      const requestId = latestRequestId.current + 1
      latestRequestId.current = requestId
      const isCurrentRequest = () => mounted.current && latestRequestId.current === requestId

      if (mode === "initial") {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const nextDashboard = await loader(client)
        if (!isCurrentRequest()) {
          return
        }
        setDashboard(nextDashboard)
        setLastUpdated(new Date())
        setErrorMessage(null)
      } catch (error: unknown) {
        if (!isCurrentRequest()) {
          return
        }
        setErrorMessage(error instanceof Error ? error.message : "主控台数据加载失败。")
      } finally {
        if (!isCurrentRequest()) {
          return
        }
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [client, loader],
  )

  useEffect(() => {
    mounted.current = true
    void load("initial")
    return () => {
      mounted.current = false
      latestRequestId.current += 1
    }
  }, [load])

  return {
    dashboard,
    isLoading,
    isRefreshing,
    errorMessage,
    lastUpdated,
    refresh: () => load(dashboard ? "refresh" : "initial"),
  }
}
