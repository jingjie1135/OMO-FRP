import React, { useMemo } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelPlan, CloudflareTunnelStatus, RuntimeInfo } from "../../../management-api/types"
import { ActionRunner } from "../../app/action-runner"
import { CloudflareTunnelPage } from "./CloudflareTunnelPage"
import { createDefaultCloudflareTunnelConfig, useCloudflareTunnelState } from "./use-cloudflare-tunnel-state"

export interface CloudflareTunnelPageWrapperProps {
  client: ManagementClient
  initialRuntimeInfo?: RuntimeInfo
  initialStatus?: CloudflareTunnelStatus
  initialPlan?: CloudflareTunnelPlan
  initialConfig?: CloudflareTunnelConfigRequest
}

export function CloudflareTunnelPageWrapper({ client, initialRuntimeInfo, initialStatus, initialPlan, initialConfig }: CloudflareTunnelPageWrapperProps) {
  const runner = useMemo(() => new ActionRunner(), [])
  const state = useCloudflareTunnelState(client, runner, {
    runtimeInfo: initialRuntimeInfo,
    status: initialStatus,
    plan: initialPlan,
    config: initialConfig,
  })

  return (
    <CloudflareTunnelPage
      runtimeInfo={state.runtimeInfo}
      status={state.status ?? { mode: "unavailable", running: false, message: "Cloudflare Tunnel status is loading." }}
      config={state.config ?? createDefaultCloudflareTunnelConfig(state.runtimeInfo)}
      plan={state.plan}
      loading={state.loading}
      error={state.error}
      saveConfig={state.saveConfig}
      startTunnel={state.startTunnel}
      stopTunnel={state.stopTunnel}
      retryStep={state.retryStep}
      getActionStatus={state.getActionStatus}
      getActionError={state.getActionError}
    />
  )
}
