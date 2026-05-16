import { useMemo } from "react"
import type { ManagementClient } from "../../../management-api/client"
import { ActionRunner } from "../../app/action-runner"
import { useEndpointsState } from "./use-endpoints-state"
import { EndpointsPage } from "./EndpointsPage"

export interface EndpointsPageWrapperProps {
  client: ManagementClient
}

export function EndpointsPageWrapper({ client }: EndpointsPageWrapperProps) {
  const runner = useMemo(() => new ActionRunner(), [])
  const state = useEndpointsState(client, runner)
  return (
    <EndpointsPage
      endpoints={state.endpoints}
      runtimeInfo={state.runtimeInfo}
      loading={state.loading}
      error={state.error}
      saveEndpoint={state.saveEndpoint}
      enableEndpoint={state.enableEndpoint}
      disableEndpoint={state.disableEndpoint}
      checkSafety={state.checkSafety}
      getDiagnostics={state.getDiagnostics}
      getActionStatus={state.getActionStatus}
      getActionError={state.getActionError}
    />
  )
}
