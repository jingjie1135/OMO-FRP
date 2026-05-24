import type { ManagementClient } from "../../../management-api/client"
import type { FrpStatus, LogLine, RuntimeInfo } from "../../../management-api/types"

export interface DashboardViewModel {
  runtimeInfo: RuntimeInfo
  frpStatus: FrpStatus
  logs: LogLine[]
}

export type LoadDashboardViewModel = (client: ManagementClient) => Promise<DashboardViewModel>

export async function loadDashboardViewModel(client: ManagementClient): Promise<DashboardViewModel> {
  const runtimeInfo = await client.getRuntimeInfo()
  const frpStatus = await client.getFrpStatus()
  const firstTool = runtimeInfo.config.toolInstances[0]
  const logs = firstTool ? await client.getToolLogs(firstTool.id) : []

  return { runtimeInfo, frpStatus, logs }
}
