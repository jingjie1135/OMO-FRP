import React, { useMemo } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { FrpStatus, PublicEndpoint, RuntimeInfo } from "../../../management-api/types"
import { ActionRunner } from "../../app/action-runner"
import { FrpPage } from "./FrpPage"
import { useFrpState } from "./use-frp-state"

export interface FrpPageWrapperProps {
  client: ManagementClient
  initialRuntimeInfo?: RuntimeInfo
  initialStatus?: FrpStatus
  initialEndpoints?: PublicEndpoint[]
}

export function FrpPageWrapper({ client, initialRuntimeInfo, initialStatus, initialEndpoints }: FrpPageWrapperProps) {
  const runner = useMemo(() => new ActionRunner(), [])
  const state = useFrpState(client, runner, {
    runtimeInfo: initialRuntimeInfo,
    status: initialStatus,
    endpoints: initialEndpoints,
  })

  return (
    <FrpPage
      capabilities={state.runtimeInfo?.capabilities ?? {
        mode: state.status?.mode === "client" ? "desktop" : "server",
        canManageFrpServer: state.status?.mode === "server",
        canManageFrpClient: state.status?.mode === "client",
        canInstallServerServices: false,
        canAccessLocalFilesystem: false,
        canManageSystemd: false,
        canManageLocalProcesses: false,
      }}
      status={state.status ?? { mode: "unavailable", running: false, message: "FRP status is loading." }}
      endpoints={state.endpoints}
      runtimeInfo={state.runtimeInfo}
      serverConfig={state.serverConfig}
      clientConfig={state.clientConfig}
      loading={state.loading}
      error={state.error}
      saveServerConfig={state.saveServerConfig}
      saveClientConfig={state.saveClientConfig}
      startFrp={state.startFrp}
      stopFrp={state.stopFrp}
      getActionStatus={state.getActionStatus}
      getActionError={state.getActionError}
    />
  )
}
